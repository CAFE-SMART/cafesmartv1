import type { LoteDetalle, LoteResumen } from '../services/lotesService';
import {
  startSecado as startSecadoApi,
  saveSecadoResults as saveSecadoResultsApi,
  finalizeSecado as finalizeSecadoApi,
  getActiveSecado,
  getActiveSecadoForLote,
  getSecadoSession as getSecadoSessionApi,
  saveSecadoDraft as saveSecadoDraftApi,
  type SecadoSession as ApiSecadoSession,
} from '../services/secadoService';

export const VISUAL_CAPACITY_KG = 3000;

export type SecadoEstado = 'IN_PROCESS' | 'READY' | 'COMPLETED';

export type SecadoSubloteSeleccionado = {
  id: string;
  etiqueta: string;
  pesoActual: number;
  pesoDisponible?: number;
  humedad: number | null;
  fechaIngreso: string;
  diasEnBodega: number;
  calidad?: string;
};

export type SecadoSession = {
  id: string;
  estado: SecadoEstado;
  loteId: string;
  loteCodigo: string;
  tipoCafeId: string;
  tipoCafe: string;
  calidadId: string;
  calidad: string;
  fechaLote?: string;
  sublotes: SecadoSubloteSeleccionado[];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  outputBuenoKg: number;
  outputBuenoHumedad: number | null;
  outputRegularKg: number;
  outputRegularHumedad: number | null;
  outputMaloKg?: number;
  outputMaloHumedad?: number | null;
  mermaKg: number;
  rendimientoPct: number;
  draftStartDate?: string | null;
  draftEndDate?: string | null;
  draftBuenoKg?: number | null;
  draftRegularKg?: number | null;
  draftMaloKg?: number | null;
};

export class SecadoValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'SecadoValidationError';
  }
}

function mapApiSession(
  session: ApiSecadoSession & {
    loteCodigo?: string;
    sublotes?: SecadoSubloteSeleccionado[];
    draftStartDate?: string | null;
    draftEndDate?: string | null;
    draftBuenoKg?: number | null;
    draftRegularKg?: number | null;
    draftMaloKg?: number | null;
    outputMaloKg?: number | null;
    outputMaloHumedad?: number | null;
  },
): SecadoSession {
  return {
    id: session.id,
    estado: session.estado as SecadoEstado,
    loteId: session.loteId || '',
    loteCodigo: session.loteCodigo || '',
    tipoCafeId: session.tipoCafeId,
    tipoCafe: session.tipoCafe,
    calidadId: session.calidadId,
    calidad: session.calidad,
    sublotes: (session.sublotes || []).map((sub) => ({
      id: sub.id,
      etiqueta: sub.etiqueta,
      pesoActual: sub.pesoActual,
      pesoDisponible: sub.pesoDisponible,
      humedad: sub.humedad,
      fechaIngreso: sub.fechaIngreso,
      diasEnBodega: sub.diasEnBodega,
      calidad: sub.calidad,
    })),
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt,
    outputBuenoKg: session.outputBuenoKg,
    outputBuenoHumedad: session.outputBuenoHumedad,
    outputRegularKg: session.outputRegularKg,
    outputRegularHumedad: session.outputRegularHumedad,
    outputMaloKg: session.outputMaloKg ?? 0,
    outputMaloHumedad: session.outputMaloHumedad ?? null,
    mermaKg: session.mermaKg,
    rendimientoPct: session.rendimientoPct || 0,
    draftStartDate: session.draftStartDate || null,
    draftEndDate: session.draftEndDate || null,
    draftBuenoKg: session.draftBuenoKg || null,
    draftRegularKg: session.draftRegularKg || null,
    draftMaloKg: session.draftMaloKg || null,
  };
}

export async function loadSecadoSessions(): Promise<SecadoSession[]> {
  const active = await getActiveSecado();
  return active ? [mapApiSession(active)] : [];
}

export function clearSecadoSessions(): void {
  // no-op, fully persisted on DB
}

export async function getSecadoSession(
  sessionId: string,
): Promise<SecadoSession | null> {
  const session = await getSecadoSessionApi(sessionId);
  return session ? mapApiSession(session) : null;
}

export async function saveSecadoDraft(
  sessionId: string,
  draft: {
    startDate?: string;
    endDate?: string;
    buenoKg?: number;
    regularKg?: number;
    maloKg?: number;
  },
): Promise<SecadoSession> {
  const updated = await saveSecadoDraftApi(sessionId, draft);
  return mapApiSession(updated);
}

export async function getActiveSecadoSession(): Promise<SecadoSession | null> {
  const active = await getActiveSecado();
  return active ? mapApiSession(active) : null;
}

export async function getActiveSecadoSessions(): Promise<SecadoSession[]> {
  const active = await getActiveSecado();
  return active ? [mapApiSession(active)] : [];
}

export async function getActiveSecadoSessionForLot(
  lotId: string,
): Promise<SecadoSession | null> {
  const active = await getActiveSecadoForLote(lotId);
  return active ? mapApiSession(active) : null;
}

export function getActiveSecadoBlockedSubloteIds(): Set<string> {
  return new Set<string>();
}

export function getActiveSecadoBlockedKgByLot(): Map<string, number> {
  return new Map<string, number>();
}

export async function startSecadoWithWeights(
  detalle: LoteDetalle,
  selectedWeights: Record<string, number>,
): Promise<SecadoSession> {
  const subloteIds = Object.keys(selectedWeights).filter(
    (id) => selectedWeights[id] > 0,
  );
  const created = await startSecadoApi(
    detalle.lote.tipoCafeId,
    detalle.lote.calidadId,
    {
      subloteIds,
      pesos: selectedWeights,
    },
  );
  return mapApiSession(created);
}

export async function saveSecadoResults(
  sessionId: string,
  payload: {
    outputBuenoKg: number;
    outputBuenoHumedad?: number | null;
    outputRegularKg: number;
    outputRegularHumedad?: number | null;
    outputMaloKg?: number | null;
    outputMaloHumedad?: number | null;
  },
): Promise<SecadoSession> {
  const updated = await saveSecadoResultsApi(sessionId, {
    outputBuenoKg: payload.outputBuenoKg,
    outputBuenoHumedad: payload.outputBuenoHumedad ?? undefined,
    outputRegularKg: payload.outputRegularKg,
    outputRegularHumedad: payload.outputRegularHumedad ?? undefined,
    outputMaloKg: payload.outputMaloKg ?? undefined,
    outputMaloHumedad: payload.outputMaloHumedad ?? undefined,
  });
  return mapApiSession(updated);
}

export async function finalizeSecado(
  sessionId: string,
): Promise<SecadoSession> {
  const updated = await finalizeSecadoApi(sessionId);
  return mapApiSession(updated);
}

export function applySecadoToLots(
  baseLots: LoteResumen[],
  _options?: unknown,
): LoteResumen[] {
  return baseLots;
}

export function applySecadoToDetalle(
  baseDetail: LoteDetalle | null,
  _tipoCafeId: string,
  _calidadId: string,
  _options?: unknown,
): LoteDetalle | null {
  return baseDetail;
}
