import { AUTH_STORAGE_KEYS, getAuthStorageValue } from '../storage/authStorage';

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

type ApiErrorDetails = Record<string, string[]>;

type ApiRequestErrorOptions = {
  status: number;
  code?: string | null;
  field?: string | null;
  action?: string | null;
  details?: ApiErrorDetails | null;
};

export class ApiRequestError extends Error {
  status: number;
  code: string | null;
  field: string | null;
  action: string | null;
  details: ApiErrorDetails | null;

  constructor(message: string, options: ApiRequestErrorOptions) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = options.status;
    this.code = options.code ?? null;
    this.field = options.field ?? null;
    this.action = options.action ?? null;
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

  if (status >= 500) {
    return 'No pudimos completar la acción. Revisa tu conexión e inténtalo nuevamente.';
  }

  if (!texto) {
    if (status === 401) {
      return 'Tu sesión expiró. Inicia sesión nuevamente.';
    }

    if (status === 403) {
      return 'No tienes permiso para realizar esta acción.';
    }

    if (status === 404) {
      return 'No encontramos esa información. Verifica los datos e inténtalo nuevamente.';
    }

    return 'No pudimos procesarlo. Revisa los datos e inténtalo nuevamente.';
  }

  if (
    /terminal|backend|internal server error|server error|stack|exception|prisma|database|endpoint|localhost/i.test(
      texto,
    )
  ) {
    return 'No pudimos completar la acción. Revisa tu conexión e inténtalo nuevamente.';
  }

  if (/^Cannot\s+(GET|POST|PUT|PATCH|DELETE)\s+/i.test(texto)) {
    return 'Esta opción aún no está disponible.';
  }

  const mapa: Record<string, string> = {
    'Internal server error':
      'No pudimos completar la acción. Revisa tu conexión e inténtalo nuevamente.',
    Unauthorized: 'Tu sesión expiró. Inicia sesión nuevamente.',
    Forbidden: 'No tienes permiso para realizar esta acción.',
    'Forbidden resource': 'No tienes permiso para esta opción.',
    'Not Found':
      'No encontramos esa información. Verifica los datos e inténtalo nuevamente.',
    'Bad Request': 'Revisa los datos e inténtalo nuevamente.',
    'Failed to fetch': 'Revisa la conexión a internet e inténtalo nuevamente.',
  };

  return mapa[texto] || texto;
}

function construirBasesApi() {
  const apiBaseConfigurada =
    (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
    'http://localhost:3000';

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

  return 'Revisa la conexión a internet y vuelve a intentarlo.';
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
          code: typeof data?.code === 'string' ? data.code : null,
          field: typeof data?.field === 'string' ? data.field : null,
          action: typeof data?.action === 'string' ? data.action : null,
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
