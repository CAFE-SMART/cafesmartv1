import React, { Suspense, lazy } from 'react';
import { Capacitor } from '@capacitor/core';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLoadingScreen } from '../components/AppLoadingScreen';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useUser } from '../context/UserContext';

const Login = lazy(() => import('../pages/Login'));
const Landing = lazy(() => import('../pages/Landing'));
const Register = lazy(() => import('../pages/Register'));
const Inicio = lazy(() => import('../pages/Inicio'));
const AnalisisFinanciero = lazy(() => import('../pages/AnalisisFinanciero'));
const Compras = lazy(() => import('../pages/Compras'));
const Inventario = lazy(() => import('../pages/Inventario'));
const Ventas = lazy(() => import('../pages/Ventas'));
const Sublotes = lazy(() => import('../pages/Sublotes'));
const SecadoInicio = lazy(() => import('../pages/SecadoInicio'));
const SecadoSeleccion = lazy(() => import('../pages/SecadoSeleccion'));
const SecadoProceso = lazy(() => import('../pages/SecadoProceso'));
const SecadoResumen = lazy(() => import('../pages/SecadoResumen'));
const Ajustes = lazy(() => import('../pages/Ajustes'));
const Gastos = lazy(() => import('../pages/Gastos'));
const SystemStatus = lazy(() => import('../pages/SystemStatus'));
const GastosOperativos = lazy(() => import('../pages/GastosOperativos'));

function RootRoute({ showLanding }: { showLanding: boolean }) {
  const { token, hasCompany, hydrated } = useUser();

  if (!hydrated) {
    return <AppLoadingScreen />;
  }

  if (token) {
    return <Navigate to={hasCompany ? '/inicio' : '/crear-empresa'} replace />;
  }

  return showLanding ? <Landing /> : <Navigate to="/login" replace />;
}

export default function AppRoutes() {
  const showLanding = Capacitor.getPlatform() === 'web';

  return (
    <Suspense fallback={<AppLoadingScreen />}>
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
    </Suspense>
  );
}
