import { Capacitor } from '@capacitor/core';

const isAndroid = Capacitor.getPlatform() === 'android';
const ANDROID_EMULATOR_API_URL = 'http://10.0.2.2:3000';
const LOCAL_API_URL = 'http://localhost:3000';

const configuredApiUrl =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || '';
const keepAndroidLocalhost =
  (import.meta.env.VITE_KEEP_ANDROID_LOCALHOST as string | undefined)?.trim() === 'true';

function isLocalhostUrl(url: string) {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

export const API_URL =
  isAndroid && (!keepAndroidLocalhost && (!configuredApiUrl || isLocalhostUrl(configuredApiUrl)))
    ? ANDROID_EMULATOR_API_URL
    : configuredApiUrl || LOCAL_API_URL;

export default API_URL;
