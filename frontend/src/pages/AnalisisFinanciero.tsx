import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { AppFeedbackMessage } from '../components/AppFeedbackMessage';
import { RefreshButton } from '../components/RefreshButton';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import {
  obtenerDashboardSummary,
  type DashboardSummary,
} from '../services/dashboardService';

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatKg(value: number) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function Metric({
  title,
  value,
  hint,
  icon,
  accent,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <article className="rounded-[18px] border border-[#e6eaf4] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            {title}
          </p>
          <p className="mt-3 text-[1.45rem] font-black text-slate-900">
            {value}
          </p>
          <p className="mt-2 text-sm text-slate-500">{hint}</p>
        </div>
        <div className={`rounded-[14px] p-3 ${accent}`}>{icon}</div>
      </div>
    </article>
  );
}

export default function AnalisisFinanciero() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await obtenerDashboardSummary();
      setSummary(data);
    } catch (err) {
      setError('No pudimos cargar el análisis financiero. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const chartData = useMemo(
    () => [
      {
        key: 'ingresos',
        label: 'Ingresos',
        value: summary?.totalVentasHoy ?? 0,
        color: 'bg-[#2f6bff]',
      },
      {
        key: 'egresos',
        label: 'Egresos',
        value: (summary?.totalComprasHoy ?? 0) + (summary?.totalGastosHoy ?? 0),
        color: 'bg-[#f97316]',
      },
      {
        key: 'utilidad',
        label: 'Utilidad',
        value: Math.max(0, summary?.utilidadTotalAcumulada ?? 0),
        color: 'bg-[#10b981]',
      },
    ],
    [summary],
  );

  const maxValue = Math.max(...chartData.map((item) => item.value), 1);

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-4 py-5 pb-[150px] text-slate-900">
      <div className="mx-auto flex w-full max-w-[430px] flex-col gap-4">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/ajustes')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#102d92] shadow-sm"
            aria-label="Volver a ajustes"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.2rem] font-black text-[#111827]">
              Análisis financiero
            </h1>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Ingresos, egresos y utilidad estimada del negocio.
            </p>
          </div>
          <CloudStatusBadge compact className="max-w-[140px]" />
        </header>

        {error ? (
          <AppFeedbackMessage variant="error" description={error} />
        ) : null}

        <section className="rounded-[22px] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Resumen gráfico
              </p>
              <h2 className="mt-2 text-[1.25rem] font-black text-[#111827]">
                Comportamiento financiero
              </h2>
            </div>
            <RefreshButton
              onClick={() => void cargar()}
              aria-label="Actualizar análisis financiero"
              iconOnly
            />
          </div>

          <div className="mt-6 flex h-[220px] items-end justify-between gap-4">
            {chartData.map((item) => {
              const height = Math.max(20, (item.value / maxValue) * 180);
              const heightClass =
                height >= 170
                  ? 'h-[180px]'
                  : height >= 145
                    ? 'h-[155px]'
                    : height >= 120
                      ? 'h-[130px]'
                      : height >= 95
                        ? 'h-[105px]'
                        : height >= 70
                          ? 'h-[80px]'
                          : height >= 45
                            ? 'h-[55px]'
                            : 'h-[28px]';
              return (
                <div
                  key={item.key}
                  className="flex min-w-0 flex-1 flex-col items-center gap-3"
                >
                  <span className="text-center text-xs font-black text-slate-500">
                    {loading ? '...' : formatMoney(item.value)}
                  </span>
                  <div className="flex h-[180px] w-full items-end justify-center rounded-[18px] bg-[#f6f8fd] px-3 py-3">
                    <div
                      className={`w-full rounded-[14px] ${item.color} ${heightClass} transition-all duration-300`}
                    />
                  </div>
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-3">
          <Metric
            title="Ingresos"
            value={loading ? '...' : formatMoney(summary?.totalVentasHoy ?? 0)}
            hint="Ventas acumuladas registradas."
            icon={<TrendingUp size={20} />}
            accent="bg-[#eef2ff] text-[#2f6bff]"
          />
          <Metric
            title="Egresos"
            value={
              loading
                ? '...'
                : formatMoney(
                    (summary?.totalComprasHoy ?? 0) +
                      (summary?.totalGastosHoy ?? 0),
                  )
            }
            hint="Compras y gastos operativos acumulados."
            icon={<TrendingDown size={20} />}
            accent="bg-[#fff4eb] text-[#f97316]"
          />
          <Metric
            title="Utilidad estimada"
            value={
              loading
                ? '...'
                : formatMoney(summary?.utilidadTotalAcumulada ?? 0)
            }
            hint="Resultado estimado del negocio."
            icon={<Wallet size={20} />}
            accent="bg-[#ecfdf5] text-[#059669]"
          />
          <Metric
            title="Merma acumulada"
            value={
              loading ? '...' : `${formatKg(summary?.mermaTotalKg ?? 0)} kg`
            }
            hint={`Valor estimado: ${formatMoney(summary?.mermaTotalValor ?? 0)}.`}
            icon={<BarChart3 size={20} />}
            accent="bg-[#fff7ed] text-[#c2410c]"
          />
        </section>
      </div>

      <AppBottomNav />
    </div>
  );
}
