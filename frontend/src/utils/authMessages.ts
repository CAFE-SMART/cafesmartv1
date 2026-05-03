import type { AuthError } from '../services/authService';
import { UI_MESSAGES } from './uiMessages';

type RawApiError = {
  message?: string | string[];
  field?: string;
  action?: string;
};

export const AUTH_MESSAGES = {
  invalidEmail: 'No encontramos una cuenta con ese correo.',
  invalidPassword: 'Contraseña incorrecta.',
  googleGeneric: 'No pudimos iniciar sesión con Google. Intenta nuevamente.',
  googleNeedsRegister: 'No encontramos tu cuenta. Vamos a crearla.',
  offline: UI_MESSAGES.auth.offline.mensaje,
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

    return normalizeMessage(data.message, AUTH_MESSAGES.googleGeneric);
  }

  if (endpoint === '/register') {
    if (field === 'nombreorganizacion') {
      return 'Ya existe una empresa registrada con ese nombre. Usa un nombre diferente.';
    }
  }

  if (endpoint === '/register/google') {
    if (field === 'nombreorganizacion') {
      return 'Ya existe una empresa registrada con ese nombre. Usa un nombre diferente.';
    }
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
