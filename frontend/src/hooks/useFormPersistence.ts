import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type PersistedForm<TValue> = {
  version: number;
  savedAt: string;
  value: TValue;
};

type UseFormPersistenceOptions<TValue> = {
  key: string;
  value: TValue;
  onRestore: (value: TValue) => void;
  enabled?: boolean;
  version?: number;
  debounceMs?: number;
  isEmpty?: (value: TValue) => boolean;
};

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function safeParse<TValue>(raw: string | null, version: number): PersistedForm<TValue> | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedForm<TValue>;
    if (!parsed || parsed.version !== version || !('value' in parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function useFormPersistence<TValue>({
  key,
  value,
  onRestore,
  enabled = true,
  version = 1,
  debounceMs = 400,
  isEmpty,
}: UseFormPersistenceOptions<TValue>) {
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const restoredRef = useRef(false);
  const skipNextSaveRef = useRef(false);
  const onRestoreRef = useRef(onRestore);

  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  const clearDraft = useCallback(() => {
    if (!canUseLocalStorage()) return;
    window.localStorage.removeItem(key);
    setLastSavedAt(null);
  }, [key]);

  const hasDraft = useMemo(() => {
    if (!canUseLocalStorage()) return false;
    return Boolean(safeParse<TValue>(window.localStorage.getItem(key), version));
  }, [key, version]);

  useEffect(() => {
    if (!enabled || restoredRef.current || !canUseLocalStorage()) return;

    const persisted = safeParse<TValue>(window.localStorage.getItem(key), version);
    if (persisted && (!isEmpty || !isEmpty(persisted.value))) {
      skipNextSaveRef.current = true;
      onRestoreRef.current(persisted.value);
      setLastSavedAt(persisted.savedAt);
    }

    restoredRef.current = true;
  }, [enabled, isEmpty, key, version]);

  useEffect(() => {
    if (!enabled || !restoredRef.current || !canUseLocalStorage()) return;

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    if (isEmpty?.(value)) {
      window.localStorage.removeItem(key);
      setLastSavedAt(null);
      return;
    }

    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const payload: PersistedForm<TValue> = {
        version,
        savedAt,
        value,
      };

      window.localStorage.setItem(key, JSON.stringify(payload));
      setLastSavedAt(savedAt);
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [debounceMs, enabled, isEmpty, key, value, version]);

  return {
    clearDraft,
    hasDraft,
    lastSavedAt,
  };
}
