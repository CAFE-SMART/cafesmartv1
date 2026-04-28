import React from 'react';
import { Settings, ShoppingCart, House, Warehouse, Banknote } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const items = [
  { id: 'inicio', label: 'Inicio', path: '/inicio', icon: House },
  { id: 'compras', label: 'Compras', path: '/compras', icon: ShoppingCart },
  { id: 'inventario', label: 'Inventario', path: '/inventario', icon: Warehouse },
  { id: 'ventas', label: 'Ventas', path: '/ventas', icon: Banknote },
  { id: 'ajustes', label: 'Ajustes', path: '/ajustes', icon: Settings },
];

export function AppBottomNav({ hidden = false }: { hidden?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();

  if (hidden) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 px-3 py-2 backdrop-blur">
      <div className="mx-auto w-full max-w-[340px] rounded-[18px] border border-slate-200/80 bg-white/95 p-1 shadow-[0_-8px_22px_rgba(15,23,42,0.08)]">
        <div className="grid grid-cols-5 gap-1">
          {items.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-[13px] px-1 py-1.5 text-[0.48rem] font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cb8ff] focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-[#102d92] text-white shadow-[0_12px_24px_rgba(16,45,146,0.24)]'
                    : 'text-slate-500 hover:bg-[#f4f6fb]'
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
