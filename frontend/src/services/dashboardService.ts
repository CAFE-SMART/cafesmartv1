import { apiFetch } from './apiService';

export type DashboardMovimiento = {
  id: string;
  tipo: 'COMPRA' | 'VENTA';
  nombre: string;
  kg: number;
  valor: number;
  fecha: string;
};

export type DashboardSummary = {
  comprasHoy: number;
  ventasHoy: number;
  kgCompradosHoy: number;
  totalProductores: number;
  kgActual: number;
  kgCapacidad: number;
  inventarioPorTipo: {
    tipoCafeId: string;
    tipoCafe: string;
    kgDisponible: number;
  }[];
  utilidadTotalAcumulada: number;
  mermaTotalKg: number;
  movimientosRecientes: DashboardMovimiento[];
};

export async function obtenerDashboardSummary() {
  return apiFetch('/dashboard/summary') as Promise<DashboardSummary>;
}
