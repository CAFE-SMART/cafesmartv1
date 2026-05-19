import React, { useCallback, useEffect, useMemo, useState } from 'react';

const IndicatorGood = () => <span className="mt-2 text-green-600">OK</span>;
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Clock,
  LineChart,
  Lock,
  PackageCheck,
  Plus,
  Receipt,
  Scale,
  Search,
  ShoppingCart,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RefreshButton } from '../components/RefreshButton';
import { SmartSelect } from '../components/SmartSelect';
import { CafeSmartErrorState } from '../components/CafeSmartErrorState';
import { CafeSmartProcessingScreen } from '../components/CafeSmartProcessingScreen';
import {
  obtenerDashboardSummary,
  type DashboardMovimiento,
  type DashboardSummary,
} from '../services/dashboardService';
import { listarCompras } from '../services/comprasService';
import { listarGastos } from '../services/gastosService';
import { listarVentas } from '../services/ventasService';
import { verificarPasswordFinanciero } from '../services/financialAccessService';
import {
  BUSINESS_MIN_DATE_VALUE,
  formatDateLabel,
  getTodayLocalDateValue,
} from '../utils/date';
import { sanitizeSearchInput } from '../utils/inputLimits';

function formatCurrency(value: number) {
  return `$ ${new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function formatCurrencyTight(value: number) {
  return `$${new Intl.NumberFormat('es-CO', {
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

async function cargarMovimientosHistoricos(): Promise<DashboardMovimiento[]> {
  const [compras, ventasResponse, gastos] = await Promise.all([
    listarCompras(),
    listarVentas(),
    listarGastos(),
  ]);

  const comprasMovimientos = compras.map((compra): DashboardMovimiento => ({
    id: compra.id,
    tipo: 'COMPRA',
    nombre: compra.productorNombre ?? 'Productor sin registrar',
    kg: compra.sublotes.reduce((total, sublote) => total + sublote.pesoInicial, 0),
    valor: compra.totalCompra,
    fecha: compra.fecha,
  }));

  const ventasMovimientos = ventasResponse.registros.map((venta): DashboardMovimiento => ({
    id: venta.id,
    tipo: 'VENTA',
    nombre: venta.clienteNombre || 'Cliente general',
    kg: venta.totalKg,
    valor: venta.totalVenta,
    fecha: venta.fecha,
  }));

  const gastosMovimientos = gastos.map((gasto): DashboardMovimiento => ({
    id: gasto.id,
    tipo: 'GASTO',
    nombre: gasto.conceptoGasto || gasto.tipoGasto,
    kg: gasto.sublotes.reduce((total, sublote) => total + sublote.pesoActual, 0),
    valor: gasto.montoGasto,
    fecha: gasto.fechaGasto,
  }));

  return [...comprasMovimientos, ...ventasMovimientos, ...gastosMovimientos];
}

function formatDayShort(value: Date) {
  return value.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
  });
}

function formatLongDateLabel(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const TREND_STATIC_LABELS = ['10', '11', '12', '13', '14', '15', '16'];
const TREND_STATIC_VALUES = [
  1200000,
  850000,
  1500000,
  2100000,
  1800000,
  950000,
  2400000,
];
const TREND_STATIC_NODE_LABELS = [
  '$1.2M',
  '$850K',
  '$1.5M',
  '$2.1M',
  '$1.8M',
  '$950K',
  '$2.4M',
];
const WEEKDAYS_ES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
function ariaPressed(active: boolean) {
  return { 'aria-pressed': active ? 'true' : 'false' } as const;
}

function parseLocalDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

function formatLocalDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDateValueInRange(value: string, min: string, max: string) {
  return value >= min && value <= max;
}

function HistoryDatePicker({
  value,
  open,
  onToggle,
  onClose,
  onChange,
}: {
  value: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
}) {
  const min = BUSINESS_MIN_DATE_VALUE;
  const max = getTodayLocalDateValue();
  const selectedDate = parseLocalDateValue(value);
  const maxDate = parseLocalDateValue(max) ?? new Date();
  const minDate = parseLocalDateValue(min) ?? new Date(2026, 0, 1);
  const visibleDate = selectedDate ?? maxDate;
  const [calendarView, setCalendarView] =
    useState<'days' | 'months' | 'years'>('days');
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(visibleDate.getFullYear(), visibleDate.getMonth(), 1),
  );

  React.useEffect(() => {
    if (open) {
      const nextDate = parseLocalDateValue(value) ?? maxDate;
      setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
      setCalendarView('days');
    }
  }, [max, open, value]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const daysInMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      0,
    ).getDate();
    return [
      ...Array.from({ length: firstDay.getDay() }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index + 1);
        return { day: index + 1, value: formatLocalDateValue(date) };
      }),
    ];
  }, [visibleMonth]);

  const visibleYear = visibleMonth.getFullYear();
  const previousMonth = new Date(visibleYear, visibleMonth.getMonth() - 1, 1);
  const nextMonth = new Date(visibleYear, visibleMonth.getMonth() + 1, 1);
  const canGoPrevious = previousMonth >= new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const canGoNext = nextMonth <= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  const yearOptions = Array.from(
    { length: maxDate.getFullYear() - minDate.getFullYear() + 1 },
    (_, index) => minDate.getFullYear() + index,
  );

  return (
    <div
      className="relative w-full min-w-0 overflow-visible"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open ? 'true' : 'false'}
        onClick={onToggle}
        className={`flex min-h-[42px] w-full items-center justify-between gap-2 rounded-[12px] border bg-white px-3 text-left text-[0.72rem] font-black text-[#08256d] transition hover:border-[#9fb0d4] ${
          open ? 'border-[#102d92]' : 'border-[#dbe2f0]'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">
          {value ? formatLongDateLabel(value) : 'Fecha'}
        </span>
        <CalendarDays size={15} className={open ? 'text-[#102d92]' : 'text-slate-500'} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Calendario de historial financiero"
          className="absolute left-1/2 z-[120] mt-2 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[18px] border border-[#d5deee] bg-white p-2 shadow-[0_18px_38px_rgba(15,23,42,0.16)] sm:left-auto sm:right-0 sm:translate-x-0"
        >
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => setVisibleMonth(previousMonth)}
              aria-label="Mes anterior"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#102d92] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:text-slate-300"
            >
              <ArrowLeft size={17} />
            </button>
            <div className="flex min-w-0 items-center justify-center gap-1 rounded-full bg-[#f8faff] p-1">
              <button
                type="button"
                {...ariaPressed(calendarView === 'months')}
                onClick={() => setCalendarView((current) => (current === 'months' ? 'days' : 'months'))}
                className={`rounded-full px-2.5 py-1 text-xs font-black transition ${calendarView === 'months' ? 'bg-[#102d92] text-white' : 'text-slate-900 hover:bg-[#eef4ff]'}`}
              >
                {MONTHS_ES[visibleMonth.getMonth()]}
              </button>
              <button
                type="button"
                {...ariaPressed(calendarView === 'years')}
                onClick={() => setCalendarView((current) => (current === 'years' ? 'days' : 'years'))}
                className={`rounded-full px-2.5 py-1 text-xs font-black transition ${calendarView === 'years' ? 'bg-[#102d92] text-white' : 'text-slate-900 hover:bg-[#eef4ff]'}`}
              >
                {visibleYear}
              </button>
            </div>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setVisibleMonth(nextMonth)}
              aria-label="Mes siguiente"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#102d92] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:text-slate-300"
            >
              <ArrowRight size={17} />
            </button>
          </div>

          {calendarView === 'months' ? (
            <div className="grid grid-cols-3 gap-1.5 px-1 py-1">
              {MONTHS_ES.map((month, monthIndex) => {
                const candidate = new Date(visibleYear, monthIndex, 1);
                const disabled =
                  candidate < new Date(minDate.getFullYear(), minDate.getMonth(), 1) ||
                  candidate > new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
                const active = monthIndex === visibleMonth.getMonth();
                return (
                  <button
                    key={month}
                    type="button"
                    disabled={disabled}
                    {...ariaPressed(active)}
                    onClick={() => {
                      if (!disabled) {
                        setVisibleMonth(new Date(visibleYear, monthIndex, 1));
                        setCalendarView('days');
                      }
                    }}
                    className={`min-h-[36px] rounded-[12px] px-2 text-[0.7rem] font-black transition disabled:cursor-not-allowed disabled:text-slate-300 ${active ? 'bg-[#102d92] text-white' : 'text-slate-800 hover:bg-[#f4f7ff]'}`}
                  >
                    {month}
                  </button>
                );
              })}
            </div>
          ) : calendarView === 'years' ? (
            <div className="grid max-h-44 grid-cols-3 gap-1.5 overflow-y-auto px-1 py-1">
              {yearOptions.map((year) => {
                const active = year === visibleYear;
                return (
                  <button
                    key={year}
                    type="button"
                    {...ariaPressed(active)}
                    onClick={() => {
                      setVisibleMonth(new Date(year, visibleMonth.getMonth(), 1));
                      setCalendarView('months');
                    }}
                    className={`min-h-[36px] rounded-[12px] px-2 text-xs font-black transition ${active ? 'bg-[#102d92] text-white' : 'text-slate-800 hover:bg-[#f4f7ff]'}`}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 px-1">
              {WEEKDAYS_ES.map((day) => (
                <span key={day} className="py-1.5 text-center text-[0.72rem] font-black text-slate-500">
                  {day}
                </span>
              ))}
              {calendarDays.map((day, index) =>
                day ? (
                  <button
                    key={day.value}
                    type="button"
                    disabled={!isDateValueInRange(day.value, min, max)}
                    {...ariaPressed(day.value === value)}
                    onClick={() => {
                      onChange(day.value);
                      onClose();
                    }}
                    className={`h-8 min-w-0 rounded-full text-xs font-black transition disabled:cursor-not-allowed disabled:text-slate-300 ${
                      day.value === value
                        ? 'bg-[#102d92] text-white shadow-[0_8px_18px_rgba(16,45,146,0.22)]'
                        : day.value === max
                          ? 'bg-[#eef4ff] text-[#102d92]'
                          : 'text-slate-800 hover:bg-[#f4f7ff]'
                    }`}
                  >
                    {day.day}
                  </button>
                ) : (
                  <span key={`empty-${index}`} aria-hidden="true" />
                ),
              )}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between border-t border-[#edf1f7] px-1 pt-2">
            <button
              type="button"
              onClick={() => {
                onChange('');
                onClose();
              }}
              className="rounded-full px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(max);
                onClose();
              }}
              className="rounded-full bg-[#eef4ff] px-3 py-2 text-xs font-black text-[#102d92] transition hover:bg-[#dfe8ff]"
            >
              Hoy
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
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
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historialCompleto, setHistorialCompleto] = useState<DashboardMovimiento[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialError, setHistorialError] = useState<string | null>(null);
  const [historialActivo, setHistorialActivo] = useState<
    'VENTA' | 'COMPRA' | 'GASTO' | null
  >(null);
  const [historialSearch, setHistorialSearch] = useState('');
  const [historialDate, setHistorialDate] = useState('');
  const [historialDateOpen, setHistorialDateOpen] = useState(false);
  const [historialTipo, setHistorialTipo] = useState('TODOS');
  const [historialSort, setHistorialSort] = useState<'recent' | 'oldest' | 'amount-desc' | 'amount-asc'>('recent');
  const [historialVisibleCount, setHistorialVisibleCount] = useState(30);
  const [financialSectionsOpen, setFinancialSectionsOpen] = useState({
    trend: false,
    movements: false,
    histories: false,
  });
  const [showMermaAudit, setShowMermaAudit] = useState(false);

  const cargar = useCallback(async (isRefresh = false) => {
    if (refreshing) return;
    setHistorialLoading(true);
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setHistorialError(null);
    if (isRefresh) setRefreshFeedback(null);

    try {
      const [summaryResult, historialResult] = await Promise.allSettled([
        obtenerDashboardSummary(),
        cargarMovimientosHistoricos(),
      ]);

      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value);
      } else {
        setSummary(null);
        setError('No pudimos cargar el resumen financiero. Intenta nuevamente.');
      }

      if (historialResult.status === 'fulfilled') {
        setHistorialCompleto(historialResult.value);
      } else {
        setHistorialCompleto([]);
        setHistorialError('No pudimos cargar el historial. Intenta nuevamente.');
      }

      if (isRefresh) {
        setRefreshFeedback(
          summaryResult.status === 'fulfilled' && historialResult.status === 'fulfilled'
            ? 'Datos actualizados correctamente.'
            : 'No pudimos actualizar todos los datos. Intenta nuevamente.',
        );
      }
    } finally {
      setLoading(false);
      setHistorialLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  const handleUnlock = async () => {
    if (!password.trim()) {
      setError('Escribe la contraseña del administrador.');
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

  const handleRetryAccess = () => {
    void handleUnlock();
  };

  const handleBackAccess = () => {
    navigate(-1);
  };

  const utilidad = summary?.utilidadTotalAcumulada ?? 0;
  const movimientos = useMemo(() => {
    const seen = new Set<string>();

    const base =
      historialCompleto.length > 0
        ? historialCompleto
        : (summary?.movimientosRecientes ?? []);

    return [...base]
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
  }, [historialCompleto, summary?.movimientosRecientes]);
  const movimientosRecientes = useMemo(
    () => movimientos.slice(0, 3),
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
  const historialVisible = useMemo(
    () => historialMovimientos.slice(0, historialVisibleCount),
    [historialMovimientos, historialVisibleCount],
  );
  const historialHasMore = historialMovimientos.length > historialVisible.length;
  const historialFiltrosActivos =
    Boolean(historialSearch.trim()) ||
    Boolean(historialDate) ||
    historialTipo !== 'TODOS' ||
    historialSort !== 'recent';
  const abrirHistorial = (tipo: 'VENTA' | 'COMPRA' | 'GASTO') => {
    setHistorialActivo(tipo);
    setHistorialSearch('');
    setHistorialDate('');
    setHistorialTipo('TODOS');
    setHistorialSort('recent');
    setHistorialVisibleCount(30);
  };
  const recargarHistorial = () => {
    setRefreshFeedback('Actualizando información...');
    void cargar(true);
  };
  const limpiarFiltrosHistorial = () => {
    setHistorialSearch('');
    setHistorialDate('');
    setHistorialDateOpen(false);
    setHistorialTipo('TODOS');
    setHistorialSort('recent');
    setHistorialVisibleCount(30);
    setRefreshFeedback('Filtros limpiados.');
  };
  useEffect(() => {
    setHistorialVisibleCount(30);
  }, [historialActivo, historialDate, historialSearch, historialSort, historialTipo]);
  const toggleFinancialSection = (section: keyof typeof financialSectionsOpen) => {
    setFinancialSectionsOpen((current) => ({
      ...current,
      [section]: !current[section],
    }));
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
    const buckets = TREND_STATIC_LABELS.map((label, index) => ({
      key: `mayo-${label}`,
      label,
      time: new Date(2026, 4, Number(label)).getTime(),
      value: TREND_STATIC_VALUES[index],
      displayValue: TREND_STATIC_NODE_LABELS[index],
    }));

    const values = buckets.map((bucket) => bucket.value);
    const rawMin = Math.min(0, ...values);
    const rawMax = Math.max(0, ...values);
    const padding = Math.max(100000, (rawMax - rawMin) * 0.22);
    const min = rawMin - padding;
    const max = rawMax + padding;
    const range = Math.max(1, max - min);
    const chart = { left: 74, top: 34, width: 286, height: 164 };
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
      yAxisTitle: 'Dinero utilizado / Gastado (COP)',
      xAxisTitle: 'Mes: Mayo',
      hasEnoughData: true,
    };
  }, []);

  if (loading || refreshing || historialLoading) {
    return (
      <CafeSmartProcessingScreen
        title="Cargando información financiera"
        subtitle="Estamos validando y preparando los datos."
        helperText="Actualizando resultados, historial, utilidad y merma."
        trustTitle="Acceso financiero seguro"
        trustText="CaféSmart mantiene protegida tu información mientras valida y carga los datos."
      />
    );
  }

  if (!authorized && error) {
    return (
      <CafeSmartErrorState
        title="No pudimos cargar el acceso financiero"
        message={error}
        primaryLabel="Volver a intentar"
        secondaryLabel="Volver"
        onPrimary={handleRetryAccess}
        onSecondary={handleBackAccess}
        primaryBusy={loading}
        fullScreen
      />
    );
  }

  if (authorized && error && !historialActivo) {
    return (
      <CafeSmartErrorState
        title="No pudimos cargar la información"
        message="Verifica tu conexión o vuelve a intentarlo."
        primaryLabel="Reintentar"
        secondaryLabel="Volver"
        onPrimary={() => void cargar(true)}
        onSecondary={() => navigate(-1)}
        primaryBusy={loading || refreshing}
        fullScreen
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] px-4 py-4 pb-24 text-slate-900">
      <main className="mx-auto w-full max-w-[430px] py-2">
        <header className="grid min-h-[54px] grid-cols-[44px_1fr_auto] items-center gap-2">
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
            <RefreshButton
              onClick={() => void cargar(true)}
              loading={refreshing}
              aria-label="Recargar resumen"
            >
              {refreshing ? 'Actualizando...' : 'Actualizar datos'}
            </RefreshButton>
          ) : (
            <span />
          )}
        </header>

        {refreshFeedback ? (
          <section
            role="status"
            className={`mt-2 rounded-[12px] border px-3 py-2 text-[0.68rem] font-black ${
              refreshFeedback.startsWith('Datos')
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {refreshFeedback}
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
              Ingresa la contraseña del administrador para ver utilidad, merma y
              análisis.
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
              placeholder="Contraseña"
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
                  Resultado después de compras, gastos y ventas
                </p>
              ) : (
                <div className="mt-3 space-y-1 text-white/75">
                  <p className="text-[0.64rem] font-black leading-4">
                    Aún no tienes movimientos registrados
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
                <button
                  type="button"
                  onClick={() => setShowMermaAudit(true)}
                  disabled={mermaTotalKg <= 0}
                  className="rounded-full bg-white/90 px-3 py-1.5 text-[0.58rem] font-black text-amber-700 shadow-sm transition hover:bg-white disabled:opacity-60"
                >
                  {mermaTotalKg > 0 ? 'Revisar' : 'OK'}
                </button>
              </div>
            </section>

            <section className="mt-4 rounded-[16px] border border-[#e5eaf3] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <button
                type="button"
                onClick={() => toggleFinancialSection('trend')}
                className="flex w-full items-center justify-between text-left"
              >
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
                <ChevronDown
                  size={17}
                  className={`text-slate-400 transition ${financialSectionsOpen.trend ? 'rotate-180' : ''}`}
                />
              </button>

              {financialSectionsOpen.trend ? (
              trend.hasEnoughData ? (
              <div className="mt-4 min-h-[300px] overflow-visible">
                <div className="mb-3">
                  <h3 className="text-[0.86rem] font-black text-slate-950">
                    Movimiento de registro durante la última semana
                  </h3>
                  <p className="mt-0.5 text-[0.66rem] font-semibold text-slate-500">
                    Gráfico de movimiento
                  </p>
                </div>
                <svg
                  viewBox="0 0 390 260"
                  className="h-[255px] w-full overflow-visible"
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
                    x="358"
                    y="250"
                    textAnchor="end"
                    fill="#0f172a"
                    fontSize="11"
                    fontWeight="800"
                  >
                    {trend.xAxisTitle}
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
                        x1="82"
                        y1={tick.y}
                        x2="358"
                        y2={tick.y}
                        stroke="#e6ecf4"
                        strokeDasharray="5 5"
                      />
                    </g>
                  ))}
                  <line
                    x1="82"
                    y1={trend.zeroY}
                    x2="358"
                    y2={trend.zeroY}
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                  />
                  <polyline
                    points={trend.polyline}
                    fill="none"
                    stroke="#1E3A8A"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {trend.points.map((point, index) => (
                    <g key={point.key}>
                      <text
                        x={point.x}
                        y={Math.max(22, point.y - (index % 2 === 0 ? 14 : 28))}
                        textAnchor="middle"
                        fill="#111827"
                        fontSize="11"
                        fontWeight="800"
                      >
                        {point.displayValue}
                      </text>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="6"
                        fill="#1E3A8A"
                        stroke="#ffffff"
                        strokeWidth="3"
                      />
                      <text
                        x={point.x}
                        y="224"
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
              ) : (
                <div className="mt-4 rounded-[14px] border border-[#dbe5f7] bg-[#f8fbff] px-4 py-5 text-center">
                  <p className="text-[0.86rem] font-black text-slate-900">
                    Aún no hay movimientos para mostrar.
                  </p>
                </div>
              )
              ) : null}
            </section>

            <section className="mt-4 rounded-[16px] border border-[#e5eaf3] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <button
                type="button"
                onClick={() => toggleFinancialSection('movements')}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div>
                  <p className="text-[0.82rem] font-black text-[#111827]">
                    Movimientos recientes
                  </p>
                  <p className="mt-1 text-[0.62rem] font-semibold text-slate-500">
                    {movimientosRecientes.length} últimos registros
                  </p>
                </div>
                <span className="rounded-full bg-[#f1f5fb] px-2 py-1 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#73829a]">
                  {movimientosRecientes.length}
                </span>
                <ChevronDown
                  size={17}
                  className={`text-slate-400 transition ${financialSectionsOpen.movements ? 'rotate-180' : ''}`}
                />
              </button>

              {financialSectionsOpen.movements ? (
              movimientosRecientes.length === 0 ? (
                <p className="mt-3 rounded-[10px] bg-[#f8fafc] px-3 py-3 text-[0.64rem] font-semibold text-slate-500">
                  Aún no tienes movimientos
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
              )) : null}
            </section>

            <section className="mt-4 rounded-[16px] border border-[#e5eaf3] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <button
                type="button"
                onClick={() => toggleFinancialSection('histories')}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div>
                  <p className="text-[0.82rem] font-black text-[#111827]">
                    Historiales financieros
                  </p>
                  <p className="mt-1 text-[0.62rem] font-semibold text-slate-500">
                    Consulta completa por categoría
                  </p>
                </div>
                <ChevronDown
                  size={17}
                  className={`text-slate-400 transition ${financialSectionsOpen.histories ? 'rotate-180' : ''}`}
                />
              </button>
              {financialSectionsOpen.histories ? (
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
              ) : null}
            </section>

            <section className="mt-4 grid grid-cols-3 gap-1.5">
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
              <div className="fixed inset-0 z-50 h-[100dvh] bg-[#f7f9fc] text-slate-900">
                <section className="mx-auto flex h-full w-full max-w-[430px] flex-col overflow-visible bg-white">
                  <header className="relative z-[80] shrink-0 border-b border-slate-100 bg-white px-4 py-4 shadow-sm">
                    <div className="grid grid-cols-[42px_1fr_42px] items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setHistorialDateOpen(false);
                          setHistorialActivo(null);
                        }}
                        aria-label="Volver a resultado financiero"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#eef2ff] text-[#102d92]"
                      >
                        <ArrowLeft size={17} />
                      </button>
                      <h3 className="min-w-0 truncate text-lg font-black text-slate-950">
                        {historialActivo === 'VENTA'
                          ? 'Historial de ventas'
                          : historialActivo === 'COMPRA'
                            ? 'Historial de compras'
                            : 'Historial de gastos'}
                      </h3>
                      <RefreshButton
                        onClick={recargarHistorial}
                        loading={refreshing}
                        aria-label="Recargar información del historial"
                        title="Recargar información"
                        iconOnly
                      />
                    </div>
                    <label className="mt-3 flex h-11 items-center gap-2 rounded-[14px] border border-[#dbe2f0] bg-[#f8faff] px-3">
                      <Search size={15} className="text-slate-400" />
                      <input
                        value={historialSearch}
                        maxLength={60}
                        onChange={(event) =>
                          setHistorialSearch(sanitizeSearchInput(event.target.value))
                        }
                        className="w-full bg-transparent text-sm font-semibold outline-none"
                        placeholder="Buscar registro"
                      />
                    </label>
                    {refreshing || refreshFeedback === 'Actualizando información...' ? (
                      <p role="status" className="mt-3 rounded-[14px] bg-[#eef4ff] px-3 py-2 text-xs font-black text-[#102d92]">
                        Actualizando información...
                      </p>
                    ) : null}
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="min-w-0">
                        <label className="mb-1 block text-[0.58rem] font-black uppercase tracking-[0.08em] text-slate-500">
                          Fecha
                        </label>
                        <HistoryDatePicker
                        value={historialDate}
                          open={historialDateOpen}
                          onToggle={() => setHistorialDateOpen((open) => !open)}
                          onClose={() => setHistorialDateOpen(false)}
                          onChange={setHistorialDate}
                      />
                      </div>
                      <div className="min-w-0">
                        <label className="mb-1 block text-[0.58rem] font-black uppercase tracking-[0.08em] text-slate-500">
                          {historialActivo === 'VENTA'
                            ? 'Tipo de cliente'
                            : historialActivo === 'COMPRA'
                              ? 'Tipo de productor'
                              : 'Tipo de gasto'}
                        </label>
                      <SmartSelect
                        value={historialTipo}
                        onChange={(event) => setHistorialTipo(event.target.value)}
                        className="min-h-[42px] rounded-[12px] text-[0.68rem]"
                        aria-label="Filtrar por tipo"
                      >
                        {historialTipos.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {tipo === 'TODOS' ? 'Todos' : tipo}
                          </option>
                        ))}
                      </SmartSelect>
                      </div>
                      <div className="min-w-0">
                        <label className="mb-1 block text-[0.58rem] font-black uppercase tracking-[0.08em] text-slate-500">
                          Ordenar por
                        </label>
                      <SmartSelect
                        value={historialSort}
                        onChange={(event) =>
                          setHistorialSort(event.target.value as typeof historialSort)
                        }
                        className="min-h-[42px] rounded-[12px] text-[0.68rem]"
                        aria-label="Ordenar historial"
                      >
                        <option value="recent">Recientes</option>
                        <option value="oldest">Antiguos</option>
                        <option value="amount-desc">Mayor valor</option>
                        <option value="amount-asc">Menor valor</option>
                      </SmartSelect>
                      </div>
                    </div>
                    {historialDate ? (
                      <div className="mt-3 rounded-[14px] border border-[#dbe6ff] bg-[#f5f8ff] px-3 py-2 text-xs font-bold text-[#102d92]">
                        Mostrando registros del {formatDateLabel(historialDate)}. Usa “Limpiar” para ver todo.
                      </div>
                    ) : null}
                    {historialFiltrosActivos ? (
                      <button
                        type="button"
                        onClick={limpiarFiltrosHistorial}
                        className="mt-3 inline-flex min-h-[38px] w-full items-center justify-center rounded-[13px] border border-[#d5deee] bg-white px-3 text-xs font-black text-[#334b85]"
                      >
                        Limpiar filtros
                      </button>
                    ) : null}
                    <div className="mt-3 rounded-[14px] bg-[#eef4ff] px-3 py-2 text-sm font-black text-[#102d92]">
                      Total acumulado: {formatCurrency(historialTotal)}
                    </div>
                  </header>
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {historialError ? (
                      <div className="flex min-h-full items-center justify-center py-4">
                        <CafeSmartErrorState
                          title="No pudimos cargar el historial"
                          message={historialError}
                          primaryLabel="Reintentar"
                          secondaryLabel="Volver"
                          onPrimary={recargarHistorial}
                          onSecondary={() => {
                            setHistorialDateOpen(false);
                            setHistorialActivo(null);
                          }}
                          primaryBusy={refreshing}
                          className="rounded-[24px] px-4 py-5 shadow-none"
                        />
                      </div>
                    ) : loading || historialLoading ? (
                      <div className="space-y-2">
                        {[0, 1, 2, 3].map((item) => (
                          <div
                            key={item}
                            className="h-[68px] animate-pulse rounded-[14px] bg-[#eef2f7]"
                          />
                        ))}
                      </div>
                    ) : historialMovimientos.length === 0 ? (
                      <p className="rounded-[14px] bg-[#f8fafc] px-4 py-6 text-center text-sm font-bold text-slate-500">
                        {historialFiltrosActivos
                          ? 'No hay registros con esos filtros.'
                          : 'Aún no hay registros históricos disponibles.'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {historialVisible.map((item) => {
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
                        {historialHasMore ? (
                          <button
                            type="button"
                            onClick={() => setHistorialVisibleCount((count) => count + 30)}
                            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#102d92]"
                          >
                            Cargar más
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            ) : null}
          </>
        )}
      </main>

      {showMermaAudit ? (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/45 px-3 pb-3 pt-3 backdrop-blur-sm sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="merma-audit-title"
            className="max-h-[92dvh] w-full max-w-[430px] overflow-y-auto rounded-[24px] border border-amber-100 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.24)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-700">
                  Revisión de merma
                </p>
                <h2 id="merma-audit-title" className="mt-1 text-lg font-black text-slate-950">
                  Resumen de pérdidas del lote
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowMermaAudit(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
                  aria-label="Cerrar revisión de merma"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-3 py-3">
              <span className="inline-flex rounded-full bg-amber-200 px-2.5 py-1 text-[0.62rem] font-black text-amber-900">
                Advertencia
              </span>
              <p className="mt-3 text-sm font-bold leading-6 text-amber-950">
                El lote presenta una pérdida total del {formatPercent(mermaTotalPorcentaje)} debido a calidad subestándar del grano.
              </p>
            </div>

            <section className="mt-4 grid grid-cols-[132px_1fr] items-center gap-4 border-y border-slate-200 py-4 max-[360px]:grid-cols-1">
              <MermaDonutChart />
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#3B82F6]" />
                  <div>
                    <p className="text-sm font-black text-slate-950">
                      Humedad: {formatKg(Math.round(mermaTotalKg * 0.59))} (59%)
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                      Descontados por exceso de agua.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#4B5563]" />
                  <div>
                    <p className="text-sm font-black text-slate-950">
                      Factor: {formatKg(Math.max(0, mermaTotalKg - Math.round(mermaTotalKg * 0.59)))} (41%)
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                      Descartados por pasilla y defectos.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <article className="border-b border-slate-200 py-4">
              <p className="text-[0.66rem] font-black uppercase tracking-[0.1em] text-slate-500">
                Impacto financiero
              </p>
              <p className="mt-1 text-2xl font-black text-slate-950">
                {formatCurrencyTight(mermaTotalValor)}
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
                El sistema aplicó este descuento debido a los parámetros de calidad.
              </p>
            </article>

            <div className="pt-4">
              <p className="text-sm font-black text-slate-950">
                La merma supera el límite permitido.
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                Se guardará un registro de esta operación.
              </p>
              <button
                type="button"
                onClick={() => setShowMermaAudit(false)}
                className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white"
              >
                Confirmar liquidación y continuar
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function MermaDonutChart() {
  const radius = 46;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  const humidityOffset = circumference * 0.41;

  return (
    <div className="relative mx-auto h-32 w-32 shrink-0" aria-label="Distribución de merma: humedad 59%, factor 41%" role="img">
      <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#4B5563"
          strokeWidth={strokeWidth}
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#3B82F6"
          strokeDasharray={circumference}
          strokeDashoffset={humidityOffset}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full">
        <span className="text-[0.62rem] font-black uppercase tracking-[0.08em] text-slate-400">
          Merma
        </span>
        <span className="text-lg font-black text-slate-950">100%</span>
      </div>
    </div>
  );
}
