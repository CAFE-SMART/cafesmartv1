import { Capacitor } from '@capacitor/core';

const isCapacitorNative = Capacitor.isNativePlatform();

function clearServiceWorkerState(reason: string) {
  return navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(registrations.map((registration) => registration.unregister())),
    )
    .then(() => {
      if (!('caches' in window)) return undefined;
      return caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
    })
    .then(() => {
      console.info('[pwa]', reason);
    })
    .catch((error) => {
      console.info('[pwa]', 'No se pudo limpiar el service worker.', error);
    });
}

export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    if (isCapacitorNative) {
      void clearServiceWorkerState(
        'Service workers y caches limpiados en Capacitor.',
      );
      return;
    }

    if (import.meta.env.DEV) {
      void clearServiceWorkerState(
        'Service workers y caches limpiados en desarrollo.',
      );
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      if (import.meta.env.DEV) {
        console.info('[pwa]', 'No se pudo registrar el service worker.', error);
      }
    });
  });
}
