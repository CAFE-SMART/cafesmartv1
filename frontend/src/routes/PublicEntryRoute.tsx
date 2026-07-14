import { lazy, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { AppLoadingScreen } from '../components/AppLoadingScreen';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import { getStoredAuthToken } from '../storage/authStorage';

const Landing = lazy(() => import('../pages/Landing'));

export function PublicEntryRoute() {
  const { isDesktop } = useDeviceLayout();
  const [authResolved, setAuthResolved] = useState(false);
  const [hasStoredSession, setHasStoredSession] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void getStoredAuthToken().then((token) => {
      if (!isMounted) return;
      setHasStoredSession(Boolean(token));
      setAuthResolved(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!authResolved) {
    return <AppLoadingScreen />;
  }

  if (hasStoredSession) {
    return <Navigate to="/inicio" replace />;
  }

  if (Capacitor.isNativePlatform() || !isDesktop) {
    return <Navigate to="/login" replace />;
  }

  return <Landing />;
}
