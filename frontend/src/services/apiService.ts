import { AUTH_STORAGE_KEYS, getAuthStorageValue } from '../storage/authStorage';
import { getOfflineCache, saveOfflineCache } from './offlineCacheService';

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

type ApiErrorDetails = Record<string, string[]>;

type ApiRequestErrorOptions = {
  status: number;
  code?: string | null;
  field?: string | null;
  details?: ApiErrorDetails | null;
};

export class ApiRequestError extends Error {
  status: number;
  code: string | null;
  field: string | null;
  details: ApiErrorDetails | null;

  constructor(message: string, options: ApiRequestErrorOptions) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = options.status;
    this.code = options.code ?? null;
    this.field = options.field ?? null;
    this.details = options.details ?? null;
  }
}

const GET_CACHE_TTL_MS = 12_000;

const inFlightGetRequests = new Map<string, Promise<unknown>>();
const getResponseCache = new Map<string, { expiresAt: number; data: unknown }>();

function normalizarMensaje(message: unknown) {
  if (Array.isArray(message)) {
    return message.filter(Boolean).join(', ').trim();
  }

  return typeof message === 'string' ? message.trim() : '';
}

const TECHNICAL_ERROR_PATTERN =
  /^Cannot\s+(GET|POST|PUT|PATCH|DELETE)\s+/i;
const TECHNICAL_ERROR_WORDS =
  /api|autenticaci[oó]n fallida|backend|base de datos|conexi[oó]n rechazada|database|endpoint|error interno|error\s*500|exception|fallo del sistema|fetch failed|internal server|localhost|prisma|request|server|servidor|stack|terminal|timeout|token/i;

export function limpiarMensajeTecnico(message: unknown) {
  const texto = normalizarMensaje(message);

  if (!texto || TECHNICAL_ERROR_PATTERN.test(texto) || TECHNICAL_ERROR_WORDS.test(texto)) {
    return '';
  }

  return texto;
}

export function traducirMensajeError(message: unknown, status = 0) {
  const texto = limpiarMensajeTecnico(message);

  if (status >= 500) {
    return 'Ocurrió un problema temporal. Intenta nuevamente.';
  }

  if (!texto) {
    if (status === 401) {
      return 'Tu sesión expiró. Ingresa nuevamente.';
    }

    if (status === 403) {
      return 'No tienes acceso a esta opción.';
    }

    if (status === 404) {
      return 'No encontramos la información solicitada. Verifica e intenta nuevamente.';
    }

    return 'No pudimos procesarlo. Intenta de nuevo.';
  }

  const mapa: Record<string, string> = {
    'Internal server error':
      'Ocurrió un problema temporal. Intenta nuevamente.',
    Unauthorized: 'Tu sesión expiró. Ingresa nuevamente.',
    Forbidden: 'No tienes acceso a esta opción.',
    'Forbidden resource': 'No tienes acceso a esta opción.',
    'Not Found': 'No encontramos esa información.',
    'Bad Request': 'Revisa los datos e intenta de nuevo.',
    'Failed to fetch': 'Revisa la conexión a internet y vuelve a intentarlo.',
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
  const method = (options.method ?? 'GET').toUpperCase();
  const canDedupe = method === 'GET' && !options.signal;
  const dedupeKey = canDedupe
    ? `${token ?? 'anonymous'}::${endpoint}`
    : null;
  const offlineCacheKey =
    method === 'GET' ? `${token ?? 'anonymous'}::${endpoint}` : null;

  if (dedupeKey && inFlightGetRequests.has(dedupeKey)) {
    return inFlightGetRequests.get(dedupeKey);
  }

  if (dedupeKey) {
    const cached = getResponseCache.get(dedupeKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    if (cached) getResponseCache.delete(dedupeKey);
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let ultimoError: unknown = null;

  const requestPromise = (async () => {
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
            details:
              data?.details && typeof data.details === 'object'
                ? (data.details as ApiErrorDetails)
                : null,
          });
        }

        if (dedupeKey) {
          getResponseCache.set(dedupeKey, {
            data,
            expiresAt: Date.now() + GET_CACHE_TTL_MS,
          });
        }

        if (offlineCacheKey) {
          saveOfflineCache(offlineCacheKey, data);
        }

        return data;
      } catch (error) {
        ultimoError = error;

        if (!(error instanceof TypeError)) {
          throw error;
        }
      }
    }

    if (offlineCacheKey) {
      const cached = getOfflineCache<unknown>(offlineCacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    throw new ApiRequestError(traducirErrorConexion(ultimoError), { status: 0 });
  })();

  if (dedupeKey) {
    inFlightGetRequests.set(dedupeKey, requestPromise);
    requestPromise.then(
      () => inFlightGetRequests.delete(dedupeKey),
      () => inFlightGetRequests.delete(dedupeKey),
    );
  }

  if (method !== 'GET') {
    getResponseCache.clear();
    requestPromise.then(
      () => getResponseCache.clear(),
      () => getResponseCache.clear(),
    );
  }

  return requestPromise;
};

export function invalidateApiCache() {
  getResponseCache.clear();
  inFlightGetRequests.clear();
}
