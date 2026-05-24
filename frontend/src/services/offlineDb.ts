const DB_NAME = 'cafesmart-offline';
const DB_VERSION = 1;

export type OfflineStoreName =
  | 'cachedSession'
  | 'cachedQueries'
  | 'offlineDrafts'
  | 'syncQueue';

type StoredRecord<T> = {
  key: string;
  value: T;
  updatedAt: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function canUseIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

function openOfflineDb() {
  if (!canUseIndexedDb()) {
    return Promise.reject(new Error('IndexedDB no está disponible.'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      const stores: OfflineStoreName[] = [
        'cachedSession',
        'cachedQueries',
        'offlineDrafts',
        'syncQueue',
      ];

      for (const store of stores) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'key' });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function setOfflineRecord<T>(
  storeName: OfflineStoreName,
  key: string,
  value: T,
) {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.put({
      key,
      value,
      updatedAt: new Date().toISOString(),
    } satisfies StoredRecord<T>);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getOfflineRecord<T>(
  storeName: OfflineStoreName,
  key: string,
) {
  const db = await openOfflineDb();
  return new Promise<T | null>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => {
      const record = request.result as StoredRecord<T> | undefined;
      resolve(record?.value ?? null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineRecord(
  storeName: OfflineStoreName,
  key: string,
) {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.delete(key);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
