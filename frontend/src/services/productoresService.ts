import { apiFetch } from './apiService';

export type ProductorItem = {
  id: string;
  nombre: string;
  documento: string | null;
  tipoDocumento: 'CEDULA' | 'NIT' | null;
  telefono: string | null;
  createdAt: string;
};

export type GuardarProductorPayload = {
  nombre: string;
  documento?: string;
  tipoDocumento?: 'CEDULA' | 'NIT';
  telefono?: string;
};

export async function listarProductores() {
  return apiFetch('/productores') as Promise<ProductorItem[]>;
}

export async function crearProductor(payload: GuardarProductorPayload) {
  return apiFetch('/productores', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<ProductorItem>;
}

export async function actualizarProductor(
  id: string,
  payload: GuardarProductorPayload,
) {
  return apiFetch(`/productores/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }) as Promise<ProductorItem>;
}
