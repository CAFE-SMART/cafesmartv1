import React, { useCallback, useMemo, useState } from 'react';
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
import { ApiRequestError } from '../services/apiService';

type PeriodoFinanciero = 'DIARIO' | 'SEMANAL';

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
  if (abs >= 1000000) {
    return `$${(value / 1000000).toLocaleString('es-CO', {
      maximumFractionDigits: 1,
    })}M`;
  }
  if (abs >= 1000) {
    return `$${(value / 1000).toLocaleString('es-CO', {
      maximumFractionDigits: 0,
    })}K`;
  }
  return `$${value.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

function getFinancialSummaryErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 0 || error.status >= 500) {
      return 'No pudimos cargar el resumen. Revisa tu internet e intenta de nuevo.';
    }

    if (error.status === 401) {
      return 'Tu sesión venció. Inicia sesión nuevamente.';
    }

    if (error.status === 403) {
      return 'Tu usuario no tiene permiso para ver este resumen.';
    }

    return error.message || 'No pudimos cargar el resumen. Intenta de nuevo.';
  }

  return 'No pudimos cargar el resumen. Intenta de nuevo.';
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

function getFinancialAccessErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    const message = error.message.toLowerCase();

    if (error.status === 0) {
      return 'No pudimos validar el acceso. Revisa tu internet e intenta de nuevo.';
    }

    if (error.status === 401) {
      if (message.includes('google') || message.includes('local')) {
        return 'Esta cuenta entró con Google y no tiene una contraseña creada en la app. Entra con un administrador que use contraseña.';
      }

      if (error.field === 'password' || message.includes('contrase')) {
        return 'La contraseña no coincide con el usuario que inició sesión. Revísala e intenta de nuevo.';
      }

      return 'Tu sesión venció. Inicia sesión nuevamente para ver el resumen financiero.';
    }

    if (error.status === 403) {
      return 'Tu usuario no tiene permiso para ver el resumen financiero.';
    }

    if (error.status >= 500) {
      return 'No pudimos validar el acceso en este momento. Revisa tu internet e intenta de nuevo.';
    }

    return (
      error.message || 'No pudimos validar la contraseña. Intenta de nuevo.'
    );
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'No pudimos validar la contraseña. Intenta de nuevo.';
}

export default function ResumenFinanciero() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [password, setPassword] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoFinanciero>('DIARIO');
  const [historialAbierto, setHistorialAbierto] = useState(false);

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
      setError(getFinancialSummaryErrorMessage(err));
      if (!isRefresh) {
        setSummary(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleUnlock = async () => {
    if (!password.trim()) {
      setAccessError('Escribe la contraseña del administrador.');
      return;
    }

    setLoading(true);
    setAccessError(null);

    try {
      await verificarPasswordFinanciero(password);
      setAuthorized(true);
      setPassword('');
      await cargar();
    } catch (err) {
      setAccessError(getFinancialAccessErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

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
  const mermaTotalKg = summary?.mermaTotalKg ?? 0;
  const periodoActual = new Date().toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const periodoLabel =
    periodo === 'DIARIO' ? 'del día' : 'de los últimos 7 días';
  const movimientosDelPeriodo = useMemo(() => {
    const ahora = new Date();
    const inicio = new Date(ahora);
    inicio.setHours(0, 0, 0, 0);

    if (periodo === 'SEMANAL') {
      inicio.setDate(inicio.getDate() - 6);
    }

    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + (periodo === 'DIARIO' ? 1 : 7));

    return movimientos.filter((item) => {
      const fecha = new Date(item.fecha);
      return fecha >= inicio && fecha < fin;
    });
  }, [movimientos, periodo]);
  const totalesMovimientosPeriodo = useMemo(
    () =>
      movimientosDelPeriodo.reduce(
        (totales, item) => {
          if (item.tipo === 'VENTA') {
            totales.ventas += item.valor;
          } else if (item.tipo === 'COMPRA') {
            totales.compras += item.valor;
          } else {
            totales.gastos += item.valor;
          }

          return totales;
        },
        { ventas: 0, compras: 0, gastos: 0 },
      ),
    [movimientosDelPeriodo],
  );
  const totalConRespaldo = (apiValue: number | undefined, fallback: number) =>
    apiValue && apiValue > 0 ? apiValue : fallback;
  const ventasTotal =
    periodo === 'DIARIO'
      ? totalConRespaldo(
          summary?.totalVentasHoy,
          totalesMovimientosPeriodo.ventas,
        )
      : totalConRespaldo(
          summary?.totalVentasSemana,
          totalesMovimientosPeriodo.ventas,
        );
  const gastosTotal =
    periodo === 'DIARIO'
      ? totalConRespaldo(
          summary?.totalGastosHoy,
          totalesMovimientosPeriodo.gastos,
        )
      : totalConRespaldo(
          summary?.totalGastosSemana,
          totalesMovimientosPeriodo.gastos,
        );
  const comprasTotal =
    periodo === 'DIARIO'
      ? totalConRespaldo(
          summary?.totalComprasHoy,
          totalesMovimientosPeriodo.compras,
        )
      : totalConRespaldo(
          summary?.totalComprasSemana,
          totalesMovimientosPeriodo.compras,
        );
  const utilidadEstimada = ventasTotal - comprasTotal - gastosTotal;
  const hasData =
    ventasTotal > 0 ||
    comprasTotal > 0 ||
    gastosTotal > 0 ||
    mermaTotalKg > 0 ||
    movimientosDelPeriodo.length > 0;
  const movimientosRecientes = useMemo(
    () => movimientosDelPeriodo.slice(0, 4),
    [movimientosDelPeriodo],
  );
  const trend = useMemo(() => {
    const byDay = new Map<
      string,
      { key: string; label: string; time: number; value: number }
    >();

    for (const item of movimientosDelPeriodo) {
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
          value: utilidadEstimada,
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
    const chart = { left: 96, top: 42, width: 248, height: 122 };
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
        }))
        .filter((tick, index, list) => {
          if (tick.value !== 0) return true;
          return list.every(
            (other, otherIndex) =>
              otherIndex === index || Math.abs(other.y - tick.y) > 18,
          );
        }),
      xAxisTitle: 'Días con movimiento',
      yAxisTitle: 'Dinero',
    };
  }, [movimientosDelPeriodo, utilidadEstimada]);

  return (
    <div className="min-h-screen bg-[#f7f9fc] px-4 py-3 pb-20 text-slate-900">
      <main className="mx-auto w-full max-w-[430px] py-1">
        <header className="grid min-h-[42px] grid-cols-[36px_1fr_36px] items-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-900 transition hover:bg-white"
            aria-label="Volver"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-center text-[0.9rem] font-black text-[#111827]">
            Resultado financiero
          </h1>
          {authorized ? (
            <button
              type="button"
              onClick={() => void cargar(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-white"
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

        {authorized && summary && error ? (
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
              Ingresa la contraseña del administrador para ver balance, merma y
              movimientos.
            </p>
            <input
              type="password"
              maxLength={72}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (accessError) setAccessError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleUnlock();
                }
              }}
              aria-invalid={Boolean(accessError)}
              aria-describedby="financial-access-error"
              className="mt-4 w-full rounded-[8px] border border-[#dbe2ee] bg-[#f8fafc] px-3 py-2.5 text-[0.78rem] font-semibold outline-none focus:border-[#102d92] aria-[invalid=true]:border-rose-300"
              placeholder="Contraseña"
            />
            <div
              id="financial-access-error"
              aria-live="polite"
              className="mt-2 flex min-h-[44px] items-start text-left"
            >
              {accessError ? (
                <p className="w-full rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-2 text-[0.66rem] font-semibold leading-4 text-rose-700">
                  {accessError}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void handleUnlock()}
              disabled={loading}
              className="mt-1 inline-flex min-h-[38px] w-full items-center justify-center rounded-[8px] bg-[#102d92] px-4 text-[0.7rem] font-black text-white disabled:opacity-70"
            >
              {loading ? 'Validando...' : 'Ver resumen financiero'}
            </button>
          </section>
        ) : !summary ? (
          <section className="mt-6 rounded-[16px] border border-[#dbe2ee] bg-white px-4 py-5 text-center shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
            <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#eef2ff] text-[#102d92]">
              <RefreshCcw
                size={18}
                className={loading || refreshing ? 'animate-spin' : ''}
              />
            </span>
            <h2 className="mt-3 text-[1rem] font-black text-[#111827]">
              {loading ? 'Cargando resumen' : 'No pudimos cargar el resumen'}
            </h2>
            <p className="mx-auto mt-2 max-w-[300px] text-[0.68rem] font-semibold leading-5 text-slate-500">
              {loading
                ? 'Estamos preparando los datos financieros.'
                : (error ?? 'Revisa tu conexión e intenta de nuevo.')}
            </p>
            {!loading ? (
              <button
                type="button"
                onClick={() => void cargar()}
                className="mt-4 inline-flex min-h-[38px] w-full items-center justify-center rounded-[8px] bg-[#102d92] px-4 text-[0.7rem] font-black text-white"
              >
                Intentar de nuevo
              </button>
            ) : null}
          </section>
        ) : (
          <>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[0.64rem] font-black uppercase tracking-[0.12em] text-[#64748b]">
                  Resumen financiero
                </p>
                <h2 className="mt-0.5 text-[1.45rem] font-black leading-none text-[#071126]">
                  Finanzas
                </h2>
              </div>
              <div className="inline-flex min-h-[34px] items-center gap-1.5 rounded-[10px] border border-[#dfe6f2] bg-white px-2.5 text-[0.68rem] font-bold text-[#111827] shadow-sm">
                <CalendarDays size={13} className="text-[#102d92]" />
                {periodoActual}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 rounded-[10px] bg-[#eef3fa] p-1">
              {(['DIARIO', 'SEMANAL'] as PeriodoFinanciero[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPeriodo(item)}
                  className={`min-h-[34px] rounded-[8px] text-[0.68rem] font-black transition ${
                    periodo === item
                      ? 'bg-white text-[#102d92] shadow-sm'
                      : 'text-[#64748b]'
                  }`}
                >
                  {item === 'DIARIO' ? 'Diario' : 'Semanal'}
                </button>
              ))}
            </div>

            <section className="mt-3 overflow-hidden rounded-[14px] bg-[#0959d8] px-3.5 py-4 text-white shadow-[0_12px_26px_rgba(9,89,216,0.2)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.08em] text-white/80">
                    Utilidad estimada {periodoLabel}
                  </p>
                  <p className="mt-2 text-[1.7rem] font-black leading-none tracking-normal">
                    {loading ? '...' : formatCurrency(utilidadEstimada)}
                  </p>
                </div>
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/18">
                  <TrendingUp size={24} />
                </span>
              </div>
              {hasData ? (
                <p className="mt-2 text-[0.6rem] font-semibold leading-4 text-white/75">
                  Ventas menos compras y gastos {periodoLabel}.
                </p>
              ) : (
                <div className="mt-2 space-y-1 text-white/75">
                  <p className="text-[0.62rem] font-black leading-4">
                    Aún no tienes movimientos registrados
                  </p>
                  <p className="text-[0.6rem] font-semibold leading-4">
                    Registra compras, ventas o gastos para ver tu balance
                  </p>
                </div>
              )}
              <p className="mt-3 inline-flex items-center gap-1.5 text-[0.62rem] font-bold text-white/75">
                <Clock size={12} />
                Actualizado: hoy
              </p>
            </section>

            <section className="mt-3 grid grid-cols-3 gap-2">
              <article className="rounded-[12px] border border-emerald-100 bg-white px-2 py-3 text-center shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                <span className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <ShoppingCart size={15} />
                </span>
                <p className="mt-2 text-[0.55rem] font-black uppercase tracking-[0.06em] text-emerald-700">
                  Ventas
                </p>
                <p className="mt-1 text-[0.78rem] font-black text-[#111827]">
                  {loading ? '...' : formatCurrency(ventasTotal)}
                </p>
              </article>
              <article className="rounded-[12px] border border-blue-100 bg-white px-2 py-3 text-center shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                <span className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[#0f58bd]">
                  <PackageCheck size={15} />
                </span>
                <p className="mt-2 text-[0.55rem] font-black uppercase tracking-[0.06em] text-[#0f58bd]">
                  Compras
                </p>
                <p className="mt-1 text-[0.78rem] font-black text-[#111827]">
                  {loading ? '...' : formatCurrency(comprasTotal)}
                </p>
              </article>
              <article className="rounded-[12px] border border-rose-100 bg-white px-2 py-3 text-center shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                <span className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <Wallet size={15} />
                </span>
                <p className="mt-2 text-[0.55rem] font-black uppercase tracking-[0.06em] text-rose-600">
                  Gastos
                </p>
                <p className="mt-1 text-[0.78rem] font-black text-[#111827]">
                  {loading ? '...' : formatCurrency(gastosTotal)}
                </p>
              </article>
            </section>

            {periodo === 'SEMANAL' ? (
              <section className="mt-3 rounded-[14px] border border-[#e5eaf3] bg-white px-3 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <LineChart size={15} className="text-[#102d92]" />
                    <div>
                      <p className="text-[0.78rem] font-black text-[#111827]">
                        Tendencia del balance
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

                {movimientosDelPeriodo.length === 0 ? (
                  <div className="mt-3 rounded-[10px] bg-[#f8fafc] px-3 py-3">
                    <p className="text-[0.7rem] font-black text-[#111827]">
                      Aún no hay movimientos para este periodo.
                    </p>
                    <p className="mt-1 text-[0.62rem] font-semibold leading-4 text-slate-500">
                      Registra compras, ventas o gastos para ver el resumen
                      financiero.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 h-[206px]">
                    <svg
                      viewBox="0 0 390 230"
                      className="h-[196px] w-full overflow-visible"
                      role="img"
                      aria-label="Tendencia del balance"
                    >
                      <text
                        x="4"
                        y="14"
                        fill="#0f172a"
                        fontSize="10"
                        fontWeight="800"
                      >
                        {trend.yAxisTitle}
                      </text>
                      <text
                        x="350"
                        y="226"
                        textAnchor="end"
                        fill="#0f172a"
                        fontSize="10"
                        fontWeight="800"
                      >
                        Fecha
                      </text>
                      {trend.yLabels.map((tick) => (
                        <g key={tick.label}>
                          <text
                            x="4"
                            y={tick.y + 4}
                            fill="#475569"
                            fontSize="9"
                            fontWeight="700"
                          >
                            {tick.label}
                          </text>
                          <line
                            x1="96"
                            y1={tick.y}
                            x2="344"
                            y2={tick.y}
                            stroke="#e6ecf4"
                            strokeDasharray="5 5"
                          />
                        </g>
                      ))}
                      <line
                        x1="96"
                        y1={trend.zeroY}
                        x2="344"
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
                            y="208"
                            textAnchor="middle"
                            fill="#475569"
                            fontSize="9"
                            fontWeight="700"
                          >
                            {point.label}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                )}
              </section>
            ) : null}

            <section className="mt-3 rounded-[14px] border border-amber-100 bg-[#fff8e7] px-3 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                    <Scale size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-amber-700">
                      Merma total
                    </p>
                    <p className="mt-0.5 text-[1.15rem] font-black text-[#8a4b00]">
                      {loading ? '...' : formatKg(mermaTotalKg)}
                    </p>
                    <p className="mt-0.5 text-[0.58rem] font-semibold leading-4 text-amber-800/75">
                      Diferencia entre peso comprado y peso final.
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-white/80 px-2 py-1 text-[0.56rem] font-black text-amber-700">
                  {mermaTotalKg > 0 ? 'Revisar' : 'OK'}
                </span>
              </div>
            </section>

            <section className="mt-3 rounded-[14px] border border-[#e5eaf3] bg-white px-3 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[0.82rem] font-black text-[#111827]">
                    Movimientos recientes
                  </p>
                  <p className="text-[0.58rem] font-semibold text-slate-500">
                    {periodo === 'DIARIO' ? 'Hoy' : 'Últimos 7 días'}
                  </p>
                </div>
                {movimientosDelPeriodo.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setHistorialAbierto(true)}
                    className="rounded-full bg-[#f1f5fb] px-2.5 py-1.5 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#102d92]"
                  >
                    Ver historial
                  </button>
                ) : (
                  <span className="rounded-full bg-[#f1f5fb] px-2 py-1 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#73829a]">
                    {movimientosRecientes.length}
                  </span>
                )}
              </div>

              {movimientosRecientes.length === 0 ? (
                <p className="mt-2 rounded-[10px] bg-[#f8fafc] px-3 py-2.5 text-[0.62rem] font-semibold text-slate-500">
                  Aún no tienes movimientos
                </p>
              ) : (
                <div className="mt-2 space-y-1">
                  {movimientosRecientes.map((item) => {
                    const copy = getMovimientoCopy(item);
                    const Icon = copy.icon;
                    return (
                      <article
                        key={`${item.tipo}-${item.id}`}
                        className="flex items-center gap-2.5 border-b border-[#eef2f7] px-1 py-2.5 last:border-b-0"
                      >
                        <span
                          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${copy.tone}`}
                        >
                          <Icon size={15} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.76rem] font-black text-[#111827]">
                            {copy.title}
                          </p>
                          <p className="truncate text-[0.62rem] font-semibold text-slate-500">
                            {copy.detail}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[0.62rem] font-semibold text-slate-500">
                            {formatDate(item.fecha)}
                          </p>
                          <p
                            className={`mt-0.5 text-[0.68rem] font-black ${copy.amountTone}`}
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

            <section className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => navigate('/ventas')}
                className="inline-flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-[8px] bg-[#e9f7ef] px-2 text-center text-[0.56rem] font-black text-[#118444]"
              >
                <ShoppingCart size={15} />
                Venta
              </button>
              <button
                type="button"
                onClick={() => navigate('/compras')}
                className="inline-flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-[8px] bg-[#eef4ff] px-2 text-center text-[0.56rem] font-black text-[#0f58bd]"
              >
                <PackageCheck size={15} />
                Compra
              </button>
              <button
                type="button"
                onClick={() => navigate('/gastos/registro')}
                className="inline-flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-[8px] bg-[#fff1f2] px-2 text-center text-[0.56rem] font-black text-[#be123c]"
              >
                <Plus size={15} />
                Gasto
              </button>
            </section>

            {historialAbierto ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-5 py-8 backdrop-blur-sm">
                <section className="flex max-h-[72vh] w-full max-w-[350px] flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.24)]">
                  <div className="flex shrink-0 items-center justify-between border-b border-[#eef2f7] px-3.5 py-2.5">
                    <div>
                      <p className="text-[0.88rem] font-black text-[#111827]">
                        Historial
                      </p>
                      <p className="text-[0.6rem] font-semibold text-slate-500">
                        {periodo === 'DIARIO'
                          ? 'Movimientos de hoy'
                          : 'Movimientos de los últimos 7 días'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHistorialAbierto(false)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f1f5fb] text-slate-500"
                      aria-label="Cerrar historial"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div className="min-h-0 max-h-[360px] flex-1 overflow-y-scroll px-3.5 py-1.5 pr-[6px] [scrollbar-color:#c5ccda_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-[8px] [&::-webkit-scrollbar-thumb]:bg-[#c5ccda]">
                    {movimientosDelPeriodo.map((item) => {
                      const copy = getMovimientoCopy(item);
                      const Icon = copy.icon;
                      return (
                        <article
                          key={`historial-${item.tipo}-${item.id}`}
                          className="flex items-center gap-2 border-b border-[#eef2f7] py-2 last:border-b-0"
                        >
                          <span
                            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${copy.tone}`}
                          >
                            <Icon size={14} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[0.72rem] font-black text-[#111827]">
                              {copy.title}
                            </p>
                            <p className="truncate text-[0.6rem] font-semibold text-slate-500">
                              {copy.detail}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[0.58rem] font-semibold text-slate-500">
                              {formatDate(item.fecha)}
                            </p>
                            <p
                              className={`mt-0.5 text-[0.64rem] font-black ${copy.amountTone}`}
                            >
                              {copy.sign ? `${copy.sign} ` : ''}
                              {formatCurrency(item.valor)}
                            </p>
                          </div>
                        </article>
                      );
                    })}
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
