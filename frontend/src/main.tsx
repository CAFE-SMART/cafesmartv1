/*
 * ========================================================
 * 🚀 ARCHIVO: main.tsx (El Punto de Entrada del Frontend)
 * ========================================================
 * ¿Para qué sirve?: Este es el primer archivo que lee React. Su trabajo
 * es agarrar tu componente principal (<App />) y "dibujarlo" en la página web.
 * 
 * ¿Debo editarlo?: ⛔ NO. Por lo general este archivo no se toca a menos 
 * que vayas a instalar un proveedor global (como Redux o un ThemeProvider).
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);