import { useCallback, useEffect, useState } from 'react';

type UseFormPersistenceOptions<TValue> = {
  key: string;
  value: TValue;
  onRestore: (value: TValue) => void;
  enabled?: boolean;
  version?: number;
  debounceMs?: number;
  isEmpty?: (value: TValue) => boolean;
};

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

  const clearDraft = useCallback(() => {
    void key;
    setLastSavedAt(null);
  }, [key]);

  useEffect(() => {
    void enabled;
    void onRestore;
    void isEmpty;
    void version;
  }, [enabled, isEmpty, onRestore, version]);

  useEffect(() => {
    void value;
    void debounceMs;
    void version;
    void isEmpty;
    void key;
  }, [debounceMs, enabled, isEmpty, key, value, version]);

  return {
    clearDraft,
    hasDraft: false,
    lastSavedAt,
  };
}
