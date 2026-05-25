export type FontScalePreference = 'normal' | 'large' | 'xlarge';

export type AccessibilityPreferences = {
  screenReaderMode: boolean;
  highContrast: boolean;
  fontScale: FontScalePreference;
};

export const ACCESSIBILITY_STORAGE_KEY = 'cafesmart:accessibility-preferences';

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  screenReaderMode: false,
  highContrast: false,
  fontScale: 'normal',
};

function isFontScalePreference(value: unknown): value is FontScalePreference {
  return value === 'normal' || value === 'large' || value === 'xlarge';
}

export function sanitizeAccessibilityPreferences(
  value: unknown,
): AccessibilityPreferences {
  if (!value || typeof value !== 'object') {
    return DEFAULT_ACCESSIBILITY_PREFERENCES;
  }

  const candidate = value as Partial<AccessibilityPreferences>;

  return {
    screenReaderMode: Boolean(candidate.screenReaderMode),
    highContrast: Boolean(candidate.highContrast),
    fontScale: isFontScalePreference(candidate.fontScale)
      ? candidate.fontScale
      : 'normal',
  };
}

export function readAccessibilityPreferences(): AccessibilityPreferences {
  if (typeof window === 'undefined') {
    return DEFAULT_ACCESSIBILITY_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
    if (!raw) return DEFAULT_ACCESSIBILITY_PREFERENCES;
    return sanitizeAccessibilityPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_ACCESSIBILITY_PREFERENCES;
  }
}

export function persistAccessibilityPreferences(
  preferences: AccessibilityPreferences,
) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    ACCESSIBILITY_STORAGE_KEY,
    JSON.stringify(preferences),
  );
}

export function applyAccessibilityPreferences(
  preferences: AccessibilityPreferences,
) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.classList.toggle('a11y-screen-reader', preferences.screenReaderMode);
  root.classList.toggle('a11y-high-contrast', preferences.highContrast);
  root.classList.remove('font-large', 'font-xlarge');

  if (preferences.fontScale === 'large') {
    root.classList.add('font-large');
  }

  if (preferences.fontScale === 'xlarge') {
    root.classList.add('font-xlarge');
  }

  root.dataset.accessibilityScreenReader = preferences.screenReaderMode
    ? 'on'
    : 'off';
  root.dataset.accessibilityContrast = preferences.highContrast ? 'high' : 'default';
  root.dataset.fontScale = preferences.fontScale;

  if (import.meta.env.DEV) {
    console.log('[a11y-debug]', {
      highContrast: preferences.highContrast,
      htmlClass: root.className,
      hasHighContrast: root.classList.contains('a11y-high-contrast'),
    });
  }
}
