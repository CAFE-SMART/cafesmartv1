import type { AuthError } from '../services/authService';

type RawApiError = {
  message?: string | string[];
  field?: string;
  action?: string;
};

export const AUTH_MESSAGES = {
  invalidEmail: 'No encontramos una cuenta con este correo.',
  invalidPassword: 'La contraseña no coincide.',
  googleGeneric:
    'No pudimos entrar con Google. Revisa tu conexión e intenta de nuevo.',
  googleNeedsRegister:
    'No encontramos una cuenta con este correo.',
  offlineFirstLogin:
    'Sin conexión. Conéctate a internet para iniciar sesión por primera vez.',
  cloudWaking:
    'Estamos conectando con la nube. Esto puede tardar unos segundos.',
  cloudUnavailable:
    'Conexión inestable. Puedes seguir usando los datos guardados.',
  cloudTimeout:
    'Conexión inestable. Intenta nuevamente.',
  cloudTryAgain:
    'Conexión inestable. Intenta nuevamente en unos segundos.',
  invalidCredentials: 'Correo o contraseña incorrectos.',
} as const;

export function normalizeMessage(
  message: string | string[] | undefined,
  fallback: string,
) {
  const rawMessage = Array.isArray(message)
    ? message.filter(Boolean).join(', ')
    : message;

  if (
    !rawMessage ||
    /api|autenticaci[oó]n fallida|backend|base de datos|conexi[oó]n rechazada|database|endpoint|error interno|exception|fetch failed|internal server|localhost|request|server|servidor|stack|timeout|token/i.test(
      rawMessage,
    )
  ) {
    return fallback;
  }

  return rawMessage;
}

export function mapFriendlyAuthMessage(
  endpoint: string,
  data: RawApiError,
  fallbackError: string,
): string {
  const field = (data.field ?? '').toLowerCase();

  if (endpoint === '/login') {
    if (field === 'email' || field === 'correo') {
      const rawMessage = normalizeMessage(data.message, AUTH_MESSAGES.invalidEmail);
      const lowerMessage = rawMessage.toLowerCase();

      if (
        lowerMessage.includes('formato') ||
        lowerMessage.includes('valid') ||
        lowerMessage.includes('obligatorio')
      ) {
        return 'El correo no parece válido.';
      }

      return AUTH_MESSAGES.invalidEmail;
    }

    if (field === 'password' || field === 'contrasena') {
      return AUTH_MESSAGES.invalidPassword;
    }
  }

  if (endpoint === '/login/google' || endpoint === '/register/google') {
    if (data.action === 'register') {
      return AUTH_MESSAGES.googleNeedsRegister;
    }

    const rawMessage = normalizeMessage(
      data.message,
      AUTH_MESSAGES.googleGeneric,
    );
    const lowerMessage = rawMessage.toLowerCase();

    if (
      lowerMessage.includes('internal server error') ||
      lowerMessage.includes('server error') ||
      lowerMessage.includes('fetch failed') ||
      lowerMessage.includes('google')
    ) {
      return AUTH_MESSAGES.googleGeneric;
    }

    return rawMessage;
  }

  return normalizeMessage(data.message, fallbackError);
}

export function buildOfflineAuthError(): AuthError {
  const browserOffline =
    typeof navigator !== 'undefined' && navigator.onLine === false;

  return {
    message: browserOffline
      ? AUTH_MESSAGES.offlineFirstLogin
      : AUTH_MESSAGES.cloudUnavailable,
    field: null,
    action: null,
    code: 'OFFLINE',
    status: 0,
  };
}
