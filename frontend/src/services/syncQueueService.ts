import { apiFetch, invalidateApiCache } from './apiService';
import { emitCloudStatusEvent } from './cloudStatusEvents';
import { setOfflineRecord } from './offlineDb';

export type SyncStatus =
  | 'PENDIENTE'
  | 'SINCRONIZANDO'
  | 'SINCRONIZADO'
  | 'ERROR';

export type SyncModule = 'COMPRA' | 'VENTA' | 'GASTO' | 'SECADO' | 'INVENTARIO';

export type SyncOperation = {
  idLocal: string;
  clientMutationId: string;
  deviceId: string;
  modulo: SyncModule;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  payload: unknown;
  estado: SyncStatus;
  intentos: number;
  error?: string;
  creadoEn: string;
  actualizadoEn: string;
  sincronizadoEn?: string;
  serverResponse?: unknown;
};

export type SyncQueueSummary = {
  total: number;
  pendientes: number;
  sincronizando: number;
  sincronizados: number;
  errores: number;
};

const SYNC_QUEUE_STORAGE_KEY = 'cafe-smart:sync-queue:v1';
export const SYNC_QUEUE_EVENT = 'cafe-smart-sync-queue-updated';

function nowIso() {
  return new Date().toISOString();
}

function notifyQueueUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SYNC_QUEUE_EVENT));
}

function normalizeError(error: unknown) {
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return 'No pudimos sincronizar este registro. Revisa los datos e intenta nuevamente.';
}

function isTechnicalServerError(error: unknown) {
  const message = normalizeError(error);
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : 0;

  return (
    status >= 500 ||
    code === 'P2022' ||
    /p2022|prisma|codigo_sublote|venta_detalle|problema temporal|problema interno|servidor|server/i.test(
      message,
    )
  );
}

function getModuleErrorMessage(operation: SyncOperation, error: unknown) {
  const message = normalizeError(error);

  if (isTechnicalServerError(error)) {
    return 'No pudimos sincronizar este registro por un problema interno. Tus datos siguen guardados en este dispositivo.';
  }

  if (operation.modulo === 'COMPRA') {
    return `No pudimos sincronizar esta compra. ${message || 'Revisa los datos obligatorios o la capacidad de bodega.'}`;
  }

  if (operation.modulo === 'GASTO') {
    return `No pudimos sincronizar este gasto. ${message || 'Revisa el valor y la fecha antes de intentarlo nuevamente.'}`;
  }

  if (operation.modulo === 'VENTA') {
    if (/inventario|stock|disponible|sublote/i.test(message)) {
      return 'No pudimos sincronizar esta venta porque el inventario disponible cambió.';
    }
    return `No pudimos sincronizar esta venta. ${message}`;
  }

  if (operation.modulo === 'SECADO') {
    if (/peso|sublote|disponible|inventario/i.test(message)) {
      return 'No pudimos sincronizar este secado porque uno de los sublotes ya no tiene el peso disponible.';
    }
    return `No pudimos sincronizar este secado. ${message}`;
  }

  return message;
}

function readQueue(): SyncOperation[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(SYNC_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SyncOperation[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: SyncOperation[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  void setOfflineRecord('syncQueue', 'all', queue);
  notifyQueueUpdated();
}

export function addSyncOperation(
  operation: Omit<
    SyncOperation,
    'estado' | 'intentos' | 'creadoEn' | 'actualizadoEn'
  > &
    Partial<Pick<SyncOperation, 'estado' | 'intentos' | 'creadoEn'>>,
) {
  const queue = readQueue();
  const existing = queue.find(
    (item) =>
      item.clientMutationId === operation.clientMutationId &&
      item.deviceId === operation.deviceId,
  );

  if (existing) return existing;

  const createdAt = operation.creadoEn ?? nowIso();
  const next: SyncOperation = {
    ...operation,
    estado: operation.estado ?? 'PENDIENTE',
    intentos: operation.intentos ?? 0,
    creadoEn: createdAt,
    actualizadoEn: createdAt,
  };

  writeQueue([...queue, next]);
  return next;
}

export const addOperation = addSyncOperation;

export function getAllOperations() {
  return getSyncQueue();
}

export function getSyncQueue() {
  return readQueue().sort(
    (a, b) => new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime(),
  );
}

export function getSyncQueueSummary(): SyncQueueSummary {
  const queue = readQueue();
  return {
    total: queue.length,
    pendientes: queue.filter((item) => item.estado === 'PENDIENTE').length,
    sincronizando: queue.filter((item) => item.estado === 'SINCRONIZANDO')
      .length,
    sincronizados: queue.filter((item) => item.estado === 'SINCRONIZADO')
      .length,
    errores: queue.filter((item) => item.estado === 'ERROR').length,
  };
}

export function getPendingOperations() {
  return getSyncQueue().filter((item) => item.estado === 'PENDIENTE');
}

export function getErrorOperations() {
  return getSyncQueue().filter((item) => item.estado === 'ERROR');
}

function updateOperation(
  idLocal: string,
  updater: (operation: SyncOperation) => SyncOperation,
) {
  const queue = readQueue();
  const next = queue.map((operation) =>
    operation.idLocal === idLocal ? updater(operation) : operation,
  );
  writeQueue(next);
}

export function markSyncing(idLocal: string) {
  updateOperation(idLocal, (operation) => ({
    ...operation,
    estado: 'SINCRONIZANDO',
    intentos: operation.intentos + 1,
    error: undefined,
    actualizadoEn: nowIso(),
  }));
}

export function markSynced(idLocal: string, serverResponse: unknown) {
  updateOperation(idLocal, (operation) => ({
    ...operation,
    estado: 'SINCRONIZADO',
    serverResponse,
    sincronizadoEn: nowIso(),
    actualizadoEn: nowIso(),
    error: undefined,
  }));
}

export function markError(idLocal: string, error: unknown) {
  updateOperation(idLocal, (operation) => ({
    ...operation,
    estado: 'ERROR',
    error: normalizeError(error),
    actualizadoEn: nowIso(),
  }));
}

export function retryOperation(idLocal: string) {
  updateOperation(idLocal, (operation) => ({
    ...operation,
    estado: 'PENDIENTE',
    error: undefined,
    actualizadoEn: nowIso(),
  }));
}

export function deleteSyncOperation(idLocal: string) {
  writeQueue(readQueue().filter((operation) => operation.idLocal !== idLocal));
}

export const deleteOperation = deleteSyncOperation;

export function removeSynced({ olderThanMs = 1000 * 60 * 60 * 24 * 3 } = {}) {
  const threshold = Date.now() - olderThanMs;
  writeQueue(
    readQueue().filter((operation) => {
      if (operation.estado !== 'SINCRONIZADO') return true;
      if (!operation.sincronizadoEn) return true;
      return new Date(operation.sincronizadoEn).getTime() >= threshold;
    }),
  );
}

export function clearSyncedOperations() {
  writeQueue(readQueue().filter((operation) => operation.estado !== 'SINCRONIZADO'));
}

async function syncOperation(operation: SyncOperation) {
  markSyncing(operation.idLocal);

  try {
    const response = await apiFetch(operation.endpoint, {
      method: operation.method,
      body: JSON.stringify({
        ...(operation.payload && typeof operation.payload === 'object'
          ? (operation.payload as Record<string, unknown>)
          : { payload: operation.payload }),
        clientMutationId: operation.clientMutationId,
        deviceId: operation.deviceId,
        localId: operation.clientMutationId,
      }),
    });
    markSynced(operation.idLocal, response);
    return { ok: true as const };
  } catch (error) {
    markError(operation.idLocal, getModuleErrorMessage(operation, error));
    return { ok: false as const, error };
  }
}

let activeSyncPromise: Promise<{
  synced: number;
  failed: number;
}> | null = null;

export async function syncAllPending() {
  if (activeSyncPromise) return activeSyncPromise;

  activeSyncPromise = (async () => {
    const pending = getPendingOperations();
    if (pending.length === 0) return { synced: 0, failed: 0 };

    emitCloudStatusEvent({
      status: 'syncing',
      source: 'sync',
      message: 'Estamos sincronizando tus cambios pendientes.',
    });

    let synced = 0;
    let failed = 0;

    for (const operation of pending) {
      const result = await syncOperation(operation);
      if (result.ok) {
        synced += 1;
      } else {
        failed += 1;
      }
    }

    invalidateApiCache();
    emitCloudStatusEvent({
      status: failed > 0 ? 'error' : 'synced',
      source: 'sync',
      message:
        failed > 0
          ? 'Algunos cambios necesitan revisión antes de sincronizarse.'
          : 'Tus cambios pendientes ya están guardados en la nube.',
    });

    return { synced, failed };
  })().finally(() => {
    activeSyncPromise = null;
  });

  return activeSyncPromise;
}

export const syncQueueStorageKey = SYNC_QUEUE_STORAGE_KEY;
