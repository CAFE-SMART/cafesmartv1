import { apiFetch } from './apiService';

export type OrganizationSettingsResponse = {
  id: string;
  nombre: string;
  tipo: string;
  otroTipoDetalle: string | null;
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
