import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  House,
  LogOut,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  UserRound,
  Warehouse,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useUser } from '../context/UserContext';

const SIDEBAR_COLLAPSED_KEY = 'cafesmart:desktop-sidebar-collapsed';

type SidebarNavItemConfig = {
  label: string;
  path: string;
  icon: LucideIcon;
};

const desktopNavigation: SidebarNavItemConfig[] = [
  { label: 'Inicio', path: '/inicio', icon: House },
  { label: 'Compras', path: '/compras', icon: ShoppingCart },
  { label: 'Inventario', path: '/inventario', icon: Warehouse },
  { label: 'Ventas', path: '/ventas', icon: Banknote },
  { label: 'Ajustes', path: '/ajustes', icon: Settings },
];
function getInitialCollapsed() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
}

function getOrganizationLabel(user: ReturnType<typeof useUser>['user']) {
  return (
    user?.organizacion?.nombre ||
    user?.nombreOrganizacion ||
    user?.organizacion?.tipo ||
    user?.tipoOrganizacion ||
    'Gestión cafetera'
  );
}

function getInitials(name?: string | null) {
  const source = name?.trim() || 'CS';
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function isItemActive(pathname: string, item: SidebarNavItemConfig) {
  if (item.path === '/inicio') {
    return pathname === item.path;
  }

  if (item.label === 'Inventario') {
    return pathname === '/inventario' || pathname.startsWith('/inventario/');
  }

  if (item.label === 'Ajustes') {
    return (
      pathname === '/ajustes' ||
      pathname.startsWith('/ajustes/') ||
      pathname === '/soporte' ||
      pathname.startsWith('/soporte/')
    );
  }

  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}
function SidebarHeader({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="shrink-0 border-b border-slate-200/70 px-3 py-4 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#102d92] text-sm font-black text-white shadow-sm">
          CS
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-950 dark:text-white">
              Café Smart
            </p>
            <p className="truncate text-xs font-bold text-slate-500 dark:text-slate-400">
              Gestión cafetera
            </p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          aria-label={
            collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'
          }
          title={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-[#102d92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cb8ff] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          {collapsed ? (
            <ChevronRight size={18} aria-hidden="true" />
          ) : (
            <ChevronLeft size={18} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

function SidebarNavItem({
  item,
  collapsed,
}: {
  item: SidebarNavItemConfig;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const location = useLocation();
  const active = isItemActive(location.pathname, item);

  return (
    <NavLink
      to={item.path}
      title={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cb8ff] ${
        collapsed ? 'justify-center' : ''
      } ${
        active
          ? 'bg-[#eaf1ff] text-[#102d92] shadow-[inset_0_0_0_1px_rgba(16,45,146,0.10)] dark:bg-slate-800 dark:text-white'
          : 'text-slate-600 hover:bg-white hover:text-[#102d92] dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white'
      }`}
    >
      {active ? (
        <span className="absolute left-1 h-5 w-1 rounded-full bg-[#102d92] dark:bg-blue-300" />
      ) : null}
      <Icon size={19} strokeWidth={active ? 2.6 : 2.2} aria-hidden="true" />
      <span className={collapsed ? 'sr-only' : 'truncate'}>{item.label}</span>
    </NavLink>
  );
}
function SidebarNavigation({ collapsed }: { collapsed: boolean }) {
  return (
    <nav
      aria-label="Navegación de escritorio"
      className="min-h-0 flex-1 overflow-y-auto px-2 py-3"
    >
      <div className="space-y-1">
        {desktopNavigation.map((item) => (
          <SidebarNavItem key={item.label} item={item} collapsed={collapsed} />
        ))}
      </div>
    </nav>
  );
}

function SidebarProfileMenu({
  menuId,
  onClose,
}: {
  menuId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { logout } = useUser();

  const goTo = (path: string) => {
    onClose();
    navigate(path);
  };

  const closeSession = async () => {
    onClose();
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div
      id={menuId}
      role="menu"
      className="absolute bottom-[calc(100%+8px)] left-2 right-2 rounded-xl border border-slate-200 bg-white p-1.5 text-sm font-bold text-slate-700 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => goTo('/ajustes')}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cb8ff] dark:hover:bg-slate-800"
      >
        <UserRound size={17} aria-hidden="true" />
        Ver perfil
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => goTo('/ajustes')}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cb8ff] dark:hover:bg-slate-800"
      >
        <SlidersHorizontal size={17} aria-hidden="true" />
        Configuración
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={closeSession}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 dark:text-red-300 dark:hover:bg-red-500/10"
      >
        <LogOut size={17} aria-hidden="true" />
        Cerrar sesión
      </button>
    </div>
  );
}

function SidebarProfile({ collapsed }: { collapsed: boolean }) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const userName = user?.name || user?.email || 'Usuario';
  const organizationLabel = getOrganizationLabel(user);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative shrink-0 border-t border-slate-200/70 p-3 dark:border-slate-800"
    >
      {open ? (
        <SidebarProfileMenu menuId={menuId} onClose={() => setOpen(false)} />
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Abrir opciones del perfil"
        title={collapsed ? userName : undefined}
        className={`flex w-full items-center rounded-xl text-left transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cb8ff] dark:hover:bg-slate-800 ${
          collapsed ? 'justify-center p-2' : 'gap-3 p-2'
        }`}
      >
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#102d92] text-xs font-black text-white">
            {getInitials(userName)}
          </span>
        )}
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-slate-900 dark:text-white">
                {userName}
              </span>
              <span className="block truncate text-xs font-bold text-slate-500 dark:text-slate-400">
                {organizationLabel}
              </span>
            </span>
            <Ellipsis size={18} aria-hidden="true" className="text-slate-400" />
          </>
        ) : null}
      </button>
    </div>
  );
}

export function DesktopSidebar() {
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  return (
    <aside
      className={`flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white/95 shadow-[8px_0_24px_rgba(15,23,42,0.05)] transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-950/95 ${
        collapsed ? 'w-[76px]' : 'w-[268px]'
      }`}
      aria-label="Menú lateral principal"
    >
      <SidebarHeader
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
      />
      <SidebarNavigation collapsed={collapsed} />
      <SidebarProfile collapsed={collapsed} />
    </aside>
  );
}
