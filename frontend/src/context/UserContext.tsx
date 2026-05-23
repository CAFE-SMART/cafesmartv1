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
  removeAuthStorageValue,
  setRuntimeAuthStorageValue,
  setAuthStorageValue,
} from '../storage/authStorage';
import { authSessionService } from '../services/authSessionService';
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
};

type UserSessionInput = {
  user: User;
  token: string;
  hasCompany: boolean;
  persist?: boolean;
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

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      const [
        storedUserRaw,
        storedToken,
        storedHasCompany,
        storedRememberSession,
      ] = await Promise.all([
        getAuthStorageValue(AUTH_STORAGE_KEYS.user),
        getAuthStorageValue(AUTH_STORAGE_KEYS.token),
        getAuthStorageValue(AUTH_STORAGE_KEYS.hasCompany),
        getAuthStorageValue(AUTH_STORAGE_KEYS.rememberSession),
      ]);

      if (!active) {
        return;
      }

      if (storedRememberSession === 'true') {
        await clearAuthStorage();
        await authSessionService.clearLastSession();
        setUser(null);
        setToken(null);
        setHasCompany(false);
        setHydrated(true);
        return;
      }

      if (!storedToken || !storedUserRaw) {
        setUser(null);
        setToken(null);
        setHasCompany(false);
        setHydrated(true);
        return;
      }

      const expirationMs = getTokenExpirationMs(storedToken);
      const isExpired = expirationMs !== null && expirationMs <= Date.now();

      if (isExpired) {
        await clearAuthStorage();
        await authSessionService.clearLastSession();
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
        const parsed = JSON.parse(storedUserRaw) as StoredUserShape;
        const nextHasCompany =
          storedHasCompany === 'true' || Boolean(parsed.organizacionId);

        setToken(storedToken);
        setHasCompany(nextHasCompany);
        setUser({
          id: parsed.id,
          email: parsed.email ?? parsed.correo ?? '',
          name: parsed.name ?? parsed.nombre ?? '',
          telefono: parsed.telefono ?? null,
          organizacionId: parsed.organizacionId ?? null,
          nombreOrganizacion: parsed.nombreOrganizacion ?? null,
          tipoOrganizacion: parsed.tipoOrganizacion ?? null,
          otroTipoDetalle: parsed.otroTipoDetalle ?? null,
        });
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
    if (!token) {
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
  }, [token]);

  const setSession = async (data: UserSessionInput) => {
    const nextHasCompany = data.hasCompany || Boolean(data.user.organizacionId);

    setUser(data.user);
    setToken(data.token);
    setHasCompany(nextHasCompany);

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
      removeAuthStorageValue(AUTH_STORAGE_KEYS.rememberSession),
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

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LOGIN_DRAFT_STORAGE_KEY);
    }

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
