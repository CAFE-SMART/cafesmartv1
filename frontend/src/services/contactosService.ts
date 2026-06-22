import { ApiRequestError, apiFetch } from './apiService';
import { getApiBaseUrlCandidates } from '../config/api';
import {
  getStoredAuthToken,
  restorePrimaryAuthFromLastSession,
} from '../storage/authStorage';
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

  const normalizeResponse = (data: unknown): ContactoItem[] => {
    if (Array.isArray(data)) return data as ContactoItem[];
    if (data && typeof data === 'object') {
      const record = data as {
        contactos?: unknown;
        data?: unknown;
        items?: unknown;
      };
      if (Array.isArray(record.contactos)) return record.contactos as ContactoItem[];
      if (Array.isArray(record.data)) return record.data as ContactoItem[];
      if (Array.isArray(record.items)) return record.items as ContactoItem[];
    }
    throw new ApiRequestError('La respuesta de contactos no es válida.', {
      status: 0,
      code: 'CONTACTOS_RESPUESTA_INVALIDA',
    });
  };

  let token = await getStoredAuthToken();
  let lastError: unknown = null;

  for (const apiBaseUrl of getApiBaseUrlCandidates()) {
    const url = `${apiBaseUrl}${endpoint}`;
    console.log('[contactos] endpoint:', url);
    console.log('[contactos] token presente:', Boolean(token));

    const request = async (authToken: string | null) =>
      fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      });

    try {
      let response = await request(token);
      let data = await response.json().catch(() => null);

      if (response.status === 401) {
        const restored = await restorePrimaryAuthFromLastSession();
        if (restored?.token && restored.token !== token) {
          token = restored.token;
          response = await request(token);
          data = await response.json().catch(() => null);
        }
      }

      console.log('[contactos] status:', response.status);
      console.log('[contactos] response:', data);

      if (!response.ok) {
        throw new ApiRequestError(
          typeof data?.message === 'string'
            ? data.message
            : 'No pudimos cargar los contactos',
          {
            status: response.status,
            code: typeof data?.code === 'string' ? data.code : null,
            field: typeof data?.field === 'string' ? data.field : null,
            details:
              data?.details && typeof data.details === 'object'
                ? (data.details as Record<string, string[]>)
                : null,
          },
        );
      }

      return normalizeResponse(data);
    } catch (error) {
      lastError = error;
      if (error instanceof ApiRequestError) throw error;
      console.log('[contactos] status:', 'network-error');
      console.log('[contactos] response:', error);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('No pudimos cargar los contactos');
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
