import { Preferences } from '@capacitor/preferences';

export const AUTH_STORAGE_KEYS = {
  token: 'auth_token',
  user: 'auth_user',
  hasCompany: 'auth_has_company',
  rememberSession: 'auth_remember_session',
} as const;

const runtimeAuthStorage = new Map<string, string>();

export async function getAuthStorageValue(key: string) {
  const { value } = await Preferences.get({ key });
  return value ?? runtimeAuthStorage.get(key) ?? null;
}

export async function setAuthStorageValue(key: string, value: string) {
  runtimeAuthStorage.set(key, value);
  await Preferences.set({ key, value });
}

export function setRuntimeAuthStorageValue(key: string, value: string) {
  runtimeAuthStorage.set(key, value);
}

export async function removeAuthStorageValue(key: string) {
  runtimeAuthStorage.delete(key);
  await Preferences.remove({ key });
}

export async function clearAuthStorage() {
  await Promise.all([
    removeAuthStorageValue(AUTH_STORAGE_KEYS.token),
    removeAuthStorageValue(AUTH_STORAGE_KEYS.user),
    removeAuthStorageValue(AUTH_STORAGE_KEYS.hasCompany),
    removeAuthStorageValue(AUTH_STORAGE_KEYS.rememberSession),
  ]);
}
