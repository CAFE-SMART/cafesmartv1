import { Preferences } from '@capacitor/preferences';

export const AUTH_STORAGE_KEYS = {
  token: 'auth_token',
  user: 'auth_user',
  hasCompany: 'auth_has_company',
} as const;

export async function getAuthStorageValue(key: string) {
  const { value } = await Preferences.get({ key });
  return value;
}

export async function setAuthStorageValue(key: string, value: string) {
  await Preferences.set({ key, value });
}

export async function removeAuthStorageValue(key: string) {
  await Preferences.remove({ key });
}

export async function clearAuthStorage() {
  await Promise.all([
    removeAuthStorageValue(AUTH_STORAGE_KEYS.token),
    removeAuthStorageValue(AUTH_STORAGE_KEYS.user),
    removeAuthStorageValue(AUTH_STORAGE_KEYS.hasCompany),
  ]);
}
