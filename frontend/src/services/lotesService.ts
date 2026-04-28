import { apiFetch } from './apiService';

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
};

export type SubloteDetalle = {
  id: string;
  etiqueta: string;
  tipoCafeId: string;
  tipoCafe: string;
  calidadId: string;
  calidad: string;
  pesoInicial: number;
  pesoActual: number;
  precioKg: number;
  humedad: number | null;
  fechaIngreso: string;
  diasEnBodega: number;
  creadoEn: string;
};

export type LoteDetalle = {
  lote: LoteResumen;
  sublotes: SubloteDetalle[];
};

export type ActualizarHumedadPayload = {
  id: string;
  humedad: number | null;
};

export async function obtenerLotes() {
  return apiFetch('/lotes') as Promise<LoteResumen[]>;
}

export async function obtenerDetalleLote(tipoCafeId: string, calidadId: string) {
  return apiFetch(`/lotes/${tipoCafeId}/${calidadId}/sublotes`) as Promise<LoteDetalle>;
}

export async function obtenerDetalleLotePorId(loteId: string) {
  return apiFetch(`/lotes/detalle/${loteId}`) as Promise<LoteDetalle>;
}

export async function guardarHumedadesSublotes(
  sublotes: ActualizarHumedadPayload[],
) {
  return apiFetch('/lotes/sublotes/humedad', {
    method: 'PATCH',
    body: JSON.stringify({ sublotes }),
  }) as Promise<{ totalActualizados: number }>;
}
