import { Outlet } from 'react-router-dom';
import { AppBottomNav } from '../components/AppBottomNav';
import { GlobalNavigationContext } from './GlobalNavigationContext';

export function MobileBottomNavigation() {
  return <AppBottomNav global />;
}

export function MobileLayout() {
  return (
    <GlobalNavigationContext.Provider value>
      <div className="min-h-screen pb-[calc(env(safe-area-inset-bottom)+88px)]">
        <Outlet />
        <MobileBottomNavigation />
      </div>
    </GlobalNavigationContext.Provider>
  );
}
