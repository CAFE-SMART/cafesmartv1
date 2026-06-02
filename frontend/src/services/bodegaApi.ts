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
