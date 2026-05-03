import { AUTH_STORAGE_KEYS, getAuthStorageValue } from '../storage/authStorage';

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

type ApiErrorDetails = Record<string, string[]>;

type ApiRequestErrorOptions = {
  status: number;
  field?: string | null;
  details?: ApiErrorDetails | null;
};

export class ApiRequestError extends Error {
  status: number;
  field: string | null;
  details: ApiErrorDetails | null;

  constructor(message: string, options: ApiRequestErrorOptions) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = options.status;
    this.field = options.field ?? null;
    this.details = options.details ?? null;
  }
}

function normalizarMensaje(message: unknown) {
  if (Array.isArray(message)) {
    return message.filter(Boolean).join(', ').trim();
  }

  return typeof message === 'string' ? message.trim() : '';
}

function traducirMensajeError(message: unknown, status: number) {
  const texto = normalizarMensaje(message);

  if (!texto) {
    if (status >= 500) {
      return 'Surgió un problema interno. Intenta de nuevo.';
    }

    if (status === 401) {
      return 'Tu sesion expiro. Ingresa de nuevo.';
    }

    if (status === 403) {
      return 'No tienes permiso para esta accion.';
    }

    if (status === 404) {
      return 'No encontramos la información solicitada. Verifica e intenta nuevamente.';
    }

    return 'No pudimos procesarlo. Intenta de nuevo.';
  }

  if (/^Cannot\s+(GET|POST|PUT|PATCH|DELETE)\s+/i.test(texto)) {
    return 'Esta opcion aun no esta disponible.';
  }

  const mapa: Record<string, string> = {
    'Internal server error': 'Surgió un problema interno. Intenta de nuevo.',
    Unauthorized: 'Tu sesion expiro. Ingresa de nuevo.',
    Forbidden: 'No tienes permiso para esta accion.',
    'Forbidden resource': 'No tienes permiso para esta opcion.',
    'Not Found': 'No encontramos esa informacion.',
    'Bad Request': 'Revisa los datos e intenta de nuevo.',
    'Failed to fetch':
      'Surgió un problema interno. Intenta de nuevo. Si el problema continúa, comunícate con el encargado.',
  };

  return mapa[texto] || texto;
}

function construirBasesApi() {
  const apiBaseConfigurada =
    (import.meta.env.VITE_API_URL as string | undefined)?.trim() || 'http://localhost:3000';

  const candidatas = [apiBaseConfigurada.replace(/\/$/, '')];

  if (typeof window === 'undefined') {
    return candidatas;
  }

  try {
    const urlConfigurada = new URL(apiBaseConfigurada);
    const hostActual = window.location.hostname?.trim();

    if (
      hostActual &&
      !HOSTS_LOCALES.has(hostActual) &&
      HOSTS_LOCALES.has(urlConfigurada.hostname)
    ) {
      candidatas.push(
        `${urlConfigurada.protocol}//${hostActual}${
          urlConfigurada.port ? `:${urlConfigurada.port}` : ''
        }`,
      );
    }
  } catch {
    return candidatas;
  }

  return [...new Set(candidatas)];
}

function traducirErrorConexion(error: unknown) {
  if (error instanceof Error) {
    const mensaje = traducirMensajeError(error.message, 0);
    if (mensaje) return mensaje;
  }

  return 'Surgió un problema interno. Intenta de nuevo. Si el problema continúa, comunícate con el encargado.';
}

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = await getAuthStorageValue(AUTH_STORAGE_KEYS.token);
  const basesApi = construirBasesApi();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let ultimoError: unknown = null;

  for (const apiBaseUrl of basesApi) {
    try {
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const mensaje = traducirMensajeError(data?.message, response.status);
        throw new ApiRequestError(mensaje || 'No pudimos procesarlo.', {
          status: response.status,
          field: typeof data?.field === 'string' ? data.field : null,
          details:
            data?.details && typeof data.details === 'object'
              ? (data.details as ApiErrorDetails)
              : null,
        });
      }

      return data;
    } catch (error) {
      ultimoError = error;

      if (!(error instanceof TypeError)) {
        throw error;
      }
    }
  }

  throw new ApiRequestError(traducirErrorConexion(ultimoError), { status: 0 });
};
