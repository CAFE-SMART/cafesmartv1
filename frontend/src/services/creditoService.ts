import { apiFetch } from './apiService';

export interface CreditoInfo {
  limite: number;
  usado: number;
  disponible: number;
  estado: string;
}

export async function obtenerCreditoAPI(): Promise<CreditoInfo> {
  return apiFetch('/api/credito') as Promise<CreditoInfo>;
}

export async function setLimiteCreditoAPI(limite: number) {
  return apiFetch('/api/credito/limite', {
    method: 'POST',
    body: JSON.stringify({ limite }),
  });
}
