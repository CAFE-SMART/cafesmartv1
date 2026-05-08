import { apiFetch } from './apiService';

export type InventarioResumen = {
  kgActual: number;
  kgCapacidad: number | null;
};

/**
 * Obtiene el resumen de inventario actual (kg en bodega y capacidad).
 * Usa el endpoint de dashboard que ya devuelve esta información.
 */
export async function obtenerInventarioResumen(): Promise<InventarioResumen> {
  const data = (await apiFetch('/dashboard/summary')) as {
    kgActual: number;
    kgCapacidad: number | null;
  };
  return {
    kgActual: Number(data.kgActual) || 0,
    kgCapacidad:
      Number.isFinite(Number(data.kgCapacidad)) && Number(data.kgCapacidad) > 0
        ? Number(data.kgCapacidad)
        : null,
  };
}
