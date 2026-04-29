import { AUTH_STORAGE_KEYS, getAuthStorageValue } from '../storage/authStorage';
import API_URL from '../config/api';

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

function traducirMensajeError(message: string | null | undefined, status: number) {
  const texto = (message || '').trim();

  if (!texto) {
    if (status >= 500) {
      return 'Intenta guardar de nuevo. Tuvimos un inconveniente, pero tus datos están a salvo.';
    }

    if (status === 401) {
      return 'Ingresa otra vez. Tu sesión se cerró para proteger tu cuenta.';
    }

    if (status === 403) {
      return 'Pide autorización al administrador. Tu cuenta actual no tiene habilitada esta opción.';
    }

    if (status === 404) {
      return 'Revisa tu búsqueda. No logramos encontrar la información que solicitas.';
    }

    return 'Intenta la acción nuevamente. Hubo un pequeño tropiezo procesando tus datos.';
  }

  const mapa: Record<string, string> = {
    'Internal server error': 'Guarda tu progreso de nuevo. Tuvimos un inconveniente técnico, pero nada se ha perdido.',
    Unauthorized: 'Ingresa de nuevo a tu cuenta. La sesión se cerró por tu seguridad.',
    Forbidden: 'Solicita acceso para esto. Tu cuenta no tiene permisos para usar esta función.',
    'Forbidden resource': 'Solicita acceso para esto. Tu cuenta no tiene permisos para esta opción.',
    'Not Found': 'Revisa el dato buscado. No logramos encontrar esa información en el sistema.',
    'Bad Request': 'Verifica lo que escribiste. Parece que falta algún dato o hay un pequeño error de escritura.',
    'Failed to fetch': 'Comprueba tu conexión. Parece que tu celular se quedó sin internet temporalmente.',
  };

  return mapa[texto] || texto;
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
      candidatas.push(`${urlConfigurada.protocol}//${hostActual}${urlConfigurada.port ? `:${urlConfigurada.port}` : ''}`);
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

  return 'Verifica la conexión. No pudimos conectarnos al sistema, por favor revisa el internet de tu celular.';
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
