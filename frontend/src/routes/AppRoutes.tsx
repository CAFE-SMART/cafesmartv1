import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Inicio from '../pages/Inicio';
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
        <Route path="/inventario" element={<Navigate to="/inicio" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
