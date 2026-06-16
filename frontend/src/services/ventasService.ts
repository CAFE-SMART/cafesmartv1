import { apiFetch, invalidateApiCache } from './apiService';
import { getStoredAuthToken } from '../storage/authStorage';

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
  clienteId?: string | null;
  clienteRapido?: boolean;
  clienteNombre?: string;
  totalKg?: number;
  totalEstimado?: number;
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
  const token = await getStoredAuthToken();
  if (!token) {
    throw new Error('No hay sesión activa. Inicia sesión nuevamente.');
  }

  const payloadFiltrado: CreateVentaPayload = {
    ...payload,
    detalles: payload.detalles.filter(
      (detalle) =>
        Boolean(detalle.subloteId) &&
        Number(detalle.pesoVendido) > 0 &&
        Number(detalle.precioKg) > 0,
    ),
  };

  if (payloadFiltrado.detalles.length === 0) {
    throw new Error('Agrega al menos un cafe con cantidad y precio validos.');
  }

  const payloadLog = {
    endpoint: '/ventas',
    authTokenPresent: true,
    fecha: payloadFiltrado.fecha ?? null,
    clienteId: payloadFiltrado.clienteId ?? null,
    clienteRapido: Boolean(payloadFiltrado.clienteRapido),
    clienteNombre: payloadFiltrado.clienteNombre ?? null,
    deviceIdPresent: Boolean(payloadFiltrado.deviceId),
    localIdPresent: Boolean(payloadFiltrado.localId),
    detallesCount: payloadFiltrado.detalles.length,
    totalKg: payloadFiltrado.detalles.reduce(
      (total, detalle) => total + Number(detalle.pesoVendido || 0),
      0,
    ),
    totalEstimado: payloadFiltrado.detalles.reduce(
      (total, detalle) =>
        total +
        Number(detalle.pesoVendido || 0) * Number(detalle.precioKg || 0),
      0,
    ),
    detalles: payloadFiltrado.detalles.map((detalle, index) => ({
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
      body: JSON.stringify(payloadFiltrado),
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

