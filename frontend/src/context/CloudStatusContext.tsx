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

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || 'http://localhost:3000';

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
        title: 'Sin internet',
        detail: 'La app sigue local. La nube no esta disponible.',
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
        title: 'Sincronizando',
        detail: lastEvent.message,
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
        title: 'Verificando nube',
        detail: 'Comprobando conexion con la API.',
        isOnline,
        backendReachable,
        isSyncing: false,
        lastSyncAt,
        refreshHealth,
      };
    }

    if (!backendReachable) {
      return {
        tone: 'degraded',
        title: 'Servidor no disponible',
        detail: 'Hay red, pero no responde la API del backend.',
        isOnline,
        backendReachable,
        isSyncing: false,
        lastSyncAt,
        refreshHealth,
      };
    }

    if (lastEvent?.status === 'synced') {
      return {
        tone: 'synced',
        title: 'Guardado en la nube',
        detail: lastEvent.message,
        isOnline,
        backendReachable,
        isSyncing: false,
        lastSyncAt,
        refreshHealth,
      };
    }

    if (lastEvent?.status === 'error') {
      return {
        tone: 'error',
        title: 'Fallo de sincronizacion',
        detail: lastEvent.message,
        isOnline,
        backendReachable,
        isSyncing: false,
        lastSyncAt,
        refreshHealth,
      };
    }

    return {
      tone: 'connected',
      title: 'Nube conectada',
      detail: lastSyncAt
        ? 'La API responde y la ultima operacion llego a la nube.'
        : 'La API responde y esta lista para sincronizar.',
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
