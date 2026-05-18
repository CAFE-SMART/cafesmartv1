import { apiFetch } from './apiService';

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

export async function listarGastos(subloteId?: string) {
  const query = subloteId ? `?subloteId=${encodeURIComponent(subloteId)}` : '';
  return apiFetch(`/gastos${query}`) as Promise<GastoItem[]>;
}

export async function crearGasto(payload: CrearGastoPayload) {
  return apiFetch('/gastos', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<GastoItem>;
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

export async function actualizarEstadoGasto(
  id: string,
  estadoPago: GastoEstadoPago,
) {
  return apiFetch(`/gastos/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estadoPago }),
  }) as Promise<GastoItem>;
}

export async function listarGastosPorSublote(subloteId: string) {
  return apiFetch(`/gastos/sublote/${subloteId}`) as Promise<GastoItem[]>;
}
