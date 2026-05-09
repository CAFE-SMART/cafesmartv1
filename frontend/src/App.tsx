import React, { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import AppRoutes from './routes/AppRoutes';
import { AppLoadingScreen } from './components/AppLoadingScreen';
import { useCloudStatus } from './context/CloudStatusContext';
import { useLocation } from 'react-router-dom';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

const BOOT_SPLASH_VISIBLE_MS = 2200;

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
    this.setState({ hasError: false });
  };

  private handleGoHome = () => {
    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 text-slate-900">
          <section
            className="w-full max-w-sm rounded-2xl border border-rose-100 bg-white p-5 text-left shadow-lg"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl font-black leading-tight text-slate-950">
                  No pudimos cargar la pantalla
                </h1>
                <p className="mt-2 text-sm leading-5 text-slate-600">
                  {isOffline
                    ? 'Parece que no hay conexion. Revisa tu internet e intenta nuevamente.'
                    : 'Parece que hubo un problema de conexion o del sistema.'}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#07153b] px-4 text-base font-black text-white shadow-sm transition hover:bg-[#0c2258] focus:outline-none focus:ring-2 focus:ring-[#07153b] focus:ring-offset-2"
              >
                <RotateCcw className="h-5 w-5" aria-hidden="true" />
                Reintentar
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
              >
                <Home className="h-5 w-5" aria-hidden="true" />
                Volver al inicio
              </button>
            </div>

            <p className="mt-4 text-center text-xs leading-5 text-slate-500">
              Si el problema continua, intentalo mas tarde.
            </p>
          </section>
        </div>
      );
    }

    return this.props.children;
  }
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
