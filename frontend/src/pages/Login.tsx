import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Check, Mail, Lock, Eye, EyeOff, LogIn, LogOut, Loader } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { Capacitor } from '@capacitor/core';

import {
  createGuidedError,
  InlineGuidedError,
  type GuidedErrorMessage,
} from '../components/forms/GuidedError';
import { AppFeedbackMessage } from '../components/AppFeedbackMessage';
import { authService, type AuthError } from '../services/authService';
import { useUser } from '../context/UserContext';
import { getGooglePrefillFromIdToken } from '../utils/googleProfile';
import {
  clearRememberedAccount,
  getRememberedAccount,
  saveRememberedAccount,
} from '../storage/authStorage';
import { CafeSmartLogo } from '../components/CafeSmartLogo';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type EmailValidationMode = 'typing' | 'blur' | 'submit';
type FieldMessageTone = 'assist' | 'error';

function getProgressiveEmailError(value: string, mode: EmailValidationMode) {
  const trimmed = value.trim();

  if (!trimmed) {
    return mode === 'submit' ? 'Ingresa tu correo electrónico.' : null;
  }

  const shouldGuide = mode !== 'typing' || trimmed.length >= 5;
  if (!shouldGuide) {
    return null;
  }

  if (!trimmed.includes('@')) {
    return 'Agrega un correo válido.';
  }

  const [localPart, domainPart = '', extraPart] = trimmed.split('@');
  if (!localPart || extraPart !== undefined || /\s/.test(trimmed)) {
    return 'El correo no parece válido.';
  }

  if (!domainPart) {
    return 'Completa el dominio del correo.';
  }

  if (!domainPart.includes('.')) {
    return 'Completa el dominio del correo.';
  }

  const domainSections = domainPart.split('.');
  const lastSection = domainSections[domainSections.length - 1] ?? '';
  if (domainPart.endsWith('.') || lastSection.length < 2) {
    return 'Parece que falta completar el correo.';
  }

  if (!isValidEmail(trimmed)) {
    return 'El correo no parece válido.';
  }

  return null;
}

function FieldMessage({
  id,
  message,
  tone,
}: {
  id: string;
  message: string;
  tone: FieldMessageTone;
}) {
  const isError = tone === 'error';

  return (
    <p
      id={id}
      {...(isError
        ? ({ role: 'alert', 'aria-live': 'assertive' } as const)
        : ({ role: 'status', 'aria-live': 'polite' } as const))}
      className={`mt-2 flex items-start gap-1.5 rounded-lg px-1 text-sm font-semibold leading-5 ${
        isError ? 'text-red-600' : 'text-slate-500'
      }`}
    >
      <AlertCircle
        size={14}
        className={`mt-0.5 shrink-0 ${isError ? 'text-red-500' : 'text-slate-400'}`}
        aria-hidden="true"
      />
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

const SESSION_EXPIRED_MESSAGE_KEY = 'cafesmart_session_expired_message';
const LOGIN_DRAFT_STORAGE_KEY = 'cafesmart:login-draft:v1';
const LOGIN_DRAFT_TTL_MS = 1000 * 60 * 60 * 24;

type LoginDraft = {
  authMode: 'login';
  currentScreen: 'login';
  email: string;
  rememberMe: boolean;
  savedAt: number;
};

function readLoginDraft() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LOGIN_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const draft = JSON.parse(raw) as Partial<LoginDraft>;
    if (
      typeof draft.savedAt !== 'number' ||
      Date.now() - draft.savedAt > LOGIN_DRAFT_TTL_MS
    ) {
      window.localStorage.removeItem(LOGIN_DRAFT_STORAGE_KEY);
      return null;
    }

    if (draft.authMode !== 'login' || draft.currentScreen !== 'login') {
      window.localStorage.removeItem(LOGIN_DRAFT_STORAGE_KEY);
      return null;
    }

    return {
      authMode: 'login',
      currentScreen: 'login',
      email: typeof draft.email === 'string' ? draft.email : '',
      rememberMe: Boolean(draft.rememberMe),
      savedAt: draft.savedAt,
    };
  } catch {
    window.localStorage.removeItem(LOGIN_DRAFT_STORAGE_KEY);
    return null;
  }
}

function saveLoginDraft(draft: Pick<LoginDraft, 'email' | 'rememberMe'>) {
  if (typeof window === 'undefined') {
    return;
  }

  const email = draft.email.trim();
  if (!email && !draft.rememberMe) {
    window.localStorage.removeItem(LOGIN_DRAFT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    LOGIN_DRAFT_STORAGE_KEY,
    JSON.stringify({
      email,
      rememberMe: draft.rememberMe,
      authMode: 'login',
      currentScreen: 'login',
      savedAt: Date.now(),
    }),
  );
}

function clearLoginDraft() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(LOGIN_DRAFT_STORAGE_KEY);
  }
}

export default function Login() {
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';
  const isGoogleAuthEnabled = Boolean(googleClientId);
  const isAndroidApp = Capacitor.getPlatform() === 'android';
  const googleButtonWidth =
    typeof window !== 'undefined'
      ? String(Math.min(360, Math.max(180, window.innerWidth - 72)))
      : '320';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null);
  const [emailFieldTone, setEmailFieldTone] = useState<FieldMessageTone>('assist');
  const [passwordFieldError, setPasswordFieldError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleButtonMissing, setGoogleButtonMissing] = useState(isAndroidApp);
  const [rememberMe, setRememberMe] = useState(false);
  const [rememberedAccountName, setRememberedAccountName] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [recoveryNoticeExiting, setRecoveryNoticeExiting] = useState(false);
  const restoredLoginDraftRef = useRef(false);
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
    let active = true;
    const draft = readLoginDraft();
    if (draft?.email) {
      restoredLoginDraftRef.current = true;
      setEmail(draft.email);
      setRememberMe(draft.rememberMe);
      setEmailTouched(true);
      setRecoveryNotice(
        'Recuperamos tu información anterior. Por seguridad, vuelve a ingresar tu contraseña.',
      );
    }

    const loadRememberedAccount = async () => {
      const account = await getRememberedAccount();
      if (!active || !account.email) {
        return;
      }

      if (!restoredLoginDraftRef.current) {
        setEmail(account.email);
      }
      setRememberedAccountName(account.name);
      setRememberMe(true);
    };

    void loadRememberedAccount();

    if (typeof window !== 'undefined') {
      const expiredMessage = window.sessionStorage.getItem(SESSION_EXPIRED_MESSAGE_KEY);
      if (expiredMessage) {
        setError(expiredMessage);
        setPassword('');
        window.sessionStorage.removeItem(SESSION_EXPIRED_MESSAGE_KEY);
      }
    }

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      saveLoginDraft({
        email,
        rememberMe,
      });
    }, 650);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [email, rememberMe]);

  useEffect(() => {
    const saveCurrentDraft = () => {
      saveLoginDraft({
        email,
        rememberMe,
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentDraft();
      }
    };

    window.addEventListener('beforeunload', saveCurrentDraft);
    window.addEventListener('blur', saveCurrentDraft);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      saveCurrentDraft();
      window.removeEventListener('beforeunload', saveCurrentDraft);
      window.removeEventListener('blur', saveCurrentDraft);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [email, rememberMe]);

  useEffect(() => {
    if (!recoveryNotice) {
      return;
    }

    setRecoveryNoticeExiting(false);

    const fadeTimer = window.setTimeout(() => {
      setRecoveryNoticeExiting(true);
    }, 4200);
    const clearTimer = window.setTimeout(() => {
      setRecoveryNotice(null);
      setRecoveryNoticeExiting(false);
    }, 4600);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [recoveryNotice]);

  useEffect(() => {
    if (!isGoogleAuthEnabled || isAndroidApp || googleLoading) {
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
  }, [googleLoading, isAndroidApp, isGoogleAuthEnabled]);

  useEffect(() => {
    if (!email.trim() || !emailTouched) {
      return;
    }

    const timerId = window.setTimeout(() => {
      const nextEmailError = getProgressiveEmailError(email, 'typing');
      setEmailFieldTone('assist');
      setEmailFieldError(nextEmailError);
    }, 850);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [email, emailTouched]);

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
    clearLoginDraft();
    setError(null);
    setEmailFieldError(null);
    setEmailFieldTone('assist');
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
      navigate('/', { replace: true });
    }
  };

  const getEmailGuidance = (message: string): GuidedErrorMessage =>
    createGuidedError(
      message,
      'Revisa tu correo.',
      'Puede estar incompleto o no estar registrado.',
      'Ajusta el correo e intenta de nuevo.',
    );

  const getPasswordGuidance = (message: string): GuidedErrorMessage =>
    createGuidedError(
      message,
      'Revisa tu contraseña.',
      'Puede estar vacía o no coincidir con tu cuenta.',
      'Escríbela de nuevo con calma.',
    );

  const getGlobalGuidance = (message: string): GuidedErrorMessage =>
    createGuidedError(
      message,
      'Problema al iniciar.',
      'Puede ser un problema temporal o de conexión.',
      'Espera un momento e intenta nuevamente.',
    );

  const syncRememberedAccount = async (account: { email: string; name?: string | null }) => {
    if (rememberMe) {
      await saveRememberedAccount(account);
      setRememberedAccountName(account.name ?? '');
      return;
    }

    await clearRememberedAccount();
    setRememberedAccountName('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    setError(null);
    setEmailFieldError(null);
    setEmailFieldTone('assist');
    setPasswordFieldError(null);

    let hasValidationError = false;
    let nextEmailError: string | null = null;
    let nextPasswordError: string | null = null;

    nextEmailError = getProgressiveEmailError(email, 'submit');
    if (nextEmailError) {
      hasValidationError = true;
    }

    if (!password.trim()) {
      nextPasswordError = 'Ingresa tu contraseña.';
      hasValidationError = true;
    }

    setEmailFieldTone('error');
    setEmailFieldError(nextEmailError);
    setPasswordFieldError(nextPasswordError);

    if (hasValidationError) {
      setError('Completa los datos para continuar.');
      return;
    }

    setLoading(true);

    try {
      const data = await authService.login(email, password);
      const nextHasCompany = data.hasCompany || Boolean(data.user.organizacionId);

      await setSession({
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          organizacionId: data.user.organizacionId ?? null,
          nombreOrganizacion: data.user.nombreOrganizacion ?? null,
          tipoOrganizacion: normalizeTipoOrganizacion(data.user.tipoOrganizacion),
          otroTipoDetalle: data.user.otroTipoDetalle ?? null,
        },
        token: data.access_token,
        hasCompany: nextHasCompany,
        persist: false,
      });
      await syncRememberedAccount({
        email: data.user.email || email.trim(),
        name: data.user.name,
      });
      clearLoginDraft();

      navigate(nextHasCompany ? '/inicio' : '/crear-empresa');
    } catch (err) {
      const authError = err as AuthError;
      const field = (authError.field || '').toLowerCase();
      const message = authError.message || 'No pudimos iniciar sesión en este momento.';
      const details = authError.details ?? {};
      const isCredentialError =
        authError.status === 401 ||
        field === 'email' ||
        field === 'correo' ||
        field === 'password' ||
        field === 'contrasena' ||
        Boolean(details.email?.[0] || details.correo?.[0] || details.password?.[0] || details.contrasena?.[0]);

      const emailDetail = details.email?.[0] || details.correo?.[0];
      const passwordDetail = details.password?.[0] || details.contrasena?.[0];

      if (isCredentialError && (emailDetail || passwordDetail)) {
        setPasswordFieldError(passwordDetail || 'La contraseña no coincide.');
        setPassword('');
        setError(null);
      } else if (isCredentialError && (field === 'email' || field === 'correo')) {
        setEmailFieldTone('error');
        setEmailFieldError(message);
        setError(null);
      } else if (isCredentialError && (field === 'password' || field === 'contrasena')) {
        setPasswordFieldError(message);
        setPassword('');
        setError(null);
      } else if (authError.code === 'OFFLINE' || authError.status === 0) {
        setError('No pudimos conectarnos. Revisa tu internet e intenta nuevamente.');
        setPasswordFieldError(null);
      } else if ((authError.status ?? 0) >= 500) {
        setError('No pudimos iniciar sesión en este momento.');
        setPasswordFieldError(null);
      } else {
        setError(message);
        setPasswordFieldError(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setError(null);
    setEmailFieldError(null);
    setEmailFieldTone('assist');
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
      const nextHasCompany = data.hasCompany || Boolean(data.user.organizacionId);

      await setSession({
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          organizacionId: data.user.organizacionId ?? null,
          nombreOrganizacion: data.user.nombreOrganizacion ?? null,
          tipoOrganizacion: normalizeTipoOrganizacion(data.user.tipoOrganizacion),
          otroTipoDetalle: data.user.otroTipoDetalle ?? null,
        },
        token: data.access_token,
        hasCompany: nextHasCompany,
        persist: false,
      });
      await syncRememberedAccount({
        email: data.user.email,
        name: data.user.name,
      });
      clearLoginDraft();

      navigate(nextHasCompany ? '/inicio' : '/crear-empresa');
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
    setEmailFieldTone('assist');
    setPasswordFieldError(null);
    setGoogleLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-800">
      <main className="flex-1 flex flex-col items-center justify-center px-3 py-4 sm:p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8 w-full max-w-[480px]">
          <div className="relative mb-7 flex items-start justify-center">
            <CafeSmartLogo
              size="md"
              compact
              className="animate-[cafesmartFadeScale_360ms_ease-out_both]"
            />
            <button
              type="button"
              onClick={() => void handleExitApp()}
              className="absolute right-0 top-0 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
              aria-label="Salir de la aplicación"
            >
              Salir
              <LogOut size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="animate-[cafesmartFadeUp_380ms_ease-out_120ms_both]">
<h2 className="text-2xl sm:text-3xl font-bold text-center text-[#0f172a] mb-2">Iniciar sesión</h2>
            <p className="mx-auto mb-5 max-w-[300px] text-center text-sm text-gray-500 sm:mb-8">
              Bienvenido de nuevo a la gestión inteligente de CaféSmart
            </p>
          </div>

          {error ? (
            <InlineGuidedError message={getGlobalGuidance(error)} className="mb-6" />
          ) : null}

          {recoveryNotice ? (
            <div
              role="status"
              aria-live="polite"
              className={`mb-4 flex items-start gap-2.5 rounded-2xl border border-[#dbeafe] bg-[#f8fbff] px-4 py-3 text-sm font-semibold leading-5 text-[#334155] shadow-[0_10px_26px_rgba(30,58,138,0.08)] transition-all duration-300 ${
                recoveryNoticeExiting
                  ? '-translate-y-1 opacity-0'
                  : 'translate-y-0 opacity-100'
              }`}
            >
              <span
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#1e3a8a] shadow-sm ring-1 ring-[#dbeafe]"
                aria-hidden="true"
              >
                <Check size={15} strokeWidth={3} />
              </span>
              <span>{recoveryNotice}</span>
            </div>
          ) : null}

          <form
            onSubmit={handleLogin}
            noValidate
            className="space-y-4 sm:space-y-6 animate-[cafesmartFadeUp_420ms_ease-out_220ms_both]"
          >
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
Correo electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  aria-describedby={emailFieldError ? 'login-email-error' : undefined}


                  className={`block w-full pl-10 pr-9 py-3 border rounded-xl focus:outline-none transition-all text-gray-700 placeholder-gray-400 focus:border-[#1e3a8a]/55 focus:bg-white focus:ring-4 focus:ring-[#1e3a8a]/10 ${
                    emailFieldError && emailFieldTone === 'error'
                      ? 'border-red-300 bg-red-50/40 focus:border-red-300 focus:ring-red-100'
                      : emailFieldError
                        ? 'border-slate-300 bg-slate-50/70'
                        : 'border-gray-200'
                  }`}

                  placeholder="ejemplo@correo.com"
                  value={email}
                  onBlur={() => {
                    setEmailTouched(true);
                    const nextEmailError = getProgressiveEmailError(email, 'blur');
                    setEmailFieldTone(nextEmailError ? 'error' : 'assist');
                    setEmailFieldError(nextEmailError);
                  }}
                  onChange={(e) => {
                    const nextEmail = e.target.value;
                    setEmail(nextEmail);
                    setEmailTouched(true);
                    setError(null);
                    setEmailFieldTone('assist');
                    setEmailFieldError(null);
                  }}
                />
                {emailFieldError && emailFieldTone === 'error' ? (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  </div>
                ) : null}
              </div>
              {emailFieldError && (
                <FieldMessage
                  id="login-email-error"
                  message={emailFieldError}
                  tone={emailFieldTone}
                />
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
<label className="block text-sm font-bold text-slate-700">Contraseña</label>
                <button
                  type="button"
                  onClick={() => navigate('/recuperar')}
                  className="text-sm font-semibold text-[#1e3a8a] hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}


                  aria-describedby={passwordFieldError ? 'login-password-error' : undefined}

                  className={`block w-full pl-10 pr-10 py-3 border rounded-xl focus:outline-none transition-all text-gray-700 placeholder-gray-400 text-lg tracking-wider ${
                    passwordFieldError
                      ? 'border-red-300 bg-red-50/40 focus:border-red-300 focus:ring-4 focus:ring-red-100'
                      : 'border-gray-200 focus:border-[#1e3a8a]/55 focus:bg-white focus:ring-4 focus:ring-[#1e3a8a]/10'
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
                <FieldMessage
                  id="login-password-error"
                  message={passwordFieldError}
                  tone="error"
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => setRememberMe((current) => !current)}
              className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
                rememberMe
                  ? 'border-[#1e3a8a] bg-[#eef4ff] shadow-[0_8px_24px_rgba(30,58,138,0.12)]'
                  : 'border-slate-200 bg-slate-50'
              }`}
              aria-label="Recordar cuenta en este dispositivo"
            >


              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all ${
                  rememberMe
                    ? 'border-[#1e3a8a] bg-[#1e3a8a] text-white'
                    : 'border-slate-300 bg-white text-transparent'
                }`}
              >
                <Check size={18} strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-slate-800">
                  Recordar cuenta en este dispositivo
                </span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">
                  {rememberMe && (rememberedAccountName || email)
                    ? rememberedAccountName || email
                    : 'Guarda solo tu correo, no inicia sesión automáticamente.'}
                </span>
              </span>
              <span
                className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-all ${
                  rememberMe ? 'bg-[#1e3a8a]' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    rememberMe ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>

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
            <div className="mt-5 sm:mt-8 mb-4 sm:mb-6 flex items-center animate-[cafesmartFadeUp_420ms_ease-out_320ms_both]">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-4 text-sm font-semibold text-gray-500">
                O CONTINUA CON
              </span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>
          )}

          {isGoogleAuthEnabled && googleLoading && (
            <div className="mb-6 flex flex-col items-center justify-center py-8 animate-[cafesmartFadeUp_420ms_ease-out_360ms_both]">
              <div className="relative w-16 h-16 mb-4">
                <Loader className="w-16 h-16 text-[#1e3a8a] animate-spin" />
              </div>
              <p className="text-center text-sm font-semibold text-gray-700 mb-2">
                Procesando inicio de sesión...
              </p>
              <p className="text-center text-sm text-gray-500">
                Espera un momento mientras validamos tu cuenta.
              </p>
            </div>
          )}

          {isGoogleAuthEnabled && !googleLoading && (
            <div className="mb-5 sm:mb-6 w-full animate-[cafesmartFadeUp_420ms_ease-out_380ms_both]">
              <div
                ref={googleButtonRef}
                className="flex min-h-[44px] w-full items-center justify-center overflow-hidden"
              >
                {googleButtonMissing || isAndroidApp ? (
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
            <AppFeedbackMessage
              variant="warning"
              description={<>El acceso con Google no está disponible porque falta configurar<strong> VITE_GOOGLE_CLIENT_ID </strong>en el frontend.</>}
              className="mt-1 animate-[cafesmartFadeUp_420ms_ease-out_340ms_both]"
            />
          )}

          <p className="mt-5 sm:mt-8 text-center text-sm text-slate-600 animate-[cafesmartFadeUp_420ms_ease-out_420ms_both]">
            ¿No tienes una cuenta?{' '}
            <Link to="/register" className="font-bold text-[#1e3a8a] hover:underline">
              Regístrate gratis
            </Link>
          </p>
        </div>
      </main>

      <footer className="px-4 py-3 sm:p-6 text-center">
        <p className="text-sm text-slate-500 font-medium">
          Copyright 2024 Cafe Smart Inc. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
