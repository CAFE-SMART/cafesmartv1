import { apiFetch } from './apiService';

export type ClienteItem = {
  id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  createdAt: string;
};

export type GuardarClientePayload = {
  nombre: string;
  documento?: string;
  telefono?: string;
};

export async function listarClientes() {
  return apiFetch('/clientes') as Promise<ClienteItem[]>;
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
