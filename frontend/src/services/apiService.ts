import { AUTH_STORAGE_KEYS, getAuthStorageValue } from '../storage/authStorage';
import API_URL from '../config/api';

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function traducirMensajeError(message: string | null | undefined, status: number) {
  const texto = (message || '').trim();

  if (!texto) {
    if (status >= 500) {
      return 'Ocurrio un problema interno del sistema. Por favor comunicate con la persona encargada.';
    }

    if (status === 401) {
      return 'Tu sesion ya no esta activa. Ingresa nuevamente.';
    }

    if (status === 403) {
      return 'No tienes permiso para realizar esta accion.';
    }

    if (status === 404) {
      return 'No se encontro la informacion solicitada.';
    }

    return 'No fue posible completar la solicitud.';
  }

  const mapa: Record<string, string> = {
    'Internal server error': 'Ocurrio un problema interno del sistema. Por favor comunicate con la persona encargada.',
    Unauthorized: 'Tu sesion ya no esta activa. Ingresa nuevamente.',
    Forbidden: 'No tienes permiso para realizar esta accion.',
    'Forbidden resource': 'No tienes permiso para realizar esta accion.',
    'Not Found': 'No se encontro la informacion solicitada.',
    'Bad Request': 'No fue posible procesar la informacion enviada. Revisa los datos e intenta de nuevo.',
    'Failed to fetch': 'No fue posible conectarse con el servidor. Verifica que el backend este encendido y que esta app pueda alcanzarlo.',
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

  return 'No fue posible conectarse con el servidor. Verifica la conexion e intenta nuevamente.';
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
        throw new Error(mensaje || 'No fue posible completar la solicitud.');
      }

      return data;
    } catch (error) {
      ultimoError = error;

      if (!(error instanceof TypeError)) {
        throw error;
      }
    }
  }

  throw new Error(traducirErrorConexion(ultimoError));
};
