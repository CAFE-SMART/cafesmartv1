import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Capacitor } from '@capacitor/core';
import App from './App';
import { CloudStatusProvider } from './context/CloudStatusContext';
import { ThemeProvider } from './theme/themeProvider';
import { AccessibilityProvider } from './theme/accessibilityProvider';
import { UserProvider } from './context/UserContext';
import { registerServiceWorker } from './services/pwaService';
import { logDebugLine } from './utils/debugLog';
import './index.css';

const googleClientId =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';
const shouldLoadGoogleIdentityScript =
  Boolean(googleClientId) && Capacitor.getPlatform() !== 'android';

if (import.meta.env.DEV || Capacitor.isNativePlatform()) {
  console.log(
    `[CafeSmart][startup-env] MODE=${import.meta.env.MODE} VITE_API_URL=${
      (import.meta.env.VITE_API_URL as string | undefined)?.trim() || '(empty)'
    } platform=${Capacitor.getPlatform()} isNative=${Capacitor.isNativePlatform()}`,
  );
  logDebugLine('[CafeSmart][startup-env]', {
    MODE: import.meta.env.MODE,
    VITE_API_URL:
      (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
      '(empty)',
    platform: Capacitor.getPlatform(),
    isNative: Capacitor.isNativePlatform(),
  });
}

registerServiceWorker();

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AccessibilityProvider>
        <CloudStatusProvider>
          <UserProvider>{children}</UserProvider>
        </CloudStatusProvider>
      </AccessibilityProvider>
    </ThemeProvider>
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
