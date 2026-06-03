import { apiFetch, invalidateApiCache } from './apiService';

export type SubloteResumen = {
  id: string;
  tipoCafe: string;
  calidad: string;
  pesoActual: number;
};

export type GastoItem = {
  id: string;
  conceptoGasto: string;
  descripcion: string | null;
  montoGasto: number;
  fechaGasto: string;
  tipoGasto: string;
  estadoPago: string;
  esGastoGeneral: boolean;
  createdAt: string;
  updatedAt: string;
  sublotes: SubloteResumen[];
};

export type CrearGastoPayload = {
  conceptoGasto: string;
  descripcion?: string;
  montoGasto: number;
  fechaGasto: string; // ISO 8601
  tipoGasto:
    | 'TRANSPORTE'
    | 'COMIDA'
    | 'SECADO'
    | 'CARGUE'
    | 'DESCARGUE'
    | 'OTROS';
  estadoPago: 'PAGADO' | 'PENDIENTE';
  deviceId?: string;
  localId?: string;
  asociarASublotes?: boolean;
  subloteIds?: string[];
};

export type ActualizarGastoPayload = Partial<CrearGastoPayload>;

export type GastoTipo = CrearGastoPayload['tipoGasto'];
export type GastoEstadoPago = CrearGastoPayload['estadoPago'];
export type GastoAplicaA = 'GENERAL' | 'SUBLOTES';

export type RegistrarGastoLocalPayload = {
  id: string;
  concepto: string;
  descripcion?: string;
  monto: number;
  fecha: string;
  tipo: GastoTipo;
  estadoPago: GastoEstadoPago;
  aplicaA: GastoAplicaA;
  lotesIds?: string[];
};

export type ListarGastosParams = {
  subloteId?: string;
  fecha?: string;
  tipo?: string;
  orden?: 'recent' | 'oldest';
  page?: number;
  limit?: number;
  signal?: AbortSignal;
};

export async function listarGastos(params?: string | ListarGastosParams) {
  const options =
    typeof params === 'string' ? { subloteId: params } : (params ?? {});
  const search = new URLSearchParams();
  if (options.subloteId) search.set('subloteId', options.subloteId);
  if (options.fecha) search.set('fecha', options.fecha);
  if (options.tipo && options.tipo !== 'TODOS') search.set('tipo', options.tipo);
  if (options.orden) search.set('orden', options.orden);
  if (options.page) search.set('page', String(options.page));
  if (options.limit) search.set('limit', String(options.limit));
  const query = search.toString() ? `?${search.toString()}` : '';
  return apiFetch(`/gastos${query}`, { signal: options.signal }) as Promise<GastoItem[]>;
}

export async function crearGasto(payload: CrearGastoPayload) {
  const response = await apiFetch('/gastos', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as GastoItem;
  invalidateApiCache();
  return response;
}

export async function actualizarEstadoGasto(
  id: string,
  estadoPago: GastoEstadoPago,
) {
  const response = await apiFetch(`/gastos/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estadoPago }),
  }) as GastoItem;
  invalidateApiCache();
  return response;
}

export async function actualizarGasto(
  id: string,
  payload: ActualizarGastoPayload,
) {
  const response = await apiFetch(`/gastos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }) as GastoItem;
  invalidateApiCache();
  return response;
}

export async function eliminarGasto(id: string) {
  await apiFetch(`/gastos/${id}`, {
    method: 'DELETE',
  });
  invalidateApiCache();
}

export async function registrarGastoLocal(payload: RegistrarGastoLocalPayload) {
  return crearGasto({
    conceptoGasto: payload.concepto,
    descripcion: payload.descripcion,
    montoGasto: payload.monto,
    fechaGasto: new Date(payload.fecha).toISOString(),
    tipoGasto: payload.tipo,
    estadoPago: payload.estadoPago,
    localId: payload.id,
    asociarASublotes: payload.aplicaA === 'SUBLOTES',
    subloteIds: payload.aplicaA === 'SUBLOTES' ? (payload.lotesIds ?? []) : [],
  });
}

export async function obtenerGasto(id: string) {
  return apiFetch(`/gastos/${id}`) as Promise<GastoItem>;
}

export async function listarGastosPorSublote(subloteId: string) {
  return apiFetch(`/gastos/sublote/${subloteId}`) as Promise<GastoItem[]>;
}
