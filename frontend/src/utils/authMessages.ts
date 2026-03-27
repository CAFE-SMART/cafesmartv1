import type { AuthError } from '../services/authService';

type RawApiError = {
  message?: string | string[];
  field?: string;
  action?: string;
};

export const AUTH_MESSAGES = {
  invalidEmail: 'Correo incorrecto. Verificalo e intenta nuevamente.',
  invalidPassword: 'Contrasena incorrecta. Intenta nuevamente.',
  googleGeneric: 'No se pudo iniciar sesion con Google. Intenta nuevamente.',
  googleNeedsRegister: 'No encontramos tu cuenta. Vamos a crearla.',
  offline: 'No se pudo conectar con el servidor. Verifica tu conexion e intenta nuevamente.',
} as const;

export function normalizeMessage(message: string | string[] | undefined, fallback: string) {
  if (Array.isArray(message)) {
    return message.join(', ');
  }

  return message || fallback;
}

export function mapFriendlyAuthMessage(
  endpoint: string,
  data: RawApiError,
  fallbackError: string,
): string {
  const field = (data.field ?? '').toLowerCase();

  if (endpoint === '/login') {
    if (field === 'email' || field === 'correo') {
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

    return AUTH_MESSAGES.googleGeneric;
  }

  return normalizeMessage(data.message, fallbackError);
}

export function buildOfflineAuthError(): AuthError {
  return {
    message: AUTH_MESSAGES.offline,
    field: null,
    action: null,
    code: 'OFFLINE',
  };
}
