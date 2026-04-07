import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Inicio from '../pages/Inicio';
import Compras from '../pages/Compras';
import Inventario from '../pages/Inventario';
import Sublotes from '../pages/Sublotes';
import SecadoSeleccion from '../pages/SecadoSeleccion';
import SecadoProceso from '../pages/SecadoProceso';
import SecadoResumen from '../pages/SecadoResumen';
import Ajustes from '../pages/Ajustes';
import SystemStatus from '../pages/SystemStatus';
import { ProtectedRoute } from '../components/ProtectedRoute';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/crear-empresa" element={<Register />} />
      <Route path="/estado-sistema" element={<SystemStatus />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/compras" element={<Compras />} />
        <Route path="/inventario" element={<Inventario />} />
        <Route path="/ajustes" element={<Ajustes />} />
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
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
