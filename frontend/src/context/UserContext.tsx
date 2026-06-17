import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AUTH_STORAGE_KEYS,
  clearAuthStorage,
  getAuthStorageValue,
  restorePrimaryAuthFromLastSession,
  setRuntimeAuthStorageValue,
  setAuthStorageValue,
} from '../storage/authStorage';
import { authSessionService } from '../services/authSessionService';
import { clearFinancialAccessSession } from '../services/financialAccessService';
import { parseJwtPayload } from '../utils/jwt';

type TipoOrganizacion = 'COOPERATIVA' | 'COMPRAVENTA' | 'PERSONALIZADO' | 'OTRO';

type User = {
  id: number | string;
  email: string;
  name: string;
  telefono?: string | null;
  organizacionId?: string | null;
  nombreOrganizacion?: string | null;
  tipoOrganizacion?: TipoOrganizacion | null;
  otroTipoDetalle?: string | null;
  descripcionOrganizacion?: string | null;
  avatarUrl?: string | null;
};

type StoredUserShape = {
  id: number | string;
  email?: string;
  name?: string;
  correo?: string;
  nombre?: string;
  telefono?: string | null;
  organizacionId?: string | null;
  nombreOrganizacion?: string | null;
  tipoOrganizacion?: TipoOrganizacion | null;
  otroTipoDetalle?: string | null;
  descripcionOrganizacion?: string | null;
  avatarUrl?: string | null;
};

type UserSessionInput = {
  user: User;
  token: string;
  hasCompany: boolean;
  persist?: boolean;
  offline?: boolean;
};

type UserState = {
  user: User | null;
  token: string | null;
  hasCompany: boolean;
  hydrated: boolean;
  setSession: (data: UserSessionInput) => Promise<void>;
  logout: () => Promise<void>;
};

const UserContext = createContext<UserState | null>(null);
const SESSION_EXPIRED_MESSAGE_KEY = 'cafesmart_session_expired_message';
const LOGIN_DRAFT_STORAGE_KEY = 'cafesmart:login-draft:v1';

function mapStoredUserToUser(parsed: StoredUserShape): User {
  return {
    id: parsed.id,
    email: parsed.email ?? parsed.correo ?? '',
    name: parsed.name ?? parsed.nombre ?? '',
    telefono: parsed.telefono ?? null,
    organizacionId: parsed.organizacionId ?? null,
    nombreOrganizacion: parsed.nombreOrganizacion ?? null,
    tipoOrganizacion: parsed.tipoOrganizacion ?? null,
    otroTipoDetalle: parsed.otroTipoDetalle ?? null,
    descripcionOrganizacion: parsed.descripcionOrganizacion ?? null,
    avatarUrl: parsed.avatarUrl ?? null,
  };
}

function getTokenExpirationMs(token: string): number | null {
  const payload = parseJwtPayload<{ exp?: number }>(token);
  if (!payload?.exp) {
    return null;
  }

  return payload.exp * 1000;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hasCompany, setHasCompany] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);
  const [offlineSession, setOfflineSession] = useState(false);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      const browserOnline =
        typeof navigator === 'undefined' ? true : navigator.onLine;
      const [
        storedUserRaw,
        storedToken,
        storedHasCompany,
      ] = await Promise.all([
        getAuthStorageValue(AUTH_STORAGE_KEYS.user),
        getAuthStorageValue(AUTH_STORAGE_KEYS.token),
        getAuthStorageValue(AUTH_STORAGE_KEYS.hasCompany),
      ]);

      if (!active) {
        return;
      }

      let currentUserRaw = storedUserRaw;
      let currentToken = storedToken;
      let currentHasCompany = storedHasCompany;

      if (!currentToken || !currentUserRaw) {
        const restored = await restorePrimaryAuthFromLastSession();
        if (!active) return;

        if (restored) {
          currentToken = restored.token;
          currentUserRaw = JSON.stringify(restored.user);
          currentHasCompany = String(restored.hasCompany);
          console.info(
            '[offline-login] credenciales primarias restauradas desde auth_last_session',
            JSON.stringify({ hasCompany: restored.hasCompany }),
          );
        }
      }

      if (!currentToken || !currentUserRaw) {
        if (!browserOnline) {
          const cached = await authSessionService.getLastSessionResult();
          if (!active) return;

          if (cached.session) {
            await restorePrimaryAuthFromLastSession();
            if (!active) return;
            setToken(cached.session.accessToken);
            setHasCompany(cached.session.hasCompany);
            setUser(cached.session.user);
            setOfflineSession(true);
            setHydrated(true);
            console.info(
              '[offline-login] sesion cacheada restaurada durante hidratacion',
              JSON.stringify({ reason: cached.reason }),
            );
            return;
          }
        }

        setUser(null);
        setToken(null);
        setHasCompany(false);
        setHydrated(true);
        return;
      }

      const expirationMs = getTokenExpirationMs(currentToken);
      const isExpired = expirationMs !== null && expirationMs <= Date.now();

      if (isExpired) {
        if (!browserOnline) {
          try {
            const parsed = JSON.parse(currentUserRaw) as StoredUserShape;
            const nextHasCompany =
              currentHasCompany === 'true' || Boolean(parsed.organizacionId);

            setToken(currentToken);
            setHasCompany(nextHasCompany);
            setUser(mapStoredUserToUser(parsed));
            setOfflineSession(true);
            setHydrated(true);
            console.info(
              '[offline-login] token vencido aceptado temporalmente sin conexion',
              JSON.stringify({ hasCompany: nextHasCompany }),
            );
            return;
          } catch {
            const cached = await authSessionService.getLastSessionResult();
            if (!active) return;

            if (cached.session) {
              setToken(cached.session.accessToken);
              setHasCompany(cached.session.hasCompany);
              setUser(cached.session.user);
              setOfflineSession(true);
              setHydrated(true);
              console.info(
                '[offline-login] sesion cacheada restaurada con token vencido',
                JSON.stringify({ reason: cached.reason }),
              );
              return;
            }
          }
        }

        await clearAuthStorage();
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(
            SESSION_EXPIRED_MESSAGE_KEY,
            'Tu sesión expiró. Ingresa nuevamente.',
          );
        }
        setUser(null);
        setToken(null);
        setHasCompany(false);
        setHydrated(true);
        return;
      }

      try {
        const parsed = JSON.parse(currentUserRaw) as StoredUserShape;
        const nextHasCompany =
          currentHasCompany === 'true' || Boolean(parsed.organizacionId);

        setToken(currentToken);
        setHasCompany(nextHasCompany);
        setUser(mapStoredUserToUser(parsed));
      } catch {
        await clearAuthStorage();
        setUser(null);
        setToken(null);
        setHasCompany(false);
      }

      setHydrated(true);
    };

    void hydrate();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!token || offlineSession) {
      return;
    }

    const expirationMs = getTokenExpirationMs(token);
    if (expirationMs === null) {
      return;
    }

    const remainingMs = expirationMs - Date.now();
    if (remainingMs <= 0) {
      void expireSession();
      return;
    }

    const timerId = window.setTimeout(() => {
      void expireSession();
    }, remainingMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [offlineSession, token]);

  const setSession = async (data: UserSessionInput) => {
    const nextHasCompany = data.hasCompany || Boolean(data.user.organizacionId);

    setUser(data.user);
    setToken(data.token);
    setHasCompany(nextHasCompany);
    setOfflineSession(Boolean(data.offline));

    if (data.persist === false) {
      await clearAuthStorage();
      setRuntimeAuthStorageValue(AUTH_STORAGE_KEYS.token, data.token);
      setRuntimeAuthStorageValue(
        AUTH_STORAGE_KEYS.user,
        JSON.stringify(data.user),
      );
      setRuntimeAuthStorageValue(
        AUTH_STORAGE_KEYS.hasCompany,
        String(nextHasCompany),
      );
      await authSessionService.saveLastSession({
        accessToken: data.token,
        user: data.user,
        hasCompany: nextHasCompany,
        lastLoginAt: Date.now(),
        offlineAllowed: true,
        loggedOutManually: false,
      });
      return;
    }

    await Promise.all([
      setAuthStorageValue(AUTH_STORAGE_KEYS.token, data.token),
      setAuthStorageValue(AUTH_STORAGE_KEYS.user, JSON.stringify(data.user)),
      setAuthStorageValue(AUTH_STORAGE_KEYS.hasCompany, String(nextHasCompany)),
      setAuthStorageValue(AUTH_STORAGE_KEYS.rememberSession, 'true'),
      authSessionService.saveLastSession({
        accessToken: data.token,
        user: data.user,
        hasCompany: nextHasCompany,
        lastLoginAt: Date.now(),
        offlineAllowed: true,
        loggedOutManually: false,
      }),
    ]);
  };

  const expireSession = async () => {
    setUser(null);
    setToken(null);
    setHasCompany(false);
    setOfflineSession(false);

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        SESSION_EXPIRED_MESSAGE_KEY,
        'Tu sesión expiró. Ingresa nuevamente.',
      );
    }

    await authSessionService.clearLastSession();
    await clearAuthStorage();
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    setHasCompany(false);
    setOfflineSession(false);

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LOGIN_DRAFT_STORAGE_KEY);
    }

    clearFinancialAccessSession();
    await authSessionService.disableOfflineAccess();
    await clearAuthStorage();
  };

  const value = useMemo(
    () => ({ user, token, hasCompany, hydrated, setSession, logout }),
    [hasCompany, hydrated, token, user],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser debe usarse dentro de UserProvider');
  }
  return context;
}
