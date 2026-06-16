import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLoadingScreen } from '../components/AppLoadingScreen';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { ENABLE_SECADO_PROTOTYPE } from '../config/features';

const Login = lazy(() => import('../pages/Login'));
const RecuperarPassword = lazy(() => import('../pages/RecuperarPassword'));
const RestablecerPassword = lazy(() => import('../pages/RestablecerPassword'));
const Register = lazy(() => import('../pages/Register'));
const Inicio = lazy(() => import('../pages/Inicio'));
const Compras = lazy(() => import('../pages/Compras'));
const Inventario = lazy(() => import('../pages/Inventario'));
const Ventas = lazy(() => import('../pages/Ventas'));
const Sublotes = lazy(() => import('../pages/Sublotes'));
const SecadoSeleccion = lazy(() => import('../pages/SecadoSeleccion'));
const SecadoInicio = lazy(() => import('../pages/SecadoInicio'));
const SecadosActivos = lazy(() => import('../pages/SecadosActivos'));
const SecadoProceso = lazy(() => import('../pages/SecadoProceso'));
const SecadoResumen = lazy(() => import('../pages/SecadoResumen'));
const Ajustes = lazy(() => import('../pages/Ajustes'));
const ContactoSoporte = lazy(() => import('../pages/ContactoSoporte'));
const AyudaBasica = lazy(() => import('../pages/AyudaBasica'));
const SystemStatus = lazy(() => import('../pages/SystemStatus'));
const GastosOperativos = lazy(() => import('../pages/GastosOperativos'));
const GastosListado = lazy(() => import('../pages/GastosListado'));
const ResumenFinanciero = lazy(() => import('../pages/ResumenFinanciero'));
const AnalisisInteligente = lazy(() => import('../pages/AnalisisInteligente'));
const AsistenteIA = lazy(() => import('../pages/AsistenteIA'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/recuperar" element={<RecuperarPassword />} />
        <Route path="/recuperar-password" element={<RecuperarPassword />} />
        <Route path="/restablecer" element={<RestablecerPassword />} />
        <Route path="/register" element={<Register />} />
        <Route path="/crear-empresa" element={<Register />} />
        <Route path="/estado-sistema" element={<SystemStatus />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/inicio" element={<Inicio />} />
          <Route path="/compras" element={<Compras />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="/soporte" element={<ContactoSoporte />} />
          <Route path="/soporte/ayuda" element={<AyudaBasica />} />
          {ENABLE_SECADO_PROTOTYPE ? (
            <>
              <Route path="/inventario/secados" element={<SecadosActivos />} />
              <Route path="/inventario/secado/inicio" element={<SecadoInicio />} />
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
            </>
          ) : null}
          <Route
            path="/inventario/:tipoCafeId/:calidadId/sublotes"
            element={<Sublotes />}
          />
          <Route path="/gastos" element={<GastosListado />} />
          <Route path="/gastos/registro" element={<GastosOperativos />} />
          <Route path="/resumen-financiero" element={<ResumenFinanciero />} />
          <Route path="/resumen-financiero/acceso" element={<ResumenFinanciero />} />
          <Route path="/asistente" element={<AsistenteIA />} />
          <Route
            path="/resumen-financiero/analisis-inteligente"
            element={<AnalisisInteligente />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
