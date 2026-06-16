import { apiFetch, invalidateApiCache } from './apiService';

export type VentaClientePayload = {
  nombre: string;
  documento: string;
  telefono?: string;
  detalle?: string;
  rapido?: boolean;
};

export type VentaDetallePayload = {
  subloteId: string;
  pesoVendido: number;
  precioKg: number;
};

export type CreateVentaPayload = {
  fecha?: string;
  deviceId: string;
  localId: string;
  clienteId?: string;
  detalles: VentaDetallePayload[];
};

export type CreateVentaResponse = {
  venta: {
    id: string;
    fecha: string;
    totalVenta: number;
    localId: string;
    deviceId: string;
    clienteId: string | null;
  };
  detalles: Array<{
    id: string;
    subloteId: string;
    pesoVendido: number;
    precioKg: number;
    subtotal: number;
  }>;
};

export type VentaListadoItem = {
  id: string;
  fecha: string;
  clienteNombre: string;
  clienteDocumento: string;
  totalVenta: number;
  totalKg: number;
  detalles: Array<{
    subloteId?: string;
    subloteCodigo?: string;
    tipoCafe?: string;
    calidad?: string;
    fechaIngreso?: string;
    fecha_ingreso?: string;
    pesoVendido: number;
    precioKg: number;
    precioCompra?: number;
    precio_compra?: number;
    subtotal: number;
    ventaNumero?: number;
    pesoRestante?: number;
    peso_restante?: number;
    sublote?: {
      precioCompra?: number;
      precio_compra?: number;
      fechaIngreso?: string;
      fecha_ingreso?: string;
      pesoDisponible?: number;
      peso_disponible?: number;
    };
  }>;
  detallesSublotes?: Array<{
    subloteId: string;
    codigoSublote: string;
    tipoCafe: string;
    calidad: string;
    kilosVendidos: number;
    precioVentaKg: number;
    precioCompraKg: number;
    fechaIngreso: string;
    inventarioRestante: number;
  }>;
};

export type VentaListadoResponse = {
  totalAcumulado: number;
  registros: VentaListadoItem[];
};

const VENTA_CREATE_TIMEOUT_MS = 30_000;

export type ListarVentasParams = {
  fecha?: string;
  orden?: 'recent' | 'oldest';
  page?: number;
  limit?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export async function listarVentas(params: ListarVentasParams = {}) {
  const search = new URLSearchParams();
  if (params.fecha) search.set('fecha', params.fecha);
  if (params.orden) search.set('orden', params.orden);
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  const query = search.toString() ? `?${search.toString()}` : '';
  return apiFetch(`/ventas${query}`, {
    signal: params.signal,
    timeoutMs: params.timeoutMs,
  }) as Promise<VentaListadoResponse>;
}

export async function crearVenta(payload: CreateVentaPayload) {
  const payloadLog = {
    endpoint: '/ventas',
    fecha: payload.fecha ?? null,
    clienteId: payload.clienteId ?? null,
    deviceIdPresent: Boolean(payload.deviceId),
    localIdPresent: Boolean(payload.localId),
    detallesCount: payload.detalles.length,
    totalKg: payload.detalles.reduce(
      (total, detalle) => total + Number(detalle.pesoVendido || 0),
      0,
    ),
    totalEstimado: payload.detalles.reduce(
      (total, detalle) =>
        total +
        Number(detalle.pesoVendido || 0) * Number(detalle.precioKg || 0),
      0,
    ),
    detalles: payload.detalles.map((detalle, index) => ({
      index,
      subloteId: detalle.subloteId || null,
      pesoVendido: detalle.pesoVendido,
      precioKg: detalle.precioKg,
      subtotal:
        Number(detalle.pesoVendido || 0) * Number(detalle.precioKg || 0),
    })),
  };

  console.info('[CafeSmart][ventas-create] request', JSON.stringify(payloadLog));

  try {
    const response = (await apiFetch('/ventas', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: VENTA_CREATE_TIMEOUT_MS,
    })) as CreateVentaResponse;

    console.info(
      '[CafeSmart][ventas-create] response',
      JSON.stringify({
        ventaId: response.venta?.id ?? null,
        fecha: response.venta?.fecha ?? null,
        totalVenta: response.venta?.totalVenta ?? null,
        detallesCount: response.detalles?.length ?? 0,
      }),
    );

    invalidateApiCache();
    return response;
  } catch (error) {
    console.info(
      '[CafeSmart][ventas-create] error',
      JSON.stringify({
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        status:
          typeof error === 'object' && error && 'status' in error
            ? (error as { status?: number }).status
            : null,
        code:
          typeof error === 'object' && error && 'code' in error
            ? (error as { code?: string | null }).code
            : null,
        field:
          typeof error === 'object' && error && 'field' in error
            ? (error as { field?: string | null }).field
            : null,
        details:
          typeof error === 'object' && error && 'details' in error
            ? (error as { details?: unknown }).details
            : null,
      }),
    );
    throw error;
  }
}

export function sortByFIFO(l:any[]):any[]{return[...l].sort((a,b)=>{return new Date(a.fechaIngreso||a.fecha).getTime()-new Date(b.fechaIngreso||b.fecha).getTime()})}

