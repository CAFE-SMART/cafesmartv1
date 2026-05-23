const OFFLINE_CACHE_PREFIX = 'cafe-smart:offline-cache:v1:';
const OFFLINE_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

type OfflineCacheEntry<T> = {
  savedAt: string;
  data: T;
};

function storageKey(key: string) {
  return `${OFFLINE_CACHE_PREFIX}${key}`;
}

export function saveOfflineCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;

  try {
    const entry: OfflineCacheEntry<T> = {
      savedAt: new Date().toISOString(),
      data,
    };
    window.localStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // El cache de lectura nunca debe bloquear el flujo principal.
  }
}

export function getOfflineCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<OfflineCacheEntry<T>>;
    if (!entry.savedAt || !('data' in entry)) return null;

    const age = Date.now() - new Date(entry.savedAt).getTime();
    if (age > OFFLINE_CACHE_MAX_AGE_MS) return null;

    return entry.data as T;
  } catch {
    return null;
  }
}

export function clearOfflineCache(key: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(key));
}
