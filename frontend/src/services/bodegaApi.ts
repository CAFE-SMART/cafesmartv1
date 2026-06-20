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
  descripcion: string | null;
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
  descripcion?: string | null;
  capacidadMaxKg: number;
  activa?: boolean;
  esPrincipal?: boolean;
};

export type LimitesBodega = {
  limiteMinimoKg: number;
  limiteMaximoKg: number;
  alertaPreventivaPct: number;
  alertaCriticaPct: number;
  bloquearAlSuperarCapacidad: boolean;
  alertasActivas: boolean;
};

export type LimitesBodegaGeneralResponse = LimitesBodega & {
  bodegasAfectadas: number;
};

function logBodegaDebug(
  message: string,
  data: Record<string, unknown>,
) {
  if (!import.meta.env.DEV) return;
  console.debug(`[CafeSmart][bodegas] ${message}`, data);
}

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
  logBodegaDebug('request', {
    method: 'POST',
    endpoint: '/bodega',
    payload,
  });
  return apiFetch('/bodega', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
    .then((response) => {
      logBodegaDebug('response', {
        method: 'POST',
        endpoint: '/bodega',
        status: 'ok',
        response,
      });
      return response as BodegaItem;
    })
    .catch((error) => {
      logBodegaDebug('error', {
        method: 'POST',
        endpoint: '/bodega',
        status: error?.status ?? 'unknown',
        response: error?.message ?? error,
      });
      throw error;
    });
}

export function editarBodega(id: string, payload: Partial<GuardarBodegaPayload>) {
  const endpoint = `/bodega/${encodeURIComponent(id)}`;
  logBodegaDebug('request', {
    method: 'PATCH',
    endpoint,
    payload,
  });
  return apiFetch(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
    .then((response) => {
      logBodegaDebug('response', {
        method: 'PATCH',
        endpoint,
        status: 'ok',
        response,
      });
      return response as BodegaItem;
    })
    .catch((error) => {
      logBodegaDebug('error', {
        method: 'PATCH',
        endpoint,
        status: error?.status ?? 'unknown',
        response: error?.message ?? error,
      });
      throw error;
    });
}

export function eliminarBodega(id: string) {
  const endpoint = `/bodega/${encodeURIComponent(id)}`;
  logBodegaDebug('request', {
    method: 'DELETE',
    endpoint,
    payload: { id },
  });
  return apiFetch(endpoint, {
    method: 'DELETE',
  })
    .then((response) => {
      logBodegaDebug('response', {
        method: 'DELETE',
        endpoint,
        status: 'ok',
        response,
      });
      return response as { ok: boolean };
    })
    .catch((error) => {
      logBodegaDebug('error', {
        method: 'DELETE',
        endpoint,
        status: error?.status ?? 'unknown',
        response: error?.message ?? error,
      });
      throw error;
    });
}

export function obtenerLimitesBodega(id: string) {
  return apiFetch(`/bodega/${encodeURIComponent(id)}/limites`) as Promise<LimitesBodega>;
}

export function guardarLimitesBodega(id: string, payload: LimitesBodega) {
  return apiFetch(`/bodega/${encodeURIComponent(id)}/limites`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }) as Promise<LimitesBodega>;
}

export function aplicarLimitesBodegaGeneral(
  payload: LimitesBodega & {
    scope?: 'todas' | 'activas' | 'seleccionadas';
    bodegaIds?: string[];
  },
) {
  return apiFetch('/bodega/limites/general', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<LimitesBodegaGeneralResponse>;
}
