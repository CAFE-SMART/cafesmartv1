import {
  AUTH_STORAGE_KEYS,
  getAuthStorageValue,
  removeAuthStorageValue,
  setAuthStorageValue,
} from '../storage/authStorage';
import { parseJwtPayload } from '../utils/jwt';

type CachedUser = {
  id: number | string;
  email: string;
  name: string;
  telefono?: string | null;
  organizacionId?: string | null;
  nombreOrganizacion?: string | null;
  tipoOrganizacion?: 'COOPERATIVA' | 'COMPRAVENTA' | 'PERSONALIZADO' | 'OTRO' | null;
  otroTipoDetalle?: string | null;
};

export type CachedAuthSession = {
  accessToken: string;
  user: CachedUser;
  hasCompany: boolean;
  lastLoginAt: number;
  offlineAllowed: boolean;
  loggedOutManually: boolean;
};

export type CachedSessionResult =
  | { session: CachedAuthSession; reason: 'valid' }
  | { session: null; reason: 'missing' | 'invalid' | 'expired' | 'disabled' };

export type OfflineEntryResult =
  | { canEnter: true; session: CachedAuthSession }
  | { canEnter: false; reason: CachedSessionResult['reason'] | 'email_mismatch' };

function getTokenExpirationMs(token: string): number | null {
  const payload = parseJwtPayload<{ exp?: number }>(token);
  return payload?.exp ? payload.exp * 1000 : null;
}

function isExpired(session: CachedAuthSession) {
  const expirationMs = getTokenExpirationMs(session.accessToken);
  return expirationMs !== null && expirationMs <= Date.now();
}

function hasMinimumSessionData(value: Partial<CachedAuthSession>) {
  return (
    typeof value.accessToken === 'string' &&
    value.accessToken.length > 0 &&
    typeof value.user === 'object' &&
    value.user !== null &&
    typeof value.user.id !== 'undefined' &&
    typeof value.user.email === 'string' &&
    typeof value.user.name === 'string' &&
    typeof value.hasCompany === 'boolean' &&
    typeof value.lastLoginAt === 'number'
  );
}

export const authSessionService = {
  async saveLastSession(session: CachedAuthSession) {
    await setAuthStorageValue(
      AUTH_STORAGE_KEYS.lastSession,
      JSON.stringify({
        ...session,
        lastLoginAt: session.lastLoginAt || Date.now(),
        offlineAllowed: session.offlineAllowed,
        loggedOutManually: session.loggedOutManually,
      }),
    );
  },

  async getLastSessionResult(): Promise<CachedSessionResult> {
    const raw = await getAuthStorageValue(AUTH_STORAGE_KEYS.lastSession);
    if (!raw) return { session: null, reason: 'missing' };

    try {
      const parsed = JSON.parse(raw) as Partial<CachedAuthSession>;
      if (!hasMinimumSessionData(parsed)) {
        await this.clearLastSession();
        return { session: null, reason: 'invalid' };
      }

      const session = parsed as CachedAuthSession;

      if (session.offlineAllowed !== true || session.loggedOutManually === true) {
        return { session: null, reason: 'disabled' };
      }

      if (isExpired(session)) {
        await this.clearLastSession();
        return { session: null, reason: 'expired' };
      }

      return { session, reason: 'valid' };
    } catch {
      await this.clearLastSession();
      return { session: null, reason: 'invalid' };
    }
  },

  async getLastSession() {
    const result = await this.getLastSessionResult();
    return result.session;
  },

  async clearLastSession() {
    await removeAuthStorageValue(AUTH_STORAGE_KEYS.lastSession);
  },

  async disableOfflineAccess() {
    const raw = await getAuthStorageValue(AUTH_STORAGE_KEYS.lastSession);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<CachedAuthSession>;
      if (!hasMinimumSessionData(parsed)) {
        await this.clearLastSession();
        return;
      }

      await setAuthStorageValue(
        AUTH_STORAGE_KEYS.lastSession,
        JSON.stringify({
          ...parsed,
          offlineAllowed: false,
          loggedOutManually: true,
        }),
      );
    } catch {
      await this.clearLastSession();
    }
  },

  async hasValidCachedSession() {
    return Boolean(await this.getLastSession());
  },

  async canEnterOffline(email: string): Promise<OfflineEntryResult> {
    const result = await this.getLastSessionResult();
    if (!result.session) {
      return { canEnter: false, reason: result.reason };
    }

    const requestedEmail = email.trim().toLowerCase();
    const cachedEmail = result.session.user.email.trim().toLowerCase();
    if (!requestedEmail || requestedEmail !== cachedEmail) {
      return { canEnter: false, reason: 'email_mismatch' };
    }

    return { canEnter: true, session: result.session };
  },
};
