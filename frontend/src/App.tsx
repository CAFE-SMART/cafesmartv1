import React, { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { AppLoadingScreen } from './components/AppLoadingScreen';
import { CafeSmartErrorState } from './components/CafeSmartErrorState';
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
  const { isOnline } = useCloudStatus();
  const location = useLocation();

  const isSubloteDetail = /^\/inventario\/[^/]+\/[^/]+\/sublotes$/.test(location.pathname);

  if (isOnline || isSubloteDetail) {
    return null;
  }

  return (
    <div className="border-b border-[#ececec] bg-white px-4 py-3">
      <div
        role="status"
        aria-live="polite"
        className="mx-auto max-w-[390px] rounded-[14px] border border-[#ececec] bg-[#fafafa] px-4 py-3 text-[12px] leading-5 text-[#4b5563] whitespace-pre-line"
      >
        Para refrescar los datos necesitas conexión a internet.
        {'\n'}
        Tus cambios están guardados y se sincronizarán automáticamente.
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
