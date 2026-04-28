import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { useCloudStatus } from './context/CloudStatusContext';
import { useLocation } from 'react-router-dom';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

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
  const location = useLocation();

  const isSubloteDetail = /^\/inventario\/[^/]+\/[^/]+\/sublotes$/.test(location.pathname);

  if (isOnline || isSubloteDetail) {
    return null;
  }

  return (
    <div className="border-b border-[#ececec] bg-white px-4 py-3">
      <div className="mx-auto max-w-[340px] rounded-[14px] border border-[#ececec] bg-[#fafafa] px-4 py-3 text-[12px] leading-5 text-[#707070] whitespace-pre-line">
        Para refrescar los datos necesitas conexión a internet.
        {'\n'}
        Tus cambios están guardados y se sincronizarán automáticamente.
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
