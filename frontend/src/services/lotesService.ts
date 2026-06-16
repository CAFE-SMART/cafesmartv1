import { apiFetch, type ApiFetchOptions } from './apiService';

export type LoteResumen = {
  id: string;
  codigo: string;
  tipoCafeId: string;
  tipoCafe: string;
  calidadId: string;
  calidad: string;
  sublotes: number;
  sublotesConHumedad: number;
  pesoInicial: number;
  pesoActual: number;
  precioPromedioKg: number;
  humedadPromedio: number | null;
  fecha: string;
  fechaPrimerIngreso: string;
  fechaUltimoIngreso: string;
  diasEnBodegaMin: number;
  diasEnBodegaMax: number;
  creadoEn: string;
  totalVentas: number;
  totalGastos: number;
  utilidadNeta: number;
  mermaValor: number;
  mermaKg: number;
};

export type SubloteDetalle = {
  id: string;
  codigo?: string;
  etiqueta: string;
  tipoCafeId: string;
  tipoCafe: string;
  calidadId: string;
  calidad: string;
  pesoInicial: number;
  pesoActual: number;
  precioKg: number;
  humedad: number | null;
  factor: number | null;
  fechaIngreso: string;
  diasEnBodega: number;
  creadoEn: string;
  codigoOrigen?: string | null;
  procesoOrigen?: 'SECADO' | null;
  costoTotal: number;
  totalVentas: number;
  pesoVendido: number;
  totalGastos: number;
  mermaKg: number;
  mermaPorcentaje: number;
  mermaValor: number;
  utilidadNeta: number;
  costoPorKg: number;
};

export type ResultadosFinancierosSublote = {
  subloteId: string;
  costoTotal: number;
  totalVentas: number;
  pesoVendido: number;
  totalGastos: number;
  mermaKg: number;
  mermaPorcentaje: number;
  mermaValor: number;
  utilidadNeta: number;
  costoPorKg: number;
};

export type LoteDetalle = {
  lote: LoteResumen;
  sublotes: SubloteDetalle[];
};

export type ActualizarHumedadPayload = {
  id: string;
  humedad: number | null;
};

export type ActualizarFactorPayload = {
  id: string;
  factor: number | null;
};

export type ActualizarPesoPayload = {
  id: string;
  pesoActual: number;
  motivo?: string;
};

export async function obtenerLotes() {
  return apiFetch('/lotes') as Promise<LoteResumen[]>;
}

export async function obtenerDetalleLote(
  tipoCafeId: string,
  calidadId: string,
  options: Pick<ApiFetchOptions, 'signal' | 'timeoutMs'> = {},
) {
  return apiFetch(
    `/lotes/${tipoCafeId}/${calidadId}/sublotes`,
    options,
  ) as Promise<LoteDetalle>;
}

export async function obtenerResultadosFinancierosSublote(subloteId: string) {
  return apiFetch(
    `/lotes/sublotes/${subloteId}/resultados-financieros`,
  ) as Promise<ResultadosFinancierosSublote>;
}

export async function guardarHumedadesSublotes(
  sublotes: ActualizarHumedadPayload[],
) {
  return apiFetch('/lotes/sublotes/humedad', {
    method: 'PATCH',
    body: JSON.stringify({ sublotes }),
  }) as Promise<{ totalActualizados: number }>;
}

export async function guardarFactoresSublotes(
  sublotes: ActualizarFactorPayload[],
) {
  return apiFetch('/lotes/sublotes/factor', {
    method: 'PATCH',
    body: JSON.stringify({ sublotes }),
  }) as Promise<{ totalActualizados: number }>;
}

export async function guardarPesosSublotes(sublotes: ActualizarPesoPayload[]) {
  return apiFetch('/lotes/sublotes/peso', {
    method: 'PATCH',
    body: JSON.stringify({ sublotes }),
  }) as Promise<{ totalActualizados: number }>;
}
