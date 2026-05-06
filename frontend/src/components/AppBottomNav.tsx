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
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-white via-white/95 to-white/0 px-4 pb-3 pt-8">
      <div className="mx-auto w-full max-w-[430px] rounded-[24px] border border-[#e3e8f2] bg-white/95 p-1.5 shadow-[0_-4px_28px_rgba(15,23,42,0.10)] backdrop-blur-xl">
        <div className="grid grid-cols-5 gap-1">
          {items.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[18px] px-1 py-2 text-[0.56rem] font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cb8ff] focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-[#123aa6] text-white shadow-[0_10px_22px_rgba(18,58,166,0.22)]'
                    : 'text-[#6b7890] hover:bg-[#f4f6fb]'
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2.2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
