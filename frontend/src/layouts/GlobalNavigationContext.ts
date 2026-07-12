import { createContext, useContext } from 'react';

export const GlobalNavigationContext = createContext(false);

export function useHasGlobalNavigation() {
  return useContext(GlobalNavigationContext);
}
