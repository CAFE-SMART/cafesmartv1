import React, { useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Loader,
  Lock,
  LogIn,
  Mail,
  LogOut,
} from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { CafeSmartLogo } from '../components/CafeSmartLogo';
import { authService, type AuthError } from '../services/authService';
import { useUser } from '../context/UserContext';
import { getGooglePrefillFromIdToken } from '../utils/googleProfile';

const EMAIL_MAX_LENGTH = 70;
const PASSWORD_MAX_LENGTH = 72;

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

type NativeShellWindow = Window & {
  Capacitor?: {
    Plugins?: {
      App?: {
        exitApp?: () => Promise<void> | void;
      };
    };
  };
  electronAPI?: {
    closeApp?: () => void;
  };
};

export default function Login() {
  const isGoogleAuthEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null);
  const [passwordFieldError, setPasswordFieldError] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const location = useLocation();
  const initialMode =
    (location.state as { mode?: 'login' | 'forgot' | 'reset' } | null)?.mode ||
    'login';
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>(initialMode);
  const [code, setCode] = useState('');
  const [codeFieldError, setCodeFieldError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const navigate = useNavigate();
  const { setSession } = useUser();

  const handleSwitchMode = (newMode: 'login' | 'forgot' | 'reset') => {
    setMode(newMode);
    setError(null);
    setSuccessMessage(null);
    setEmailFieldError(null);
    setPasswordFieldError(null);
    setCodeFieldError(null);
    setCode('');
    setPassword('');
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setError(null);
    setEmailFieldError(null);
    setPasswordFieldError(null);
  };

  const handleExitApp = async () => {
    const nativeWindow = window as NativeShellWindow;
    const capacitorApp = nativeWindow.Capacitor?.Plugins?.App;
    if (capacitorApp?.exitApp) {
      await capacitorApp.exitApp();
      return;
    }

    const electronApi = nativeWindow.electronAPI;
    if (electronApi?.closeApp) {
      electronApi.closeApp();
      return;
    }

    window.close();
    if (!window.closed) {
      resetForm();
      navigate('/landing', { replace: true });
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
    } else if (email.trim().length > EMAIL_MAX_LENGTH) {
      nextEmailError = `El correo no puede superar ${EMAIL_MAX_LENGTH} caracteres.`;
      hasValidationError = true;
    } else if (!isValidEmail(email)) {
      nextEmailError = 'Correo invalido.';
      hasValidationError = true;
    }

    if (!password.trim()) {
      nextPasswordError = 'Escribe tu contrase\u00f1a.';
      hasValidationError = true;
    } else if (password.length > PASSWORD_MAX_LENGTH) {
      nextPasswordError = `La contrase\u00f1a no puede superar ${PASSWORD_MAX_LENGTH} caracteres.`;
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
          tipoOrganizacion: normalizeTipoOrganizacion(
            data.user.tipoOrganizacion,
          ),
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
      const message =
        authError.message || 'Verifica tu conexión e inténtalo nuevamente.';
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

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setEmailFieldError(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setEmailFieldError('Escribe tu correo.');
      return;
    } else if (email.trim().length > EMAIL_MAX_LENGTH) {
      setEmailFieldError(
        `El correo no puede superar ${EMAIL_MAX_LENGTH} caracteres.`,
      );
      return;
    } else if (!isValidEmail(email)) {
      setEmailFieldError('Correo invalido.');
      return;
    }

    setLoading(true);

    try {
      await authService.forgotPassword(email);
      setSuccessMessage(
        import.meta.env.DEV
          ? 'Código de verificación enviado. Revisa tu bandeja de entrada o la consola del backend.'
          : 'Código de verificación enviado. Revisa tu bandeja de entrada.',
      );
      setMode('reset');
      setCode('');
      setPassword('');
    } catch (err) {
      const authError = err as AuthError;
      const field = (authError.field || '').toLowerCase();
      const message =
        authError.message || 'Error al enviar el código de recuperación.';

      if (field === 'email' || field === 'correo') {
        setEmailFieldError(message);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setCodeFieldError(null);
    setPasswordFieldError(null);
    setSuccessMessage(null);

    let hasError = false;

    if (!code.trim()) {
      setCodeFieldError('Escribe el código de verificación.');
      hasError = true;
    } else if (code.trim().length !== 6) {
      setCodeFieldError('El código debe tener exactamente 6 dígitos.');
      hasError = true;
    }

    if (!password.trim()) {
      setPasswordFieldError('Escribe tu nueva contraseña.');
      hasError = true;
    } else if (password.length < 6 || password.length > PASSWORD_MAX_LENGTH) {
      setPasswordFieldError(
        `La contraseña debe tener entre 6 y ${PASSWORD_MAX_LENGTH} caracteres.`,
      );
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);

    try {
      await authService.resetPassword(email, code, password);
      setEmail('');
      setPassword('');
      setCode('');
      setMode('login');
      setSuccessMessage(
        'Tu contraseña ha sido restablecida con éxito. Ya puedes iniciar sesión.',
      );
    } catch (err) {
      const authError = err as AuthError;
      const field = (authError.field || '').toLowerCase();
      const message =
        authError.message || 'Error al restablecer la contraseña.';

      if (field === 'code' || field === 'codigo') {
        setCodeFieldError(message);
      } else if (field === 'password' || field === 'contrasena') {
        setPasswordFieldError(message);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (
    credentialResponse: CredentialResponse,
  ) => {
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
          tipoOrganizacion: normalizeTipoOrganizacion(
            data.user.tipoOrganizacion,
          ),
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
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 py-7">
        <header className="flex items-center justify-between">
          <div className="rounded-full bg-white px-3 py-2 shadow-[0_10px_26px_rgba(15,23,42,0.08)]">
            <CafeSmartLogo />
          </div>

          <button
            type="button"
            onClick={() => void handleExitApp()}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#274ab8]"
          >
            Salir
            <LogOut size={14} />
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
              {mode === 'login' && 'Iniciar Sesión'}
              {mode === 'forgot' && 'Recuperar Contraseña'}
              {mode === 'reset' && 'Restablecer Contraseña'}
            </h1>
            <p className="mx-auto mt-2 max-w-[280px] text-center text-[0.72rem] leading-5 text-[#75859d]">
              {mode === 'login' && 'Bienvenido a Café Smart'}
              {mode === 'forgot' &&
                'Ingresa tu correo electrónico para recibir un código de verificación de 6 dígitos.'}
              {mode === 'reset' &&
                `Ingresa el código enviado a ${email} y tu nueva contraseña.`}
            </p>

            {successMessage ? (
              <div className="mt-5 rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex gap-3">
                <div className="mt-0.5 shrink-0 text-emerald-600 font-bold">
                  ✓
                </div>
                <div>
                  <p className="font-black">¡Completado!</p>
                  <p className="mt-1 leading-5">{successMessage}</p>
                </div>
              </div>
            ) : null}

            {error ? <AlertBanner message={error} /> : null}

            {mode === 'login' && (
              <form onSubmit={handleLogin} className="mt-5 space-y-4">
                <TextField
                  id="login-email"
                  ref={emailInputRef}
                  label="Correo electronico"
                  value={email}
                  onChange={(value) => {
                    setEmail(value.slice(0, EMAIL_MAX_LENGTH));
                    setEmailFieldError(null);
                  }}
                  placeholder="ejemplo@correo.com"
                  type="email"
                  autoComplete="email"
                  maxLength={EMAIL_MAX_LENGTH}
                  error={emailFieldError}
                  icon={<Mail size={17} />}
                />

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label
                      htmlFor="login-password"
                      className="text-sm font-black text-[#344054]"
                    >
                      Contraseña
                    </label>
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('forgot')}
                      className="text-[11px] font-black text-[#274ab8] hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
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
                        setPassword(
                          event.target.value.slice(0, PASSWORD_MAX_LENGTH),
                        );
                        setPasswordFieldError(null);
                      }}
                      placeholder="********"
                      autoComplete="current-password"
                      maxLength={PASSWORD_MAX_LENGTH}
                      className="min-w-0 flex-1 bg-transparent py-2 text-[0.72rem] font-semibold text-slate-900 outline-none placeholder:text-[#a8b4c5]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="shrink-0 text-[#9aa8bc] transition-colors hover:text-[#536178]"
                      aria-label={
                        showPassword
                          ? 'Ocultar contrasena'
                          : 'Mostrar contrasena'
                      }
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>

                  {passwordFieldError ? (
                    <FieldError message={passwordFieldError} />
                  ) : null}
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
                  className={`inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-full text-[0.72rem] font-black text-white transition ${
                    loading
                      ? 'cursor-wait bg-blue-300'
                      : 'bg-[#1D4ED8] shadow-[0_16px_30px_rgba(29,78,216,0.20)] hover:bg-[#1e40af]'
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
            )}

            {mode === 'forgot' && (
              <form onSubmit={handleSendCode} className="mt-5 space-y-4">
                <TextField
                  id="forgot-email"
                  label="Correo electrónico"
                  value={email}
                  onChange={(value) => {
                    setEmail(value.slice(0, EMAIL_MAX_LENGTH));
                    setEmailFieldError(null);
                  }}
                  placeholder="ejemplo@correo.com"
                  type="email"
                  autoComplete="email"
                  maxLength={EMAIL_MAX_LENGTH}
                  error={emailFieldError}
                  icon={<Mail size={17} />}
                />

                <button
                  type="submit"
                  disabled={loading}
                  className={`inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-full text-[0.72rem] font-black text-white transition ${
                    loading
                      ? 'cursor-wait bg-blue-300'
                      : 'bg-[#1D4ED8] shadow-[0_16px_30px_rgba(29,78,216,0.20)] hover:bg-[#1e40af]'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader size={17} className="animate-spin" />
                      Enviando código...
                    </>
                  ) : (
                    <>Enviar código</>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className="w-full text-center text-sm font-black text-[#274ab8] hover:underline pt-2 block"
                >
                  Regresar al inicio de sesión
                </button>
              </form>
            )}

            {mode === 'reset' && (
              <form onSubmit={handleResetPassword} className="mt-5 space-y-4">
                <TextField
                  id="reset-code"
                  label="Código de verificación (6 dígitos)"
                  value={code}
                  onChange={(value) => {
                    const clean = value.replace(/\D/g, '').slice(0, 6);
                    setCode(clean);
                    setCodeFieldError(null);
                  }}
                  placeholder="123456"
                  type="text"
                  maxLength={6}
                  error={codeFieldError}
                  icon={<Lock size={17} />}
                />

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label
                      htmlFor="reset-new-password"
                      className="text-sm font-black text-[#344054]"
                    >
                      Nueva contraseña
                    </label>
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
                      id="reset-new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => {
                        setPassword(
                          event.target.value.slice(0, PASSWORD_MAX_LENGTH),
                        );
                        setPasswordFieldError(null);
                      }}
                      placeholder="Escribe tu nueva contraseña"
                      maxLength={PASSWORD_MAX_LENGTH}
                      className="min-w-0 flex-1 bg-transparent py-2 text-[0.72rem] font-semibold text-slate-900 outline-none placeholder:text-[#a8b4c5]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="shrink-0 text-[#9aa8bc] transition-colors hover:text-[#536178]"
                      aria-label={
                        showPassword
                          ? 'Ocultar contraseña'
                          : 'Mostrar contraseña'
                      }
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>

                  {passwordFieldError ? (
                    <FieldError message={passwordFieldError} />
                  ) : null}
                </div>

                {import.meta.env.DEV ? (
                  <div className="rounded-[8px] border border-blue-100 bg-blue-50/70 p-3 text-[11px] text-blue-800 leading-relaxed">
                    <strong>Nota (Desarrollo):</strong> El código se imprimió en
                    la terminal del backend para facilitar tus pruebas locales.
                  </div>
                ) : (
                  <p className="text-[11px] text-[#75859d] leading-relaxed">
                    Si no recibes el correo en unos minutos, por favor revisa tu
                    carpeta de correo no deseado (spam).
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-full text-[0.72rem] font-black text-white transition ${
                    loading
                      ? 'cursor-wait bg-blue-300'
                      : 'bg-[#1D4ED8] shadow-[0_16px_30px_rgba(29,78,216,0.20)] hover:bg-[#1e40af]'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader size={17} className="animate-spin" />
                      Restableciendo...
                    </>
                  ) : (
                    <>Restablecer contraseña</>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchMode('forgot')}
                  className="w-full text-center text-sm font-black text-[#274ab8] hover:underline pt-2 block"
                >
                  Volver a solicitar código
                </button>
              </form>
            )}

            {mode === 'login' && (
              <>
                {isGoogleAuthEnabled ? (
                  <div className="mt-7">
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-[#e3e8f0]" />
                      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#93a1b6]">
                        O CONTINÚA CON
                      </span>
                      <div className="h-px flex-1 bg-[#e3e8f0]" />
                    </div>

                    {googleLoading ? (
                      <div className="mt-5 rounded-[12px] border border-[#dbe4ff] bg-[#f5f8ff] px-4 py-5 text-center">
                        <Loader
                          size={18}
                          className="mx-auto animate-spin text-[#274ab8]"
                        />
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
                    Google no está configurado.
                  </p>
                )}

                <p className="mt-7 text-center text-sm text-[#5d6b82]">
                  ¿No tienes una cuenta?{' '}
                  <Link
                    to="/register"
                    className="font-black text-[#274ab8] hover:underline"
                  >
                    Regístrate gratis
                  </Link>
                </p>
              </>
            )}
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
    maxLength?: number;
    error?: string | null;
    icon: React.ReactNode;
  }
>(function TextField(
  {
    id,
    label,
    value,
    onChange,
    placeholder,
    type = 'text',
    autoComplete,
    maxLength,
    error,
    icon,
  },
  ref,
) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[0.68rem] font-black text-[#344054]"
      >
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
          maxLength={maxLength}
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
  const title = isGoogleError
    ? 'No pudimos entrar con Google'
    : 'No se pudo iniciar sesión';

  return (
    <div
      className="mt-5 flex gap-3 rounded-[8px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
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
