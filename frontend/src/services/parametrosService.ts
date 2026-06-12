import { apiFetch } from './apiService';

export async function obtenerParametro(nombre: string): Promise<number> {
  return apiFetch(`/api/parametros/${encodeURIComponent(nombre)}`) as Promise<number>;
}
