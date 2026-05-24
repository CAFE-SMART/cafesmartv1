export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      if (import.meta.env.DEV) {
        console.info('[pwa]', 'No se pudo registrar el service worker.', error);
      }
    });
  });
}
