import { apiFetch } from './apiService';

export type DashboardMovimiento = {
  id: string;
  tipo: 'COMPRA' | 'VENTA' | 'GASTO';
  nombre: string;
  kg: number;
  valor: number;
  fecha: string;
};

export type DashboardSummary = {
  updatedAt: string;
  comprasHoy: number;
  ventasHoy: number;
  gastosHoy: number;
  kgCompradosHoy: number;
  totalComprasHoy: number;
  totalVentasHoy: number;
  totalGastosHoy: number;
  totalProductores: number;
  kgActual: number;
  kgCapacidad: number | null;
  inventarioPorTipo: {
    tipoCafeId: string;
    tipoCafe: string;
    kgDisponible: number;
  }[];
  utilidadTotalAcumulada: number;
  mermaTotalKg: number;
  mermaTotalPorcentaje: number;
  mermaTotalValor: number;
  movimientosRecientes: DashboardMovimiento[];
};

export type DashboardInicioBodegaItem = {
  key: 'VERDE_BUENO' | 'VERDE_REGULAR' | 'SECO_BUENO';
  tipo: 'Verde' | 'Seco';
  calidad: 'Bueno' | 'Regular';
  tipoCafeId: string;
  calidadId: string;
  totalKg: number;
  lots: number;
  averageDays: number;
};

export type DashboardInicio = DashboardSummary & {
  inventarioBodega: DashboardInicioBodegaItem[];
};

export async function obtenerDashboardSummary() {
  return apiFetch('/dashboard/summary') as Promise<DashboardSummary>;
}

export async function obtenerDashboardInicio() {
  return apiFetch('/dashboard/inicio') as Promise<DashboardInicio>;
}
