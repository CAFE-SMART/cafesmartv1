import { AUTH_STORAGE_KEYS, getAuthStorageValue } from '../storage/authStorage';
import { getApiBaseUrlCandidates, SHOULD_LOG_API_DEBUG } from '../config/api';
import { getOfflineCache, saveOfflineCache } from './offlineCacheService';
import { logDebugLine } from '../utils/debugLog';

type ApiErrorDetails = Record<string, string[]>;

type ApiRequestErrorOptions = {
  status: number;
  code?: string | null;
  field?: string | null;
  details?: ApiErrorDetails | null;
  retryAfterSeconds?: number | null;
};

export class ApiRequestError extends Error {
  status: number;
  code: string | null;
  field: string | null;
  details: ApiErrorDetails | null;
  retryAfterSeconds: number | null;

  constructor(message: string, options: ApiRequestErrorOptions) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = options.status;
    this.code = options.code ?? null;
    this.field = options.field ?? null;
    this.details = options.details ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
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

const SPECIFIC_CODE_MESSAGES: Record<string, string> = {
  AI_DISABLED:
    'El asistente inteligente todavía no está disponible.',
  AI_SERVICE_NOT_CONFIGURED:
    'No pude conectar con el asistente. Revisa la configuración del servicio de IA.',
  AI_PROVIDER_ERROR:
    'No pude generar una respuesta en este momento. Intenta nuevamente.',
  AI_EMPTY_RESPONSE:
    'No pude generar una respuesta en este momento. Intenta nuevamente.',
  AI_PROVIDER_QUOTA_EXCEEDED:
    'El asistente alcanzó el límite de uso por ahora. Intenta más tarde.',
  AI_QUOTA_EXCEEDED:
    'El asistente alcanzó el límite de uso por ahora. Intenta más tarde.',
  AI_DAILY_LIMIT_EXCEEDED:
    'Alcanzaste el límite diario del asistente. Intenta de nuevo mañana.',
  AI_CONTEXT_TOO_LARGE:
    'La información es demasiado amplia para analizarla ahora.',
  INSUFFICIENT_STOCK: 'La cantidad supera el inventario disponible.',
  VENTA_INVENTARIO_INSUFICIENTE: 'La cantidad supera el inventario disponible.',
  VENTA_CANTIDAD_INVALIDA: 'Ingresa una cantidad mayor a 0.',
  VENTA_PRECIO_INVALIDO: 'El precio por kg debe ser mínimo $1,000.',
  VENTA_SUBLOTE_INVALIDO: 'El sublote seleccionado no está disponible para la venta.',
  COMPRA_PESO_INVALIDO: 'Ingresa un peso mayor a 0 kg.',
  COMPRA_PRECIO_INVALIDO: 'Ingresa un precio válido por kg.',
  COMPRA_PRECIO_ALTO: 'Revisa el precio ingresado. Parece demasiado alto.',
  SECADO_PESO_INVALIDO: 'Ingresa un peso válido.',
  SECADO_PESO_EXCEDIDO: 'El peso supera el disponible para secado.',
  SECADO_MONTO_INVALIDO: 'Ingresa un valor válido.',
  SECADO_MONTO_MAXIMO: 'El monto supera el máximo permitido.',
  BODEGA_CAPACIDAD_INVALIDA: 'La capacidad debe ser mayor que 0.',
  BODEGA_CAPACIDAD_MENOR_INVENTARIO:
    'La capacidad no puede ser menor al inventario actual.',
};

const SPECIFIC_FIELD_MESSAGES: Record<string, string> = {
  cantidad: 'Ingresa una cantidad mayor a 0.',
  cantidadkg: 'Ingresa una cantidad mayor a 0.',
  precio: 'Ingresa un precio válido por kg.',
  preciokg: 'Ingresa un precio válido por kg.',
  precio_kilo: 'Ingresa un precio válido por kg.',
  peso: 'Ingresa un peso mayor a 0 kg.',
  pesokg: 'Ingresa un peso mayor a 0 kg.',
  capacidad: 'La capacidad debe ser mayor que 0.',
  monto: 'Ingresa un valor válido.',
  valor: 'Ingresa un valor válido.',
  humedad: 'Ingresa una humedad válida.',
  factor: 'Ingresa un factor válido.',
  documento: 'Ingresa solo números.',
  telefono: 'Ingresa solo números.',
  teléfono: 'Ingresa solo números.',
};

export function limpiarMensajeTecnico(message: unknown) {
  const texto = normalizarMensaje(message);

  if (!texto || TECHNICAL_ERROR_PATTERN.test(texto) || TECHNICAL_ERROR_WORDS.test(texto)) {
    return '';
  }

  return texto;
}

function normalizarClave(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();
}

function mensajePorStatus(status = 0) {
  if (status >= 500) {
    return 'Ocurrió un problema temporal. Intenta nuevamente.';
  }

  if (status === 401) {
    return 'Tu sesión expiró. Ingresa nuevamente.';
  }

  if (status === 403) {
    return 'No tienes acceso a esta opción.';
  }

  if (status === 404) {
    return 'No encontramos la información solicitada.';
  }

  return '';
}

export function getUserFriendlyErrorMessage(error: {
  code?: string | null;
  field?: string | null;
  message?: unknown;
  status?: number;
}) {
  const status = error.status ?? 0;
  const code = error.code?.trim();

  if (
    code === 'AI_SERVICE_NOT_CONFIGURED' ||
    code === 'AI_DISABLED' ||
    code === 'AI_PROVIDER_ERROR' ||
    code === 'AI_EMPTY_RESPONSE' ||
    code === 'AI_PROVIDER_QUOTA_EXCEEDED' ||
    code === 'AI_QUOTA_EXCEEDED' ||
    code === 'AI_DAILY_LIMIT_EXCEEDED' ||
    code === 'AI_CONTEXT_TOO_LARGE'
  ) {
    return SPECIFIC_CODE_MESSAGES[code];
  }

  if (status >= 500 || status === 401 || status === 403 || status === 404) {
    return mensajePorStatus(status);
  }

  if (code && SPECIFIC_CODE_MESSAGES[code]) {
    return SPECIFIC_CODE_MESSAGES[code];
  }

  const fieldKey = normalizarClave(error.field);
  if (fieldKey && SPECIFIC_FIELD_MESSAGES[fieldKey]) {
    return SPECIFIC_FIELD_MESSAGES[fieldKey];
  }

  const texto = limpiarMensajeTecnico(error.message);
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

  if (texto) {
    return mapa[texto] || texto;
  }

  return mensajePorStatus(status) || 'No pudimos procesarlo. Intenta de nuevo.';
}

export function traducirMensajeError(message: unknown, status = 0) {
  return getUserFriendlyErrorMessage({ message, status });
}

function construirBasesApi() {
  return getApiBaseUrlCandidates();
}

function traducirErrorConexion(error: unknown) {
  if (error instanceof Error) {
    const mensaje = traducirMensajeError(error.message, 0);
    if (mensaje) return mensaje;
  }

  return 'Revisa la conexión a internet y vuelve a intentarlo.';
}

function describeFetchError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    };
  }

  return { message: String(error) };
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
      const url = `${apiBaseUrl}${endpoint}`;
      try {
        if (SHOULD_LOG_API_DEBUG) {
          console.info(`[CafeSmart][api-fetch] request method=${method} url=${url}`);
          logDebugLine('[CafeSmart][api-fetch] request', {
            method,
            url,
          });
        }

        const response = await fetch(url, {
          ...options,
          headers,
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          if (SHOULD_LOG_API_DEBUG) {
            console.info(
              `[CafeSmart][api-fetch] HTTP error method=${method} url=${url} status=${response.status} code=${data?.code ?? ''} field=${data?.field ?? ''} message=${data?.message ?? ''}`,
            );
            logDebugLine('[CafeSmart][api-fetch] HTTP error', {
              method,
              url,
              status: response.status,
              code: data?.code,
              field: data?.field,
              message: data?.message,
            });
          }

          const mensaje = getUserFriendlyErrorMessage({
            code: typeof data?.code === 'string' ? data.code : null,
            field: typeof data?.field === 'string' ? data.field : null,
            message: data?.message,
            status: response.status,
          });
          throw new ApiRequestError(mensaje || 'No pudimos procesarlo.', {
            status: response.status,
            code: typeof data?.code === 'string' ? data.code : null,
            field: typeof data?.field === 'string' ? data.field : null,
            retryAfterSeconds:
              typeof data?.retryAfterSeconds === 'number'
                ? data.retryAfterSeconds
                : null,
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
          void saveOfflineCache(offlineCacheKey, data);
        }

        return data;
      } catch (error) {
        ultimoError = error;

        if (!(error instanceof TypeError)) {
          throw error;
        }

        if (SHOULD_LOG_API_DEBUG) {
          console.info(
            `[CafeSmart][api-fetch] network error method=${method} url=${url} error=${JSON.stringify(describeFetchError(error))}`,
          );
          logDebugLine('[CafeSmart][api-fetch] network error', {
            method,
            url,
            error: describeFetchError(error),
          });
        }
      }
    }

    if (offlineCacheKey) {
      const cached = await getOfflineCache<unknown>(offlineCacheKey);
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
