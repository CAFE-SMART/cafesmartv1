import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

const DESKTOP_MIN_WIDTH = 1024;

function getIsNativeMobile() {
  return Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'android';
}

function getLayoutKind() {
  if (typeof window === 'undefined') {
    return 'mobile' as const;
  }

  if (getIsNativeMobile()) {
    return 'mobile' as const;
  }

  return window.innerWidth >= DESKTOP_MIN_WIDTH ? 'desktop' : 'mobile';
}

export function useDeviceLayout() {
  const [layout, setLayout] = useState<'mobile' | 'desktop'>(() =>
    getLayoutKind(),
  );

  useEffect(() => {
    if (getIsNativeMobile()) {
      setLayout('mobile');
      return undefined;
    }

    const updateLayout = () => setLayout(getLayoutKind());
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  return {
    layout,
    isMobile: layout === 'mobile',
    isDesktop: layout === 'desktop',
    isNativeMobile: getIsNativeMobile(),
  };
}
