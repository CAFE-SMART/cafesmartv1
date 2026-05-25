export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'cafesmart:theme-preference';

const LEGACY_THEME_STORAGE_KEYS = [
  'theme',
  'resolvedTheme',
  'isDark',
  'darkMode',
  'themeMode',
  'cafesmart-theme',
  'appearance',
  'color-mode',
  'cafesmart:theme',
  'cafesmart:resolved-theme',
  'cafesmart:dark-mode',
  'cafesmart:theme-mode',
  'cafesmart:appearance',
];

export function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }

  return 'light';
}

export function sanitizeThemePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : 'system';
}

export function cleanupLegacyThemeStorage() {
  if (typeof window === 'undefined') return;
  for (const key of LEGACY_THEME_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}

export function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  cleanupLegacyThemeStorage();
  return sanitizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function resolveTheme(theme: ThemePreference): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

export function applyResolvedTheme(theme: ResolvedTheme) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const body = document.body;
  const appRoot = document.getElementById('root');

  root.classList.remove('dark');
  body?.classList.remove('dark', 'theme-dark', 'theme-light');
  appRoot?.classList.remove('dark', 'theme-dark', 'theme-light');

  if (theme === 'dark') {
    root.classList.add('dark');
  }

  document.documentElement.style.colorScheme = theme;
  document.documentElement.dataset.theme = theme;

  logThemeDebug({
    storedPreference:
      typeof window === 'undefined'
        ? theme
        : sanitizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY)),
    resolvedTheme: theme,
  });
}

export function persistThemePreference(theme: ThemePreference) {
  if (typeof window === 'undefined') return;
  cleanupLegacyThemeStorage();
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function applyThemePreference(theme: ThemePreference): ResolvedTheme {
  const resolvedTheme = resolveTheme(theme);
  applyResolvedTheme(resolvedTheme);
  return resolvedTheme;
}

function logThemeDebug({
  storedPreference,
  resolvedTheme,
}: {
  storedPreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
}) {
  if (typeof document === 'undefined') return;
  if (!import.meta.env.DEV) return;

  console.log('[theme-debug]', {
    storedPreference,
    resolvedTheme,
    htmlClass: document.documentElement.className,
    bodyClass: document.body?.className ?? '',
    rootClass: document.getElementById('root')?.className ?? '',
    htmlHasDark: document.documentElement.classList.contains('dark'),
    bodyHasDark: document.body?.classList.contains('dark') ?? false,
    rootHasDark: document.getElementById('root')?.classList.contains('dark') ?? false,
  });
}
