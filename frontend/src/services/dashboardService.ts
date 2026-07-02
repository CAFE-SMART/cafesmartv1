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
  comprasHoy: number;
  ventasHoy: number;
  gastosHoy: number;
  kgCompradosHoy: number;
  totalComprasHoy: number;
  totalVentasHoy: number;
  totalGastosHoy: number;
  totalComprasSemana?: number;
  totalVentasSemana?: number;
  totalGastosSemana?: number;
  totalComprasAcumulado?: number;
  totalVentasAcumulado?: number;
  totalGastosAcumulado?: number;
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

export type DashboardInicioSubloteAntiguo = {
  id: string;
  tipo: string;
  calidad: string;
  tipoCafeId: string;
  calidadId: string;
  totalKg: number;
  days: number;
};

export type DashboardInicio = Pick<
  DashboardSummary,
  | 'comprasHoy'
  | 'ventasHoy'
  | 'gastosHoy'
  | 'kgCompradosHoy'
  | 'totalComprasHoy'
  | 'totalVentasHoy'
  | 'totalGastosHoy'
  | 'totalProductores'
  | 'kgActual'
  | 'kgCapacidad'
  | 'inventarioPorTipo'
> & {
  inventarioBodega: DashboardInicioBodegaItem[];
  sublotesAntiguos?: DashboardInicioSubloteAntiguo[];
  totalComprasHistorico: number;
};

export async function obtenerDashboardSummary() {
  return apiFetch('/dashboard/summary') as Promise<DashboardSummary>;
}

export async function obtenerDashboardInicio() {
  return apiFetch('/dashboard/inicio') as Promise<DashboardInicio>;
}
