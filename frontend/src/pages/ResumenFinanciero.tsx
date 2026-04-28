import React, { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, Lock, RefreshCcw, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { obtenerDashboardSummary, type DashboardSummary } from '../services/dashboardService';
import { verificarPasswordFinanciero } from '../services/financialAccessService';

function formatCurrency(value: number) {
  return `$ ${new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function formatKg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value)} kg`;
}

export default function ResumenFinanciero() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [password, setPassword] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      setSummary(await obtenerDashboardSummary());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el resumen financiero.');
      setSummary(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleUnlock = async () => {
    if (!password.trim()) {
      setError('Escribe la contrasena del administrador.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await verificarPasswordFinanciero(password);
      setAuthorized(true);
      setPassword('');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo validar la contrasena.');
    } finally {
      setLoading(false);
    }
  };

  const utilidad = summary?.utilidadTotalAcumulada ?? 0;
  const chartBars = useMemo(() => {
    const ingresos = summary?.movimientosRecientes
      .filter((item) => item.tipo === 'VENTA')
      .reduce((sum, item) => sum + item.valor, 0) ?? 0;
    const compras = summary?.movimientosRecientes
      .filter((item) => item.tipo === 'COMPRA')
      .reduce((sum, item) => sum + item.valor, 0) ?? 0;
    const maxValue = Math.max(1, ingresos, compras, Math.abs(utilidad));

    return [
      { label: 'Ingresos', value: ingresos, tone: 'bg-[#9ec5ee]' },
      { label: 'Compras', value: compras, tone: 'bg-[#d7e3f2]' },
      { label: 'Utilidad', value: Math.max(0, utilidad), tone: 'bg-[#0f58bd]' },
    ].map((item) => ({
      ...item,
      height: Math.max(10, Math.round((item.value / maxValue) * 112)),
    }));
  }, [summary?.movimientosRecientes, utilidad]);

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <main className="mx-auto min-h-screen w-full max-w-[340px] bg-white px-4 py-4 shadow-[0_14px_38px_rgba(15,23,42,0.06)]">
        <header className="grid h-10 grid-cols-[36px_1fr_36px] items-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#102d92]"
            aria-label="Volver"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-center text-[0.84rem] font-black">Resumen financiero</h1>
          {authorized ? (
            <button
              type="button"
              onClick={() => void cargar(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400"
              aria-label="Recargar resumen"
            >
              <RefreshCcw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          ) : (
            <span />
          )}
        </header>

        {error ? (
          <section className="mt-3 rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-3 text-[0.68rem] font-semibold text-rose-700">
            {error}
          </section>
        ) : null}

        {!authorized ? (
          <section className="mt-6 rounded-[16px] border border-[#dbe2ee] bg-white px-4 py-5 text-center shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
            <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#eef2ff] text-[#102d92]">
              <Lock size={18} />
            </span>
            <h2 className="mt-3 text-[1rem] font-black text-[#111827]">Acceso financiero</h2>
            <p className="mt-2 text-[0.66rem] font-semibold leading-5 text-slate-500">
              Ingresa la contrasena del administrador para ver utilidad, merma y analisis.
            </p>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleUnlock();
                }
              }}
              className="mt-4 w-full rounded-[8px] border border-[#dbe2ee] bg-[#f8fafc] px-3 py-2.5 text-[0.78rem] font-semibold outline-none focus:border-[#102d92]"
              placeholder="Contrasena"
            />
            <button
              type="button"
              onClick={() => void handleUnlock()}
              disabled={loading}
              className="mt-3 inline-flex min-h-[38px] w-full items-center justify-center rounded-[8px] bg-[#102d92] px-4 text-[0.7rem] font-black text-white disabled:opacity-70"
            >
              {loading ? 'Validando...' : 'Ver resumen financiero'}
            </button>
          </section>
        ) : (
          <>
            <section className="mt-4 rounded-[18px] bg-[#0f58bd] px-4 py-5 text-white shadow-[0_16px_34px_rgba(15,88,189,0.24)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.7rem] font-semibold text-white/75">Utilidad neta realizada</p>
                  <p className="mt-2 text-[1.85rem] font-black leading-none">
                    {loading ? '...' : formatCurrency(utilidad)}
                  </p>
                </div>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                  <TrendingUp size={20} />
                </span>
              </div>
              <p className="mt-3 text-[0.62rem] font-semibold leading-4 text-white/75">
                Calculada sobre ventas realizadas, gastos registrados y merma valorizada.
              </p>
            </section>

            <section className="mt-3 rounded-[14px] border border-[#dbe2ee] bg-white px-3 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 size={15} className="text-[#102d92]" />
                  <p className="text-[0.72rem] font-black text-[#111827]">Ingresos vs utilidad</p>
                </div>
                <p className="text-[0.56rem] font-black uppercase tracking-[0.1em] text-[#73829a]">
                  Actual
                </p>
              </div>

              <div className="mt-4 flex h-[150px] items-end justify-around border-b border-[#e6ecf4] px-2">
                {chartBars.map((bar) => (
                  <div key={bar.label} className="flex flex-col items-center gap-2">
                    <div
                      className={`w-8 rounded-t-[5px] ${bar.tone}`}
                      style={{ height: `${bar.height}px` }}
                    />
                    <span className="text-[0.5rem] font-black uppercase text-[#73829a]">
                      {bar.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-3 grid grid-cols-2 gap-2">
              <article className="rounded-[12px] border border-[#dbe2ee] bg-white px-3 py-3">
                <p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-[#73829a]">
                  Merma
                </p>
                <p className="mt-2 text-[1rem] font-black text-[#111827]">
                  {loading ? '...' : formatKg(summary?.mermaTotalKg ?? 0)}
                </p>
              </article>
              <article className="rounded-[12px] border border-[#dbe2ee] bg-white px-3 py-3">
                <p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-[#73829a]">
                  Ventas hoy
                </p>
                <p className="mt-2 text-[1rem] font-black text-[#111827]">
                  {loading ? '...' : summary?.ventasHoy ?? 0}
                </p>
              </article>
            </section>

            <section className="mt-4 rounded-[14px] border border-[#dbe2ee] bg-white px-3 py-3">
              <p className="text-[0.72rem] font-black text-[#111827]">Lectura rapida</p>
              <p className="mt-2 text-[0.64rem] font-semibold leading-5 text-slate-500">
                La utilidad puede ser negativa solo cuando los gastos o la merma superan el margen
                vendido. El inventario sin vender no se descuenta como perdida.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
