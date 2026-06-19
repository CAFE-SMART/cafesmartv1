import { Preferences } from '@capacitor/preferences';

type StoredSessionUser = {
  id: number | string;
  email?: string;
  correo?: string;
  name?: string;
  nombre?: string;
  telefono?: string | null;
  organizacionId?: string | null;
  nombreOrganizacion?: string | null;
  tipoOrganizacion?: string | null;
  otroTipoDetalle?: string | null;
  descripcionOrganizacion?: string | null;
  avatarUrl?: string | null;
};

type StoredLastSession = {
  accessToken?: string;
  user?: StoredSessionUser | null;
  hasCompany?: boolean;
  lastLoginAt?: number;
  sessionUpdatedAt?: number;
  offlineAllowed?: boolean;
  loggedOutManually?: boolean;
};

export const AUTH_STORAGE_KEYS = {
  token: 'auth_token',
  user: 'auth_user',
  hasCompany: 'auth_has_company',
  rememberSession: 'auth_remember_session',
  rememberedEmail: 'auth_remembered_email',
  rememberedName: 'auth_remembered_name',
  lastSession: 'auth_last_session',
  manualLogout: 'auth_manual_logout',
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

function parseLastSession(raw: string | null): StoredLastSession | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredLastSession;
    if (
      typeof parsed?.accessToken !== 'string' ||
      parsed.accessToken.length === 0 ||
      !parsed.user ||
      typeof parsed.user !== 'object' ||
      typeof parsed.user.id === 'undefined'
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function saveRestoredPrimaryAuth(session: StoredLastSession) {
  if (!session.accessToken || !session.user) return null;

  const hasCompany = session.hasCompany === true || Boolean(session.user.organizacionId);
  const normalizedSession: StoredLastSession = {
    ...session,
    hasCompany,
    offlineAllowed: true,
    loggedOutManually: false,
    lastLoginAt: session.lastLoginAt || Date.now(),
    sessionUpdatedAt: Date.now(),
  };

  await Promise.all([
    setAuthStorageValue(AUTH_STORAGE_KEYS.token, session.accessToken),
    setAuthStorageValue(AUTH_STORAGE_KEYS.user, JSON.stringify(session.user)),
    setAuthStorageValue(AUTH_STORAGE_KEYS.hasCompany, String(hasCompany)),
    setAuthStorageValue(
      AUTH_STORAGE_KEYS.lastSession,
      JSON.stringify(normalizedSession),
    ),
    removeAuthStorageValue(AUTH_STORAGE_KEYS.manualLogout),
  ]);

  return {
    token: session.accessToken,
    user: session.user,
    hasCompany,
    session: normalizedSession,
  };
}

export async function restorePrimaryAuthFromLastSession() {
  const raw = await getAuthStorageValue(AUTH_STORAGE_KEYS.lastSession);
  const session = parseLastSession(raw);

  if (!session?.accessToken || !session.user) {
    return null;
  }

  return saveRestoredPrimaryAuth(session);
}

export async function getStoredAuthToken() {
  const directToken = await getAuthStorageValue(AUTH_STORAGE_KEYS.token);
  if (directToken) {
    return directToken;
  }

  const restored = await restorePrimaryAuthFromLastSession();
  return restored?.token ?? null;
}

export async function saveRememberedAccount(account: {
  email: string;
  name?: string | null;
}) {
  await Promise.all([
    setAuthStorageValue(AUTH_STORAGE_KEYS.rememberedEmail, account.email),
    account.name
      ? setAuthStorageValue(AUTH_STORAGE_KEYS.rememberedName, account.name)
      : removeAuthStorageValue(AUTH_STORAGE_KEYS.rememberedName),
  ]);
}

export async function getRememberedAccount() {
  const [email, name] = await Promise.all([
    getAuthStorageValue(AUTH_STORAGE_KEYS.rememberedEmail),
    getAuthStorageValue(AUTH_STORAGE_KEYS.rememberedName),
  ]);

  return {
    email: email ?? '',
    name: name ?? '',
  };
}

export async function clearRememberedAccount() {
  await Promise.all([
    removeAuthStorageValue(AUTH_STORAGE_KEYS.rememberedEmail),
    removeAuthStorageValue(AUTH_STORAGE_KEYS.rememberedName),
  ]);
}

export async function updateRememberedAccountIfCurrent(account: {
  previousEmail?: string | null;
  email: string;
  name: string;
}) {
  const remembered = await getRememberedAccount();
  const rememberedEmail = remembered.email.trim().toLowerCase();
  const previousEmail = account.previousEmail?.trim().toLowerCase();
  const nextEmail = account.email.trim().toLowerCase();

  if (!rememberedEmail) {
    return;
  }

  if (rememberedEmail !== previousEmail && rememberedEmail !== nextEmail) {
    return;
  }

  await saveRememberedAccount({
    email: account.email,
    name: account.name,
  });
}
