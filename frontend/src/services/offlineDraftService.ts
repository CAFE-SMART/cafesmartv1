import { obtenerDeviceId } from '../utils/deviceId';

export type OfflineDraftStatus = 'BORRADOR' | 'LISTO_PARA_ENVIAR' | 'ERROR';

export type OfflineDraftModule =
  | 'COMPRA'
  | 'VENTA'
  | 'GASTO'
  | 'SECADO'
  | 'INVENTARIO'
  | 'CLIENTE'
  | 'PRODUCTOR'
  | 'AJUSTES';

export type OfflineDraft = {
  idLocal: string;
  deviceId: string;
  modulo: OfflineDraftModule;
  payload: unknown;
  estado: OfflineDraftStatus;
  creadoEn: string;
  actualizadoEn: string;
  error?: string;
};

const OFFLINE_DRAFTS_STORAGE_KEY = 'cafe-smart:offline-drafts:v1';

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readAll(): OfflineDraft[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(OFFLINE_DRAFTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineDraft[]) : [];
  } catch {
    return [];
  }
}

function writeAll(drafts: OfflineDraft[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(OFFLINE_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
}

export async function createOfflineDraft(
  modulo: OfflineDraftModule,
  payload: unknown,
  options: {
    estado?: OfflineDraftStatus;
    idLocal?: string;
    error?: string;
  } = {},
) {
  const now = new Date().toISOString();
  const idLocal = options.idLocal ?? createId();
  const draft: OfflineDraft = {
    idLocal,
    deviceId: await obtenerDeviceId(),
    modulo,
    payload,
    estado: options.estado ?? 'LISTO_PARA_ENVIAR',
    creadoEn: now,
    actualizadoEn: now,
    error: options.error,
  };

  const drafts = readAll().filter((item) => item.idLocal !== idLocal);
  writeAll([...drafts, draft]);
  return draft;
}

export function getOfflineDraftsByModule(modulo: OfflineDraftModule) {
  return readAll()
    .filter((draft) => draft.modulo === modulo)
    .sort(
      (a, b) =>
        new Date(b.actualizadoEn).getTime() -
        new Date(a.actualizadoEn).getTime(),
    );
}

export function getOfflineDraft(idLocal: string) {
  return readAll().find((draft) => draft.idLocal === idLocal) ?? null;
}

export function hasOfflineDraft(modulo: OfflineDraftModule) {
  return getOfflineDraftsByModule(modulo).length > 0;
}

export function updateOfflineDraft(
  idLocal: string,
  updates: Partial<Omit<OfflineDraft, 'idLocal' | 'creadoEn'>>,
) {
  const drafts = readAll();
  const index = drafts.findIndex((draft) => draft.idLocal === idLocal);
  if (index < 0) return null;

  const next: OfflineDraft = {
    ...drafts[index],
    ...updates,
    actualizadoEn: new Date().toISOString(),
  };
  drafts[index] = next;
  writeAll(drafts);
  return next;
}

export function deleteOfflineDraft(idLocal: string) {
  writeAll(readAll().filter((draft) => draft.idLocal !== idLocal));
}

export const offlineDraftStorageKey = OFFLINE_DRAFTS_STORAGE_KEY;
