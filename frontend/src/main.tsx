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
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import { UserProvider } from './context/UserContext';
import './index.css';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {googleClientId ? (
      <GoogleOAuthProvider clientId={googleClientId}>
        <UserProvider>
          <App />
        </UserProvider>
      </GoogleOAuthProvider>
    ) : (
      <UserProvider>
        <App />
      </UserProvider>
    )}
  </React.StrictMode>,
);