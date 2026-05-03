import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Capacitor } from '@capacitor/core';
import App from './App';
import { CloudStatusProvider } from './context/CloudStatusContext';
import { UserProvider } from './context/UserContext';
import './index.css';

const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';
const shouldLoadGoogleIdentityScript = Boolean(googleClientId) && Capacitor.getPlatform() !== 'android';

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CloudStatusProvider>
      <UserProvider>{children}</UserProvider>
    </CloudStatusProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  shouldLoadGoogleIdentityScript ? (
    <GoogleOAuthProvider clientId={googleClientId}>
      <Providers>
        <App />
      </Providers>
    </GoogleOAuthProvider>
  ) : (
    <Providers>
      <App />
    </Providers>
  ),
);
