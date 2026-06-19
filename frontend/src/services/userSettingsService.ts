import { apiFetch } from './apiService';
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

export async function subirFotoPerfil(file: File) {
  const token = await getStoredAuthToken();
  if (!token) {
    throw new Error('No hay sesión activa. Inicia sesión nuevamente.');
  }

  let lastError: unknown = null;

  for (const apiBaseUrl of getApiBaseUrlCandidates()) {
    try {
      const formData = new FormData();
      formData.append('avatar', file, file.name || 'avatar');
      const response = await fetch(`${apiBaseUrl}/users/profile/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as
        | UserProfileResponse
        | { message?: string };

      if (!response.ok) {
        throw new Error(
          typeof data.message === 'string'
            ? data.message
            : 'No pudimos subir la foto de perfil.',
        );
      }

      const profile = data as UserProfileResponse;
      if (!profile.avatarUrl) {
        throw new Error(
          'No pudimos guardar la foto. Revisa tu conexión e inténtalo nuevamente.',
        );
      }

      return profile;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('No pudimos subir la foto de perfil.');
}

export function quitarFotoPerfilRemota() {
  return apiFetch('/users/profile/avatar', {
    method: 'DELETE',
  }) as Promise<UserProfileResponse>;
}
