import React, { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { X } from 'lucide-react';
import AppRoutes from './routes/AppRoutes';
import { AppLoadingScreen } from './components/AppLoadingScreen';
import { CafeSmartErrorState } from './components/CafeSmartErrorState';
import { AppFeedbackMessage } from './components/AppFeedbackMessage';
import { InternalLoadingScreen } from './components/InternalLoadingScreen';
import { SyncQueueRunner } from './components/SyncQueueRunner';
import { useCloudStatus } from './context/CloudStatusContext';
import { useLocation } from 'react-router-dom';
import { AUTH_STORAGE_KEYS, getAuthStorageValue } from './storage/authStorage';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

const BOOT_SPLASH_VISIBLE_MS = 2200;
const PRIVATE_ROUTE_CURRENT_KEY = 'cafeSmart:currentPrivateRoute';
const PRIVATE_ROUTE_PREVIOUS_KEY = 'cafeSmart:previousPrivateRoute';
const DISMISSED_CONNECTION_ALERT_KEY = 'cafesmart:dismissed-connection-alert';

const isPublicRoute = (path: string) =>
  path === '/' ||
  path.startsWith('/login') ||
  path.startsWith('/recuperar') ||
  path.startsWith('/recuperar-password') ||
  path.startsWith('/restablecer') ||
  path.startsWith('/register') ||
  path.startsWith('/crear-empresa');

class AppErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Keep the app visible if something fails at runtime.
    console.error('Cafe Smart runtime error:', error);
  }

  private handleRetry = () => {
    this.setState({ hasError: false }, () => {
      window.location.reload();
    });
  };

  private handleGoHome = async () => {
    const path = window.location.pathname;
    const inAuthFlow = isPublicRoute(path);
    const token = await getAuthStorageValue(AUTH_STORAGE_KEYS.token);

    if (!token && inAuthFlow) {
      window.location.assign('/login');
      return;
    }

    if (path.startsWith('/ventas')) {
      window.location.assign('/ventas');
      return;
    }

    window.location.assign(token ? '/inicio' : '/login');
  };

  render() {
    if (this.state.hasError) {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      const inAuthFlow = isPublicRoute(path);
      const inVentasFlow = path.startsWith('/ventas');

      return (
        <CafeSmartErrorState
          fullScreen
          title={
            inAuthFlow
              ? 'No pudimos cargar el acceso'
              : 'No pudimos cargar la pantalla'
          }
          message={
            isOffline
              ? 'Revisa tu conexión a internet e intenta nuevamente.'
              : inAuthFlow
                ? 'Puedes volver al login o intentar cargar nuevamente.'
                : 'Puedes ir al inicio o intentar cargar la pantalla otra vez.'
          }
          primaryLabel="Reintentar"
          secondaryLabel={
            inAuthFlow
              ? 'Volver al login'
              : inVentasFlow
                ? 'Volver a ventas'
                : 'Volver al inicio'
          }
          onPrimary={this.handleRetry}
          onSecondary={this.handleGoHome}
        />
      );
    }

    return this.props.children;
  }
}

function PrivateRouteHistoryTracker() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const path = location.pathname;
    if (isPublicRoute(path)) return;

    const current = window.sessionStorage.getItem(PRIVATE_ROUTE_CURRENT_KEY);
    if (current && current !== path) {
      window.sessionStorage.setItem(PRIVATE_ROUTE_PREVIOUS_KEY, current);
    }
    window.sessionStorage.setItem(PRIVATE_ROUTE_CURRENT_KEY, path);
  }, [location.pathname]);

  return null;
}

function GlobalOfflineNotice() {
  const { isOnline, backendReachable, isSyncing, reconnectedAt } =
    useCloudStatus();
  const location = useLocation();
  const [showReconnectedNotice, setShowReconnectedNotice] = useState(false);
  const [dismissedAlert, setDismissedAlert] = useState<string | null>(() =>
    typeof window === 'undefined'
      ? null
      : window.sessionStorage.getItem(DISMISSED_CONNECTION_ALERT_KEY),
  );

  const isSubloteDetail = /^\/inventario\/[^/]+\/[^/]+\/sublotes$/.test(location.pathname);
  const isAuthFlow = isPublicRoute(location.pathname);

  useEffect(() => {
    if (!reconnectedAt) return undefined;
    setShowReconnectedNotice(true);
    const timeout = window.setTimeout(() => setShowReconnectedNotice(false), 5200);
    return () => window.clearTimeout(timeout);
  }, [reconnectedAt]);

  if (isSubloteDetail || isAuthFlow) {
    return null;
  }

  const hasNoInternet = !isOnline;
  const backendUnavailable = isOnline && backendReachable === false;

  if (!hasNoInternet && !backendUnavailable && !showReconnectedNotice && !isSyncing) return null;

  const notice = hasNoInternet
    ? {
        key: 'offline',
        variant: 'warning' as const,
        title: 'Sin conexión',
        description: 'Estás usando información guardada en este dispositivo.',
      }
    : backendUnavailable
      ? {
          key: 'server-unavailable',
          variant: 'error' as const,
          title: 'No pudimos conectar con el servidor',
          description: 'Revisa que el servidor esté encendido o intenta nuevamente.',
        }
      : isSyncing
        ? {
            key: 'syncing',
            variant: 'info' as const,
            title: 'Conexión restablecida',
            description: 'Estamos sincronizando tus cambios pendientes.',
          }
        : {
            key: 'reconnected',
            variant: 'success' as const,
            title: 'Conexión restablecida',
            description: 'Ya puedes sincronizar los cambios pendientes.',
          };

  if (dismissedAlert === notice.key) return null;

  const dismissAlert = () => {
    window.sessionStorage.setItem(DISMISSED_CONNECTION_ALERT_KEY, notice.key);
    setDismissedAlert(notice.key);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-[80] px-4 sm:bottom-[calc(env(safe-area-inset-bottom)+20px)]">
      <div className="mx-auto max-w-[430px]">
        <AppFeedbackMessage
          variant={notice.variant}
          title={notice.title}
          description={notice.description}
          role="status"
          aria-live="polite"
          autoClose={!hasNoInternet && !backendUnavailable}
          duration={isSyncing ? 3200 : 4200}
          className="pointer-events-auto shadow-[0_18px_40px_rgba(15,23,42,0.16)]"
          action={
            <button
              type="button"
              onClick={dismissAlert}
              aria-label="Cerrar alerta de conexión"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-slate-500 transition hover:bg-white hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
            >
              <X size={15} aria-hidden="true" />
            </button>
          }
        />
      </div>
    </div>
  );
}

function GlobalSyncOverlay() {
  const { isSyncing } = useCloudStatus();

  if (!isSyncing) return null;

  return (
    <div className="fixed inset-0 z-[120]">
      <InternalLoadingScreen
        title="Sincronizando datos"
        description="Estamos guardando tus registros pendientes en la nube."
        warningText="No cierres la aplicación durante la sincronización."
        securityTitle="Tus datos están protegidos"
        securityDescription="Validamos cada registro antes de guardarlo en la nube."
      />
    </div>
  );
}

function App() {
  const [showBootSplash, setShowBootSplash] = useState(true);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setShowBootSplash(false);
    }, BOOT_SPLASH_VISIBLE_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <PrivateRouteHistoryTracker />
        {showBootSplash ? (
          <AppLoadingScreen />
        ) : (
          <div className="min-h-screen bg-gray-50 text-gray-900">
            <a href="#app-content" className="skip-link">
              Saltar al contenido principal
            </a>
            <GlobalOfflineNotice />
            <SyncQueueRunner />
            <GlobalSyncOverlay />
            <div id="app-content">
              <AppRoutes />
            </div>
          </div>
        )}
      </AppErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
