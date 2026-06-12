import { apiFetch } from './apiService';
import type { DocumentType } from '../utils/personValidation';

export type ClienteItem = {
  id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  createdAt: string;
};

export type GuardarClientePayload = {
  nombre: string;
  tipoDocumento?: DocumentType;
  documento?: string;
  telefono?: string;
};

export type ListarClientesParams = {
  q?: string;
  limit?: number;
  offset?: number;
  orden?: 'recientes' | 'antiguos' | 'az';
};

export async function listarClientes(params: ListarClientesParams = {}) {
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
  return apiFetch(`/clientes${query ? `?${query}` : ''}`) as Promise<
    ClienteItem[]
  >;
}

export async function crearCliente(payload: GuardarClientePayload) {
  return apiFetch('/clientes', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<ClienteItem>;
}

export async function actualizarCliente(
  id: string,
  payload: GuardarClientePayload,
) {
  return apiFetch(`/clientes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }) as Promise<ClienteItem>;
}
