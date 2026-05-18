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

export async function obtenerDashboardSummary() {
  return apiFetch('/dashboard/summary') as Promise<DashboardSummary>;
}
