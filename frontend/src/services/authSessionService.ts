import {
  AUTH_STORAGE_KEYS,
  getAuthStorageValue,
  removeAuthStorageValue,
  setAuthStorageValue,
} from '../storage/authStorage';
import {
  deleteOfflineRecord,
  getOfflineRecord,
  setOfflineRecord,
} from './offlineDb';
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
  descripcionOrganizacion?: string | null;
};

export type CachedAuthSession = {
  accessToken: string;
  user: CachedUser;
  hasCompany: boolean;
  lastLoginAt: number;
  sessionUpdatedAt?: number;
  offlineAllowed: boolean;
  loggedOutManually: boolean;
};

type StoredSessionSource = 'indexeddb' | 'preferences';

type StoredSessionRead =
  | { session: Partial<CachedAuthSession>; source: StoredSessionSource }
  | null;

export type CachedSessionResult =
  | { session: CachedAuthSession; reason: 'valid' }
  | { session: null; reason: 'missing' | 'invalid' | 'disabled' };

export type OfflineEntryResult =
  | { canEnter: true; session: CachedAuthSession }
  | {
      canEnter: false;
      reason: CachedSessionResult['reason'] | 'email_mismatch';
      diagnostics?: {
        offlineAllowed?: boolean;
        loggedOutManually?: boolean;
        emailMatches?: boolean;
        source?: StoredSessionSource;
      };
    };

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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeSession(session: CachedAuthSession): CachedAuthSession {
  return {
    ...session,
    user: {
      ...session.user,
      email: normalizeEmail(session.user.email),
    },
    lastLoginAt: session.lastLoginAt || Date.now(),
    sessionUpdatedAt: session.sessionUpdatedAt || Date.now(),
    offlineAllowed: session.offlineAllowed,
    loggedOutManually: session.loggedOutManually,
  };
}

function getSessionFreshness(session: Partial<CachedAuthSession>) {
  return session.sessionUpdatedAt ?? session.lastLoginAt ?? 0;
}

async function readStoredSession(): Promise<StoredSessionRead> {
  let indexedDbSession: Partial<CachedAuthSession> | null = null;
  try {
    indexedDbSession = await getOfflineRecord<CachedAuthSession>(
      'cachedSession',
      AUTH_STORAGE_KEYS.lastSession,
    );
  } catch {
    // Preferences queda como respaldo para WebViews donde IndexedDB falle.
  }

  let preferencesSession: Partial<CachedAuthSession> | null = null;
  try {
    const raw = await getAuthStorageValue(AUTH_STORAGE_KEYS.lastSession);
    preferencesSession = raw ? (JSON.parse(raw) as Partial<CachedAuthSession>) : null;
  } catch {
    preferencesSession = null;
  }

  if (indexedDbSession && preferencesSession) {
    return getSessionFreshness(preferencesSession) > getSessionFreshness(indexedDbSession)
      ? { session: preferencesSession, source: 'preferences' }
      : { session: indexedDbSession, source: 'indexeddb' };
  }

  if (indexedDbSession) return { session: indexedDbSession, source: 'indexeddb' };
  if (preferencesSession) return { session: preferencesSession, source: 'preferences' };
  return null;
}

export const authSessionService = {
  async saveLastSession(session: CachedAuthSession) {
    const normalized = normalizeSession({
      ...session,
      sessionUpdatedAt: Date.now(),
    });
    let source: StoredSessionSource = 'indexeddb';
    try {
      await setOfflineRecord(
        'cachedSession',
        AUTH_STORAGE_KEYS.lastSession,
        normalized,
      );
    } catch {
      // La copia en Preferences conserva compatibilidad si IndexedDB falla.
      source = 'preferences';
    }

    await setAuthStorageValue(
      AUTH_STORAGE_KEYS.lastSession,
      JSON.stringify(normalized),
    );

    return { source, session: normalized };
  },

  async reactivateOfflineAccess(session: CachedAuthSession) {
    const saved = await this.saveLastSession({
      ...session,
      offlineAllowed: true,
      loggedOutManually: false,
      sessionUpdatedAt: Date.now(),
    });

    let verifiedSource: StoredSessionSource = saved.source;
    let verifiedSession: CachedAuthSession | null = null;

    try {
      verifiedSession = await getOfflineRecord<CachedAuthSession>(
        'cachedSession',
        AUTH_STORAGE_KEYS.lastSession,
      );
      if (verifiedSession) {
        verifiedSource = 'indexeddb';
      }
    } catch {
      const stored = await readStoredSession();
      if (stored && hasMinimumSessionData(stored.session)) {
        verifiedSession = normalizeSession(stored.session as CachedAuthSession);
        verifiedSource = stored.source;
      }
    }

    let offlineAllowed = verifiedSession?.offlineAllowed === true;
    let loggedOutManually = verifiedSession?.loggedOutManually === true;

    if (!offlineAllowed || loggedOutManually) {
      try {
        await setOfflineRecord(
          'cachedSession',
          AUTH_STORAGE_KEYS.lastSession,
          saved.session,
        );
        verifiedSession = await getOfflineRecord<CachedAuthSession>(
          'cachedSession',
          AUTH_STORAGE_KEYS.lastSession,
        );
        verifiedSource = 'indexeddb';
        offlineAllowed = verifiedSession?.offlineAllowed === true;
        loggedOutManually = verifiedSession?.loggedOutManually === true;
      } catch {
        // Si IndexedDB falla, queda la copia en Preferences y el diagnostico lo mostrara.
      }
    }

    if (import.meta.env.DEV) {
      console.info('[offline-login] session reactivated', {
        offlineAllowed,
        loggedOutManually,
        source: verifiedSource,
      });
    }

    return {
      source: verifiedSource,
      session: verifiedSession ?? saved.session,
      offlineAllowed,
      loggedOutManually,
    };
  },

  async getLastSessionResult(): Promise<CachedSessionResult> {
    try {
      const stored = await readStoredSession();
      const parsed = stored?.session;
      if (!parsed) return { session: null, reason: 'missing' };

      if (!hasMinimumSessionData(parsed)) {
        await this.clearLastSession();
        return { session: null, reason: 'invalid' };
      }

      const session = normalizeSession(parsed as CachedAuthSession);

      if (session.offlineAllowed !== true || session.loggedOutManually === true) {
        return { session: null, reason: 'disabled' };
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
    try {
      await deleteOfflineRecord('cachedSession', AUTH_STORAGE_KEYS.lastSession);
    } catch {
      // Preferences queda como respaldo.
    }
    await removeAuthStorageValue(AUTH_STORAGE_KEYS.lastSession);
  },

  async disableOfflineAccess() {
    const stored = await readStoredSession();
    const parsed = stored?.session;
    if (!parsed) return;

    try {
      if (!hasMinimumSessionData(parsed)) {
        await this.clearLastSession();
        return;
      }

      const saved = await this.saveLastSession({
        ...(parsed as CachedAuthSession),
        offlineAllowed: false,
        loggedOutManually: true,
      });
      if (import.meta.env.DEV) {
        console.info('[offline-login] session disabled by logout', {
          reason: 'manual_logout',
          source: saved.source,
        });
      }
    } catch {
      await this.clearLastSession();
    }
  },

  async hasValidCachedSession() {
    return Boolean(await this.getLastSession());
  },

  async canEnterOffline(email: string): Promise<OfflineEntryResult> {
    const requestedEmail = normalizeEmail(email);
    const stored = await readStoredSession();
    const storedSession = stored?.session;

    if (storedSession && hasMinimumSessionData(storedSession)) {
      const session = normalizeSession(storedSession as CachedAuthSession);
      const cachedEmail = normalizeEmail(session.user.email);
      const emailMatches = Boolean(requestedEmail && requestedEmail === cachedEmail);
      const diagnostics = {
        offlineAllowed: session.offlineAllowed,
        loggedOutManually: session.loggedOutManually,
        emailMatches,
        source: stored.source,
      };

      if (import.meta.env.DEV) {
        console.info('[offline-login] session read', diagnostics);
      }

      if (!emailMatches) {
        return {
          canEnter: false,
          reason: 'email_mismatch',
          diagnostics,
        };
      }

      if (session.offlineAllowed !== true || session.loggedOutManually === true) {
        return {
          canEnter: false,
          reason: 'disabled',
          diagnostics,
        };
      }

      return { canEnter: true, session };
    }

    const result = await this.getLastSessionResult();
    if (!result.session) {
      return { canEnter: false, reason: result.reason };
    }

    return { canEnter: true, session: result.session };
  },

  isTokenExpired(session: CachedAuthSession) {
    return isExpired(session);
  },
};
