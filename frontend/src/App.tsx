/*
 * ========================================================
 * 🗺️ ARCHIVO: App.tsx (El Enrutador Principal)
 * ========================================================
 * ¿Para qué sirve?: Aquí es donde le decimos a React qué pantalla mostrar
 * dependiendo de la URL (Por ejemplo: si la url es /login, muestra la pantalla Login).
 * 
 * ¿Debo editarlo?: ✅ SÍ. Cada vez que creen una nueva pantalla (ej. Inventario),
 * deben venir aquí y agregar la ruta (<Route path="/inventario" element={<Inventario />} />).
 */
import React from 'react';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <AppRoutes />
    </div>
  );
}

export default App;
