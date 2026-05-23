import { useEffect, useRef } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { getPendingOperations, syncAllPending } from '../services/syncQueueService';

export function SyncQueueRunner() {
  const { isOffline, reconnectedAt } = useNetworkStatus();
  const lastRunRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOffline) return;
    if (getPendingOperations().length === 0) return;

    if (lastRunRef.current === reconnectedAt && reconnectedAt !== null) {
      return;
    }

    lastRunRef.current = reconnectedAt;
    void syncAllPending();
  }, [isOffline, reconnectedAt]);

  return null;
}
