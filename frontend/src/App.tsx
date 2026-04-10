import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';

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

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-center text-slate-900">
          <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 shadow-lg">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-rose-500">
              Error de la interfaz
            </p>
            <h1 className="mt-3 text-2xl font-black text-slate-900">
              La pantalla no pudo cargarse
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Algo en la vista de inicio de sesion o registro esta fallando en tiempo de
              ejecucion. Ya no deberia verse en blanco; ahora veras este aviso en lugar del fallo.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <div className="min-h-screen bg-gray-50 text-gray-900">
          <AppRoutes />
        </div>
      </AppErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
