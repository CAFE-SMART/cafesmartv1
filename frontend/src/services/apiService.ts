/*
 * ========================================================
 * 📡 ARCHIVO: apiService.ts (Envoltorio para Fetch)
 * ========================================================
 * Este servicio intercepta todas las peticiones a la API para
 * inyectar automáticamente el token JWT si el usuario está logueado.
 */
export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`http://localhost:3000${endpoint}`, {
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
