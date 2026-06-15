import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Check, Mail, Lock, Eye, EyeOff, LogIn, Loader } from 'lucide-react';
import type { CredentialResponse } from '@react-oauth/google';

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
import { useCloudStatus } from '../context/CloudStatusContext';
import { authSessionService } from '../services/authSessionService';
import { AUTH_MESSAGES } from '../utils/authMessages';
import {
  fieldInputClass,
  fieldLabelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../styles/uiClasses';

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
        isError ? 'text-red-600 dark:text-red-300' : 'text-slate-600 dark:text-slate-300'
      }`}
    >
      <AlertCircle
        size={14}
        className={`mt-0.5 shrink-0 ${isError ? 'text-red-500 dark:text-red-300' : 'text-slate-400 dark:text-slate-400'}`}
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

function logLoginDebug(event: string, payload: Record<string, unknown>) {
  console.info(`[CafeSmart][login] ${event} ${JSON.stringify(payload)}`);
}

function maskEmailForLog(value: string) {
  const trimmed = value.trim().toLowerCase();
  const [local, domain] = trimmed.split('@');

  if (!local || !domain) {
    return trimmed ? '(correo inválido)' : '(vacío)';
  }

  return `${local.slice(0, 2)}***@${domain}`;
}

function withLoginSafetyTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeoutId: number | null = null;

  operation.catch(() => undefined);

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      logLoginDebug('timeout', { timeoutMs: 17_000 });
      reject({
        message: AUTH_MESSAGES.cloudTimeout,
        field: null,
        action: null,
        code: 'TIMEOUT',
        status: 0,
      } satisfies AuthError);
    }, 17_000);
  });

  return Promise.race([operation, timeout]).finally(() => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  });
}

export default function Login() {
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';
  const isGoogleAuthEnabled = Boolean(googleClientId);
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
  const [rememberMe, setRememberMe] = useState(false);
  const [rememberedAccountName, setRememberedAccountName] = useState('');
  const [offlineSessionAvailable, setOfflineSessionAvailable] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [recoveryNoticeExiting, setRecoveryNoticeExiting] = useState(false);
  const restoredLoginDraftRef = useRef(false);

  const navigate = useNavigate();
  const { setSession, token, hasCompany, hydrated } = useUser();
  const { isOnline, backendReachable } = useCloudStatus();
  const isOffline = !isOnline;
  const isCloudChecking = isOnline && backendReachable === null;
  const isCloudUnavailable = isOnline && backendReachable === false;
  const canUseGoogleAuth = isGoogleAuthEnabled && isOnline;

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
      const [account, offlineEntry] = await Promise.all([
        getRememberedAccount(),
        authSessionService.getLastSessionResult(),
      ]);
      if (active) {
        setOfflineSessionAvailable(
          offlineEntry.hasSession &&
            offlineEntry.offlineAllowed &&
            !offlineEntry.loggedOutManually,
        );
      }
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

  const getGlobalGuidance = (message: string): GuidedErrorMessage => {
    if (message.startsWith('Sin conexión.')) {
      return createGuidedError(
        message,
        'Sin conexión.',
        'No detectamos internet disponible en este dispositivo.',
        offlineSessionAvailable
          ? 'Puedes entrar con tu sesión guardada.'
          : 'Conéctate a internet para iniciar sesión por primera vez.',
      );
    }

    if (message === AUTH_MESSAGES.cloudUnavailable) {
      return createGuidedError(
        message,
        'No pudimos conectar con la nube.',
        'Puede ser internet, CORS o que Render todavía no responda.',
        'Revisa tu conexión e intenta de nuevo.',
      );
    }

    return createGuidedError(
      message,
      'Problema al iniciar.',
      'Puede ser un problema temporal o de conexión.',
      'Espera un momento e intenta nuevamente.',
    );
  };

  const syncRememberedAccount = async (account: { email: string; name?: string | null }) => {
    if (rememberMe) {
      await saveRememberedAccount(account);
      setRememberedAccountName(account.name ?? '');
      return;
    }

    await clearRememberedAccount();
    setRememberedAccountName('');
  };

  const enterOfflineMode = async () => {
    const offlineEntry = await authSessionService.canEnterOffline(email);

    if (import.meta.env.DEV) {
      if (!offlineEntry.canEnter && offlineEntry.reason === 'disabled') {
        console.info('[offline-login] disabled', offlineEntry.diagnostics);
      } else {
        console.info(
          '[offline-login]',
          offlineEntry.canEnter ? 'valid' : offlineEntry.reason,
        );
      }
    }

    if (!offlineEntry.canEnter) {
      if (offlineEntry.reason === 'missing') {
        setError(AUTH_MESSAGES.offlineFirstLogin);
      } else if (offlineEntry.reason === 'email_mismatch') {
        setError('Esta cuenta no tiene una sesión guardada en este dispositivo.');
      } else if (offlineEntry.reason === 'disabled') {
        setError('Conéctate a internet para iniciar sesión nuevamente.');
      } else {
        setError('No pudimos validar tu sesión guardada. Conéctate a internet para iniciar sesión nuevamente.');
      }
      setPassword('');
      return false;
    }

    await setSession({
      user: offlineEntry.session.user,
      token: offlineEntry.session.accessToken,
      hasCompany: offlineEntry.session.hasCompany,
      persist: false,
      offline: true,
    });
    setOfflineSessionAvailable(true);
    clearLoginDraft();
    navigate(offlineEntry.session.hasCompany ? '/inicio' : '/crear-empresa');
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    setError(null);
    setEmailFieldError(null);
    setEmailFieldTone('assist');
    setPasswordFieldError(null);

    logLoginDebug('submit iniciado', {
      hasEmail: Boolean(email.trim()),
      hasPassword: Boolean(password.trim()),
      isOnline,
      backendReachable,
    });
    logLoginDebug('email usado', {
      email: maskEmailForLog(email),
    });

    if (isOffline) {
      setLoading(true);
      try {
        await enterOfflineMode();
      } finally {
        logLoginDebug('finally loading=false', { mode: 'offline' });
        setLoading(false);
      }
      return;
    }

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
      logLoginDebug('request enviado', {
        backendReachable,
        apiMode: import.meta.env.MODE,
      });
      const data = await withLoginSafetyTimeout(authService.login(email, password));
      const nextHasCompany = data.hasCompany || Boolean(data.user.organizacionId);
      const userSession = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        organizacionId: data.user.organizacionId ?? null,
        nombreOrganizacion: data.user.nombreOrganizacion ?? null,
        tipoOrganizacion: normalizeTipoOrganizacion(data.user.tipoOrganizacion),
        otroTipoDetalle: data.user.otroTipoDetalle ?? null,
      };

      await setSession({
        user: userSession,
        token: data.access_token,
        hasCompany: nextHasCompany,
        persist: true,
      });
      const reactivatedSession = await authSessionService.reactivateOfflineAccess({
        accessToken: data.access_token,
        user: userSession,
        hasCompany: nextHasCompany,
        lastLoginAt: Date.now(),
        offlineAllowed: true,
        loggedOutManually: false,
      });
      if (import.meta.env.DEV) {
        console.info('[offline-login] session saved', {
          email: userSession.email.trim().toLowerCase(),
          offlineAllowed: true,
          loggedOutManually: false,
          source: reactivatedSession.source,
        });
      }
      setOfflineSessionAvailable(true);
      await syncRememberedAccount({
        email: data.user.email || email.trim(),
        name: data.user.name,
      });
      clearLoginDraft();

      navigate(nextHasCompany ? '/inicio' : '/crear-empresa');
    } catch (err) {
      const authError = err as AuthError;
      logLoginDebug('error capturado', {
        code: authError.code,
        status: authError.status ?? null,
        field: authError.field ?? null,
        action: authError.action ?? null,
        browserOnline:
          typeof navigator === 'undefined' ? null : navigator.onLine,
      });
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
      } else if (
        authError.code === 'TIMEOUT' ||
        authError.code === 'CORS_OR_NETWORK'
      ) {
        setError(
          authError.code === 'TIMEOUT'
            ? AUTH_MESSAGES.cloudTimeout
            : AUTH_MESSAGES.cloudTryAgain,
        );
        setPasswordFieldError(null);
      } else if (
        authError.code === 'OFFLINE' ||
        authError.status === 0 ||
        (typeof navigator !== 'undefined' && !navigator.onLine)
      ) {
        const browserOffline =
          typeof navigator !== 'undefined' && navigator.onLine === false;

        if (browserOffline) {
          const enteredOffline = await enterOfflineMode();
          if (!enteredOffline) {
            setPasswordFieldError(null);
          }
        } else {
          setError(AUTH_MESSAGES.cloudUnavailable);
          setPasswordFieldError(null);
        }
      } else if ((authError.status ?? 0) >= 500) {
        setError('No pudimos iniciar sesión en este momento.');
        setPasswordFieldError(null);
      } else {
        setError(message);
        setPasswordFieldError(null);
      }
    } finally {
      logLoginDebug('finally loading=false', {
        isOnline,
        backendReachable,
      });
      logLoginDebug('loading=false en finally', {
        isOnline,
        backendReachable,
      });
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
      const userSession = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        organizacionId: data.user.organizacionId ?? null,
        nombreOrganizacion: data.user.nombreOrganizacion ?? null,
        tipoOrganizacion: normalizeTipoOrganizacion(data.user.tipoOrganizacion),
        otroTipoDetalle: data.user.otroTipoDetalle ?? null,
      };

      await setSession({
        user: userSession,
        token: data.access_token,
        hasCompany: nextHasCompany,
        persist: true,
      });
      const reactivatedSession = await authSessionService.reactivateOfflineAccess({
        accessToken: data.access_token,
        user: userSession,
        hasCompany: nextHasCompany,
        lastLoginAt: Date.now(),
        offlineAllowed: true,
        loggedOutManually: false,
      });
      if (import.meta.env.DEV) {
        console.info('[offline-login] session saved', {
          email: userSession.email.trim().toLowerCase(),
          offlineAllowed: true,
          loggedOutManually: false,
          source: reactivatedSession.source,
        });
      }
      setOfflineSessionAvailable(true);
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
      if (
        loginError.code === 'OFFLINE' ||
        loginError.status === 0 ||
        (typeof navigator !== 'undefined' && !navigator.onLine)
      ) {
        const browserOffline =
          typeof navigator !== 'undefined' && navigator.onLine === false;
        setError(
          browserOffline
            ? AUTH_MESSAGES.offlineFirstLogin
            : AUTH_MESSAGES.cloudUnavailable,
        );
      } else {
        setError(message);
      }
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
    <div className="flex min-h-screen flex-col bg-gray-50 font-sans text-gray-800 dark:bg-slate-950 dark:text-slate-100">
      <main className="flex-1 flex flex-col items-center justify-center px-3 py-4 sm:p-4">
        <div className="w-full max-w-[480px] rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8 dark:border-slate-700 dark:bg-slate-900">
          <div className="relative mb-7 flex items-start justify-center">
            <CafeSmartLogo
              size="md"
              compact
              className="animate-[cafesmartFadeScale_360ms_ease-out_both]"
            />
          </div>

          <div className="animate-[cafesmartFadeUp_380ms_ease-out_120ms_both]">
<h2 className="mb-2 text-center text-2xl font-bold text-[#0f172a] sm:text-3xl dark:text-slate-100">Iniciar sesión</h2>
            <p className="mx-auto mb-5 max-w-[300px] text-center text-sm text-gray-500 sm:mb-8 dark:text-slate-300">
              Bienvenido de nuevo a la gestión inteligente de CaféSmart
            </p>
          </div>

          {error ? (
            <InlineGuidedError message={getGlobalGuidance(error)} className="mb-6" />
          ) : null}

          {isOffline ? (
            <div
              role="status"
              aria-live="polite"
              className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-5 text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-100"
            >
              <p className="font-bold">Sin conexión</p>
              <p className="font-medium">
                {offlineSessionAvailable
                  ? 'Puedes ingresar con tu sesión guardada en este dispositivo.'
                  : 'Conéctate a internet para iniciar sesión por primera vez.'}
              </p>
            </div>
          ) : null}

          {!error && !isOffline && isCloudChecking ? (
            <div
              role="status"
              aria-live="polite"
              className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm leading-5 text-blue-950 dark:border-blue-400/40 dark:bg-blue-500/15 dark:text-blue-100"
            >
              <p className="font-bold">Conectando con la nube</p>
              <p className="font-medium">
                Estamos conectando con la nube. Esto puede tardar unos segundos.
              </p>
            </div>
          ) : null}

          {!error && !isOffline && isCloudUnavailable ? (
            <div
              role="status"
              aria-live="polite"
              className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-5 text-amber-950 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-100"
            >
              <p className="font-bold">Nube no disponible</p>
              <p className="font-medium">
                No pudimos conectar con la nube. Puedes intentar iniciar sesión de todas formas.
              </p>
            </div>
          ) : null}

          {recoveryNotice ? (
            <div
              role="status"
              aria-live="polite"
              className={`mb-4 flex items-start gap-2.5 rounded-2xl border border-[#dbeafe] bg-[#f8fbff] px-4 py-3 text-sm font-semibold leading-5 text-[#334155] shadow-[0_10px_26px_rgba(30,58,138,0.08)] transition-all duration-300 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100 ${
                recoveryNoticeExiting
                  ? '-translate-y-1 opacity-0'
                  : 'translate-y-0 opacity-100'
              }`}
            >
              <span
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#1e3a8a] shadow-sm ring-1 ring-[#dbeafe] dark:bg-blue-500/20 dark:text-blue-100 dark:ring-blue-400/30"
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
              <label
                htmlFor="login-email"
                className={fieldLabelClass}
              >
                Correo electrónico
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 dark:text-slate-300"
                  aria-hidden="true"
                />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  aria-describedby={emailFieldError ? 'login-email-error' : undefined}


                  className={`${fieldInputClass} login-credential-input py-3 pl-10 pr-9 caret-[#1e3a8a] selection:bg-blue-200 selection:text-slate-950 dark:caret-blue-200 dark:selection:bg-blue-500 dark:selection:text-white ${
                    emailFieldError && emailFieldTone === 'error'
                      ? 'border-red-400 bg-red-50/70 text-red-950 focus:border-red-500 focus:ring-red-200 dark:border-red-400/70 dark:bg-red-500/15 dark:text-red-100 dark:focus:border-red-300 dark:focus:ring-red-400/25'
                      : ''
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
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
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
                <label
                  htmlFor="login-password"
                  className={`${fieldLabelClass} mb-0`}
                >
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/recuperar')}
                  className="text-sm font-bold text-[#102d92] underline-offset-4 transition hover:underline focus:outline-none focus:ring-4 focus:ring-blue-400/20 dark:text-blue-300"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 dark:text-slate-300"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"


                  aria-describedby={passwordFieldError ? 'login-password-error' : undefined}

                  className={`${fieldInputClass} login-credential-input py-3 pl-10 pr-11 caret-[#1e3a8a] selection:bg-blue-200 selection:text-slate-950 dark:caret-blue-200 dark:selection:bg-blue-500 dark:selection:text-white ${
                    passwordFieldError
                      ? 'border-red-400 bg-red-50/70 text-red-950 focus:border-red-500 focus:ring-red-200 dark:border-red-400/70 dark:bg-red-500/15 dark:text-red-100 dark:focus:border-red-300 dark:focus:ring-red-400/25'
                      : ''
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
                  className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent p-1 text-slate-500 shadow-none transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff
                      className="h-5 w-5"
                      aria-hidden="true"
                    />
                  ) : (
                    <Eye
                      className="h-5 w-5"
                      aria-hidden="true"
                    />
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
                  ? 'border-[#1e3a8a] bg-[#eef4ff] shadow-[0_8px_24px_rgba(30,58,138,0.12)] dark:border-blue-500/40 dark:bg-slate-900 dark:text-slate-100'
                  : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
              }`}
              aria-label="Recordar cuenta en este dispositivo"
            >


              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all ${
                rememberMe
                    ? 'border-[#1e3a8a] bg-[#1e3a8a] text-white dark:border-blue-500 dark:bg-blue-500'
                    : 'border-slate-300 bg-white text-transparent dark:border-slate-600 dark:bg-slate-800'
                }`}
              >
                <Check size={18} strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-slate-800 dark:text-slate-100">
                  Recordar cuenta en este dispositivo
                </span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500 dark:text-slate-300">
                  {rememberMe && (rememberedAccountName || email)
                    ? rememberedAccountName || email
                    : 'Guarda solo tu correo, no inicia sesión automáticamente.'}
                </span>
              </span>
              <span
                className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-all ${
                  rememberMe ? 'bg-[#1e3a8a] dark:bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'
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
              className={`${primaryButtonClass} w-full rounded-xl py-3.5 ${
                loading
                  ? 'cursor-wait bg-[#1e3a8a]/70'
                  : 'bg-[#1e3a8a] shadow-md hover:bg-[#1e3a8a]/90 hover:shadow-lg'
              }`}
            >
              {loading ? 'Entrando...' : 'Entrar'} <LogIn size={18} />
            </button>
          </form>

          {canUseGoogleAuth && (
            <div className="mt-5 sm:mt-8 mb-4 sm:mb-6 flex items-center animate-[cafesmartFadeUp_420ms_ease-out_320ms_both]">
              <div className="flex-1 border-t border-gray-200 dark:border-slate-700"></div>
              <span className="px-4 text-sm font-semibold text-gray-500 dark:text-slate-400">
                O CONTINUA CON
              </span>
              <div className="flex-1 border-t border-gray-200 dark:border-slate-700"></div>
            </div>
          )}

          {canUseGoogleAuth && googleLoading && (
            <div className="mb-6 flex flex-col items-center justify-center py-8 animate-[cafesmartFadeUp_420ms_ease-out_360ms_both]">
              <div className="relative w-16 h-16 mb-4">
                <Loader className="h-16 w-16 animate-spin text-[#1e3a8a] dark:text-blue-300" />
              </div>
              <p className="mb-2 text-center text-sm font-semibold text-gray-700 dark:text-slate-200">
                Procesando inicio de sesión...
              </p>
              <p className="text-center text-sm text-gray-500 dark:text-slate-300">
                Espera un momento mientras validamos tu cuenta.
              </p>
            </div>
          )}

          {canUseGoogleAuth && !googleLoading && (
            <div className="mb-5 sm:mb-6 w-full animate-[cafesmartFadeUp_420ms_ease-out_380ms_both]">
              <div className="flex min-h-[44px] w-full items-center justify-center">
                <button
                  type="button"
                  onClick={openGoogleRedirect}
                  className={`${secondaryButtonClass} h-11 w-full max-w-[360px] rounded-lg text-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-blue-400/70 dark:hover:bg-blue-950/35`}
                  aria-label="Continuar con Google"
                >
                  <span
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-transparent text-base font-black leading-none"
                    aria-hidden="true"
                  >
                    <span className="text-[#4285f4]">G</span>
                  </span>
                  <span>Continuar con Google</span>
                </button>
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

          <p className="mt-5 text-center text-sm font-semibold text-slate-600 animate-[cafesmartFadeUp_420ms_ease-out_420ms_both] sm:mt-8 dark:text-slate-300">
            ¿No tienes una cuenta?{' '}
            <Link
              to="/register"
              className="inline-flex rounded-md font-black text-[#1e3a8a] underline-offset-4 transition hover:underline focus:outline-none focus:ring-4 focus:ring-[#1e3a8a]/15 dark:text-blue-300 dark:focus:ring-blue-400/25"
            >
              Regístrate gratis
            </Link>
          </p>
        </div>
      </main>

      <footer className="px-4 py-3 sm:p-6 text-center">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Copyright 2024 Cafe Smart Inc. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
