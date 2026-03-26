import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Inventario from '../pages/Inventario';
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
        <Route path="/inventario" element={<Inventario />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
