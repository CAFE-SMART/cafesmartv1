import React, { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { AppLoadingScreen } from './components/AppLoadingScreen';
import { CafeSmartErrorState } from './components/CafeSmartErrorState';
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

  const isSubloteDetail = /^\/inventario\/[^/]+\/[^/]+\/sublotes$/.test(location.pathname);

  useEffect(() => {
    if (!reconnectedAt) return undefined;
    setShowReconnectedNotice(true);
    const timeout = window.setTimeout(() => setShowReconnectedNotice(false), 5200);
    return () => window.clearTimeout(timeout);
  }, [reconnectedAt]);

  if (isSubloteDetail) {
    return null;
  }

  const isOffline = !isOnline || backendReachable === false;

  if (!isOffline && !showReconnectedNotice && !isSyncing) return null;

  return (
    <div className="border-b border-[#dbe5fb] bg-white px-4 py-3">
      <div
        role="status"
        aria-live="polite"
        className={`mx-auto max-w-[390px] rounded-[14px] border px-4 py-3 text-[12px] leading-5 whitespace-pre-line ${
          isOffline
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : isSyncing
              ? 'border-sky-200 bg-sky-50 text-sky-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
        }`}
      >
        {isOffline ? (
          <>
            <strong>Sin conexión</strong>
            {'\n'}
            Puedes consultar información guardada en este dispositivo. Algunas
            acciones estarán disponibles cuando vuelvas a tener internet.
          </>
        ) : isSyncing ? (
          <>
            <strong>Conexión restablecida</strong>
            {'\n'}
            Estamos sincronizando tus cambios pendientes.
          </>
        ) : (
          <>
            <strong>Conexión restablecida</strong>
            {'\n'}
            Ya puedes finalizar los borradores pendientes para guardarlos en la
            nube.
          </>
        )}
      </div>
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
