import { apiFetch } from './apiService';
import type { DocumentType } from '../utils/personValidation';

export type ContactoRol = 'CLIENTE' | 'PRODUCTOR';
export type ContactoFiltroRol = ContactoRol | 'MULTIROL';

export type ContactoItem = {
  id: string;
  nombre: string;
  documento: string;
  tipoDocumento: DocumentType;
  telefono: string | null;
  roles: ContactoRol[];
  esMultirol: boolean;
  etiquetaRol: 'Cliente' | 'Productor' | 'Multirol';
  descripcionRol: string;
  clienteId: string | null;
  productorId: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GuardarContactoPayload = {
  nombre: string;
  documento: string;
  tipoDocumento: DocumentType;
  telefono?: string;
  roles: ContactoRol[];
};

export async function listarContactos(rol?: ContactoFiltroRol) {
  const query = rol ? `?rol=${encodeURIComponent(rol)}` : '';
  const endpoint = `/contactos${query}`;
  if (import.meta.env.DEV) {
    console.debug('[CafeSmart][contactos] request', {
      endpoint,
      method: 'GET',
      rol: rol ?? 'TODOS',
    });
  }
  try {
    const response = (await apiFetch(endpoint)) as ContactoItem[];
    if (import.meta.env.DEV) {
      console.debug('[CafeSmart][contactos] response', {
        endpoint,
        method: 'GET',
        status: 'ok',
        count: Array.isArray(response) ? response.length : null,
        response,
      });
    }
    return response;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug('[CafeSmart][contactos] error', {
        endpoint,
        method: 'GET',
        status:
          error && typeof error === 'object' && 'status' in error
            ? (error as { status?: unknown }).status
            : 'unknown',
        response: error instanceof Error ? error.message : error,
        error,
      });
    }
    throw error;
  }
}

export async function crearContacto(payload: GuardarContactoPayload) {
  return apiFetch('/contactos', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<ContactoItem>;
}

export async function actualizarContacto(id: string, payload: GuardarContactoPayload) {
  return apiFetch(`/contactos/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }) as Promise<ContactoItem>;
}

export async function agregarRolContacto(id: string, rol: ContactoRol) {
  return apiFetch(`/contactos/${encodeURIComponent(id)}/roles`, {
    method: 'POST',
    body: JSON.stringify({ rol }),
  }) as Promise<ContactoItem>;
}

export async function retirarRolContacto(id: string, rol: ContactoRol) {
  return apiFetch(`/contactos/${encodeURIComponent(id)}/roles/${rol}`, {
    method: 'DELETE',
  }) as Promise<ContactoItem>;
}
