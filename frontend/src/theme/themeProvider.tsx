import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  applyResolvedTheme,
  applyThemePreference,
  cleanupLegacyThemeStorage,
  getSystemTheme,
  persistThemePreference,
  readThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from './themeService';

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(readThemePreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);
  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    cleanupLegacyThemeStorage();
    applyResolvedTheme(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const nextSystemTheme = media.matches ? 'dark' : 'light';
      setSystemTheme(nextSystemTheme);
      if (readThemePreference() === 'system') {
        applyResolvedTheme(nextSystemTheme);
      }
    };

    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    persistThemePreference(nextTheme);
    const nextResolvedTheme = applyThemePreference(nextTheme);
    setSystemTheme(getSystemTheme());
    setThemeState(nextTheme);
    if (nextTheme !== 'system') {
      applyResolvedTheme(nextResolvedTheme);
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [resolvedTheme, setTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider');
  }
  return context;
}

export type { ResolvedTheme, ThemePreference };
