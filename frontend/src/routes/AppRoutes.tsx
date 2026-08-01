import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Landing from '../pages/Landing';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Inicio from '../pages/Inicio';
import Compras from '../pages/Compras';
import Inventario from '../pages/Inventario';
import Ventas from '../pages/Ventas';
import Sublotes from '../pages/Sublotes';
import SecadoSeleccion from '../pages/SecadoSeleccion';
import SecadosActivos from '../pages/SecadosActivos';
import SecadoProceso from '../pages/SecadoProceso';
import SecadoResumen from '../pages/SecadoResumen';
import SecadoInicio from '../pages/SecadoInicio';
import Ajustes from '../pages/Ajustes';
import SystemStatus from '../pages/SystemStatus';
import GastosOperativos from '../pages/GastosOperativos';
import GastosListado from '../pages/GastosListado';
import ResumenFinanciero from '../pages/ResumenFinanciero';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { ENABLE_SECADO_PROTOTYPE } from '../config/features';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/crear-empresa" element={<Register />} />
      <Route path="/estado-sistema" element={<SystemStatus />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/compras" element={<Compras />} />
        <Route path="/ventas" element={<Ventas />} />
        <Route path="/inventario" element={<Inventario />} />
        <Route path="/ajustes" element={<Ajustes />} />
        {ENABLE_SECADO_PROTOTYPE ? (
          <>
            <Route path="/inventario/secados" element={<SecadosActivos />} />
            <Route
              path="/inventario/secado-inicio"
              element={<SecadoInicio />}
            />
            <Route
              path="/inventario/:tipoCafeId/:calidadId/secado"
              element={<SecadoSeleccion />}
            />
            <Route
              path="/inventario/secado/nuevo/configurar"
              element={<SecadoProceso />}
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
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
