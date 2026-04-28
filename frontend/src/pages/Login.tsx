import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Eye, EyeOff, Loader, Lock, LogIn, Mail } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { CafeSmartLogo } from '../components/CafeSmartLogo';
import { authService, type AuthError } from '../services/authService';
import { useUser } from '../context/UserContext';
import { getGooglePrefillFromIdToken } from '../utils/googleProfile';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeTipoOrganizacion(
  value: 'COOPERATIVA' | 'COMPRAVENTA' | 'OTRO' | null | undefined,
): 'COOPERATIVA' | 'COMPRAVENTA' | 'PERSONALIZADO' | null {
  if (value === 'OTRO') {
    return 'PERSONALIZADO';
  }

  return value ?? null;
}

export default function Login() {
  const isGoogleAuthEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null);
  const [passwordFieldError, setPasswordFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const navigate = useNavigate();
  const { setSession } = useUser();

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setError(null);
    setEmailFieldError(null);
    setPasswordFieldError(null);
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

  const focusEmail = () => {
    emailInputRef.current?.focus();
  };

  const focusPassword = () => {
    passwordInputRef.current?.focus();
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setEmailFieldError(null);
    setPasswordFieldError(null);

    let hasValidationError = false;
    let nextEmailError: string | null = null;
    let nextPasswordError: string | null = null;

    if (!email.trim()) {
      nextEmailError = 'Escribe tu correo.';
      hasValidationError = true;
    } else if (!isValidEmail(email)) {
      nextEmailError = 'Correo invalido.';
      hasValidationError = true;
    }

    if (!password.trim()) {
      nextPasswordError = 'Escribe tu contrase\u00f1a.';
      hasValidationError = true;
    }

    setEmailFieldError(nextEmailError);
    setPasswordFieldError(nextPasswordError);

    if (hasValidationError) {
      window.setTimeout(nextEmailError ? focusEmail : focusPassword, 80);
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
          organizacionId: data.user.organizacionId ?? null,
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
      const message = authError.message || 'No pudimos iniciar sesion.';
      const details = authError.details ?? {};

      const emailDetail = details.email?.[0] || details.correo?.[0];
      const passwordDetail = details.password?.[0] || details.contrasena?.[0];

      if (emailDetail) {
        setEmailFieldError(emailDetail);
      }

      if (passwordDetail) {
        setPasswordFieldError(passwordDetail);
      }

      if (emailDetail || passwordDetail) {
        setError(null);
        window.setTimeout(emailDetail ? focusEmail : focusPassword, 80);
      } else if (field === 'email' || field === 'correo') {
        setEmailFieldError(message);
        setError(null);
        window.setTimeout(focusEmail, 80);
      } else if (field === 'password' || field === 'contrasena') {
        setPasswordFieldError(message);
        setError(null);
        window.setTimeout(focusPassword, 80);
      } else {
        setError(message);
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
      setError('Google no respondio. Intenta de nuevo.');
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
          organizacionId: data.user.organizacionId ?? null,
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

      setError(loginError.message || 'Google no pudo iniciar sesion.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError(
      'No pudimos abrir Google. Revisa tu internet e intenta de nuevo. Si sigue pasando, entra con correo y contrasena o pide ayuda al encargado.',
    );
    setEmailFieldError(null);
    setPasswordFieldError(null);
    setGoogleLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f4f6fa] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[340px] flex-col px-5 py-7">
        <header className="flex items-center justify-between">
          <div className="rounded-full bg-white px-3 py-2 shadow-[0_10px_26px_rgba(15,23,42,0.08)]">
            <CafeSmartLogo />
          </div>

          <button
            type="button"
            onClick={() => void handleExitApp()}
            className="rounded-full px-2 py-1 text-sm font-semibold text-slate-500 transition-colors hover:text-[#274ab8]"
          >
            Salir
          </button>
        </header>

        <main className="flex flex-1 items-center justify-center py-6">
          <section className="w-full rounded-[14px] border border-white bg-white px-5 py-5 shadow-[0_16px_38px_rgba(15,23,42,0.08)]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#0b1118] shadow-[0_12px_24px_rgba(15,23,42,0.14)]">
              <img
                src="/imagenes-de-proyecto/granito-inteligente.png"
                alt="Cafe Smart"
                className="h-full w-full object-cover"
              />
            </div>
            <h1 className="text-center text-[1.25rem] font-black leading-tight tracking-normal text-[#172033]">
              Iniciar Sesi&oacute;n
            </h1>
            <p className="mx-auto mt-2 max-w-[260px] text-center text-[0.72rem] leading-5 text-[#75859d]">
              Bienvenido a Caf&eacute; Smart
            </p>

            {error ? <AlertBanner message={error} /> : null}

            <form onSubmit={handleLogin} className="mt-5 space-y-4">
              <TextField
                id="login-email"
                ref={emailInputRef}
                label="Correo electronico"
                value={email}
                onChange={(value) => {
                  setEmail(value);
                  setEmailFieldError(null);
                }}
                placeholder="ejemplo@correo.com"
                type="email"
                autoComplete="email"
                error={emailFieldError}
                icon={<Mail size={17} />}
              />

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="login-password" className="text-sm font-black text-[#344054]">
                    Contrase&ntilde;a
                  </label>
                  <button
                    type="button"
                    onClick={() => setError('Recuperacion no disponible todavia.')}
                    className="text-[11px] font-black text-[#274ab8] hover:underline"
                  >
                    &iquest;Olvidaste tu contrase&ntilde;a?
                  </button>
                </div>

                <div
                  className={`flex min-h-[42px] items-center gap-2 rounded-[8px] border bg-[#f8faff] px-3 transition ${
                    passwordFieldError
                      ? 'border-rose-300 bg-rose-50/60'
                      : 'border-[#dfe5f1] focus-within:border-[#274ab8] focus-within:ring-2 focus-within:ring-[#274ab8]/10'
                  }`}
                >
                  <Lock size={17} className="shrink-0 text-[#9aa8bc]" />
                  <input
                    id="login-password"
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setPasswordFieldError(null);
                    }}
                    placeholder="********"
                    autoComplete="current-password"
                    className="min-w-0 flex-1 bg-transparent py-2 text-[0.72rem] font-semibold text-slate-900 outline-none placeholder:text-[#a8b4c5]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="shrink-0 text-[#9aa8bc] transition-colors hover:text-[#536178]"
                    aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>

                {passwordFieldError ? <FieldError message={passwordFieldError} /> : null}
              </div>

              <label className="flex items-center gap-3 text-sm text-[#5d6b82]">
                <input
                  id="remember_me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-[#c8d2e2] text-[#274ab8] focus:ring-[#274ab8]"
                />
                <span>Recordar mi cuenta en este dispositivo</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className={`inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[8px] text-[0.72rem] font-black text-white transition ${
                  loading
                    ? 'cursor-wait bg-[#8398dc]'
                    : 'bg-[#284bc1] shadow-[0_16px_30px_rgba(40,75,193,0.20)] hover:bg-[#203fa8]'
                }`}
              >
                {loading ? (
                  <>
                    <Loader size={17} className="animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <LogIn size={17} />
                  </>
                )}
              </button>
            </form>

            {isGoogleAuthEnabled ? (
              <div className="mt-7">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#e3e8f0]" />
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#93a1b6]">
                    O CONTIN&Uacute;A CON
                  </span>
                  <div className="h-px flex-1 bg-[#e3e8f0]" />
                </div>

                {googleLoading ? (
                  <div className="mt-5 rounded-[12px] border border-[#dbe4ff] bg-[#f5f8ff] px-4 py-5 text-center">
                    <Loader size={18} className="mx-auto animate-spin text-[#274ab8]" />
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      Validando Google...
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 flex justify-center">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      text="signin_with"
                      theme="outline"
                      size="large"
                      width="100%"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-6 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs font-semibold text-amber-800">
                Google no esta configurado.
              </p>
            )}

            <p className="mt-7 text-center text-sm text-[#5d6b82]">
              &iquest;No tienes una cuenta?{' '}
              <Link to="/register" className="font-black text-[#274ab8] hover:underline">
                Reg&iacute;strate gratis
              </Link>
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}

const TextField = React.forwardRef<
  HTMLInputElement,
  {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    type?: string;
    autoComplete?: string;
    error?: string | null;
    icon: React.ReactNode;
  }
>(function TextField(
  { id, label, value, onChange, placeholder, type = 'text', autoComplete, error, icon },
  ref,
) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[0.68rem] font-black text-[#344054]">
        {label}
      </label>
      <div
        className={`flex min-h-[42px] items-center gap-2 rounded-[8px] border bg-[#f8faff] px-3 transition ${
          error
            ? 'border-rose-300 bg-rose-50/60'
            : 'border-[#dfe5f1] focus-within:border-[#274ab8] focus-within:ring-2 focus-within:ring-[#274ab8]/10'
        }`}
      >
        <span className="shrink-0 text-[#9aa8bc]">{icon}</span>
        <input
          id={id}
          ref={ref}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="min-w-0 flex-1 bg-transparent py-2 text-[0.72rem] font-semibold text-slate-900 outline-none placeholder:text-[#a8b4c5]"
        />
      </div>
      {error ? <FieldError message={error} /> : null}
    </div>
  );
});

function FieldError({ message }: { message: string }) {
  return <p className="mt-2 text-xs font-semibold text-rose-600">{message}</p>;
}

function AlertBanner({ message }: { message: string }) {
  const isGoogleError = message.toLowerCase().includes('google');
  const isConnectionError =
    message.toLowerCase().includes('problema interno') ||
    message.toLowerCase().includes('conexion') ||
    message.toLowerCase().includes('conectar') ||
    message.toLowerCase().includes('disponible');
  const title = isGoogleError
    ? 'No pudimos entrar con Google'
    : isConnectionError
      ? 'No pudimos conectar con el sistema'
      : 'No pudimos iniciar sesion';

  return (
    <div
      className={`mt-5 flex gap-3 rounded-[12px] border px-4 py-3 text-sm ${
        isConnectionError
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-rose-200 bg-rose-50 text-rose-800'
      }`}
      role="alert"
    >
      <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-black">{title}</p>
        <p className="mt-1 leading-5">{message}</p>
      </div>
    </div>
  );
}
