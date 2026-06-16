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
  const response = await apiFetch('/ventas', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as CreateVentaResponse;
  invalidateApiCache();
  return response;
}

export function sortByFIFO(l:any[]):any[]{return[...l].sort((a,b)=>{return new Date(a.fechaIngreso||a.fecha).getTime()-new Date(b.fechaIngreso||b.fecha).getTime()})}

