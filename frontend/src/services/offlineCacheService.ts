import {
  deleteOfflineRecord,
  getOfflineRecord,
  setOfflineRecord,
} from './offlineDb';

const OFFLINE_CACHE_PREFIX = 'cafe-smart:offline-cache:v1:';
const OFFLINE_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

type OfflineCacheEntry<T> = {
  savedAt: string;
  data: T;
};

function storageKey(key: string) {
  return `${OFFLINE_CACHE_PREFIX}${key}`;
}

export async function saveOfflineCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;

  try {
    const entry: OfflineCacheEntry<T> = {
      savedAt: new Date().toISOString(),
      data,
    };
    try {
      await setOfflineRecord('cachedQueries', storageKey(key), entry);
    } catch {
      // localStorage queda como respaldo.
    }
    window.localStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // El cache de lectura nunca debe bloquear el flujo principal.
  }
}

export async function getOfflineCache<T>(key: string): Promise<T | null> {
  if (typeof window === 'undefined') return null;

  try {
    let entry = await getOfflineRecord<OfflineCacheEntry<T>>(
      'cachedQueries',
      storageKey(key),
    );

    if (!entry) {
      const raw = window.localStorage.getItem(storageKey(key));
      entry = raw ? (JSON.parse(raw) as OfflineCacheEntry<T>) : null;
    }

    if (!entry) return null;
    if (!entry.savedAt || !('data' in entry)) return null;

    const age = Date.now() - new Date(entry.savedAt).getTime();
    if (age > OFFLINE_CACHE_MAX_AGE_MS) return null;

    return entry.data as T;
  } catch {
    return null;
  }
}

export async function clearOfflineCache(key: string) {
  if (typeof window === 'undefined') return;
  try {
    await deleteOfflineRecord('cachedQueries', storageKey(key));
  } catch {
    // localStorage queda como respaldo.
  }
  window.localStorage.removeItem(storageKey(key));
}
