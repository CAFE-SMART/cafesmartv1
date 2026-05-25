import React from 'react';
import {
  Settings,
  ShoppingCart,
  House,
  Warehouse,
  Banknote,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { themeClasses } from '../theme/themeClasses';

const items = [
  { id: 'inicio', label: 'Inicio', path: '/inicio', icon: House },
  { id: 'compras', label: 'Compras', path: '/compras', icon: ShoppingCart },
  {
    id: 'inventario',
    label: 'Inventario',
    path: '/inventario',
    icon: Warehouse,
  },
  { id: 'ventas', label: 'Ventas', path: '/ventas', icon: Banknote },
  { id: 'ajustes', label: 'Ajustes', path: '/ajustes', icon: Settings },
];

function isActiveItemPath(pathname: string, itemPath: string) {
  if (itemPath === '/ajustes') {
    return (
      pathname === '/ajustes' ||
      pathname.startsWith('/ajustes/') ||
      pathname === '/soporte' ||
      pathname.startsWith('/soporte/')
    );
  }

  return (
    pathname === itemPath ||
    (itemPath !== '/inicio' && pathname.startsWith(`${itemPath}/`))
  );
}

export function AppBottomNav({
  hidden = false,
  activePath,
}: {
  hidden?: boolean;
  activePath?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  if (hidden) return null;

  return (
    <nav
      aria-label="Navegacion principal"
      className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-white via-white/95 to-white/0 px-4 pb-3 pt-8 transition-colors dark:from-slate-950 dark:via-slate-950/95 dark:to-slate-950/0"
    >
      <div
        className={`mx-auto w-full max-w-[430px] rounded-[24px] p-1.5 backdrop-blur-xl transition-colors ${themeClasses.bottomNav}`}
      >
        <div className="grid grid-cols-5 gap-1">
          {items.map((item) => {
            const isActive =
              activePath === item.path ||
              (!activePath && isActiveItemPath(location.pathname, item.path));
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.path)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`Ir a ${item.label}`}
                className={`relative flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[18px] px-1 py-2 text-[0.56rem] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cb8ff] focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-[#eef4ff] font-black text-[#102d92] shadow-[inset_0_0_0_1px_rgba(16,45,146,0.12)] dark:bg-slate-800 dark:text-slate-100'
                    : 'font-bold text-[#6b7890] hover:bg-[#f4f6fb] dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                {isActive ? (
                  <span className="absolute top-1 h-1 w-6 rounded-full bg-[#102d92] dark:bg-slate-100" />
                ) : null}
                <Icon
                  size={18}
                  strokeWidth={isActive ? 2.5 : 2.2}
                  aria-hidden="true"
                />
                <span>
                  {item.label}
                  {isActive ? <span className="sr-only">, sección actual</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
