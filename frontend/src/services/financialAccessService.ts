import { apiFetch } from './apiService';

export async function verificarPasswordFinanciero(password: string) {
  return apiFetch('/auth/verify-password', {
    method: 'POST',
    body: JSON.stringify({ password }),
  }) as Promise<{ valid: true }>;
}
