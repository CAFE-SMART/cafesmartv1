import { apiFetch } from './apiService';

export type ConfiguracionBodega = {
  nombreBodega: string;
  capacidadKg: number | null;
  maxPesoKg: number;
  maxPrecioKg: number;
  maxPrecioVentaKg: number;
  updatedAt: string;
};

export type LimitesEntrada = {
  maxPesoKg: number;
  maxPrecioKg: number;
  maxPrecioVentaKg: number;
};

export type BodegaItem = {
  id: string;
  nombre: string;
  ubicacion: string | null;
  capacidadMaxKg: number;
  cafeAlmacenadoKg: number;
  disponibleKg: number;
  ocupacionPct: number;
  activa: boolean;
  esPrincipal: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GuardarBodegaPayload = {
  nombre: string;
  ubicacion?: string | null;
  capacidadMaxKg: number;
  activa?: boolean;
  esPrincipal?: boolean;
};

/**
 * Obtiene la configuración de bodega del servidor.
 */
export async function obtenerConfiguracionBodega(): Promise<ConfiguracionBodega> {
  return apiFetch('/bodega/configuracion') as Promise<ConfiguracionBodega>;
}

/**
 * Guarda la configuración de bodega en el servidor.
 */
export async function guardarConfiguracionBodega(config: {
  nombreBodega: string;
  capacidadKg: number;
}): Promise<ConfiguracionBodega> {
  return apiFetch('/bodega/configuracion', {
    method: 'POST',
    body: JSON.stringify({
      nombreBodega: config.nombreBodega,
      capacidadKg: config.capacidadKg,
    }),
  }) as Promise<ConfiguracionBodega>;
}

export async function guardarLimitesEntrada(
  limites: LimitesEntrada,
): Promise<LimitesEntrada> {
  return apiFetch('/bodega/limites', {
    method: 'POST',
    body: JSON.stringify(limites),
  }) as Promise<LimitesEntrada>;
}

export function listarBodegas() {
  return apiFetch('/bodega') as Promise<BodegaItem[]>;
}

export function obtenerBodega(id: string) {
  return apiFetch(`/bodega/detalle/${encodeURIComponent(id)}`) as Promise<BodegaItem>;
}

export function crearBodega(payload: GuardarBodegaPayload) {
  return apiFetch('/bodega', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<BodegaItem>;
}

export function editarBodega(id: string, payload: Partial<GuardarBodegaPayload>) {
  return apiFetch(`/bodega/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }) as Promise<BodegaItem>;
}

export function eliminarBodega(id: string) {
  return apiFetch(`/bodega/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }) as Promise<{ ok: boolean }>;
}
