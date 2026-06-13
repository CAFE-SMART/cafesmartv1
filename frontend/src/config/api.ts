import { Capacitor } from '@capacitor/core';

const isAndroid = Capacitor.getPlatform() === 'android';
export const SHOULD_LOG_API_DEBUG = import.meta.env.DEV || isAndroid;
const ANDROID_EMULATOR_API_URL = 'http://10.0.2.2:3000';
const LOCAL_API_URL = 'http://localhost:3000';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const configuredApiUrl =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || '';
const keepAndroidLocalhost =
  (
    import.meta.env.VITE_KEEP_ANDROID_LOCALHOST as string | undefined
  )?.trim() === 'true';

function isLocalhostUrl(url: string) {
  try {
    const { hostname } = new URL(url);
    return LOCAL_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, '');
}

function buildLanApiUrl(apiUrl: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const configuredUrl = new URL(apiUrl);
    const currentHost = window.location.hostname?.trim();

    if (
      !currentHost ||
      LOCAL_HOSTS.has(currentHost) ||
      !LOCAL_HOSTS.has(configuredUrl.hostname)
    ) {
      return null;
    }

    return `${configuredUrl.protocol}//${currentHost}${
      configuredUrl.port ? `:${configuredUrl.port}` : ''
    }`;
  } catch {
    return null;
  }
}

function getConfiguredApiUrl() {
  if (
    isAndroid &&
    !keepAndroidLocalhost &&
    (!configuredApiUrl || isLocalhostUrl(configuredApiUrl))
  ) {
    return ANDROID_EMULATOR_API_URL;
  }

  return configuredApiUrl || LOCAL_API_URL;
}

export function getApiBaseUrlCandidates() {
  const configuredUrl = stripTrailingSlash(getConfiguredApiUrl());
  const lanUrl = buildLanApiUrl(configuredUrl);

  return [...new Set([lanUrl, configuredUrl].filter(Boolean) as string[])];
}

export const API_URL = getApiBaseUrlCandidates()[0] ?? LOCAL_API_URL;

if (SHOULD_LOG_API_DEBUG) {
  console.info(
    `[CafeSmart][api-config] VITE_API_URL=${configuredApiUrl || '(empty)'}`,
  );
  console.info('[CafeSmart][api-config]', {
    mode: import.meta.env.MODE,
    platform: Capacitor.getPlatform(),
    configuredApiUrl: configuredApiUrl || '(empty)',
    keepAndroidLocalhost,
    candidates: getApiBaseUrlCandidates(),
    selectedApiUrl: API_URL,
  });
}

export default API_URL;
