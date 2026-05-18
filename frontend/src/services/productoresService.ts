import { apiFetch } from './apiService';
import type { DocumentType } from '../utils/personValidation';

export type ProductorItem = {
  id: string;
  nombre: string;
  tipoDocumento: DocumentType | null;
  documento: string | null;
  telefono: string | null;
  createdAt: string;
};

export type GuardarProductorPayload = {
  nombre: string;
  tipoDocumento?: DocumentType;
  documento?: string;
  telefono?: string;
};

export type ListarProductoresParams = {
  q?: string;
  limit?: number;
  offset?: number;
  orden?: 'recientes' | 'antiguos' | 'az';
};

export async function listarProductores(
  params: ListarProductoresParams = {},
) {
  const searchParams = new URLSearchParams();

  if (params.q?.trim()) searchParams.set('q', params.q.trim());
  if (typeof params.limit === 'number') {
    searchParams.set('limit', String(params.limit));
  }
  if (typeof params.offset === 'number') {
    searchParams.set('offset', String(params.offset));
  }
  if (params.orden) searchParams.set('orden', params.orden);

  const query = searchParams.toString();
  return apiFetch(`/productores${query ? `?${query}` : ''}`) as Promise<
    ProductorItem[]
  >;
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
