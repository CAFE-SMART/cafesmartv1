import { Outlet } from 'react-router-dom';
import { GlobalNavigationContext } from './GlobalNavigationContext';
import { DesktopSidebar } from './DesktopSidebar';

export function DesktopLayout() {
  return (
    <GlobalNavigationContext.Provider value>
      <div className="flex h-screen min-h-screen overflow-hidden bg-[#f5f7fb] text-slate-950 dark:bg-slate-950 dark:text-slate-100">
        <DesktopSidebar />
        <main
          id="desktop-main-content"
          className="min-w-0 flex-1 overflow-y-auto px-6 py-6 lg:px-8 xl:px-10"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>
    </GlobalNavigationContext.Provider>
  );
}
