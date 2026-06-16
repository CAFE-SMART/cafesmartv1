import { ApiRequestError, apiFetch } from './apiService';

export const FINANCIAL_ACCESS_SESSION_KEY =
  'cafesmart:financial-access-granted';
export const FINANCIAL_ACCESS_TTL_MS = 30 * 60 * 1000;

export class FinancialAccessError extends Error {
  code: 'INVALID_PASSWORD' | 'UNAUTHORIZED' | 'NETWORK' | 'SERVER';

  constructor(
    message: string,
    code: 'INVALID_PASSWORD' | 'UNAUTHORIZED' | 'NETWORK' | 'SERVER',
  ) {
    super(message);
    this.name = 'FinancialAccessError';
    this.code = code;
  }
}

export function saveFinancialAccessSession() {
  try {
    sessionStorage.setItem(
      FINANCIAL_ACCESS_SESSION_KEY,
      JSON.stringify({ expiresAt: Date.now() + FINANCIAL_ACCESS_TTL_MS }),
    );
  } catch {
    // Si sessionStorage no está disponible, el componente conserva el acceso en memoria.
  }
}

export function clearFinancialAccessSession() {
  try {
    sessionStorage.removeItem(FINANCIAL_ACCESS_SESSION_KEY);
  } catch {
    // No hay nada crítico que limpiar si el navegador bloquea sessionStorage.
  }
}

export function hasValidFinancialAccessSession() {
  try {
    const raw = sessionStorage.getItem(FINANCIAL_ACCESS_SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { expiresAt?: number };
    if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
      clearFinancialAccessSession();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function verificarAccesoFinanciero(password: string) {
  try {
    const response = (await apiFetch('/financial-access/verify', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })) as { ok?: boolean; message?: string };

    if (response.ok !== true) {
      throw new FinancialAccessError(
        'La contraseña no es correcta. Verifica e intenta nuevamente.',
        'INVALID_PASSWORD',
      );
    }

    return response;
  } catch (error) {
    if (error instanceof FinancialAccessError) {
      throw error;
    }

    if (error instanceof ApiRequestError) {
      if (error.status === 403) {
        throw new FinancialAccessError(
          'La contraseña no es correcta. Verifica e intenta nuevamente.',
          'INVALID_PASSWORD',
        );
      }

      if (error.status === 401) {
        throw new FinancialAccessError(
          'Tu sesión expiró. Ingresa nuevamente.',
          'UNAUTHORIZED',
        );
      }

      if (error.status === 0) {
        throw new FinancialAccessError(
          'No pudimos validar el acceso. Revisa tu conexión e intenta nuevamente.',
          'NETWORK',
        );
      }
    }

    throw new FinancialAccessError(
      'No pudimos validar la contraseña. Intenta nuevamente.',
      'SERVER',
    );
  }
}
