import { AUTH_STORAGE_KEYS, getAuthStorageValue } from '../storage/authStorage';

/*
 * ========================================================
 * 📡 ARCHIVO: apiService.ts (Envoltorio para Fetch)
 * ========================================================
 * Este servicio intercepta todas las peticiones a la API para
 * inyectar automáticamente el token JWT si el usuario está logueado.
 */
export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || 'http://localhost:3000';
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
    // Si la respuesta es error, lanzamos un throw para que el componente lo atrape
    throw new Error(data?.message || 'Error en la petición');
  }

  return data;
};
