import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { X } from 'lucide-react';
import AppRoutes from './routes/AppRoutes';
import { AppLoadingScreen } from './components/AppLoadingScreen';
import { CafeSmartErrorState } from './components/CafeSmartErrorState';
import { AppFeedbackMessage } from './components/AppFeedbackMessage';
import { InternalLoadingScreen } from './components/InternalLoadingScreen';
import { useCloudStatus } from './context/CloudStatusContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { getStoredAuthToken } from './storage/authStorage';
import { themeClasses } from './theme/themeClasses';

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
const NATIVE_BACK_EVENT = 'cafesmart:native-back';
const MAIN_PRIVATE_ROUTES = new Set([
  '/ajustes',
  '/compras',
  '/inventario',
  '/ventas',
  '/resumen-financiero',
]);

const isPublicRoute = (path: string) =>
  path === '/' ||
  path.startsWith('/login') ||
  path.startsWith('/recuperar') ||
  path.startsWith('/recuperar-password') ||
  path.startsWith('/restablecer') ||
  path.startsWith('/register') ||
  path.startsWith('/crear-empresa');

const AiFloatingButton = lazy(() =>
  import('./components/ai/AiFloatingButton').then((module) => ({
    default: module.AiFloatingButton,
  })),
);

const SyncQueueRunner = lazy(() =>
  import('./components/SyncQueueRunner').then((module) => ({
    default: module.SyncQueueRunner,
  })),
);

const AiConversationProvider = lazy(() =>
  import('./context/AiConversationContext').then((module) => ({
    default: module.AiConversationProvider,
  })),
);

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
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.history.replaceState(null, '', currentPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  };

  private handleBackToEdit = () => {
    this.setState({ hasError: false }, () => {
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.history.replaceState(null, '', currentPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  };

  private handleGoHome = async () => {
    const path = window.location.pathname;
    const inAuthFlow = isPublicRoute(path);
    const token = await getStoredAuthToken();

    if (path.startsWith('/ajustes')) {
      window.location.assign('/ajustes');
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
      const inAjustesFlow = path.startsWith('/ajustes');

      return (
        <CafeSmartErrorState
          fullScreen
          title={
            inAuthFlow
              ? 'No pudimos cargar tu sesión'
              : 'No pudimos cargar la pantalla'
          }
          message={
            isOffline
              ? 'Estás sin conexión. Intentaremos usar información guardada en este dispositivo.'
              : inAuthFlow
                ? 'Intenta nuevamente o vuelve a revisar tus datos.'
                : 'Puedes ir al inicio o intentar cargar la pantalla otra vez.'
          }
          info={
            inAuthFlow
              ? 'Conservamos la información escrita. Puedes reintentar o volver a editar.'
              : undefined
          }
          primaryLabel="Reintentar"
          secondaryLabel={
            inAuthFlow
              ? 'Volver a editar'
              : inAjustesFlow
              ? 'Volver a ajustes'
              : inVentasFlow
                ? 'Volver a ventas'
                : 'Volver al inicio'
          }
          onPrimary={this.handleRetry}
          onSecondary={inAuthFlow ? this.handleBackToEdit : this.handleGoHome}
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
          variant: 'warning' as const,
          title: 'Conexión inestable',
          description:
            'Puedes seguir usando los datos guardados. Intentaremos sincronizar cuando vuelva la conexión.',
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-slate-500 transition hover:bg-white hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
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

function GlobalAiAssistant() {
  const location = useLocation();
  const isAuthFlow = isPublicRoute(location.pathname);
  const isAssistantPage = location.pathname.startsWith('/asistente');
  const isFinancialAiPage = location.pathname.includes(
    '/resumen-financiero/analisis',
  );

  if (isAuthFlow || isAssistantPage || isFinancialAiPage) return null;

  return (
    <Suspense fallback={null}>
      <AiFloatingButton />
    </Suspense>
  );
}

function NativeBackButtonHandler({
  onExitAttempt,
}: {
  onExitAttempt: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const lastExitAttemptRef = useRef(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return undefined;
    }

    let removeListener: (() => void) | undefined;

    const registerBackButton = async () => {
      const handle = await CapacitorApp.addListener('backButton', () => {
        const closeEvent = new CustomEvent(NATIVE_BACK_EVENT, {
          cancelable: true,
          detail: { pathname: window.location.pathname },
        });

        if (!window.dispatchEvent(closeEvent)) {
          return;
        }

        const pathname = window.location.pathname;
        if (pathname === '/inicio') {
          const now = Date.now();
          if (now - lastExitAttemptRef.current <= 2000) {
            void CapacitorApp.exitApp();
            return;
          }
          lastExitAttemptRef.current = now;
          onExitAttempt();
          return;
        }

        if (MAIN_PRIVATE_ROUTES.has(pathname)) {
          navigate('/inicio');
          return;
        }

        if (window.history.length > 1) {
          navigate(-1);
          return;
        }

        navigate('/inicio');
      });
      removeListener = () => {
        void handle.remove();
      };
    };

    void registerBackButton();

    return () => {
      removeListener?.();
    };
  }, [location.pathname, navigate, onExitAttempt]);

  return null;
}

function AppContent() {
  const location = useLocation();
  const [showBootSplash, setShowBootSplash] = useState(true);
  const [exitWarningVisible, setExitWarningVisible] = useState(false);
  const bootSplashShownRef = useRef(false);
  const isAuthFlow = isPublicRoute(location.pathname);

  useEffect(() => {
    if (isAuthFlow) {
      setShowBootSplash(false);
      return undefined;
    }

    if (bootSplashShownRef.current) {
      setShowBootSplash(false);
      return undefined;
    }

    setShowBootSplash(true);
    const timerId = window.setTimeout(() => {
      bootSplashShownRef.current = true;
      setShowBootSplash(false);
    }, BOOT_SPLASH_VISIBLE_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isAuthFlow, location.pathname]);

  useEffect(() => {
    if (!exitWarningVisible) return undefined;
    const timeout = window.setTimeout(() => setExitWarningVisible(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [exitWarningVisible]);

  if (showBootSplash && !isAuthFlow) {
    return <AppLoadingScreen />;
  }

  const appBody = (
    <>
      {!isAuthFlow ? (
        <>
          <GlobalOfflineNotice />
          <NativeBackButtonHandler
            onExitAttempt={() => setExitWarningVisible(true)}
          />
          {exitWarningVisible ? (
            <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-[95] px-4">
              <div className="mx-auto max-w-[430px] rounded-[14px] bg-slate-950 px-4 py-3 text-center text-sm font-black text-white shadow-[0_18px_40px_rgba(15,23,42,0.22)]">
                Presiona nuevamente para salir.
              </div>
            </div>
          ) : null}
          <Suspense fallback={null}>
            <SyncQueueRunner />
          </Suspense>
          <GlobalSyncOverlay />
        </>
      ) : null}
      <GlobalAiAssistant />
      <div id="app-content">
        <AppRoutes />
      </div>
    </>
  );

  return (
    <div className={`min-h-screen ${themeClasses.pageBase}`}>
      <a href="#app-content" className="skip-link">
        Saltar al contenido principal
      </a>
      {isAuthFlow ? (
        appBody
      ) : (
        <Suspense fallback={null}>
          <AiConversationProvider>{appBody}</AiConversationProvider>
        </Suspense>
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <PrivateRouteHistoryTracker />
        <AppContent />
      </AppErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
