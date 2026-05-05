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
  movimientosRecientes: DashboardMovimiento[];
  totalRevenue?: number;
  totalExpenses?: number;
  totalProfit?: number;
  totalWasteKg?: number;
};

export async function obtenerDashboardSummary() {
  return apiFetch('/dashboard/summary', { cache: 'no-store' }) as Promise<DashboardSummary>;
}

export const obtenerResumenDashboard = obtenerDashboardSummary;
