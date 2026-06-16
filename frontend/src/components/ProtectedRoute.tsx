import { Navigate, Outlet } from 'react-router-dom';
import { AppLoadingScreen } from './AppLoadingScreen';
import { useUser } from '../context/UserContext';

export const ProtectedRoute = () => {
  const { token, hasCompany, hydrated } = useUser();

  if (!hydrated) {
    return (
      <AppLoadingScreen
        title="Cargando tu sesión..."
        subtitle="Revisando la información guardada en este dispositivo"
      />
    );
  }

  // Si no hay token, lo mandamos al login.
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Si no tiene empresa, debe completar ese paso antes de entrar al inventario.
  if (!hasCompany) {
    return <Navigate to="/crear-empresa" replace />;
  }

  // Si hay token, renderiza la ruta hija
  return <Outlet />;
};
