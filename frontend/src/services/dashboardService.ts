import { apiFetch } from './apiService';

export type DashboardSummary = {
  inventoryAvailableKg: number;
  inventoryByType: Array<{
    tipoCafeId: string;
    tipoCafe: string;
    kg: number;
  }>;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  totalWasteKg: number;
  hasRecords: boolean;
};

export async function obtenerResumenDashboard() {
  return apiFetch('/dashboard/summary') as Promise<DashboardSummary>;
}
