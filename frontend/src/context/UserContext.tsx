import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AUTH_STORAGE_KEYS,
  clearAuthStorage,
  getAuthStorageValue,
  setAuthStorageValue,
} from '../storage/authStorage';

type User = {
  id: number | string;
  email: string;
  name: string;
};

type StoredUserShape = {
  id: number | string;
  email?: string;
  name?: string;
  correo?: string;
  nombre?: string;
};

type UserSessionInput = {
  user: User;
  token: string;
  hasCompany: boolean;
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

function getTokenExpirationMs(token: string): number | null {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) {
      return null;
    }

    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(normalized)) as { exp?: number };
    if (!payload.exp) {
      return null;
    }

    return payload.exp * 1000;
  } catch {
    return null;
  }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hasCompany, setHasCompany] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      const [storedUserRaw, storedToken, storedHasCompany] = await Promise.all([
        getAuthStorageValue(AUTH_STORAGE_KEYS.user),
        getAuthStorageValue(AUTH_STORAGE_KEYS.token),
        getAuthStorageValue(AUTH_STORAGE_KEYS.hasCompany),
      ]);

      if (!active) {
        return;
      }

      const expirationMs = storedToken ? getTokenExpirationMs(storedToken) : null;
      const isExpired = expirationMs !== null && expirationMs <= Date.now();

      if (isExpired) {
        await clearAuthStorage();
        setUser(null);
        setToken(null);
        setHasCompany(false);
        setHydrated(true);
        return;
      }

      setToken(storedToken ?? null);
      setHasCompany(storedHasCompany === 'true');

      if (!storedUserRaw) {
        setUser(null);
        setHydrated(true);
        return;
      }

      try {
        const parsed = JSON.parse(storedUserRaw) as StoredUserShape;
        setUser({
          id: parsed.id,
          email: parsed.email ?? parsed.correo ?? '',
          name: parsed.name ?? parsed.nombre ?? '',
        });
      } catch {
        setUser(null);
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
      void logout();
      return;
    }

    const timerId = window.setTimeout(() => {
      void logout();
    }, remainingMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [token]);

  const setSession = async (data: UserSessionInput) => {
    setUser(data.user);
    setToken(data.token);
    setHasCompany(data.hasCompany);

    await Promise.all([
      setAuthStorageValue(AUTH_STORAGE_KEYS.token, data.token),
      setAuthStorageValue(AUTH_STORAGE_KEYS.user, JSON.stringify(data.user)),
      setAuthStorageValue(AUTH_STORAGE_KEYS.hasCompany, String(data.hasCompany)),
    ]);
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    setHasCompany(false);

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
