import { apiFetch, invalidateApiCache } from './apiService';
import { getApiBaseUrlCandidates } from '../config/api';
import { getStoredAuthToken } from '../storage/authStorage';

export type OrganizationSettingsResponse = {
  id: string;
  nombre: string;
  tipo: string;
  otroTipoDetalle: string | null;
  descripcion: string | null;
};

export type UserProfileResponse = {
  id: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  avatarUrl?: string | null;
  organizacionId?: string | null;
  organizacion?: {
    id?: string | null;
    nombre?: string | null;
    tipo?: 'COOPERATIVA' | 'COMPRAVENTA' | 'PERSONALIZADO' | 'OTRO' | null;
    descripcion?: string | null;
  } | null;
  nombreOrganizacion?: string | null;
  tipoOrganizacion?: 'COOPERATIVA' | 'COMPRAVENTA' | 'PERSONALIZADO' | 'OTRO' | null;
  otroTipoDetalle?: string | null;
  descripcionOrganizacion?: string | null;
};

export function actualizarConfiguracionOrganizacion(input: {
  nombreOrganizacion: string;
  tipoOrganizacion: string;
  descripcionOrganizacion?: string | null;
}) {
  return apiFetch('/users/organization', {
    method: 'PATCH',
    body: JSON.stringify(input),
  }) as Promise<OrganizationSettingsResponse>;
}

export function actualizarPerfilUsuario(input: {
  nombre: string;
  correo: string;
  telefono: string | null;
}) {
  return apiFetch('/users/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  }) as Promise<UserProfileResponse>;
}

export function obtenerConfiguracionOrganizacion() {
  return apiFetch('/users/organization') as Promise<OrganizationSettingsResponse>;
}

export function obtenerPerfilUsuario() {
  return apiFetch('/users/profile') as Promise<UserProfileResponse>;
}

export async function subirFotoPerfil(file: File) {
  const token = await getStoredAuthToken();
  if (!token) {
    throw new Error('No hay sesión activa. Inicia sesión nuevamente.');
  }

  if (import.meta.env.DEV) {
    console.debug('[CafeSmart][profile-avatar] archivo seleccionado', {
      name: file.name,
      type: file.type,
      size: file.size,
    });
  }

  let lastError: unknown = null;

  for (const apiBaseUrl of getApiBaseUrlCandidates()) {
    const endpoint = `${apiBaseUrl}/users/profile/avatar`;
    try {
      const formData = new FormData();
      formData.append('avatar', file, file.name || 'avatar');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as
        | UserProfileResponse
        | { message?: string };

      if (import.meta.env.DEV) {
        console.debug('[CafeSmart][profile-avatar] upload response', {
          endpoint: '/users/profile/avatar',
          url: endpoint,
          method: 'POST',
          status: response.status,
          response: data,
          avatarUrl: 'avatarUrl' in data ? data.avatarUrl : null,
        });
      }

      if (!response.ok) {
        if (import.meta.env.DEV) {
          console.debug('[CafeSmart][profile-avatar] upload error', {
            endpoint: '/users/profile/avatar',
            method: 'POST',
            status: response.status,
            response: data,
          });
        }
        throw new Error(
          typeof data.message === 'string'
            ? data.message
            : 'No pudimos subir la foto. Revisa tu conexión e intenta nuevamente.',
        );
      }

      const profile = data as UserProfileResponse;
      if (!profile.avatarUrl) {
        throw new Error(
          'La foto se subió, pero no quedó guardada en tu perfil. Intenta nuevamente.',
        );
      }

      invalidateApiCache();
      return profile;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('No pudimos subir la foto. Revisa tu conexión e intenta nuevamente.');
}

export async function quitarFotoPerfilRemota() {
  const profile = (await apiFetch('/users/profile/avatar', {
    method: 'DELETE',
  })) as UserProfileResponse;
  invalidateApiCache();
  return profile;
}
