import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyAccessibilityPreferences,
  persistAccessibilityPreferences,
  readAccessibilityPreferences,
  type AccessibilityPreferences,
  type FontScalePreference,
} from './accessibilityService';

type AccessibilityContextValue = {
  preferences: AccessibilityPreferences;
  setScreenReaderMode: (enabled: boolean) => void;
  setHighContrast: (enabled: boolean) => void;
  setFontScale: (fontScale: FontScalePreference) => void;
};

const AccessibilityContext = createContext<AccessibilityContextValue | undefined>(
  undefined,
);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(() =>
    readAccessibilityPreferences(),
  );

  useEffect(() => {
    applyAccessibilityPreferences(preferences);
    persistAccessibilityPreferences(preferences);
  }, [preferences]);

  const value = useMemo<AccessibilityContextValue>(
    () => ({
      preferences,
      setScreenReaderMode: (enabled) =>
        setPreferences((current) => ({
          ...current,
          screenReaderMode: enabled,
        })),
      setHighContrast: (enabled) =>
        setPreferences((current) => ({
          ...current,
          highContrast: enabled,
        })),
      setFontScale: (fontScale) =>
        setPreferences((current) => ({
          ...current,
          fontScale,
        })),
    }),
    [preferences],
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const value = useContext(AccessibilityContext);
  if (!value) {
    throw new Error('useAccessibility debe usarse dentro de AccessibilityProvider');
  }
  return value;
}
