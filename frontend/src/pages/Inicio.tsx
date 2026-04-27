import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Banknote,
  Coffee,
  Package2,
  RefreshCcw,
  TriangleAlert,
  UserCircle2,
  Wallet,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import { useUser } from '../context/UserContext';
import {
  obtenerResumenDashboard,
  type DashboardSummary,
} from '../services/dashboardService';

function formatKg(value: number) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function getInitial(name: string | null | undefined) {
  return (name?.trim()?.charAt(0) || 'U').toUpperCase();
}

function MetricCard({
  title,
  value,
  hint,
  accent,
  icon,
}: {
  title: string;
  value: string;
  hint: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-[20px] border border-[#e4e7f2] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            {title}
          </p>
          <p className="mt-3 text-[1.9rem] font-black leading-none text-slate-900">{value}</p>
          <p className="mt-2 text-sm font-semibold text-slate-600">{hint}</p>
        </div>
        <div className={`rounded-[16px] p-3 ${accent}`}>{icon}</div>
      </div>
    </article>
  );
}

export default function Inicio() {
  const navigate = useNavigate();
  const { user, hydrated } = useUser();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarDashboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await obtenerResumenDashboard();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    void cargarDashboard();
  }, [hydrated]);
  const inventoryByType = summary?.inventoryByType ?? [];
  const hasRecords = Boolean(summary?.hasRecords);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f2fb_100%)] px-4 py-5 pb-[150px] text-slate-900">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5">
        <header className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.07)] backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#eef2ff] p-3 text-[#102d92] shadow-inner">
              <Coffee size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[1.1rem] font-black leading-tight text-[#102d92]">Café Smart</p>
              <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                Resumen operativo
              </p>
              <h1 className="mt-2 text-[1.3rem] font-black leading-tight text-[#121826]">
                Hola, {user?.name?.trim() ? user.name : 'usuario'}
              </h1>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e9f4ff] text-[#102d92]">
              <UserCircle2 size={20} />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <CloudStatusBadge compact className="max-w-[220px]" />
            <button
              type="button"
              onClick={() => void cargarDashboard()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"
            >
              <RefreshCcw size={14} />
              Recargar
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d7ecd4] text-[#1f5e34] shadow-inner">
              <span className="text-xs font-black">{getInitial(user?.name)}</span>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            No pude cargar el dashboard: {error}
          </div>
        ) : null}

        <section className="grid gap-3">
          <MetricCard
            title="Inventario disponible"
            value={loading ? '...' : `${formatKg(summary?.inventoryAvailableKg ?? 0)} kg`}
            hint="Cafe disponible consolidado para operar compras y ventas."
            accent="bg-[#eef3ff] text-[#102d92]"
            icon={<Package2 size={22} />}
          />
          <MetricCard
            title="Utilidad total"
            value={loading ? '...' : formatMoney(summary?.totalProfit ?? 0)}
            hint="Ventas menos compras y gastos operativos acumulados."
            accent="bg-[#eef9f1] text-[#177245]"
            icon={<Wallet size={22} />}
          />
          <MetricCard
            title="Merma acumulada"
            value={loading ? '...' : `${formatKg(summary?.totalWasteKg ?? 0)} kg`}
            hint="Pérdida acumulada registrada en procesos de secado."
            accent="bg-[#fff3eb] text-[#b45309]"
            icon={<TriangleAlert size={22} />}
          />
        </section>

        <section className="rounded-[22px] border border-[#e2e7f8] bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Inventario por tipo
              </p>
              <h2 className="mt-2 text-[1.25rem] font-black text-[#121826]">
                Disponibilidad consolidada
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/inventario')}
              className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.14em] text-[#102d92]"
            >
              Ver inventario
              <ArrowRight size={14} />
            </button>
          </div>

          {loading ? (
            <div className="mt-4 rounded-[16px] bg-[#f7f8fe] px-4 py-5 text-sm text-slate-500">
              Cargando indicadores...
            </div>
          ) : inventoryByType.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {inventoryByType.map((item) => (
                <article
                  key={item.tipoCafeId}
                  className="rounded-[16px] border border-[#e7ebf4] bg-[#fafbff] px-4 py-4"
                >
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {item.tipoCafe}
                  </p>
                  <p className="mt-2 text-[1.35rem] font-black text-[#102d92]">
                    {formatKg(item.kg)} kg
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-[16px] border border-dashed border-[#d7deef] bg-[#fafbff] px-4 py-5 text-sm text-slate-500">
              Aún no hay inventario consolidado por tipo.
            </div>
          )}
        </section>

        {!loading && !hasRecords ? (
          <section className="rounded-[22px] border border-[#dbe4fb] bg-[#eef3ff] p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#5b6f9d]">
              Empieza aquí
            </p>
            <h2 className="mt-2 text-[1.35rem] font-black text-[#102d92]">
              Tu dashboard se llenará cuando registres los primeros movimientos.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Registra una compra para crear inventario disponible. Después podrás ver cómo cambian
              la utilidad acumulada y la merma a medida que registres ventas, secados o gastos.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => navigate('/compras')}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 py-3 text-sm font-black text-white"
              >
                <Coffee size={16} />
                Registrar compra
              </button>
              <button
                type="button"
                onClick={() => navigate('/ventas')}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] border border-[#cdd8f5] bg-white px-4 py-3 text-sm font-black text-[#102d92]"
              >
                <Banknote size={16} />
                Ir a ventas
              </button>
            </div>
          </section>
        ) : null}
      </div>

      <AppBottomNav />
    </div>
  );
}
