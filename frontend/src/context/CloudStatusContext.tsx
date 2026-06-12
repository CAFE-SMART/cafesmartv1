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
import { getApiBaseUrlCandidates, SHOULD_LOG_API_DEBUG } from '../config/api';

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
  wasOffline: boolean;
  reconnectedAt: number | null;
  lastSyncAt: number | null;
  refreshHealth: () => Promise<void>;
};

const CloudStatusContext = createContext<CloudStatusValue | null>(null);

type HealthCheckResult = {
  ok: boolean;
  url: string;
  status: number;
  browserOnline: boolean;
  error?: string;
};

function describeHealthError(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

async function pingBackend(
  signal: AbortSignal,
  browserOnline: boolean,
): Promise<HealthCheckResult> {
  const candidates = getApiBaseUrlCandidates();
  let lastResult: HealthCheckResult | null = null;

  for (const baseUrl of candidates) {
    const url = `${baseUrl.replace(/\/$/, '')}/`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal,
        cache: 'no-store',
      });
      const text = await response.text().catch(() => '');
      const ok =
        response.ok &&
        (!text.trim() || text.trim().includes('Cafe Smart API running'));
      const result = {
        ok,
        url,
        status: response.status,
        browserOnline,
      };

      if (SHOULD_LOG_API_DEBUG) {
        console.info('[CafeSmart][health-check]', {
          ...result,
          responsePreview: text.trim().slice(0, 80),
        });
      }

      if (ok) {
        return result;
      }

      lastResult = {
        ...result,
        error: text.trim().slice(0, 120) || response.statusText,
      };
    } catch (error) {
      lastResult = {
        ok: false,
        url,
        status: 0,
        browserOnline,
        error: describeHealthError(error),
      };

      if (SHOULD_LOG_API_DEBUG) {
        console.info('[CafeSmart][health-check]', lastResult);
      }
    }
  }

  return (
    lastResult ?? {
      ok: false,
      url: '',
      status: 0,
      browserOnline,
      error: 'No API base URL candidates configured.',
    }
  );
}

export function CloudStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [backendReachable, setBackendReachable] = useState<boolean | null>(
    null,
  );
  const [lastEvent, setLastEvent] = useState<CloudStatusEventDetail | null>(
    null,
  );
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [wasOffline, setWasOffline] = useState(false);
  const [reconnectedAt, setReconnectedAt] = useState<number | null>(null);
  const clearEventTimerRef = useRef<number | null>(null);

  const refreshHealth = useCallback(async () => {
    const browserOnline =
      typeof navigator === 'undefined' ? isOnline : navigator.onLine;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 6000);

    try {
      const result = await pingBackend(controller.signal, browserOnline);

      if (result.ok && !browserOnline) {
        setIsOnline(true);
      } else {
        setIsOnline(browserOnline);
      }

      setBackendReachable(result.ok);

      if (SHOULD_LOG_API_DEBUG && !result.ok) {
        console.info('[CafeSmart][health-check] offline reason', {
          browserOnline,
          apiUrl: result.url,
          status: result.status,
          error: result.error,
        });
      }

      if (result.ok && wasOffline) {
        setReconnectedAt(Date.now());
      }
    } catch (error) {
      setBackendReachable(false);
      setWasOffline(true);
      if (SHOULD_LOG_API_DEBUG) {
        console.info('[CafeSmart][health-check] unexpected failure', {
          browserOnline,
          error: describeHealthError(error),
        });
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [isOnline, wasOffline]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setReconnectedAt(Date.now());
      }
      void refreshHealth();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
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
      if (document.visibilityState !== 'visible') {
        return;
      }

      void refreshHealth();
    }, 60000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshHealth();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshHealth, wasOffline]);

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

    window.addEventListener(
      CLOUD_STATUS_EVENT,
      handleCloudEvent as EventListener,
    );

    return () => {
      window.removeEventListener(
        CLOUD_STATUS_EVENT,
        handleCloudEvent as EventListener,
      );
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
        detail:
          'Sin internet. Tus cambios se almacenan y se subirán a la nube al reconectar.',
        isOnline,
        backendReachable,
        isSyncing: false,
        wasOffline,
        reconnectedAt,
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
        wasOffline,
        reconnectedAt,
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
        wasOffline,
        reconnectedAt,
        lastSyncAt,
        refreshHealth,
      };
    }

    if (!backendReachable) {
      return {
        tone: 'error',
        title: 'No pudimos conectar con el servidor',
        detail:
          'Revisa que el servidor esté encendido o intenta nuevamente.',
        isOnline,
        backendReachable,
        isSyncing: false,
        wasOffline,
        reconnectedAt,
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
        wasOffline,
        reconnectedAt,
        lastSyncAt,
        refreshHealth,
      };
    }

    if (lastEvent?.status === 'error') {
      return {
        tone: 'offline',
        title: 'Sin conexión',
        detail:
          'Sin internet. Tus cambios se almacenan y se subirán a la nube al reconectar.',
        isOnline,
        backendReachable,
        isSyncing: false,
        wasOffline,
        reconnectedAt,
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
      wasOffline,
      reconnectedAt,
      lastSyncAt,
      refreshHealth,
    };
  }, [
    backendReachable,
    isOnline,
    lastEvent,
    lastSyncAt,
    reconnectedAt,
    refreshHealth,
    wasOffline,
  ]);

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
