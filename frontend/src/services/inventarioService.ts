import { apiFetch } from './apiService';

export type InventarioResumen = {
  kgActual: number;
  kgCapacidad: number;
};

/**
 * Obtiene el resumen de inventario actual (kg en bodega y capacidad).
 * Usa el endpoint de dashboard que ya devuelve esta información.
 */
export async function obtenerInventarioResumen(): Promise<InventarioResumen> {
  const data = await apiFetch('/dashboard/summary') as {
    kgActual: number;
    kgCapacidad: number;
  };
  return {
    kgActual: Number(data.kgActual) || 0,
    kgCapacidad: Number(data.kgCapacidad) || 3000,
  };
}
