import React from 'react';
import { Capacitor } from '@capacitor/core';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from '../pages/Login';
import Landing from '../pages/Landing';
import Register from '../pages/Register';
import Inicio from '../pages/Inicio';
import AnalisisFinanciero from '../pages/AnalisisFinanciero';
import Compras from '../pages/Compras';
import Inventario from '../pages/Inventario';
import Ventas from '../pages/Ventas';
import Sublotes from '../pages/Sublotes';
import SecadoInicio from '../pages/SecadoInicio';
import SecadoSeleccion from '../pages/SecadoSeleccion';
import SecadoProceso from '../pages/SecadoProceso';
import SecadoResumen from '../pages/SecadoResumen';
import Ajustes from '../pages/Ajustes';
import Gastos from '../pages/Gastos';
import SystemStatus from '../pages/SystemStatus';
import GastosOperativos from '../pages/GastosOperativos';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useUser } from '../context/UserContext';

function RootRoute({ showLanding }: { showLanding: boolean }) {
  const { token, hasCompany, hydrated } = useUser();

  if (!hydrated) {
    return null;
  }

  if (token) {
    return <Navigate to={hasCompany ? '/inicio' : '/crear-empresa'} replace />;
  }

  return showLanding ? <Landing /> : <Navigate to="/login" replace />;
}

export default function AppRoutes() {
  const showLanding = Capacitor.getPlatform() === 'web';

  return (
    <Routes>
      <Route path="/" element={<RootRoute showLanding={showLanding} />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/crear-empresa" element={<Register />} />
      <Route path="/estado-sistema" element={<SystemStatus />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/analisis-financiero" element={<AnalisisFinanciero />} />
        <Route path="/compras" element={<Compras />} />
        <Route path="/ventas" element={<Ventas />} />
        <Route path="/inventario" element={<Inventario />} />
        <Route path="/ajustes" element={<Ajustes />} />
        <Route path="/gastos" element={<Gastos />} />
        <Route path="/secado" element={<SecadoInicio />} />
        <Route path="/inventario/lote/:loteId/secado" element={<SecadoSeleccion />} />
        <Route
          path="/inventario/:tipoCafeId/:calidadId/secado"
          element={<SecadoSeleccion />}
        />
        <Route
          path="/inventario/secado/:sessionId/finalizar"
          element={<SecadoProceso />}
        />
        <Route
          path="/inventario/secado/:sessionId/resumen"
          element={<SecadoResumen />}
        />
        <Route
          path="/inventario/:tipoCafeId/:calidadId/sublotes"
          element={<Sublotes />}
        />
        <Route path="/gastos/registro" element={<GastosOperativos />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
