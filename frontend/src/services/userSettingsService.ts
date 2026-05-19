import { apiFetch } from './apiService';

export type OrganizationSettingsResponse = {
  id: string;
  nombre: string;
  tipo: string;
  otroTipoDetalle: string | null;
};

export type UserProfileResponse = {
  id: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  organizacionId?: string | null;
};

export function actualizarConfiguracionOrganizacion(input: {
  nombreOrganizacion: string;
  tipoOrganizacion: string;
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
