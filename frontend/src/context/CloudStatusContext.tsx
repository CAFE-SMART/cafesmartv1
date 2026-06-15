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
import { logDebugLine } from '../utils/debugLog';

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
  backendIssue: string | null;
  isSyncing: boolean;
  wasOffline: boolean;
  reconnectedAt: number | null;
  lastSyncAt: number | null;
  refreshHealth: () => Promise<void>;
};

const CloudStatusContext = createContext<CloudStatusValue | null>(null);
const HEALTH_CHECK_TIMEOUT_MS = 10000;
const CHECKING_FALLBACK_TIMEOUT_MS = HEALTH_CHECK_TIMEOUT_MS + 2000;

type HealthCheckResult = {
  ok: boolean;
  url: string;
  status: number;
  browserOnline: boolean;
  issue: string | null;
  error?: string;
};

function describeHealthError(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

function classifyHealthIssue(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'timeout';
  }

  if (error instanceof TypeError) {
    return 'cors_or_network';
  }

  return 'unreachable';
}

async function pingBackend(
  signal: AbortSignal,
  browserOnline: boolean,
): Promise<HealthCheckResult> {
  const candidates = getApiBaseUrlCandidates();
  let lastResult: HealthCheckResult | null = null;

  if (SHOULD_LOG_API_DEBUG) {
    console.info(
      `[CafeSmart][health-check] starting MODE=${import.meta.env.MODE} VITE_API_URL=${
        (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
        '(empty)'
      } browserOnline=${browserOnline} candidates=${candidates.join(',')}`,
    );
    logDebugLine('[CafeSmart][health-check] starting', {
      mode: import.meta.env.MODE,
      VITE_API_URL:
        (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
        '(empty)',
      candidates,
      browserOnline,
    });
  }

  for (const baseUrl of candidates) {
    const url = `${baseUrl.replace(/\/$/, '')}/`;

    try {
      if (SHOULD_LOG_API_DEBUG) {
        console.info(`[CafeSmart][health-check] request method=GET url=${url}`);
        logDebugLine('[CafeSmart][health-check] request', {
          url,
          method: 'GET',
        });
      }

      const response = await fetch(url, {
        method: 'GET',
        signal,
        cache: 'no-store',
      });
      const text = await response.text().catch(() => '');
      const ok = response.ok;
      const result = {
        ok,
        url,
        status: response.status,
        browserOnline,
        issue: ok ? null : response.status >= 500 ? 'server_error' : 'unreachable',
      };

      if (SHOULD_LOG_API_DEBUG) {
        console.info(
          `[CafeSmart][health-check] response ok=${result.ok} status=${response.status} statusText=${response.statusText} url=${url} responsePreview=${text
            .trim()
            .slice(0, 80)}`,
        );
        logDebugLine('[CafeSmart][health-check] response', {
          ...result,
          statusText: response.statusText,
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
        issue: classifyHealthIssue(error),
        error: describeHealthError(error),
      };

      if (SHOULD_LOG_API_DEBUG) {
        console.info(
          `[CafeSmart][health-check] error url=${lastResult.url} status=${lastResult.status} browserOnline=${lastResult.browserOnline} error=${lastResult.error}`,
        );
        logDebugLine('[CafeSmart][health-check] error', lastResult);
      }
    }
  }

  return (
    lastResult ?? {
      ok: false,
      url: '',
      status: 0,
      browserOnline,
      issue: 'unreachable',
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
    typeof navigator === 'undefined' || navigator.onLine ? null : false,
  );
  const [backendIssue, setBackendIssue] = useState<string | null>(
    typeof navigator === 'undefined' || navigator.onLine ? null : 'offline',
  );
  const [lastEvent, setLastEvent] = useState<CloudStatusEventDetail | null>(
    null,
  );
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [wasOffline, setWasOffline] = useState(false);
  const [reconnectedAt, setReconnectedAt] = useState<number | null>(null);
  const clearEventTimerRef = useRef<number | null>(null);
  const lastLoggedStatusRef = useRef('');
  const healthCheckInFlightRef = useRef(false);

  const refreshHealth = useCallback(async () => {
    if (healthCheckInFlightRef.current) {
      return;
    }

    const browserOnline =
      typeof navigator === 'undefined' ? isOnline : navigator.onLine;

    if (!browserOnline) {
      setIsOnline(false);
      setBackendReachable(false);
      setBackendIssue('offline');
      setWasOffline(true);
      return;
    }

    healthCheckInFlightRef.current = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      HEALTH_CHECK_TIMEOUT_MS,
    );

    try {
      const result = await pingBackend(controller.signal, browserOnline);

      if (result.ok && !browserOnline) {
        setIsOnline(true);
      } else {
        setIsOnline(browserOnline);
      }

      setBackendReachable(result.ok);
      setBackendIssue(result.issue);

      if (SHOULD_LOG_API_DEBUG && !result.ok) {
        console.info(
          `[CafeSmart][health-check] offline reason browserOnline=${browserOnline} apiUrl=${result.url} status=${result.status} error=${result.error}`,
        );
        logDebugLine('[CafeSmart][health-check] offline reason', {
          browserOnline,
          apiUrl: result.url,
          status: result.status,
          error: result.error,
          issue: result.issue,
        });
      }

      if (result.ok && wasOffline) {
        setReconnectedAt(Date.now());
      }
    } catch (error) {
      setBackendReachable(false);
      setBackendIssue(classifyHealthIssue(error));
      setWasOffline(true);
      if (SHOULD_LOG_API_DEBUG) {
        console.info(
          `[CafeSmart][health-check] unexpected failure browserOnline=${browserOnline} error=${describeHealthError(error)}`,
        );
        logDebugLine('[CafeSmart][health-check] unexpected failure', {
          browserOnline,
          error: describeHealthError(error),
        });
      }
    } finally {
      healthCheckInFlightRef.current = false;
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
      setBackendIssue('offline');
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
    if (backendReachable !== null) {
      return;
    }

    const fallbackId = window.setTimeout(() => {
      setBackendReachable(false);
      setBackendIssue('timeout');
      if (SHOULD_LOG_API_DEBUG) {
        console.info(
          `[CafeSmart][health-check] fallback timeout reached after ${CHECKING_FALLBACK_TIMEOUT_MS}ms`,
        );
        logDebugLine('[CafeSmart][health-check] fallback timeout', {
          timeoutMs: CHECKING_FALLBACK_TIMEOUT_MS,
        });
      }
    }, CHECKING_FALLBACK_TIMEOUT_MS);

    return () => {
      window.clearTimeout(fallbackId);
    };
  }, [backendReachable]);

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
        backendIssue,
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
        backendIssue,
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
        title: 'Conectando con la nube',
        detail: 'Estamos conectando con la nube. Esto puede tardar unos segundos.',
        isOnline,
        backendReachable,
        backendIssue,
        isSyncing: false,
        wasOffline,
        reconnectedAt,
        lastSyncAt,
        refreshHealth,
      };
    }

    if (!backendReachable) {
      return {
        tone: 'degraded',
        title: 'Conectando con la nube',
        detail:
          'Estamos conectando con la nube. Esto puede tardar unos segundos.',
        isOnline,
        backendReachable,
        backendIssue,
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
        backendIssue,
        isSyncing: false,
        wasOffline,
        reconnectedAt,
        lastSyncAt,
        refreshHealth,
      };
    }

    if (lastEvent?.status === 'error') {
      return {
        tone: 'degraded',
        title: 'No pudimos conectar con la nube',
        detail:
          'No pudimos conectar con la nube. Revisa tu conexión o intenta de nuevo.',
        isOnline,
        backendReachable,
        backendIssue,
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
      backendIssue,
      isSyncing: false,
      wasOffline,
      reconnectedAt,
      lastSyncAt,
      refreshHealth,
    };
  }, [
    backendReachable,
    backendIssue,
    isOnline,
    lastEvent,
    lastSyncAt,
    reconnectedAt,
    refreshHealth,
    wasOffline,
  ]);

  useEffect(() => {
    if (!SHOULD_LOG_API_DEBUG) {
      return;
    }

    const isOffline = !value.isOnline;
    const nextLoggedStatus = JSON.stringify({
      tone: value.tone,
      isOnline: value.isOnline,
      isOffline,
      backendReachable: value.backendReachable,
      backendIssue: value.backendIssue,
      title: value.title,
    });

    if (lastLoggedStatusRef.current === nextLoggedStatus) {
      return;
    }

    lastLoggedStatusRef.current = nextLoggedStatus;

    console.info(
      `[CafeSmart][cloud-status] final VITE_API_URL=${
        (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
        '(empty)'
      } tone=${value.tone} isOnline=${value.isOnline} isOffline=${isOffline} backendReachable=${value.backendReachable} backendIssue=${value.backendIssue ?? ''} title=${value.title}`,
    );
    logDebugLine('[CafeSmart][cloud-status] final', {
      VITE_API_URL:
        (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
        '(empty)',
      tone: value.tone,
      cloudStatus: value.tone,
      isOnline: value.isOnline,
      isOffline,
      backendReachable: value.backendReachable,
      backendIssue: value.backendIssue,
      title: value.title,
      detail: value.detail,
    });
  }, [value]);

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
