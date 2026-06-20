import { apiFetch } from './apiService';
import { listarContactos } from './contactosService';
import type { DocumentType } from '../utils/personValidation';

export type ProductorItem = {
  id: string;
  nombre: string;
  documento: string | null;
  tipoDocumento: DocumentType | null;
  telefono: string | null;
  createdAt: string;
};

export type GuardarProductorPayload = {
  nombre: string;
  documento?: string;
  tipoDocumento?: DocumentType;
  telefono?: string;
};

export async function listarProductores() {
  const contactos = await listarContactos('PRODUCTOR');
  return contactos
    .filter((contacto) => contacto.productorId)
    .map((contacto) => ({
      id: contacto.productorId as string,
      nombre: contacto.nombre,
      documento: contacto.documento,
      tipoDocumento: contacto.tipoDocumento,
      telefono: contacto.telefono,
      createdAt: contacto.createdAt,
    })) as ProductorItem[];
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

export async function eliminarProductor(id: string) {
  return apiFetch(`/productores/${id}`, {
    method: 'DELETE',
  }) as Promise<void>;
}
