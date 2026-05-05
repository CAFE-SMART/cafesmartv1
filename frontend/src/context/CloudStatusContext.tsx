import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CLOUD_STATUS_EVENT,
  type CloudStatusEventDetail,
} from '../services/cloudStatusEvents';
import API_BASE_URL from '../config/api';

type CloudTone =
  | 'offline'
  | 'checking'
  | 'connected'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'degraded';

type CloudStatusValue = {
  tone: CloudTone;
  title: string;
  detail: string;
  isOnline: boolean;
  backendReachable: boolean | null;
  isSyncing: boolean;
  lastSyncAt: number | null;
  refreshHealth: () => Promise<void>;
};

const CloudStatusContext = createContext<CloudStatusValue | null>(null);

async function pingBackend(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/`, {
    method: 'GET',
    signal,
  });

  return response.ok;
}

export function CloudStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null);
  const [lastEvent, setLastEvent] = useState<CloudStatusEventDetail | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const clearEventTimerRef = useRef<number | null>(null);

  const refreshHealth = useCallback(async () => {
    if (!isOnline) {
      setBackendReachable(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4000);

    try {
      const ok = await pingBackend(controller.signal);
      setBackendReachable(ok);
    } catch {
      setBackendReachable(false);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [isOnline]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void refreshHealth();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setBackendReachable(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshHealth]);

  useEffect(() => {
    void refreshHealth();

    const intervalId = window.setInterval(() => {
      void refreshHealth();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshHealth]);

  useEffect(() => {
    const handleCloudEvent = (event: Event) => {
      const customEvent = event as CustomEvent<CloudStatusEventDetail>;
      const detail = customEvent.detail;
      setLastEvent(detail);

      if (detail.status === 'synced') {
        setLastSyncAt(Date.now());
      }

      if (clearEventTimerRef.current !== null) {
        window.clearTimeout(clearEventTimerRef.current);
      }

      if (detail.status !== 'syncing') {
        clearEventTimerRef.current = window.setTimeout(() => {
          setLastEvent((current) =>
            current?.status === 'syncing' ? current : null,
          );
        }, 6000);
      }
    };

    window.addEventListener(CLOUD_STATUS_EVENT, handleCloudEvent as EventListener);

    return () => {
      window.removeEventListener(CLOUD_STATUS_EVENT, handleCloudEvent as EventListener);
      if (clearEventTimerRef.current !== null) {
        window.clearTimeout(clearEventTimerRef.current);
      }
    };
  }, []);

  const value = useMemo<CloudStatusValue>(() => {
    if (!isOnline) {
      return {
        tone: 'offline',
        title: 'Sin conexión',
        detail: 'Sin internet. Tus cambios se almacenan y se subirán a la nube al reconectar.',
        isOnline,
        backendReachable,
        isSyncing: false,
        lastSyncAt,
        refreshHealth,
      };
    }

    if (lastEvent?.status === 'syncing') {
      return {
        tone: 'syncing',
        title: 'Conectado',
        detail: 'Con internet. Sincronizando cambios...',
        isOnline,
        backendReachable,
        isSyncing: true,
        lastSyncAt,
        refreshHealth,
      };
    }

    if (backendReachable === null) {
      return {
        tone: 'checking',
        title: 'Conectando',
        detail: 'Validando internet y nube.',
        isOnline,
        backendReachable,
        isSyncing: false,
        lastSyncAt,
        refreshHealth,
      };
    }

    if (!backendReachable) {
      return {
        tone: 'offline',
        title: 'Sin conexión',
        detail: 'Sin internet. Tus cambios se almacenan y se subirán a la nube al reconectar.',
        isOnline,
        backendReachable,
        isSyncing: false,
        lastSyncAt,
        refreshHealth,
      };
    }

    if (lastEvent?.status === 'synced') {
      return {
        tone: 'connected',
        title: 'Conectado',
        detail: 'Con internet. Tus cambios ya están guardados.',
        isOnline,
        backendReachable,
        isSyncing: false,
        lastSyncAt,
        refreshHealth,
      };
    }

    if (lastEvent?.status === 'error') {
      return {
        tone: 'offline',
        title: 'Sin conexión',
        detail: 'Sin internet. Tus cambios se almacenan y se subirán a la nube al reconectar.',
        isOnline,
        backendReachable,
        isSyncing: false,
        lastSyncAt,
        refreshHealth,
      };
    }

    return {
      tone: 'connected',
      title: 'Conectado',
      detail: 'Con internet. Tus cambios ya están guardados.',
      isOnline,
      backendReachable,
      isSyncing: false,
      lastSyncAt,
      refreshHealth,
    };
  }, [backendReachable, isOnline, lastEvent, lastSyncAt, refreshHealth]);

  return (
    <CloudStatusContext.Provider value={value}>
      {children}
    </CloudStatusContext.Provider>
  );
}

export function useCloudStatus() {
  const context = useContext(CloudStatusContext);
  if (!context) {
    throw new Error('useCloudStatus debe usarse dentro de CloudStatusProvider');
  }

  return context;
}
