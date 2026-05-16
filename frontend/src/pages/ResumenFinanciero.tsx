import React, { useCallback, useMemo, useState } from 'react';

const IndicatorGood = () => <span className="mt-2 text-green-600">OK</span>;
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  LineChart,
  Lock,
  PackageCheck,
  Plus,
  Receipt,
  RefreshCcw,
  Scale,
  Search,
  ShoppingCart,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  obtenerDashboardSummary,
  type DashboardMovimiento,
  type DashboardSummary,
} from '../services/dashboardService';
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

function formatPercent(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDayShort(value: Date) {
  return value.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
  });
}

function formatCurrencyShort(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1000000)
    return `$${(value / 1000000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}M`;
  if (abs >= 1000)
    return `$${(value / 1000).toLocaleString('es-CO', { maximumFractionDigits: 0 })}K`;
  return `$${value.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

function getMovimientoCopy(item: DashboardMovimiento) {
  if (item.tipo === 'VENTA') {
    return {
      title: 'Venta registrada',
      detail: item.kg > 0 ? `${formatKg(item.kg)} vendidos` : item.nombre,
      icon: ShoppingCart,
      tone: 'bg-[#e9f7ef] text-[#118444]',
      amountTone: 'text-[#118444]',
      sign: '+',
    };
  }

  if (item.tipo === 'COMPRA') {
    return {
      title: 'Compra registrada',
      detail: item.kg > 0 ? `${formatKg(item.kg)} comprados` : item.nombre,
      icon: PackageCheck,
      tone: 'bg-[#eef4ff] text-[#0f58bd]',
      amountTone: 'text-[#0f58bd]',
      sign: '-',
    };
  }

  return {
    title: item.nombre || 'Gasto registrado',
    detail: 'Gasto operativo',
    icon: Receipt,
    tone: 'bg-[#fff1f2] text-[#be123c]',
    amountTone: 'text-[#be123c]',
    sign: '',
  };
}

export default function ResumenFinanciero() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [password, setPassword] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historialActivo, setHistorialActivo] = useState<
    'VENTA' | 'COMPRA' | 'GASTO' | null
  >(null);
  const [historialSearch, setHistorialSearch] = useState('');
  const [historialDate, setHistorialDate] = useState('');
  const [historialTipo, setHistorialTipo] = useState('TODOS');
  const [historialSort, setHistorialSort] = useState<'recent' | 'oldest' | 'amount-desc' | 'amount-asc'>('recent');

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
      setError('No pudimos cargar el resumen financiero. Intenta nuevamente.');
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
      setError('No pudimos validar la contraseña. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const utilidad = summary?.utilidadTotalAcumulada ?? 0;
  const movimientos = useMemo(() => {
    const seen = new Set<string>();

    return [...(summary?.movimientosRecientes ?? [])]
      .filter((item) => {
        const key =
          item.id || `${item.tipo}-${item.fecha}-${item.valor}-${item.nombre}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      );
  }, [summary?.movimientosRecientes]);
  const movimientosRecientes = useMemo(
    () => movimientos.slice(0, 8),
    [movimientos],
  );
  const historialMovimientos = useMemo(() => {
    if (!historialActivo) return [];
    const term = historialSearch.trim().toLowerCase();
    return movimientos
      .filter((item) => item.tipo === historialActivo)
      .filter((item) => {
        if (!term) return true;
        return [item.nombre, item.tipo, String(item.valor), String(item.kg)]
          .join(' ')
          .toLowerCase()
          .includes(term);
      })
      .filter((item) => {
        if (!historialDate) return true;
        return item.fecha.slice(0, 10) === historialDate;
      })
      .filter((item) => historialTipo === 'TODOS' || item.nombre === historialTipo)
      .sort((a, b) => {
        if (historialSort === 'oldest') {
          return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
        }
        if (historialSort === 'amount-desc') return b.valor - a.valor;
        if (historialSort === 'amount-asc') return a.valor - b.valor;
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      });
  }, [historialActivo, historialDate, historialSearch, historialSort, historialTipo, movimientos]);
  const historialTipos = useMemo(
    () => [
      'TODOS',
      ...Array.from(new Set(historialMovimientos.map((item) => item.nombre).filter(Boolean))),
    ],
    [historialMovimientos],
  );
  const historialTotal = historialMovimientos.reduce(
    (total, item) => total + item.valor,
    0,
  );
  const abrirHistorial = (tipo: 'VENTA' | 'COMPRA' | 'GASTO') => {
    setHistorialActivo(tipo);
    setHistorialSearch('');
    setHistorialDate('');
    setHistorialTipo('TODOS');
    setHistorialSort('recent');
  };

  const ventasTotal = summary?.totalVentasHoy ?? 0;
  const gastosTotal = summary?.totalGastosHoy ?? 0;
  const comprasTotal = summary?.totalComprasHoy ?? 0;
  const mermaTotalKg = summary?.mermaTotalKg ?? 0;
  const mermaTotalPorcentaje = summary?.mermaTotalPorcentaje ?? 0;
  const mermaTotalValor = summary?.mermaTotalValor ?? 0;
  const hasData =
    utilidad !== 0 ||
    ventasTotal > 0 ||
    comprasTotal > 0 ||
    gastosTotal > 0 ||
    mermaTotalKg > 0 ||
    movimientos.length > 0;
  const periodoActual = new Date().toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
  });

  const trend = useMemo(() => {
    const byDay = new Map<
      string,
      { key: string; label: string; time: number; value: number }
    >();
    for (const item of movimientos) {
      const date = new Date(item.fecha);
      if (Number.isNaN(date.getTime())) continue;
      const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const key = day.toISOString().slice(0, 10);
      const bucket = byDay.get(key) ?? {
        key,
        label: formatDayShort(day),
        time: day.getTime(),
        value: 0,
      };
      bucket.value += item.tipo === 'VENTA' ? item.valor : -item.valor;
      byDay.set(key, bucket);
    }

    let buckets = [...byDay.values()].sort((a, b) => a.time - b.time).slice(-6);

    if (buckets.length === 0) {
      const now = new Date();
      buckets = [
        {
          key: now.toISOString().slice(0, 10),
          label: formatDayShort(now),
          time: now.getTime(),
          value: utilidad,
        },
      ];
    }

    const values = buckets.map((bucket) => bucket.value);
    const rawMin = Math.min(0, ...values);
    const rawMax = Math.max(0, ...values);
    const padding = Math.max(500000, (rawMax - rawMin) * 0.18);
    const min = rawMin - padding;
    const max = rawMax + padding;
    const range = Math.max(1, max - min);
    const chart = { left: 72, top: 30, width: 292, height: 148 };
    const points = buckets.map((bucket, index) => {
      const x =
        buckets.length === 1
          ? chart.left + chart.width / 2
          : chart.left + (index / (buckets.length - 1)) * chart.width;
      const y =
        chart.top +
        chart.height -
        ((bucket.value - min) / range) * chart.height;
      return { ...bucket, x, y };
    });

    return {
      points,
      polyline: points
        .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
        .join(' '),
      zeroY: chart.top + chart.height - ((0 - min) / range) * chart.height,
      yLabels: [rawMax, 0, rawMin]
        .filter(
          (value, index, list) =>
            list.findIndex((item) => Math.abs(item - value) < 1) === index,
        )
        .map((value) => ({
          value,
          label: formatCurrencyShort(value),
          y: chart.top + chart.height - ((value - min) / range) * chart.height,
        })),
      yAxisTitle: 'Dinero (COP)',
      xAxisTitle: 'Dias con movimiento',
    };
  }, [movimientos, utilidad]);

  return (
    <div className="min-h-screen bg-[#f7f9fc] px-4 py-4 pb-24 text-slate-900">
      <main className="mx-auto w-full max-w-[430px] py-2">
        <header className="grid min-h-[54px] grid-cols-[44px_1fr_44px] items-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-900 transition hover:bg-white"
            aria-label="Volver"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-center text-[1.05rem] font-black text-[#111827]">
            Resultado financiero
          </h1>
          {authorized ? (
            <button
              type="button"
              onClick={() => void cargar(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-white"
              aria-label="Recargar resumen"
            >
              <RefreshCcw
                size={14}
                className={refreshing ? 'animate-spin' : ''}
              />
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
            <h2 className="mt-3 text-[1rem] font-black text-[#111827]">
              Acceso financiero
            </h2>
            <p className="mt-2 text-[0.66rem] font-semibold leading-5 text-slate-500">
              Ingresa la contrasena del administrador para ver utilidad, merma y
              analisis.
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
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[0.72rem] font-black uppercase tracking-[0.12em] text-[#64748b]">
                  Dashboard
                </p>
                <h2 className="mt-1 text-[1.85rem] font-black leading-none text-[#071126]">
                  Finanzas
                </h2>
              </div>
              <div className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] border border-[#dfe6f2] bg-white px-3 text-[0.78rem] font-bold capitalize text-[#111827] shadow-sm">
                <CalendarDays size={15} className="text-[#102d92]" />
                {periodoActual}
              </div>
            </div>

            <section className="mt-5 overflow-hidden rounded-[16px] bg-[#0959d8] px-4 py-5 text-white shadow-[0_16px_34px_rgba(9,89,216,0.24)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.08em] text-white/80">
                    Utilidad neta
                  </p>
                  <p className="mt-3 text-[2.15rem] font-black leading-none tracking-normal">
                    {loading ? '...' : formatCurrency(utilidad)}
                  </p>
                </div>
                <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/18">
                  <TrendingUp size={30} />
                </span>
              </div>
              {hasData ? (
                <p className="mt-3 text-[0.62rem] font-semibold leading-4 text-white/75">
                  Resultado despues de compras, gastos y ventas
                </p>
              ) : (
                <div className="mt-3 space-y-1 text-white/75">
                  <p className="text-[0.64rem] font-black leading-4">
                    Aun no tienes movimientos registrados
                  </p>
                  <p className="text-[0.62rem] font-semibold leading-4">
                    Registra compras, ventas o gastos para ver tu utilidad
                  </p>
                </div>
              )}
              <p className="mt-5 inline-flex items-center gap-2 text-[0.68rem] font-bold text-white/75">
                <Clock size={14} />
                Actualizado: hoy
              </p>
            </section>

            <section className="mt-4 grid grid-cols-3 gap-3">
              <article className="rounded-[14px] border border-emerald-100 bg-white px-3 py-4 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <ShoppingCart size={18} />
                </span>
                <p className="mt-3 text-[0.62rem] font-black uppercase tracking-[0.08em] text-emerald-700">
                  Ventas
                </p>
                <p className="mt-2 text-[0.9rem] font-black text-[#111827]">
                  {loading ? '...' : formatCurrency(ventasTotal)}
                </p>
              </article>
              <article className="rounded-[14px] border border-blue-100 bg-white px-3 py-4 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#0f58bd]">
                  <PackageCheck size={18} />
                </span>
                <p className="mt-3 text-[0.62rem] font-black uppercase tracking-[0.08em] text-[#0f58bd]">
                  Compras
                </p>
                <p className="mt-2 text-[0.9rem] font-black text-[#111827]">
                  {loading ? '...' : formatCurrency(comprasTotal)}
                </p>
              </article>
              <article className="rounded-[14px] border border-rose-100 bg-white px-3 py-4 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <Wallet size={18} />
                </span>
                <p className="mt-3 text-[0.62rem] font-black uppercase tracking-[0.08em] text-rose-600">
                  Gastos
                </p>
                <p className="mt-2 text-[0.9rem] font-black text-[#111827]">
                  {loading ? '...' : formatCurrency(gastosTotal)}
                </p>
              </article>
            </section>

            <section className="mt-4 rounded-[16px] border border-amber-100 bg-[#fff8e7] px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                    <Scale size={22} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-amber-700">
                      Merma total
                    </p>
                    <p className="mt-1 text-[1.45rem] font-black text-[#8a4b00]">
                      {loading ? '...' : formatKg(mermaTotalKg)}
                    </p>
                    <p className="mt-1 text-[0.62rem] font-semibold leading-4 text-amber-800/75">
                      {loading
                        ? 'Calculando impacto.'
                        : `${formatPercent(mermaTotalPorcentaje)} del peso comprado. Valor: ${formatCurrency(mermaTotalValor)}.`}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-white/80 px-2 py-1 text-[0.56rem] font-black text-amber-700">
                  {mermaTotalKg > 0 ? 'Revisar' : 'OK'}
                </span>
              </div>
            </section>

            <section className="mt-4 rounded-[16px] border border-[#e5eaf3] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LineChart size={15} className="text-[#102d92]" />
                  <div>
                    <p className="text-[0.82rem] font-black text-[#111827]">
                      Tendencia de utilidad
                    </p>
                    <p className="text-[0.62rem] font-semibold text-slate-500">
                      Dinero por fecha
                    </p>
                  </div>
                </div>
                <p className="text-[0.56rem] font-black uppercase tracking-[0.1em] text-[#73829a]">
                  {trend.xAxisTitle}
                </p>
              </div>

              <div className="mt-4 h-[245px]">
                <svg
                  viewBox="0 0 390 230"
                  className="h-[220px] w-full overflow-visible"
                  role="img"
                  aria-label="Tendencia de utilidad"
                >
                  <text
                    x="0"
                    y="14"
                    fill="#0f172a"
                    fontSize="11"
                    fontWeight="800"
                  >
                    {trend.yAxisTitle}
                  </text>
                  <text
                    x="364"
                    y="228"
                    textAnchor="end"
                    fill="#0f172a"
                    fontSize="11"
                    fontWeight="800"
                  >
                    Fecha
                  </text>
                  {trend.yLabels.map((tick) => (
                    <g key={tick.label}>
                      <text
                        x="0"
                        y={tick.y + 4}
                        fill="#475569"
                        fontSize="11"
                        fontWeight="700"
                      >
                        {tick.label}
                      </text>
                      <line
                        x1="72"
                        y1={tick.y}
                        x2="364"
                        y2={tick.y}
                        stroke="#e6ecf4"
                        strokeDasharray="5 5"
                      />
                    </g>
                  ))}
                  <line
                    x1="72"
                    y1={trend.zeroY}
                    x2="364"
                    y2={trend.zeroY}
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                  />
                  <polyline
                    points={trend.polyline}
                    fill="none"
                    stroke="#0f58bd"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {trend.points.map((point) => (
                    <g key={point.key}>
                      <text
                        x={point.x}
                        y={Math.max(14, point.y - 12)}
                        textAnchor="middle"
                        fill="#111827"
                        fontSize="11"
                        fontWeight="800"
                      >
                        {formatCurrencyShort(point.value)}
                      </text>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="6"
                        fill="#0f58bd"
                        stroke="#ffffff"
                        strokeWidth="3"
                      />
                      <text
                        x={point.x}
                        y="212"
                        textAnchor="middle"
                        fill="#475569"
                        fontSize="11"
                        fontWeight="700"
                      >
                        {point.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </section>

            <section className="mt-4 rounded-[16px] border border-[#e5eaf3] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.82rem] font-black text-[#111827]">
                  Movimientos recientes
                </p>
                <span className="rounded-full bg-[#f1f5fb] px-2 py-1 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#73829a]">
                  {movimientosRecientes.length}
                </span>
              </div>

              {movimientosRecientes.length === 0 ? (
                <p className="mt-3 rounded-[10px] bg-[#f8fafc] px-3 py-3 text-[0.64rem] font-semibold text-slate-500">
                  Aun no tienes movimientos
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {movimientosRecientes.map((item) => {
                    const copy = getMovimientoCopy(item);
                    const Icon = copy.icon;
                    return (
                      <article
                        key={`${item.tipo}-${item.id}`}
                        className="flex items-center gap-3 border-b border-[#eef2f7] px-1 py-3 last:border-b-0"
                      >
                        <span
                          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${copy.tone}`}
                        >
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.82rem] font-black text-[#111827]">
                            {copy.title}
                          </p>
                          <p className="truncate text-[0.68rem] font-semibold text-slate-500">
                            {copy.detail}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[0.62rem] font-semibold text-slate-500">
                            {formatDate(item.fecha)}
                          </p>
                          <p
                            className={`mt-1 text-[0.74rem] font-black ${copy.amountTone}`}
                          >
                            {copy.sign ? `${copy.sign} ` : ''}
                            {formatCurrency(item.valor)}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="mt-4 rounded-[16px] border border-[#e5eaf3] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[0.82rem] font-black text-[#111827]">
                    Historiales financieros
                  </p>
                  <p className="mt-1 text-[0.62rem] font-semibold text-slate-500">
                    Consulta completa por categoría
                  </p>
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                {[
                  {
                    tipo: 'VENTA' as const,
                    title: 'Historial de ventas',
                    text: 'Consulta ventas registradas.',
                    icon: ShoppingCart,
                    tone: 'bg-[#e9f7ef] text-[#118444]',
                  },
                  {
                    tipo: 'COMPRA' as const,
                    title: 'Historial de compras',
                    text: 'Consulta compras registradas.',
                    icon: PackageCheck,
                    tone: 'bg-[#eef4ff] text-[#0f58bd]',
                  },
                  {
                    tipo: 'GASTO' as const,
                    title: 'Historial de gastos',
                    text: 'Consulta gastos registrados.',
                    icon: Wallet,
                    tone: 'bg-[#fff1f2] text-[#be123c]',
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.tipo}
                      type="button"
                      onClick={() => abrirHistorial(item.tipo)}
                      className="flex min-h-[58px] items-center gap-3 rounded-[14px] border border-[#eef2f7] bg-[#fbfcff] px-3 py-2 text-left"
                    >
                      <span
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.tone}`}
                      >
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-[#111827]">
                          {item.title}
                        </span>
                        <span className="block text-xs font-semibold text-slate-500">
                          {item.text}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-4 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => navigate('/ventas')}
                className="inline-flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[8px] bg-[#e9f7ef] px-2 text-center text-[0.58rem] font-black text-[#118444]"
              >
                <ShoppingCart size={15} />
                Venta
              </button>
              <button
                type="button"
                onClick={() => navigate('/compras')}
                className="inline-flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[8px] bg-[#eef4ff] px-2 text-center text-[0.58rem] font-black text-[#0f58bd]"
              >
                <PackageCheck size={15} />
                Compra
              </button>
              <button
                type="button"
                onClick={() => navigate('/gastos/registro')}
                className="inline-flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[8px] bg-[#fff1f2] px-2 text-center text-[0.58rem] font-black text-[#be123c]"
              >
                <Plus size={15} />
                Gasto
              </button>
            </section>

            {historialActivo ? (
              <div className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center bg-slate-900/45 px-3 pb-3 pt-3 backdrop-blur-sm sm:items-center">
                <section className="flex max-h-[88dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
                  <header className="shrink-0 border-b border-slate-100 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.1em] text-[#102d92]">
                          Historial
                        </p>
                        <h3 className="mt-1 text-lg font-black text-slate-950">
                          {historialActivo === 'VENTA'
                            ? 'Ventas registradas'
                            : historialActivo === 'COMPRA'
                              ? 'Compras registradas'
                              : 'Gastos registrados'}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setHistorialActivo(null)}
                        aria-label="Cerrar historial"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <label className="mt-3 flex h-11 items-center gap-2 rounded-[14px] border border-[#dbe2f0] bg-[#f8faff] px-3">
                      <Search size={15} className="text-slate-400" />
                      <input
                        value={historialSearch}
                        onChange={(event) => setHistorialSearch(event.target.value)}
                        className="w-full bg-transparent text-sm font-semibold outline-none"
                        placeholder="Buscar registro"
                      />
                    </label>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <input
                        type="date"
                        value={historialDate}
                        onChange={(event) => setHistorialDate(event.target.value)}
                        className="min-h-[38px] rounded-[12px] border border-[#dbe2f0] bg-white px-2 text-[0.68rem] font-bold text-slate-700"
                        aria-label="Filtrar por fecha"
                      />
                      <select
                        value={historialTipo}
                        onChange={(event) => setHistorialTipo(event.target.value)}
                        className="min-h-[38px] rounded-[12px] border border-[#dbe2f0] bg-white px-2 text-[0.68rem] font-bold text-slate-700"
                        aria-label="Filtrar por tipo"
                      >
                        {historialTipos.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {tipo === 'TODOS' ? 'Todos' : tipo}
                          </option>
                        ))}
                      </select>
                      <select
                        value={historialSort}
                        onChange={(event) =>
                          setHistorialSort(event.target.value as typeof historialSort)
                        }
                        className="min-h-[38px] rounded-[12px] border border-[#dbe2f0] bg-white px-2 text-[0.68rem] font-bold text-slate-700"
                        aria-label="Ordenar historial"
                      >
                        <option value="recent">Recientes</option>
                        <option value="oldest">Antiguos</option>
                        <option value="amount-desc">Mayor valor</option>
                        <option value="amount-asc">Menor valor</option>
                      </select>
                    </div>
                    <div className="mt-3 rounded-[14px] bg-[#eef4ff] px-3 py-2 text-sm font-black text-[#102d92]">
                      Total acumulado: {formatCurrency(historialTotal)}
                    </div>
                  </header>
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {historialMovimientos.length === 0 ? (
                      <p className="rounded-[14px] bg-[#f8fafc] px-4 py-6 text-center text-sm font-bold text-slate-500">
                        No hay registros con esos filtros.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {historialMovimientos.map((item) => {
                          const copy = getMovimientoCopy(item);
                          const Icon = copy.icon;
                          return (
                            <article
                              key={`${item.tipo}-${item.id}-${item.fecha}`}
                              className="flex items-center gap-3 rounded-[14px] border border-[#eef2f7] bg-[#fbfcff] px-3 py-3"
                            >
                              <span
                                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${copy.tone}`}
                              >
                                <Icon size={17} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-black text-[#111827]">
                                  {item.nombre || copy.title}
                                </p>
                                <p className="text-xs font-semibold text-slate-500">
                                  {formatDate(item.fecha)}
                                  {item.kg > 0 ? ` · ${formatKg(item.kg)}` : ''}
                                </p>
                              </div>
                              <p className={`shrink-0 text-sm font-black ${copy.amountTone}`}>
                                {formatCurrency(item.valor)}
                              </p>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
