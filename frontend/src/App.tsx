import React, { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { AppLoadingScreen } from './components/AppLoadingScreen';
import { CafeSmartErrorState } from './components/CafeSmartErrorState';
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
        <CafeSmartErrorState
          fullScreen
          title="No pudimos cargar la pantalla"
          message={
            isOffline
              ? 'Revisa tu conexión a internet e intenta nuevamente.'
              : 'Puedes volver al inicio o intentar cargar la pantalla otra vez.'
          }
          onPrimary={this.handleRetry}
          onSecondary={this.handleGoHome}
        />
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
