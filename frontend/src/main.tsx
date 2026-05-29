import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Capacitor } from '@capacitor/core';
import App from './App';
import { CloudStatusProvider } from './context/CloudStatusContext';
import { AiConversationProvider } from './context/AiConversationContext';
import { ThemeProvider } from './theme/themeProvider';
import { AccessibilityProvider } from './theme/accessibilityProvider';
import { UserProvider } from './context/UserContext';
import { registerServiceWorker } from './services/pwaService';
import './index.css';

const googleClientId =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';
const shouldLoadGoogleIdentityScript =
  Boolean(googleClientId) && Capacitor.getPlatform() !== 'android';

registerServiceWorker();

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AccessibilityProvider>
        <CloudStatusProvider>
          <UserProvider>
            <AiConversationProvider>{children}</AiConversationProvider>
          </UserProvider>
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
