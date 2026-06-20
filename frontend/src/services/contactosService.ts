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
  return apiFetch(`/contactos${query}`) as Promise<ContactoItem[]>;
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
