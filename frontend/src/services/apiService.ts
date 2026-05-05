import { AUTH_STORAGE_KEYS, getAuthStorageValue } from '../storage/authStorage';
import API_URL from '../config/api';
import { UI_MESSAGES } from '../utils/uiMessages';

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const API_REQUEST_TIMEOUT_MS = 30000;

type ApiErrorDetails = Record<string, string[]>;

type ErrorTraducido = {
  mensaje: string;
  accion?: string;
};

type ApiRequestErrorOptions = {
  status: number;
  field?: string | null;
  details?: ApiErrorDetails | null;
  action?: string | null;
};

export class ApiRequestError extends Error {
  status: number;
  field: string | null;
  details: ApiErrorDetails | null;
  action: string | null;

  constructor(message: string, options: ApiRequestErrorOptions) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = options.status;
    this.field = options.field ?? null;
    this.details = options.details ?? null;
    this.action = options.action ?? null;
  }
}

function traducirMensajeError(
  message: string | null | undefined,
  status: number
): ErrorTraducido {
  const texto = (message || '').trim().toLowerCase();

  const RESPUESTA_DEFAULT: ErrorTraducido = {
    mensaje: UI_MESSAGES.system.saveFailed.mensaje,
    accion: 'Intenta nuevamente',
  };

  if (/database|prisma|sql|internal server error|error 500/.test(texto) || status >= 500) {
    return {
      mensaje: UI_MESSAGES.system.saveFailed.mensaje,
      accion: 'Intenta nuevamente en unos segundos',
    };
  }

  if (!texto) {
    switch (status) {
      case 401:
        return {
          mensaje: UI_MESSAGES.auth.sessionExpired.mensaje,
          accion: UI_MESSAGES.auth.sessionExpired.accion,
        };
      case 403:
        return {
          mensaje: UI_MESSAGES.auth.forbidden.mensaje,
          accion: UI_MESSAGES.auth.forbidden.accion,
        };
      case 404:
        return {
          mensaje: UI_MESSAGES.inventory.notFound.mensaje,
          accion: UI_MESSAGES.inventory.notFound.accion,
        };
      default:
        return RESPUESTA_DEFAULT;
    }
  }

  const mapa: Record<string, ErrorTraducido> = {
    'internal server error': {
      mensaje: UI_MESSAGES.system.saveFailed.mensaje,
      accion: 'Intenta nuevamente',
    },
    unauthorized: {
      mensaje: UI_MESSAGES.auth.sessionExpired.mensaje,
      accion: UI_MESSAGES.auth.sessionExpired.accion,
    },
    forbidden: {
      mensaje: UI_MESSAGES.auth.forbidden.mensaje,
      accion: UI_MESSAGES.auth.forbidden.accion,
    },
    'forbidden resource': {
      mensaje: UI_MESSAGES.auth.forbidden.mensaje,
      accion: UI_MESSAGES.auth.forbidden.accion,
    },
    'not found': {
      mensaje: UI_MESSAGES.inventory.notFound.mensaje,
      accion: UI_MESSAGES.inventory.notFound.accion,
    },
    'bad request': {
      mensaje: 'Hay un problema con los datos ingresados.',
      accion: 'Verifica la información',
    },
    'failed to fetch': {
      mensaje: UI_MESSAGES.auth.offline.mensaje,
      accion: UI_MESSAGES.auth.offline.accion,
    },
  };

  for (const key in mapa) {
    if (texto.includes(key)) {
      return mapa[key];
    }
  }

  return {
    mensaje: message?.trim() || RESPUESTA_DEFAULT.mensaje,
    accion: 'Intenta nuevamente',
  };
}

function construirBasesApi() {
  const apiBaseConfigurada = API_URL.replace(/\/$/, '');
  const candidatas = [apiBaseConfigurada];

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
        }`
      );
    }
  } catch {
    return candidatas;
  }

  return [...new Set(candidatas)];
}

function traducirErrorConexion(error: unknown): ErrorTraducido {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted')) {
      return {
        mensaje: UI_MESSAGES.system.timeout.mensaje,
        accion: 'Revisa que el backend esté encendido e intenta otra vez',
      };
    }

    const errorTraducido = traducirMensajeError(error.message, 0);

    if (errorTraducido.mensaje) {
      return errorTraducido;
    }
  }

  return {
    mensaje: UI_MESSAGES.auth.offline.mensaje,
    accion: UI_MESSAGES.auth.offline.accion,
  };
}

async function fetchWithTimeout(url: string, options: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
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
      const response = await fetchWithTimeout(`${apiBaseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorTraducido = traducirMensajeError(data?.message, response.status);

        throw new ApiRequestError(errorTraducido.mensaje || 'No pudimos procesarlo.', {
          status: response.status,
          field: typeof data?.field === 'string' ? data.field : null,
          details:
            data?.details && typeof data.details === 'object'
              ? (data.details as ApiErrorDetails)
              : null,
          action: errorTraducido.accion ?? null,
        });
      }

      return data;
    } catch (error) {
      ultimoError = error;

      if (!(error instanceof TypeError) && !(error instanceof DOMException)) {
        throw error;
      }
    }
  }

  const errorConexion = traducirErrorConexion(ultimoError);

  throw new ApiRequestError(errorConexion.mensaje, {
    status: 0,
    action: errorConexion.accion ?? null,
  });
};
