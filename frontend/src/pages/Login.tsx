import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Mail, Lock, Eye, EyeOff, LogIn, LogOut, Loader } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import {
  createGuidedError,
  InlineGuidedError,
  type GuidedErrorMessage,
} from '../components/forms/GuidedError';
import { authService, type AuthError } from '../services/authService';
import { useUser } from '../context/UserContext';
import { getGooglePrefillFromIdToken } from '../utils/googleProfile';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600">
      <AlertCircle size={14} aria-hidden="true" />
      {message}
    </p>
  );
}

function normalizeTipoOrganizacion(
  value: 'COOPERATIVA' | 'COMPRAVENTA' | 'OTRO' | null | undefined,
): 'COOPERATIVA' | 'COMPRAVENTA' | 'PERSONALIZADO' | null {
  if (value === 'OTRO') {
    return 'PERSONALIZADO' as const;
  }

  return value ?? null;
}

export default function Login() {
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';
  const isGoogleAuthEnabled = Boolean(googleClientId);
  const googleButtonWidth =
    typeof window !== 'undefined'
      ? String(Math.min(360, Math.max(180, window.innerWidth - 72)))
      : '320';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null);
  const [passwordFieldError, setPasswordFieldError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleButtonMissing, setGoogleButtonMissing] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const navigate = useNavigate();
  const { setSession, token, hasCompany, hydrated } = useUser();

  useEffect(() => {
    if (!hydrated || !token) {
      return;
    }

    navigate(hasCompany ? '/inicio' : '/crear-empresa', { replace: true });
  }, [hasCompany, hydrated, navigate, token]);

  useEffect(() => {
    if (!isGoogleAuthEnabled || googleLoading) {
      return;
    }

    setGoogleButtonMissing(false);

    const timerId = window.setTimeout(() => {
      const iframe = googleButtonRef.current?.querySelector('iframe');
      setGoogleButtonMissing(!iframe);
    }, 1600);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [googleLoading, isGoogleAuthEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const hash = window.location.hash;
    if (!hash.includes('id_token=')) {
      return;
    }

    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const idToken = params.get('id_token');
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    if (idToken) {
      void handleGoogleSuccess({ credential: idToken });
    }
  }, []);

  const openGoogleRedirect = () => {
    if (!googleClientId || typeof window === 'undefined') {
      handleGoogleError();
      return;
    }

    const nonce =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : String(Date.now());
    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: window.location.origin + window.location.pathname,
      response_type: 'id_token',
      scope: 'openid email profile',
      nonce,
      prompt: 'select_account',
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setError(null);
    setEmailFieldError(null);
    setPasswordFieldError(null);
    setEmailTouched(false);
  };

  const handleExitApp = async () => {
    const capacitorApp = (window as any)?.Capacitor?.Plugins?.App;
    if (capacitorApp?.exitApp) {
      await capacitorApp.exitApp();
      return;
    }

    const electronApi = (window as any)?.electronAPI;
    if (electronApi?.closeApp) {
      electronApi.closeApp();
      return;
    }

    window.close();
    if (!window.closed) {
      resetForm();
      navigate('/login', { replace: true });
    }
  };

  const getEmailGuidance = (message: string): GuidedErrorMessage =>
    createGuidedError(
      message,
      'Revisa tu correo.',
      'El formato no es correcto o está vacío (ej: juan@correo.com).',
      'Corrige tu correo e intenta de nuevo.',
    );

  const getPasswordGuidance = (message: string): GuidedErrorMessage =>
    createGuidedError(
      message,
      'Revisa tu contraseña.',
      'Puede estar incorrecta o vacía.',
      'Escribe tu contraseña correcta.',
    );

  const getGlobalGuidance = (message: string): GuidedErrorMessage =>
    createGuidedError(
      message,
      'Problema al iniciar.',
      'Verifica tus credenciales o conexión.',
      'Revisa los datos e intenta entrar.',
    );

  const focusEmail = () => {
    emailInputRef.current?.focus();
  };

  const focusPassword = () => {
    passwordInputRef.current?.focus();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    setError(null);
    setEmailFieldError(null);
    setPasswordFieldError(null);

    let hasValidationError = false;
    let nextEmailError: string | null = null;
    let nextPasswordError: string | null = null;

    if (!email.trim()) {
      nextEmailError = 'Ingresa tu correo electrónico';
      hasValidationError = true;
    } else if (!isValidEmail(email)) {
      nextEmailError = 'Ingresa un correo electrónico válido';
      hasValidationError = true;
    }

    if (!password.trim()) {
      nextPasswordError = 'Ingresa tu contraseña';
      hasValidationError = true;
    }

    setEmailFieldError(nextEmailError);
    setPasswordFieldError(nextPasswordError);

    if (hasValidationError) {
      setError('Completa los campos para continuar');
      if (nextEmailError) {
        window.setTimeout(focusEmail, 80);
      } else if (nextPasswordError) {
        window.setTimeout(focusPassword, 80);
      }
      return;
    }

    setLoading(true);

    try {
      const data = await authService.login(email, password);
      await setSession({
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          telefono: data.user.telefono ?? null,
          organizacionId: data.user.organizacionId ?? null,
          nombreOrganizacion: data.user.nombreOrganizacion ?? null,
          tipoOrganizacion: normalizeTipoOrganizacion(data.user.tipoOrganizacion),
          otroTipoDetalle: data.user.otroTipoDetalle ?? null,
        },
        token: data.access_token,
        hasCompany: data.hasCompany,
        persist: rememberMe,
      });

      navigate(data.hasCompany ? '/inicio' : '/crear-empresa');
    } catch (err) {
      const authError = err as AuthError;
      const field = (authError.field || '').toLowerCase();
      const message = authError.message || 'No se pudo iniciar sesión. Intenta nuevamente.';
      const details = authError.details ?? {};

      const emailDetail = details.email?.[0] || details.correo?.[0];
      const passwordDetail = details.password?.[0] || details.contrasena?.[0];

      if (emailDetail || passwordDetail) {
        setPasswordFieldError('El correo o la contraseña no son correctos');
        setPassword('');
        setError(null);
        window.setTimeout(focusPassword, 80);
      } else if (field === 'email' || field === 'correo') {
        setEmailFieldError('El correo o la contraseña no son correctos');
        setError(null);
        window.setTimeout(focusEmail, 80);
      } else if (field === 'password' || field === 'contrasena') {
        setPasswordFieldError('El correo o la contraseña no son correctos');
        setPassword('');
        setError(null);
        window.setTimeout(focusPassword, 80);
      } else {
        setPasswordFieldError('El correo o la contraseña no son correctos');
        setPassword('');
        setError(null);
        window.setTimeout(focusPassword, 80);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setError(null);
    setEmailFieldError(null);
    setPasswordFieldError(null);
    setGoogleLoading(true);

    const idToken = credentialResponse?.credential;
    if (!idToken) {
      const message = 'No se pudo iniciar sesión con Google. Intenta nuevamente.';
      setError(message);
      setGoogleLoading(false);
      return;
    }

    try {
      const data = await authService.loginWithGoogle(idToken);
      await setSession({
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          telefono: data.user.telefono ?? null,
          organizacionId: data.user.organizacionId ?? null,
          nombreOrganizacion: data.user.nombreOrganizacion ?? null,
          tipoOrganizacion: normalizeTipoOrganizacion(data.user.tipoOrganizacion),
          otroTipoDetalle: data.user.otroTipoDetalle ?? null,
        },
        token: data.access_token,
        hasCompany: data.hasCompany,
        persist: rememberMe,
      });

      navigate(data.hasCompany ? '/inicio' : '/crear-empresa');
    } catch (err) {
      const loginError = err as AuthError;

      if (loginError.action === 'register') {
        const googlePrefill = getGooglePrefillFromIdToken(idToken);
        navigate('/crear-empresa', {
          state: {
            googleToken: idToken,
            googlePrefill,
          },
        });
        return;
      }

      const message = loginError.message || 'No se pudo iniciar sesión con Google.';
      setError(message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    const message = 'No se pudo iniciar sesión con Google.';
    setError(message);
    setEmailFieldError(null);
    setPasswordFieldError(null);
    setGoogleLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-800">
      <main className="flex-1 flex flex-col items-center justify-center px-3 py-4 sm:p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8 w-full max-w-[480px]">
          <div className="mb-4 sm:mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[#1e3a8a] p-2 text-white">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 8h1a4 4 0 1 1 0 8h-1"></path>
                  <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"></path>
                </svg>
              </div>
              <p className="text-[1.45rem] font-semibold text-[#0f172a]">Cafe Smart</p>
            </div>

            <button
              type="button"
              onClick={() => void handleExitApp()}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
              aria-label="Salir de la aplicacion"
            >
              Salir
              <LogOut size={16} className="text-gray-500" />
            </button>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-center text-[#0f172a] mb-2">Iniciar Sesión</h2>
          <p className="text-center text-sm text-gray-500 mb-5 sm:mb-8 mx-auto" style={{ maxWidth: '300px' }}>
            Bienvenido de nuevo a la gestion inteligente de Cafe Smart
          </p>

          {error ? (
            <InlineGuidedError message={getGlobalGuidance(error)} className="mb-6" />
          ) : null}

          <form onSubmit={handleLogin} noValidate className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Correo electronico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  ref={emailInputRef}
                  type="email"
                  aria-invalid={Boolean(emailFieldError)}
                  aria-describedby={emailFieldError ? 'login-email-error' : undefined}
                  className={`block w-full pl-10 pr-9 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all text-gray-700 placeholder-gray-400 ${
                    emailFieldError ? 'border-red-300 bg-red-50/40' : 'border-gray-200'
                  }`}
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onBlur={() => {
                    setEmailTouched(true);
                    if (email.trim() && !isValidEmail(email)) {
                      setEmailFieldError('Ingresa un correo electrónico válido');
                    }
                  }}
                  onChange={(e) => {
                    const nextEmail = e.target.value;
                    setEmail(nextEmail);
                    if (!nextEmail.trim()) {
                      setEmailFieldError(null);
                      return;
                    }
                    if (emailTouched && !isValidEmail(nextEmail)) {
                      setEmailFieldError('Ingresa un correo electrónico válido');
                      return;
                    }
                    setEmailFieldError(null);
                  }}
                />
                {emailFieldError ? (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  </div>
                ) : null}
              </div>
              {emailFieldError && (
                <FieldError id="login-email-error" message={emailFieldError} />
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-slate-700">Contraseña</label>
                <button
                  type="button"
                  onClick={() => {
                    const message = 'La recuperacion de contraseña aun no esta disponible.';
                    setError(message);
                  }}
                  className="text-sm font-semibold text-[#1e3a8a] hover:underline"
                >
                  Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  aria-invalid={Boolean(passwordFieldError)}
                  aria-describedby={passwordFieldError ? 'login-password-error' : undefined}
                  className={`block w-full pl-10 pr-10 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all text-gray-700 placeholder-gray-400 text-lg tracking-wider ${
                    passwordFieldError ? 'border-red-300 bg-red-50/40' : 'border-gray-200'
                  }`}
                  placeholder="********"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordFieldError(null);
                  }}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                  )}
                </button>
              </div>
              {passwordFieldError && (
                <FieldError id="login-password-error" message={passwordFieldError} />
              )}
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <input
                id="remember_me"
                type="checkbox"
                className="w-5 h-5 rounded border-gray-300 text-[#1e3a8a] focus:ring-[#1e3a8a] bg-gray-50 cursor-pointer"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label
                htmlFor="remember_me"
                className="text-sm font-medium leading-5 text-slate-700 cursor-pointer select-none"
              >
                Recordar en este dispositivo
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 px-4 rounded-xl text-white font-semibold transition-all flex items-center justify-center gap-2 ${
                loading
                  ? 'bg-[#1e3a8a]/70 cursor-wait'
                  : 'bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 shadow-md hover:shadow-lg'
              }`}
            >
              {loading ? 'Entrando...' : 'Entrar'} <LogIn size={18} />
            </button>
          </form>

          {isGoogleAuthEnabled && (
            <div className="mt-5 sm:mt-8 mb-4 sm:mb-6 flex items-center">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-4 text-xs font-semibold text-gray-400 tracking-wider">
                O CONTINUA CON
              </span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>
          )}

          {isGoogleAuthEnabled && googleLoading && (
            <div className="mb-6 flex flex-col items-center justify-center py-8">
              <div className="relative w-16 h-16 mb-4">
                <Loader className="w-16 h-16 text-[#1e3a8a] animate-spin" />
              </div>
              <p className="text-center text-sm font-semibold text-gray-700 mb-2">
                Procesando inicio de sesion...
              </p>
              <p className="text-center text-xs text-gray-500">
                Espera un momento mientras validamos tu cuenta.
              </p>
            </div>
          )}

          {isGoogleAuthEnabled && !googleLoading && (
            <div className="mb-5 sm:mb-6 w-full">
              <div
                ref={googleButtonRef}
                className="flex min-h-[44px] w-full items-center justify-center overflow-hidden"
              >
                {googleButtonMissing ? (
                  <button
                    type="button"
                    onClick={openGoogleRedirect}
                    className="flex h-11 w-full max-w-[360px] items-center justify-center gap-3 rounded border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
                  >
                    <span className="text-lg font-black text-[#4285f4]">G</span>
                    Continuar con Google
                  </button>
                ) : (
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    text="continue_with"
                    theme="outline"
                    size="large"
                    shape="rectangular"
                    logo_alignment="left"
                    width={googleButtonWidth}
                    containerProps={{
                      className: 'flex min-h-[44px] w-full justify-center',
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {!isGoogleAuthEnabled && (
            <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-800">
              El acceso con Google no esta disponible porque falta configurar
              <strong> VITE_GOOGLE_CLIENT_ID </strong>
              en el frontend.
            </div>
          )}

          <p className="mt-5 sm:mt-8 text-center text-sm text-slate-600">
            ¿No tienes una cuenta?{' '}
            <Link to="/register" className="font-bold text-[#1e3a8a] hover:underline">
              Registrate gratis
            </Link>
          </p>
        </div>
      </main>

      <footer className="px-4 py-3 sm:p-6 text-center">
        <p className="text-xs text-slate-400 font-medium tracking-wide">
          Copyright 2024 Cafe Smart Inc. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
