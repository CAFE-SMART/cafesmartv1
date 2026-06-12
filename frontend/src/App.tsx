import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { useCloudStatus } from './context/CloudStatusContext';
import { useLocation } from 'react-router-dom';
import { WifiOff } from 'lucide-react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class AppErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
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

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-center text-slate-900">
          <div className="w-full max-w-[340px] rounded-[14px] border border-rose-200 bg-white p-4 shadow-lg">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-rose-500">
              Error de pantalla
            </p>
            <h1 className="mt-2 text-[1rem] font-black text-slate-900">
              No se pudo cargar esta vista
            </h1>
            <p className="mt-2 text-[0.68rem] leading-5 text-slate-600">
              Intenta de nuevo. Si continua, vuelve a la pantalla anterior.
            </p>
            <button
              type="button"
              onClick={this.reset}
              className="mt-4 inline-flex min-h-[36px] w-full items-center justify-center rounded-[8px] bg-[#102d92] px-4 text-[0.68rem] font-black text-white"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function GlobalOfflineNotice() {
  const { isOnline } = useCloudStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [hasShownForOffline, setHasShownForOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      if (!hasShownForOffline) {
        setIsOpen(true);
        setHasShownForOffline(true);
      }
    } else {
      setHasShownForOffline(false);
      setIsOpen(false);
    }
  }, [isOnline, hasShownForOffline]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[4px]">
      <div className="w-full max-w-[340px] scale-100 rounded-[24px] border border-[#dbe5f2] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)] transition-all duration-300">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f0f4ff] text-[#2b4cbd]">
          <WifiOff size={28} strokeWidth={2} />
        </div>

        <h2 className="text-center text-[1.12rem] font-bold text-slate-900">
          Modo sin conexión
        </h2>

        <p className="mt-3 text-center text-xs leading-5 text-slate-500">
          Guardamos tus cambios en este dispositivo. Se sincronizarán
          automáticamente cuando vuelva el internet.
        </p>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="mt-6 flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#1D4ED8] text-xs font-bold text-white transition hover:bg-[#1e40af] active:scale-[0.98] shadow-[0_8px_20px_rgba(29,78,216,0.16)]"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <div className="min-h-screen bg-gray-50 text-gray-900">
          <GlobalOfflineNotice />
          <AppRoutes />
        </div>
      </AppErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
