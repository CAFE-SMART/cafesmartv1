import { AUTH_STORAGE_KEYS, getAuthStorageValue } from '../storage/authStorage';

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
  };

  return mapa[texto] || texto;
}

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const API_BASE_URL =
    (import.meta.env.VITE_API_URL as string | undefined)?.trim() || 'http://localhost:3000';
  const token = await getAuthStorageValue(AUTH_STORAGE_KEYS.token);

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const mensaje = traducirMensajeError(data?.message, response.status);
    throw new Error(mensaje || 'No fue posible completar la solicitud.');
  }

  return data;
};
