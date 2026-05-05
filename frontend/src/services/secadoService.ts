import { apiFetch } from './apiService';

export type SecadoSession = {
  id: string;
  estado: 'IN_PROCESS' | 'READY' | 'COMPLETED';
  loteId?: string;
  tipoCafeId: string;
  tipoCafe: string;
  calidadId: string;
  calidad: string;
  subloteIds: string[];
  inputKg: number;
  outputBuenoKg: number;
  outputBuenoHumedad: number | null;
  outputRegularKg: number;
  outputRegularHumedad: number | null;
  mermaKg: number;
  rendimientoPct: number | null;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type StartSecadoPayload = {
  subloteIds: string[];
};

export type SecadoResultsPayload = {
  outputBuenoKg: number;
  outputBuenoHumedad?: number;
  outputRegularKg: number;
  outputRegularHumedad?: number;
};

export async function startSecado(
  tipoCafeId: string,
  calidadId: string,
  payload: StartSecadoPayload,
): Promise<SecadoSession> {
  return apiFetch(`/secado/start/${tipoCafeId}/${calidadId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function saveSecadoResults(
  sessionId: string,
  payload: SecadoResultsPayload,
): Promise<SecadoSession> {
  return apiFetch(`/secado/${sessionId}/results`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function finalizeSecado(sessionId: string): Promise<SecadoSession> {
  return apiFetch(`/secado/${sessionId}/finalize`, {
    method: 'PATCH',
  });
}

export async function getActiveSecado(): Promise<SecadoSession | null> {
  return apiFetch('/secado/active');
}

export async function getActiveSecadoForLote(loteId: string): Promise<SecadoSession | null> {
  return apiFetch(`/secado/active/${loteId}`);
}

export async function getSecadoSession(sessionId: string): Promise<SecadoSession> {
  return apiFetch(`/secado/${sessionId}`);
}

