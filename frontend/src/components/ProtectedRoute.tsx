import { Navigate, Outlet } from 'react-router-dom';

export const ProtectedRoute = () => {
  const token = localStorage.getItem('token');
  
  // Si no hay token, lo mandamos al login
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  // Si hay token, renderiza la ruta hija
  return <Outlet />;
};
