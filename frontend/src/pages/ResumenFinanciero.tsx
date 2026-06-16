import React, { useCallback, useEffect, useMemo, useState } from 'react';

const IndicatorGood = () => <span className="mt-2 text-green-600">OK</span>;
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Clock,
  Edit2,
  Eye,
  EyeOff,
  LineChart,
  Lock,
  PackageCheck,
  Plus,
  Receipt,
  Scale,
  Search,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import {
  actualizarGasto,
  eliminarGasto,
  listarGastos,
  type GastoEstadoPago,
  type GastoItem,
  type GastoTipo,
} from '../services/gastosService';
import { listarVentas } from '../services/ventasService';
import {
  obtenerDetalleLote,
  obtenerLotes,
  type LoteDetalle,
  type SubloteDetalle,
} from '../services/lotesService';
import { HEAVY_API_TIMEOUT_MS } from '../services/apiService';
import { verificarPasswordFinanciero } from '../services/financialAccessService';
import { AppFeedbackMessage } from '../components/AppFeedbackMessage';
import granitoInteligente from '../assets/granito-inteligente.png';
import {
  BUSINESS_MIN_DATE_VALUE,
  formatDateLabel,
  getTodayLocalDateValue,
} from '../utils/date';
import { sanitizeSearchInput } from '../utils/inputLimits';
import {
  dangerButtonClass,
  fieldInputClass,
  fieldLabelClass,
  fieldTextareaClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../styles/uiClasses';

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

function formatPercentRounded(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
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

function getLocalDateValueFromRecord(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return formatLocalDateValue(parsed);
}

async function cargarMovimientosHistoricos(): Promise<{
  movimientos: MovimientoFinanciero[];
  sectionErrors: HistorialSectionStatus;
}> {
  const [comprasResult, ventasResult, gastosResult] = await Promise.allSettled([
    listarCompras(),
    listarVentas(),
    listarGastos(),
  ]);

  const sectionErrors = emptyHistorialSectionStatus();

  const comprasMovimientos =
    comprasResult.status === 'fulfilled'
      ? comprasResult.value.map((compra): DashboardMovimiento => ({
          id: compra.id,
          tipo: 'COMPRA',
          nombre: compra.productorNombre ?? 'Productor sin registrar',
          kg: compra.sublotes.reduce(
            (total, sublote) => total + sublote.pesoInicial,
            0,
          ),
          valor: compra.totalCompra,
          fecha: compra.fecha,
        }))
      : [];
  if (comprasResult.status === 'rejected') {
    sectionErrors.compras = HISTORIAL_SECTION_ERROR;
  }

  const ventasMovimientos =
    ventasResult.status === 'fulfilled'
      ? ventasResult.value.registros.map((venta): DashboardMovimiento => ({
          id: venta.id,
          tipo: 'VENTA',
          nombre: venta.clienteNombre || 'Cliente general',
          kg: venta.totalKg,
          valor: venta.totalVenta,
          fecha: venta.fecha,
        }))
      : [];
  if (ventasResult.status === 'rejected') {
    sectionErrors.ventas = HISTORIAL_SECTION_ERROR;
  }

  const gastosMovimientos =
    gastosResult.status === 'fulfilled'
      ? gastosResult.value.map((gasto): MovimientoFinanciero => ({
          id: gasto.id,
          tipo: 'GASTO',
          nombre: gasto.conceptoGasto || gasto.tipoGasto,
          kg: gasto.sublotes.reduce(
            (total, sublote) => total + sublote.pesoActual,
            0,
          ),
          valor: gasto.montoGasto,
          fecha: gasto.fechaGasto,
          gasto,
        }))
      : [];
  if (gastosResult.status === 'rejected') {
    sectionErrors.gastos = HISTORIAL_SECTION_ERROR;
  }

  return {
    movimientos: [
      ...comprasMovimientos,
      ...ventasMovimientos,
      ...gastosMovimientos,
    ],
    sectionErrors,
  };
}

function formatChartDayLabel(value: Date) {
  return value.toLocaleDateString('es-CO', {
    day: 'numeric',
  });
}

function formatChartMonthName(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';

  const month = parsed.toLocaleDateString('es-CO', { month: 'long' });
  return month.charAt(0).toUpperCase() + month.slice(1);
}

function getChartMonthLabel(data: Array<{ key: string }>) {
  const months = Array.from(
    new Set(data.map((item) => formatChartMonthName(item.key)).filter(Boolean)),
  );

  return months.length > 0 ? `Mes: ${months.join(' / ')}` : '';
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
const WEEKDAYS_ES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
const HUMEDAD_MINIMA_IDEAL = 10;
const HUMEDAD_MAXIMA_IDEAL = 12;
const FACTOR_BASE_MERCADO = 94;
const FINANCIAL_ACCESS_SESSION_KEY = 'cafesmart:financial-access-granted';
const FINANCIAL_ACCESS_TTL_MS = 30 * 60 * 1000;

type PeriodoFinanciero = 'DIARIO' | 'SEMANAL';
type HistorialTipo = 'VENTA' | 'COMPRA' | 'GASTO';
type MovimientoFinanciero = DashboardMovimiento & {
  gasto?: GastoItem;
};
type HistorialSection = 'compras' | 'ventas' | 'gastos';
type HistorialSectionStatus = Record<HistorialSection, string | null>;
type GastoEditForm = {
  conceptoGasto: string;
  descripcion: string;
  montoGasto: string;
  fechaGasto: string;
  tipoGasto: GastoTipo;
  estadoPago: GastoEstadoPago;
};

const TIPOS_GASTO: GastoTipo[] = [
  'TRANSPORTE',
  'COMIDA',
  'SECADO',
  'CARGUE',
  'DESCARGUE',
  'OTROS',
];
const GASTO_MONTO_MAX = 20000000;
const HISTORIAL_SECTION_ERROR =
  'No pudimos cargar este historial. Intenta nuevamente.';

function emptyHistorialSectionStatus(): HistorialSectionStatus {
  return {
    compras: null,
    ventas: null,
    gastos: null,
  };
}

function saveFinancialAccessSession() {
  try {
    sessionStorage.setItem(
      FINANCIAL_ACCESS_SESSION_KEY,
      JSON.stringify({ expiresAt: Date.now() + FINANCIAL_ACCESS_TTL_MS }),
    );
  } catch {
    // El acceso sigue válido en memoria aunque sessionStorage no esté disponible.
  }
}

function hasValidFinancialAccessSession() {
  try {
    const raw = sessionStorage.getItem(FINANCIAL_ACCESS_SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { expiresAt?: number };
    if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
      sessionStorage.removeItem(FINANCIAL_ACCESS_SESSION_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
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
  const todayValue = getTodayLocalDateValue();
  const todaySelectable = isDateValueInRange(todayValue, min, max) ? todayValue : max;
  const maxDate = parseLocalDateValue(max) ?? new Date();
  const minDate = parseLocalDateValue(min) ?? new Date(2026, 0, 1);
  const visibleDate = selectedDate ?? parseLocalDateValue(todaySelectable) ?? maxDate;
  const [calendarView, setCalendarView] =
    useState<'days' | 'months' | 'years'>('days');
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(visibleDate.getFullYear(), visibleDate.getMonth(), 1),
  );

  React.useEffect(() => {
    if (open) {
      const nextDate = parseLocalDateValue(value) ?? parseLocalDateValue(todaySelectable) ?? maxDate;
      setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
      setCalendarView('days');
    }
  }, [max, open, todaySelectable, value]);

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
        {...(open
          ? ({ 'aria-expanded': 'true' } as const)
          : ({ 'aria-expanded': 'false' } as const))}
        onClick={onToggle}
        className={`flex min-h-[42px] w-full items-center justify-between gap-2 rounded-[12px] border bg-white px-3 text-left text-[0.72rem] font-black text-[#08256d] transition hover:border-[#9fb0d4] dark:bg-slate-900 dark:text-slate-100 ${
          open ? 'border-[#102d92] dark:border-blue-400' : 'border-[#dbe2f0] dark:border-slate-600'
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
          className="fixed left-1/2 top-1/2 z-[120] w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-[#d5deee] bg-white p-2 shadow-[0_24px_54px_rgba(15,23,42,0.24)] dark:border-slate-600 dark:bg-slate-900 dark:shadow-[0_24px_54px_rgba(0,0,0,0.46)] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:translate-x-0 sm:translate-y-0"
        >
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => setVisibleMonth(previousMonth)}
              aria-label="Mes anterior"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#102d92] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:text-slate-300 dark:text-blue-200 dark:hover:bg-slate-800 dark:disabled:text-slate-600"
            >
              <ArrowLeft size={17} />
            </button>
            <div className="flex min-w-0 items-center justify-center gap-1 rounded-full bg-[#f8faff] p-1 dark:bg-slate-800">
              <button
                type="button"
                {...ariaPressed(calendarView === 'months')}
                onClick={() => setCalendarView((current) => (current === 'months' ? 'days' : 'months'))}
                className={`rounded-full px-2.5 py-1 text-xs font-black transition ${calendarView === 'months' ? 'bg-[#102d92] text-white dark:bg-blue-700/40 dark:text-blue-100' : 'text-slate-900 hover:bg-[#eef4ff] dark:text-slate-100 dark:hover:bg-slate-700'}`}
              >
                {MONTHS_ES[visibleMonth.getMonth()]}
              </button>
              <button
                type="button"
                {...ariaPressed(calendarView === 'years')}
                onClick={() => setCalendarView((current) => (current === 'years' ? 'days' : 'years'))}
                className={`rounded-full px-2.5 py-1 text-xs font-black transition ${calendarView === 'years' ? 'bg-[#102d92] text-white dark:bg-blue-700/40 dark:text-blue-100' : 'text-slate-900 hover:bg-[#eef4ff] dark:text-slate-100 dark:hover:bg-slate-700'}`}
              >
                {visibleYear}
              </button>
            </div>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setVisibleMonth(nextMonth)}
              aria-label="Mes siguiente"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#102d92] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:text-slate-300 dark:text-blue-200 dark:hover:bg-slate-800 dark:disabled:text-slate-600"
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
                    className={`min-h-[36px] rounded-[12px] px-2 text-[0.7rem] font-black transition disabled:cursor-not-allowed disabled:text-slate-300 dark:disabled:text-slate-600 ${active ? 'bg-[#102d92] text-white dark:bg-blue-700/40 dark:text-blue-100' : 'text-slate-800 hover:bg-[#f4f7ff] dark:text-slate-100 dark:hover:bg-slate-800'}`}
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
                    className={`min-h-[36px] rounded-[12px] px-2 text-xs font-black transition ${active ? 'bg-[#102d92] text-white dark:bg-blue-700/40 dark:text-blue-100' : 'text-slate-800 hover:bg-[#f4f7ff] dark:text-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 px-1">
              {WEEKDAYS_ES.map((day) => (
                <span key={day} className="py-1.5 text-center text-[0.72rem] font-black text-slate-500 dark:text-slate-300">
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
                    className={`h-8 min-w-0 rounded-full text-xs font-black transition disabled:cursor-not-allowed disabled:text-slate-300 dark:disabled:text-slate-600 ${
                      day.value === value
                        ? 'bg-[#102d92] text-white shadow-[0_8px_18px_rgba(16,45,146,0.22)] dark:bg-blue-700/40 dark:text-blue-100'
                        : day.value === todaySelectable
                          ? 'bg-[#eef4ff] text-[#102d92] dark:bg-blue-500/20 dark:text-blue-100'
                          : 'text-slate-800 hover:bg-[#f4f7ff] dark:text-slate-100 dark:hover:bg-slate-800'
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

          <div className="mt-2 flex items-center justify-between border-t border-[#edf1f7] px-1 pt-2 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                onChange('');
                onClose();
              }}
              className="rounded-full px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(todaySelectable);
                onClose();
              }}
              className="rounded-full bg-[#eef4ff] px-3 py-2 text-xs font-black text-[#102d92] transition hover:bg-[#dfe8ff] dark:bg-blue-500/20 dark:text-blue-100"
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
  const sign = value < 0 ? '-' : '';
  if (abs >= 1000000)
    return `${sign}$${(abs / 1000000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}M`;
  if (abs >= 1000)
    return `${sign}$${(abs / 1000).toLocaleString('es-CO', { maximumFractionDigits: 0 })}K`;
  return `${sign}$${abs.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

function getMovimientoCopy(item: DashboardMovimiento) {
  if (item.tipo === 'VENTA') {
    return {
      title: 'Venta registrada',
      detail: item.kg > 0 ? `${formatKg(item.kg)} vendidos` : item.nombre,
      icon: ShoppingCart,
      tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
      amountTone: 'text-emerald-700 dark:text-emerald-200',
      sign: '+',
    };
  }

  if (item.tipo === 'COMPRA') {
    return {
      title: 'Compra registrada',
      detail: item.kg > 0 ? `${formatKg(item.kg)} comprados` : item.nombre,
      icon: PackageCheck,
      tone: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
      amountTone: 'text-blue-700 dark:text-blue-200',
      sign: '-',
    };
  }

  return {
    title: item.nombre || 'Gasto registrado',
    detail: 'Gasto operativo',
    icon: Receipt,
    tone: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200',
    amountTone: 'text-red-700 dark:text-red-200',
    sign: '',
  };
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function sanitizeMoneyInput(value: string) {
  return value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 10);
}

function toGastoEditForm(gasto: GastoItem): GastoEditForm {
  return {
    conceptoGasto: gasto.conceptoGasto,
    descripcion: gasto.descripcion ?? '',
    montoGasto: String(Math.round(gasto.montoGasto)),
    fechaGasto: gasto.fechaGasto.slice(0, 10),
    tipoGasto: gasto.tipoGasto as GastoTipo,
    estadoPago: gasto.estadoPago as GastoEstadoPago,
  };
}

type MermaAuditData = {
  totalKg: number;
  totalPercentage: number;
  totalValue: number;
  laboratoryAnalysis: LaboratoryAnalysis | null;
};

type LaboratorySublote = {
  id: string;
  codigo: string;
  tipoCafe: string;
  calidad: string;
  pesoDisponible: number;
  pesoInicial: number;
  humedad: number | null;
  factorRendimiento: number | null;
  precioCompraKg: number;
  fechaIngreso: string;
  estado: string;
};

type LaboratoryAnalysis = {
  sublotes: LaboratorySublote[];
  totalKgInventario: number;
  humedadPromedio: number | null;
  factorPromedio: number | null;
  totalDescuentoHumedad: number;
  totalDescuentoFactor: number;
  totalMerma: number;
  sublotesConHumedad: number;
  sublotesConFactor: number;
};

function roundOne(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function roundTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeLabNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function buildLaboratoryAnalysis(sublotes: SubloteDetalle[]): LaboratoryAnalysis {
  const labSublotes = sublotes
    .filter((sublote) => sublote.pesoActual > 0)
    .map((sublote): LaboratorySublote => ({
      id: sublote.id,
      codigo: sublote.codigo || sublote.etiqueta,
      tipoCafe: sublote.tipoCafe,
      calidad: sublote.calidad,
      pesoDisponible: sublote.pesoActual,
      pesoInicial: sublote.pesoInicial,
      humedad: normalizeLabNumber(sublote.humedad),
      factorRendimiento: normalizeLabNumber(sublote.factor),
      precioCompraKg: sublote.precioKg,
      fechaIngreso: sublote.fechaIngreso,
      estado: sublote.pesoActual > 0 ? 'disponible' : 'agotado',
    }));

  let totalKgInventario = 0;
  let pesoConHumedad = 0;
  let humedadPonderada = 0;
  let pesoConFactor = 0;
  let factorPonderado = 0;
  let totalDescuentoHumedad = 0;
  let totalDescuentoFactor = 0;

  for (const sublote of labSublotes) {
    totalKgInventario += sublote.pesoDisponible;

    if (sublote.humedad !== null) {
      pesoConHumedad += sublote.pesoDisponible;
      humedadPonderada += sublote.humedad * sublote.pesoDisponible;
      const excesoHumedad = Math.max(0, sublote.humedad - HUMEDAD_MAXIMA_IDEAL);
      totalDescuentoHumedad += sublote.pesoDisponible * (excesoHumedad / 100);
    }

    if (sublote.factorRendimiento !== null) {
      pesoConFactor += sublote.pesoDisponible;
      factorPonderado += sublote.factorRendimiento * sublote.pesoDisponible;
      const diferenciaFactor = Math.max(
        0,
        sublote.factorRendimiento - FACTOR_BASE_MERCADO,
      );
      totalDescuentoFactor += sublote.pesoDisponible * (diferenciaFactor / 100);
    }
  }

  return {
    sublotes: labSublotes,
    totalKgInventario: roundTwo(totalKgInventario),
    humedadPromedio:
      pesoConHumedad > 0 ? roundOne(humedadPonderada / pesoConHumedad) : null,
    factorPromedio:
      pesoConFactor > 0 ? roundOne(factorPonderado / pesoConFactor) : null,
    totalDescuentoHumedad: roundTwo(totalDescuentoHumedad),
    totalDescuentoFactor: roundTwo(totalDescuentoFactor),
    totalMerma: roundTwo(totalDescuentoHumedad + totalDescuentoFactor),
    sublotesConHumedad: labSublotes.filter((sublote) => sublote.humedad !== null).length,
    sublotesConFactor: labSublotes.filter((sublote) => sublote.factorRendimiento !== null).length,
  };
}

async function cargarAnalisisLaboratorio(): Promise<LaboratoryAnalysis> {
  const lotes = await obtenerLotes();
  const detallesResult = await Promise.allSettled(
    lotes
      .filter((lote) => lote.pesoActual > 0)
      .map((lote) =>
        obtenerDetalleLote(lote.tipoCafeId, lote.calidadId, {
          timeoutMs: HEAVY_API_TIMEOUT_MS,
        }),
      ),
  );
  const detalles = detallesResult
    .filter(
      (result): result is PromiseFulfilledResult<LoteDetalle> =>
        result.status === 'fulfilled',
    )
    .map((result) => result.value);
  const sublotes = detalles.flatMap((detalle) => detalle.sublotes);
  const analysis = buildLaboratoryAnalysis(sublotes);

  return analysis;
}

function getMermaAuditMetrics({ totalKg, totalPercentage, totalValue, laboratoryAnalysis }: MermaAuditData) {
  const humidityKg = laboratoryAnalysis?.totalDescuentoHumedad ?? 0;
  const factorKg = laboratoryAnalysis?.totalDescuentoFactor ?? 0;
  const lotKg = laboratoryAnalysis?.totalKgInventario ?? 0;
  const roundedTotalPercentage = Math.round(totalPercentage);
  const humidityPercentage =
    lotKg > 0 ? Math.round((humidityKg / lotKg) * 100) : 0;
  const factorPercentage =
    lotKg > 0 ? Math.round((factorKg / lotKg) * 100) : 0;

  return {
    totalKg,
    totalPercentage,
    totalValue,
    humidityKg,
    factorKg,
    lotKg,
    roundedTotalPercentage,
    humidityPercentage,
    factorPercentage,
  };
}

type MermaAuditSummaryCardProps = {
  data: MermaAuditData;
  onClose: () => void;
  onOpenLaboratory: () => void;
};

function MermaAuditSummaryCard({
  data,
  onClose,
  onOpenLaboratory,
}: MermaAuditSummaryCardProps) {
  const metrics = getMermaAuditMetrics(data);
  const hasLaboratoryData = Boolean(
    data.laboratoryAnalysis &&
      (data.laboratoryAnalysis.sublotesConHumedad > 0 ||
        data.laboratoryAnalysis.sublotesConFactor > 0),
  );
  const hasHumidity = Boolean(data.laboratoryAnalysis?.sublotesConHumedad);
  const hasFactor = Boolean(data.laboratoryAnalysis?.sublotesConFactor);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="merma-audit-title"
      className="max-h-[92dvh] w-full max-w-[430px] overflow-y-auto rounded-[24px] border border-amber-100 bg-white p-4 text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-700 dark:text-amber-200">
            Revisión de merma
          </p>
          <h2 id="merma-audit-title" className="mt-1 text-lg font-black text-slate-950 dark:text-slate-100">
            Resumen de pérdidas del lote
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          aria-label="Cerrar revisión de merma"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 rounded-[18px] border border-amber-300 bg-amber-50 px-3 py-3 dark:border-amber-400/60 dark:bg-amber-500/15">
        <span className="inline-flex rounded-full bg-amber-200 px-2.5 py-1 text-[0.62rem] font-black text-amber-900 dark:bg-amber-400/20 dark:text-amber-200">
          Advertencia
        </span>
        <p className="mt-3 text-sm font-bold leading-6 text-amber-950 dark:text-amber-100">
          El lote presenta una pérdida total del {formatPercent(data.totalPercentage)} debido a calidad subestándar del grano.
        </p>
      </div>

      <section className="mt-4 border-y border-slate-200 py-4 dark:border-slate-700">
        <div className="grid grid-cols-[120px_1fr] items-center gap-4 max-[360px]:grid-cols-1">
          <MermaDonutChart
            humidityKg={metrics.humidityKg}
            factorKg={metrics.factorKg}
          />
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#3B82F6]" />
              <div>
                <p className="text-sm font-black text-slate-950 dark:text-slate-100">
                  Humedad: -{formatKg(metrics.humidityKg)}
                </p>
                <p className="mt-1 text-[0.7rem] font-semibold leading-5 text-slate-500 dark:text-slate-300">
                  {hasHumidity
                    ? `Calculado con humedad real (${metrics.humidityPercentage}% del inventario disponible).`
                    : 'Sin humedad registrada en sublotes disponibles.'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#111827] dark:bg-slate-200" />
              <div>
                <p className="text-sm font-black text-slate-950 dark:text-slate-100">
                  Factor: -{formatKg(metrics.factorKg)}
                </p>
                <p className="mt-1 text-[0.7rem] font-semibold leading-5 text-slate-500 dark:text-slate-300">
                  {hasFactor
                    ? `Calculado con factor real (${metrics.factorPercentage}% del inventario disponible).`
                    : 'Sin factor registrado en sublotes disponibles.'}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-start justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.08em] text-slate-700 dark:text-slate-300">
            Total kilos descontados
          </p>
          <p className="text-right text-sm font-black text-slate-950 dark:text-slate-100">
            - {formatKg(hasLaboratoryData ? metrics.humidityKg + metrics.factorKg : metrics.totalKg)}
            {' '}
            ({hasLaboratoryData ? formatPercentRounded(metrics.humidityPercentage + metrics.factorPercentage) : formatPercentRounded(metrics.roundedTotalPercentage)} del inventario)
          </p>
        </div>
      </section>

      <article className="border-b border-slate-200 py-4 dark:border-slate-700">
        <p className="text-[0.66rem] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-300">
          Impacto financiero
        </p>
        <p className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-100">
          {formatCurrencyTight(data.totalValue)}
        </p>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
          (Descuento total aplicado debido a los parámetros de calidad)
        </p>
      </article>

      <div className="pt-4">
        <button
          type="button"
          onClick={onOpenLaboratory}
          className="inline-flex min-h-[46px] w-full items-center justify-center rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          🔍 Ver análisis de laboratorio
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 inline-flex min-h-[46px] w-full items-center justify-center rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white"
        >
          Confirmar liquidación y continuar
        </button>
      </div>
    </section>
  );
}

type MermaLaboratoryViewProps = {
  data: MermaAuditData;
  onBack: () => void;
  onClose: () => void;
};

function MermaLaboratoryView({ data, onBack, onClose }: MermaLaboratoryViewProps) {
  const metrics = getMermaAuditMetrics(data);
  const analysis = data.laboratoryAnalysis;
  const hasHumidity = Boolean(analysis && analysis.sublotesConHumedad > 0);
  const hasFactor = Boolean(analysis && analysis.sublotesConFactor > 0);
  const hasLaboratoryData = hasHumidity || hasFactor;
  const humidityState =
    analysis?.humedadPromedio === null || analysis?.humedadPromedio === undefined
      ? 'Sin dato registrado'
      : analysis.humedadPromedio > HUMEDAD_MAXIMA_IDEAL
        ? 'Alta'
        : analysis.humedadPromedio < HUMEDAD_MINIMA_IDEAL
          ? 'Baja'
          : 'Óptima';
  const factorState =
    analysis?.factorPromedio === null || analysis?.factorPromedio === undefined
      ? 'Sin dato registrado'
      : analysis.factorPromedio > FACTOR_BASE_MERCADO
        ? 'Por encima de la base'
        : 'Dentro del rango esperado';

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="merma-lab-title"
      className="flex max-h-[94dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <header className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-700">
        <button
          type="button"
          onClick={onBack}
          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          aria-label="Volver al resumen de merma"
        >
          <ArrowLeft size={17} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xl leading-none" aria-hidden="true">
            🔬
          </p>
          <h2 id="merma-lab-title" className="mt-2 text-base font-black uppercase tracking-[0.08em] text-slate-950 dark:text-slate-100">
            Análisis de laboratorio
          </h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">
            Valores calculados con base en el inventario disponible
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          aria-label="Cerrar análisis de laboratorio"
        >
          <X size={16} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {!hasLaboratoryData ? (
          <article className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-4 text-center dark:border-slate-600 dark:bg-slate-800">
            <h3 className="text-sm font-black text-slate-950 dark:text-slate-100">
              Aún no hay datos de laboratorio suficientes.
            </h3>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">
              Registra humedad y factor de rendimiento en los sublotes para generar este análisis.
            </p>
          </article>
        ) : null}

        {hasHumidity ? (
          <article className="rounded-[20px] border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-400/60 dark:bg-blue-500/15">
            <h3 className="text-sm font-black uppercase tracking-[0.04em] text-slate-950 dark:text-slate-100">
              Humedad promedio: {formatPercent(analysis?.humedadPromedio ?? 0)}
            </h3>
            <div className="mt-3 space-y-2 text-xs font-bold leading-5 text-slate-700 dark:text-slate-200">
              <p>Estado: {humidityState}</p>
              <p>
                Rango ideal: {formatPercent(HUMEDAD_MINIMA_IDEAL)} a {formatPercent(HUMEDAD_MAXIMA_IDEAL)}
              </p>
              <p>
                Resultado comercial: Se estiman {formatKg(metrics.humidityKg)} por exceso de humedad.
              </p>
            </div>
            <p className="mt-4 rounded-[16px] bg-blue-100/70 px-3 py-3 text-xs font-semibold italic leading-5 text-blue-950 dark:bg-blue-400/15 dark:text-blue-100">
              Cálculo ponderado sobre {formatKg(analysis?.totalKgInventario ?? 0)} disponibles con datos reales de inventario.
            </p>
          </article>
        ) : null}

        {hasHumidity && hasFactor ? <div className="h-px bg-slate-200 dark:bg-slate-700" /> : null}

        {hasFactor ? (
          <article className="rounded-[20px] border border-stone-200 bg-stone-50 p-4 dark:border-slate-600 dark:bg-slate-800">
            <h3 className="text-sm font-black uppercase tracking-[0.04em] text-slate-950 dark:text-slate-100">
              Factor promedio: {analysis?.factorPromedio ?? 0}
            </h3>
            <div className="mt-3 space-y-2 text-xs font-bold leading-5 text-slate-700 dark:text-slate-200">
              <p>Estado: {factorState}</p>
              <p>Base del mercado: {FACTOR_BASE_MERCADO}</p>
              <p>
                Resultado comercial: Se estiman {formatKg(metrics.factorKg)} por rendimiento fuera de base.
              </p>
            </div>
            <p className="mt-4 rounded-[16px] bg-stone-200/60 px-3 py-3 text-xs font-semibold italic leading-5 text-stone-900 dark:bg-slate-700 dark:text-slate-100">
              Factor calculado con promedio ponderado por kilos disponibles en sublotes activos.
            </p>
          </article>
        ) : null}

        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[46px] w-full items-center justify-center rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white"
        >
          Volver al resumen
        </button>
      </div>
    </section>
  );
}

export default function ResumenFinanciero() {
  const navigate = useNavigate();
  const location = useLocation();
  const financialAccessGranted =
    (location.state as { financialAccessGranted?: boolean } | null)
      ?.financialAccessGranted === true;
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authorized, setAuthorized] = useState(
    () => financialAccessGranted || hasValidFinancialAccessSession(),
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoFinanciero>('DIARIO');
  const [historialCompleto, setHistorialCompleto] = useState<MovimientoFinanciero[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialError, setHistorialError] = useState<string | null>(null);
  const [historialSectionErrors, setHistorialSectionErrors] =
    useState<HistorialSectionStatus>(() => emptyHistorialSectionStatus());
  const [historialActivo, setHistorialActivo] = useState<HistorialTipo | null>(null);
  const [historialSearch, setHistorialSearch] = useState('');
  const [historialDate, setHistorialDate] = useState('');
  const [historialDateOpen, setHistorialDateOpen] = useState(false);
  const [historialTipo, setHistorialTipo] = useState('TODOS');
  const [historialEstado, setHistorialEstado] = useState<GastoEstadoPago | 'TODOS'>('TODOS');
  const [historialSort, setHistorialSort] = useState<'recent' | 'oldest' | 'amount-desc' | 'amount-asc' | 'date'>('recent');
  const [historialVisibleCount, setHistorialVisibleCount] = useState(30);
  const [historialActionMessage, setHistorialActionMessage] = useState<string | null>(null);
  const [historialFilterFeedback, setHistorialFilterFeedback] = useState<string | null>(null);
  const [gastoEditando, setGastoEditando] = useState<GastoItem | null>(null);
  const [gastoEditForm, setGastoEditForm] = useState<GastoEditForm | null>(null);
  const [gastoEditError, setGastoEditError] = useState<string | null>(null);
  const [gastoEditFechaOpen, setGastoEditFechaOpen] = useState(false);
  const [guardandoGasto, setGuardandoGasto] = useState(false);
  const [gastoAEliminar, setGastoAEliminar] = useState<GastoItem | null>(null);
  const [eliminandoGastoId, setEliminandoGastoId] = useState<string | null>(null);
  const [financialSectionsOpen, setFinancialSectionsOpen] = useState({
    trend: false,
    movements: false,
    histories: false,
  });
  const [showMermaAudit, setShowMermaAudit] = useState(false);
  const [mermaAuditView, setMermaAuditView] = useState<'summary' | 'laboratory'>('summary');
  const [laboratoryAnalysis, setLaboratoryAnalysis] =
    useState<LaboratoryAnalysis | null>(null);

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
      const [summaryResult, historialResult, laboratoryResult] = await Promise.allSettled([
        obtenerDashboardSummary(),
        cargarMovimientosHistoricos(),
        cargarAnalisisLaboratorio(),
      ]);

      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value);
      } else {
        setSummary(null);
        setError('No pudimos cargar el resumen financiero. Intenta nuevamente.');
      }

      if (historialResult.status === 'fulfilled') {
        setHistorialCompleto(historialResult.value.movimientos);
        setHistorialSectionErrors(historialResult.value.sectionErrors);
        setHistorialError(null);
      } else {
        setHistorialCompleto([]);
        setHistorialSectionErrors({
          compras: HISTORIAL_SECTION_ERROR,
          ventas: HISTORIAL_SECTION_ERROR,
          gastos: HISTORIAL_SECTION_ERROR,
        });
        setHistorialError(HISTORIAL_SECTION_ERROR);
      }

      setLaboratoryAnalysis(
        laboratoryResult.status === 'fulfilled' ? laboratoryResult.value : null,
      );

      if (isRefresh) {
        setRefreshFeedback(
          summaryResult.status === 'fulfilled' &&
            historialResult.status === 'fulfilled' &&
            laboratoryResult.status === 'fulfilled'
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

  useEffect(() => {
    if (!authorized || summary || loading || refreshing || historialLoading) return;
    void cargar();
  }, [authorized, cargar, historialLoading, loading, refreshing, summary]);

  useEffect(() => {
    const state = location.state as {
      openHistorial?: HistorialTipo;
      financialAccessGranted?: boolean;
    } | null;
    if (!authorized || !state?.openHistorial) return;
    setFinancialSectionsOpen((current) => ({ ...current, histories: true }));
    abrirHistorial(state.openHistorial);
    navigate(location.pathname, {
      replace: true,
      state: financialAccessGranted ? { financialAccessGranted: true } : null,
    });
  }, [authorized, financialAccessGranted, location.pathname, location.state, navigate]);

  const handleUnlock = async () => {
    if (!password.trim()) {
      setError('Escribe la contraseña del administrador.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await verificarPasswordFinanciero(password);
      saveFinancialAccessSession();
      setAuthorized(true);
      setPassword('');
      await cargar();
    } catch (err) {
      setError('No pudimos validar la contraseña. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeBusiness = () => {
    saveFinancialAccessSession();
    navigate('/resumen-financiero/analisis-inteligente', {
      state: { financialAccessGranted: true },
    });
  };

  const handleRetryAccess = () => {
    void handleUnlock();
  };

  const handleBackAccess = () => {
    navigate(-1);
  };

  const movimientos = useMemo(() => {
    const seen = new Set<string>();

    const base =
      historialCompleto.length > 0
        ? historialCompleto
        : ((summary?.movimientosRecientes ?? []) as MovimientoFinanciero[]);

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
  const movimientosDelPeriodo = useMemo(() => {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    if (periodo === 'SEMANAL') {
      inicio.setDate(inicio.getDate() - 6);
    }

    const fin = new Date();
    fin.setHours(23, 59, 59, 999);

    return movimientos.filter((item) => {
      const fecha = new Date(item.fecha);
      if (Number.isNaN(fecha.getTime())) return false;
      return fecha >= inicio && fecha <= fin;
    });
  }, [movimientos, periodo]);
  const totalesPeriodo = useMemo(
    () =>
      movimientosDelPeriodo.reduce(
        (totales, item) => {
          if (item.tipo === 'VENTA') totales.ventas += item.valor;
          if (item.tipo === 'COMPRA') totales.compras += item.valor;
          if (item.tipo === 'GASTO') totales.gastos += item.valor;
          return totales;
        },
        { ventas: 0, compras: 0, gastos: 0 },
      ),
    [movimientosDelPeriodo],
  );
  const movimientosRecientes = useMemo(
    () => movimientosDelPeriodo.slice(0, 3),
    [movimientosDelPeriodo],
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
        if (historialSort !== 'date' || !historialDate) return true;
        return getLocalDateValueFromRecord(item.fecha) === historialDate;
      })
      .filter((item) => {
        if (historialTipo === 'TODOS') return true;
        if (historialActivo === 'GASTO') {
          return item.gasto?.tipoGasto === historialTipo;
        }
        return item.nombre === historialTipo;
      })
      .filter((item) => {
        if (historialActivo !== 'GASTO' || historialEstado === 'TODOS') return true;
        return item.gasto?.estadoPago === historialEstado;
      })
      .sort((a, b) => {
        if (historialSort === 'oldest') {
          return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
        }
        if (historialSort === 'amount-desc') return b.valor - a.valor;
        if (historialSort === 'amount-asc') return a.valor - b.valor;
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      });
  }, [historialActivo, historialDate, historialEstado, historialSearch, historialSort, historialTipo, movimientos]);
  const historialTipos = useMemo(
    () =>
      historialActivo === 'GASTO'
        ? ['TODOS', ...TIPOS_GASTO]
        : [
            'TODOS',
            ...Array.from(new Set(historialMovimientos.map((item) => item.nombre).filter(Boolean))),
          ],
    [historialActivo, historialMovimientos],
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
    (historialSort === 'date' && Boolean(historialDate)) ||
    historialTipo !== 'TODOS' ||
    historialEstado !== 'TODOS' ||
    historialSort !== 'recent';
  const getHistorialSectionKey = (
    tipo: HistorialTipo | null,
  ): HistorialSection | null => {
    if (tipo === 'COMPRA') return 'compras';
    if (tipo === 'VENTA') return 'ventas';
    if (tipo === 'GASTO') return 'gastos';
    return null;
  };
  const historialActivoError =
    historialSectionErrors[getHistorialSectionKey(historialActivo) ?? 'compras'];
  const abrirHistorial = (tipo: HistorialTipo) => {
    setHistorialActivo(tipo);
    setHistorialSearch('');
    setHistorialDate('');
    setHistorialTipo('TODOS');
    setHistorialEstado('TODOS');
    setHistorialDate('');
    setHistorialDateOpen(false);
    setHistorialSort('recent');
    setHistorialVisibleCount(30);
    setHistorialFilterFeedback(null);
  };
  const recargarHistorial = () => {
    setRefreshFeedback('Actualizando información...');
    void cargar(true);
  };
  const limpiarFiltrosHistorial = () => {
    if (!historialFiltrosActivos) return;
    setHistorialSearch('');
    setHistorialDate('');
    setHistorialDateOpen(false);
    setHistorialTipo('TODOS');
    setHistorialEstado('TODOS');
    setHistorialSort('recent');
    setHistorialVisibleCount(30);
    setHistorialFilterFeedback('Filtros limpiados.');
  };
  const abrirEditarGastoHistorial = (gasto: GastoItem) => {
    setGastoEditando(gasto);
    setGastoEditForm(toGastoEditForm(gasto));
    setGastoEditError(null);
    setGastoEditFechaOpen(false);
  };
  const validarGastoEditado = () => {
    if (!gastoEditForm) return 'Corrige los campos marcados para guardar.';
    const concepto = gastoEditForm.conceptoGasto.trim();
    const monto = Number(gastoEditForm.montoGasto);
    if (!concepto || concepto.length < 4) return 'El concepto debe tener al menos 4 caracteres.';
    if (!gastoEditForm.fechaGasto) return 'Selecciona la fecha del gasto.';
    if (!Number.isFinite(monto) || monto <= 0) return 'El monto debe ser mayor a $0.';
    if (monto > GASTO_MONTO_MAX) return 'El monto máximo permitido es $20.000.000.';
    return null;
  };
  const guardarGastoEditado = async () => {
    if (!gastoEditando || !gastoEditForm || guardandoGasto) return;
    const mensaje = validarGastoEditado();
    if (mensaje) {
      setGastoEditError(mensaje);
      return;
    }
    setGuardandoGasto(true);
    setGastoEditError(null);
    try {
      const actualizado = await actualizarGasto(gastoEditando.id, {
        conceptoGasto: gastoEditForm.conceptoGasto.trim(),
        descripcion: gastoEditForm.descripcion.trim(),
        montoGasto: Number(gastoEditForm.montoGasto),
        fechaGasto: new Date(`${gastoEditForm.fechaGasto}T12:00:00`).toISOString(),
        tipoGasto: gastoEditForm.tipoGasto,
        estadoPago: gastoEditForm.estadoPago,
      });
      setHistorialCompleto((current) =>
        current.map((item) =>
          item.tipo === 'GASTO' && item.id === actualizado.id
            ? {
                ...item,
                nombre: actualizado.conceptoGasto || actualizado.tipoGasto,
                valor: actualizado.montoGasto,
                fecha: actualizado.fechaGasto,
                kg: actualizado.sublotes.reduce(
                  (total, sublote) => total + sublote.pesoActual,
                  0,
                ),
                gasto: actualizado,
              }
            : item,
        ),
      );
      setGastoEditando(null);
      setGastoEditForm(null);
      setGastoEditFechaOpen(false);
      setHistorialActionMessage('Gasto actualizado correctamente.');
    } catch {
      setGastoEditError('No pudimos actualizar el gasto. Intenta nuevamente.');
    } finally {
      setGuardandoGasto(false);
    }
  };
  const confirmarEliminarGastoHistorial = async () => {
    if (!gastoAEliminar || eliminandoGastoId) return;
    setEliminandoGastoId(gastoAEliminar.id);
    setHistorialError(null);
    try {
      await eliminarGasto(gastoAEliminar.id);
      setHistorialCompleto((current) =>
        current.filter(
          (item) => !(item.tipo === 'GASTO' && item.id === gastoAEliminar.id),
        ),
      );
      setGastoAEliminar(null);
      setHistorialActionMessage('Gasto eliminado correctamente.');
    } catch {
      setHistorialError('No pudimos eliminar el gasto. Intenta nuevamente.');
    } finally {
      setEliminandoGastoId(null);
    }
  };
  useEffect(() => {
    setHistorialVisibleCount(30);
  }, [historialActivo, historialDate, historialEstado, historialSearch, historialSort, historialTipo]);
  useEffect(() => {
    if (historialSort !== 'date') {
      setHistorialDate('');
      setHistorialDateOpen(false);
    }
  }, [historialSort]);
  const toggleFinancialSection = (section: keyof typeof financialSectionsOpen) => {
    setFinancialSectionsOpen((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };
  const closeMermaAudit = () => {
    setShowMermaAudit(false);
    setMermaAuditView('summary');
  };

  const ventasTotal =
    periodo === 'DIARIO' ? (summary?.totalVentasHoy ?? totalesPeriodo.ventas) : totalesPeriodo.ventas;
  const gastosTotal =
    periodo === 'DIARIO' ? (summary?.totalGastosHoy ?? totalesPeriodo.gastos) : totalesPeriodo.gastos;
  const comprasTotal =
    periodo === 'DIARIO' ? (summary?.totalComprasHoy ?? totalesPeriodo.compras) : totalesPeriodo.compras;
  const utilidad = ventasTotal - comprasTotal - gastosTotal;
  const periodoLabel = periodo === 'DIARIO' ? 'del día' : 'de los últimos 7 días';
  const mermaTotalKg = summary?.mermaTotalKg ?? 0;
  const mermaTotalPorcentaje = summary?.mermaTotalPorcentaje ?? 0;
  const mermaTotalValor = summary?.mermaTotalValor ?? 0;
  const hasData =
    utilidad !== 0 ||
    ventasTotal > 0 ||
    comprasTotal > 0 ||
    gastosTotal > 0 ||
    mermaTotalKg > 0 ||
    movimientosDelPeriodo.length > 0;
  const periodoActual = new Date().toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const trend = useMemo(() => {
    const byDay = new Map<
      string,
      { fecha: string; ventas: number; compras: number; gastos: number; utilidad: number }
    >();

    for (const movimiento of movimientos) {
      const fecha = getLocalDateValueFromRecord(movimiento.fecha);
      if (!fecha) continue;
      const current = byDay.get(fecha) ?? {
        fecha,
        ventas: 0,
        compras: 0,
        gastos: 0,
        utilidad: 0,
      };

      if (movimiento.tipo === 'VENTA') current.ventas += movimiento.valor;
      if (movimiento.tipo === 'COMPRA') current.compras += movimiento.valor;
      if (movimiento.tipo === 'GASTO') current.gastos += movimiento.valor;
      current.utilidad = current.ventas - current.compras - current.gastos;
      byDay.set(fecha, current);
    }

    const buckets = [...byDay.values()]
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
      .slice(-7)
      .map((item) => {
        const date = new Date(`${item.fecha}T12:00:00`);
        return {
          key: item.fecha,
          label: formatChartDayLabel(date),
          time: date.getTime(),
          value: item.utilidad,
          displayValue: formatCurrencyShort(item.utilidad),
          ventas: item.ventas,
          compras: item.compras,
          gastos: item.gastos,
        };
      });

    if (buckets.length === 0) {
      return {
        points: [],
        polyline: '',
        zeroY: 0,
        yLabels: [],
        yAxisTitle: 'Utilidad (COP)',
        monthLabel: '',
        hasEnoughData: false,
      };
    }

    const values = buckets.map((bucket) => bucket.value);
    const rawMin = Math.min(0, ...values);
    const rawMax = Math.max(0, ...values);
    const padding = Math.max(100000, (rawMax - rawMin) * 0.22);
    const min = rawMin - padding;
    const max = rawMax + padding;
    const range = Math.max(1, max - min);
    const chart = { left: 72, top: 36, width: 292, height: 150 };
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
      yAxisTitle: 'Utilidad (COP)',
      monthLabel: getChartMonthLabel(points),
      hasEnoughData: true,
    };
  }, [movimientos]);
  const trendSummary = useMemo(() => {
    if (trend.points.length === 0) {
      return 'No hay suficientes movimientos para mostrar la tendencia.';
    }
    const highest = trend.points.reduce((best, point) =>
      point.value > best.value ? point : best,
    );
    return `La gráfica muestra la utilidad registrada durante los últimos 7 días. La utilidad más alta fue ${formatCurrency(highest.value)} el día ${formatLongDateLabel(highest.key)}.`;
  }, [trend.points]);

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
    <div className="cs-workflow-page min-h-screen bg-[#f7f9fc] px-4 py-4 pb-24 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto w-full max-w-[430px] py-2">
        <header className="grid min-h-[54px] grid-cols-[44px_1fr_auto] items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-900 transition hover:bg-white dark:text-slate-100 dark:hover:bg-slate-900"
            aria-label="Volver"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-center text-[1.05rem] font-black text-slate-900 dark:text-slate-100">
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
          <section className="mt-6 rounded-[16px] border border-[#dbe2ee] bg-white px-4 py-5 text-center shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-slate-600 dark:bg-slate-900">
            <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-200">
              <Lock size={18} />
            </span>
            <h2 className="mt-3 text-[1rem] font-black text-slate-900 dark:text-slate-100">
              Acceso financiero
            </h2>
            <p className="mt-2 text-[0.66rem] font-semibold leading-5 text-slate-500 dark:text-slate-300">
              Ingresa la contraseña del administrador para ver utilidad, merma y
              análisis.
            </p>
            <div className="relative mt-4">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleUnlock();
                  }
                }}
                className={`${fieldInputClass} pr-11`}
                placeholder="Contraseña"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-[8px] text-slate-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-700/20 dark:text-slate-300"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => void handleUnlock()}
              disabled={loading}
              className={`${primaryButtonClass} mt-3 text-[0.7rem]`}
            >
              {loading ? 'Validando...' : 'Ver resumen financiero'}
            </button>
          </section>
        ) : (
          <>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[0.72rem] font-black uppercase tracking-[0.12em] text-blue-700 dark:text-blue-200">
                  Dashboard
                </p>
                <h2 className="mt-1 text-[1.85rem] font-black leading-none text-slate-900 dark:text-slate-100">
                  Finanzas
                </h2>
              </div>
              <div className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] border border-[#dfe6f2] bg-white px-3 text-[0.72rem] font-bold capitalize text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                <CalendarDays size={15} className="text-blue-700 dark:text-blue-200" />
                {periodoActual}
              </div>
            </div>

            <div
              className="mt-4 grid grid-cols-2 gap-2 rounded-[14px] border border-[#dfe6f2] bg-white p-1 shadow-sm dark:border-slate-600 dark:bg-slate-900"
              role="tablist"
              aria-label="Periodo financiero"
            >
              {[
                ['DIARIO', 'Diario'],
                ['SEMANAL', 'Semanal'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={periodo === value}
                  onClick={() => setPeriodo(value as PeriodoFinanciero)}
                  className={`min-h-[38px] rounded-[11px] px-3 text-[0.68rem] font-black transition ${
                    periodo === value
                      ? 'bg-[#102d92] text-white shadow-[0_8px_18px_rgba(16,45,146,0.2)]'
                      : 'text-slate-600 hover:bg-[#f1f5fb] dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <section className="mt-5 overflow-hidden rounded-[16px] bg-[#0959d8] px-4 py-5 text-white shadow-[0_16px_34px_rgba(9,89,216,0.24)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.08em] text-white/80">
                    {periodo === 'DIARIO'
                      ? 'Utilidad estimada del día'
                      : 'Utilidad estimada de los últimos 7 días'}
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
                  Ventas menos compras y gastos {periodoLabel}.
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

            <section className="mt-4 rounded-[16px] border border-emerald-100 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] dark:border-slate-600 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-blue-100 bg-blue-50 dark:border-blue-400/30 dark:bg-blue-500/15">
                      <img
                        src={granitoInteligente}
                        alt="Asistente inteligente de CaféSmart"
                        className="h-8 w-8 object-contain"
                        draggable={false}
                      />
                    </span>
                    <div>
                      <p className="text-[0.82rem] font-black text-slate-900 dark:text-slate-100">
                        Análisis inteligente
                      </p>
                      <p className="text-[0.62rem] font-semibold leading-4 text-slate-500 dark:text-slate-300">
                        Recibe una explicación clara sobre tus resultados, inventario y movimientos recientes.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAnalyzeBusiness}
                  className="inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-[10px] bg-emerald-700 px-3 text-[0.62rem] font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Analizar
                </button>
              </div>
            </section>

            <section className="mt-4 grid grid-cols-3 gap-3">
              <article className="rounded-[14px] border border-emerald-100 bg-white px-3 py-4 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)] dark:border-slate-600 dark:bg-slate-900">
                <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                  <ShoppingCart size={18} />
                </span>
                <p className="mt-3 text-[0.62rem] font-black uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-200">
                  Ventas
                </p>
                <p className="mt-2 text-[0.9rem] font-black text-slate-900 dark:text-slate-100">
                  {loading ? '...' : formatCurrency(ventasTotal)}
                </p>
              </article>
              <article className="rounded-[14px] border border-blue-100 bg-white px-3 py-4 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)] dark:border-slate-600 dark:bg-slate-900">
                <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
                  <PackageCheck size={18} />
                </span>
                <p className="mt-3 text-[0.62rem] font-black uppercase tracking-[0.08em] text-blue-700 dark:text-blue-200">
                  Compras
                </p>
                <p className="mt-2 text-[0.9rem] font-black text-slate-900 dark:text-slate-100">
                  {loading ? '...' : formatCurrency(comprasTotal)}
                </p>
              </article>
              <article className="rounded-[14px] border border-red-100 bg-white px-3 py-4 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)] dark:border-slate-600 dark:bg-slate-900">
                <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200">
                  <Wallet size={18} />
                </span>
                <p className="mt-3 text-[0.62rem] font-black uppercase tracking-[0.08em] text-red-700 dark:text-red-200">
                  Gastos
                </p>
                <p className="mt-2 text-[0.9rem] font-black text-slate-900 dark:text-slate-100">
                  {loading ? '...' : formatCurrency(gastosTotal)}
                </p>
              </article>
            </section>

            <section className="mt-4 rounded-[16px] border border-amber-100 bg-[#fff8e7] px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] dark:border-amber-400/30 dark:bg-amber-500/15">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                    <Scale size={22} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-amber-700 dark:text-amber-200">
                      Merma total
                    </p>
                    <p className="mt-1 text-[1.45rem] font-black text-amber-900 dark:text-amber-100">
                      {loading ? '...' : formatKg(mermaTotalKg)}
                    </p>
                    <p className="mt-1 text-[0.62rem] font-semibold leading-4 text-amber-800/75 dark:text-amber-100">
                      {loading
                        ? 'Calculando impacto.'
                        : `${formatPercent(mermaTotalPorcentaje)} del peso comprado. Valor: ${formatCurrency(mermaTotalValor)}.`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMermaAuditView('summary');
                    setShowMermaAudit(true);
                  }}
                  disabled={mermaTotalKg <= 0}
                  className="rounded-full bg-white/90 px-3 py-1.5 text-[0.58rem] font-black text-amber-700 shadow-sm transition hover:bg-white disabled:opacity-60"
                >
                  {mermaTotalKg > 0 ? 'Revisar' : 'OK'}
                </button>
              </div>
            </section>

            {periodo === 'SEMANAL' ? (
            <section className="mt-4 rounded-[16px] border border-[#e5eaf3] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] dark:border-slate-600 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => toggleFinancialSection('trend')}
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <LineChart size={15} className="text-blue-700 dark:text-blue-200" />
                  <div>
                    <p className="text-[0.82rem] font-black text-slate-900 dark:text-slate-100">
                      Tendencia del balance
                    </p>
                    <p className="text-[0.62rem] font-semibold text-slate-500 dark:text-slate-300">
                      Días con movimiento
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
                  <h3 className="text-[0.86rem] font-black text-slate-950 dark:text-slate-100">
                    Movimiento de registro durante la última semana
                  </h3>
                  <p className="mt-0.5 text-[0.66rem] font-semibold text-slate-500 dark:text-slate-300">
                    Ventas menos compras y gastos por día con movimiento
                  </p>
                </div>
                <p className="sr-only">{trendSummary}</p>
                <svg
                  viewBox="0 0 390 230"
                  className="h-[240px] w-full overflow-visible"
                  role="img"
                  aria-label="Gráfica de tendencia de utilidad de la última semana"
                >
                  <text
                    x="0"
                    y="14"
                    className="fill-slate-900 dark:fill-slate-100"
                    fontSize="11"
                    fontWeight="800"
                  >
                    {trend.yAxisTitle}
                  </text>
                  <text
                    x="218"
                    y="222"
                    textAnchor="middle"
                    className="fill-slate-600 dark:fill-slate-300"
                    fontSize="11"
                    fontWeight="800"
                  >
                    {trend.monthLabel}
                  </text>
                  {trend.yLabels.map((tick) => (
                    <g key={tick.label}>
                      <text
                        x="0"
                        y={tick.y + 4}
                        className="fill-slate-600 dark:fill-slate-300"
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
                        className="stroke-slate-200 dark:stroke-slate-700"
                        strokeDasharray="5 5"
                      />
                    </g>
                  ))}
                  <line
                    x1="82"
                    y1={trend.zeroY}
                    x2="358"
                    y2={trend.zeroY}
                    className="stroke-slate-300 dark:stroke-slate-600"
                    strokeWidth="1.5"
                  />
                  <polyline
                    points={trend.polyline}
                    fill="none"
                    className="stroke-blue-700 dark:stroke-blue-400"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {trend.points.map((point, index) => (
                    <g key={point.key}>
                      <title>
                        {`Fecha: ${formatLongDateLabel(point.key)}. Ventas: ${formatCurrency(point.ventas)}. Compras: ${formatCurrency(point.compras)}. Gastos: ${formatCurrency(point.gastos)}. Utilidad: ${formatCurrency(point.value)}.`}
                      </title>
                      <text
                        x={point.x}
                        y={Math.max(18, point.y - (index % 2 === 0 ? 12 : 24))}
                        textAnchor="middle"
                        className="fill-slate-700 dark:fill-slate-100"
                        fontSize="11"
                        fontWeight="800"
                      >
                        {point.displayValue}
                      </text>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="6"
                        className="fill-white stroke-blue-700 dark:fill-slate-900 dark:stroke-blue-300"
                        strokeWidth="3"
                      />
                      <text
                        x={point.x}
                        y="204"
                        textAnchor="middle"
                        className="fill-slate-600 dark:fill-slate-300"
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
                <div className="mt-4 rounded-[14px] border border-[#dbe5f7] bg-[#f8fbff] px-4 py-5 text-center dark:border-slate-600 dark:bg-slate-800">
                  <p className="text-[0.86rem] font-black text-slate-900 dark:text-slate-100">
                    No hay suficientes movimientos para mostrar la tendencia.
                  </p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">
                    Registra compras, ventas o gastos para generar el análisis.
                  </p>
                </div>
              )
              ) : null}
            </section>
            ) : null}

            <section className="mt-4 rounded-[16px] border border-[#e5eaf3] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] dark:border-slate-600 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => toggleFinancialSection('movements')}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div>
                  <p className="text-[0.82rem] font-black text-slate-900 dark:text-slate-100">
                    Movimientos recientes
                  </p>
                  <p className="mt-1 text-[0.62rem] font-semibold text-slate-500 dark:text-slate-300">
                    {periodo === 'DIARIO' ? 'Hoy' : 'Últimos 7 días'} · {movimientosRecientes.length} registros
                  </p>
                </div>
                <span className="rounded-full bg-[#f1f5fb] px-2 py-1 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#73829a] dark:bg-slate-800 dark:text-slate-200">
                  {movimientosRecientes.length}
                </span>
                <ChevronDown
                  size={17}
                  className={`text-slate-400 transition ${financialSectionsOpen.movements ? 'rotate-180' : ''}`}
                />
              </button>

              {financialSectionsOpen.movements ? (
              movimientosRecientes.length === 0 ? (
                <p className="mt-3 rounded-[10px] bg-[#f8fafc] px-3 py-3 text-[0.64rem] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  Aún no tienes movimientos para este periodo.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {movimientosRecientes.map((item) => {
                    const copy = getMovimientoCopy(item);
                    const Icon = copy.icon;
                    return (
                      <article
                        key={`${item.tipo}-${item.id}`}
                        className="flex items-center gap-3 border-b border-[#eef2f7] px-1 py-3 last:border-b-0 dark:border-slate-700"
                      >
                        <span
                          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${copy.tone}`}
                        >
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.82rem] font-black text-slate-900 dark:text-slate-100">
                            {copy.title}
                          </p>
                          <p className="truncate text-[0.68rem] font-semibold text-slate-500 dark:text-slate-300">
                            {copy.detail}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[0.62rem] font-semibold text-slate-500 dark:text-slate-300">
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

            <section className="mt-4 rounded-[16px] border border-[#e5eaf3] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] dark:border-slate-600 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => toggleFinancialSection('histories')}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div>
                  <p className="text-[0.82rem] font-black text-slate-900 dark:text-slate-100">
                    Historiales financieros
                  </p>
                  <p className="mt-1 text-[0.62rem] font-semibold text-slate-500 dark:text-slate-300">
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
                    section: 'ventas' as const,
                    title: 'Historial de ventas',
                    text: 'Consulta ventas registradas.',
                    icon: ShoppingCart,
                    tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
                  },
                  {
                    tipo: 'COMPRA' as const,
                    section: 'compras' as const,
                    title: 'Historial de compras',
                    text: 'Consulta compras registradas.',
                    icon: PackageCheck,
                    tone: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
                  },
                  {
                    tipo: 'GASTO' as const,
                    section: 'gastos' as const,
                    title: 'Historial de gastos',
                    text: 'Consulta gastos registrados.',
                    icon: Wallet,
                    tone: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200',
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.tipo}
                      type="button"
                      onClick={() => abrirHistorial(item.tipo)}
                      className="flex min-h-[58px] items-center gap-3 rounded-[14px] border border-[#eef2f7] bg-[#fbfcff] px-3 py-2 text-left dark:border-slate-700 dark:bg-slate-800"
                    >
                      <span
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.tone}`}
                      >
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-slate-900 dark:text-slate-100">
                          {item.title}
                        </span>
                        <span className="block text-xs font-semibold text-slate-500 dark:text-slate-300">
                          {historialSectionErrors[item.section] ??
                            item.text}
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
                className="inline-flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[8px] bg-emerald-50 px-2 text-center text-[0.58rem] font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
              >
                <ShoppingCart size={15} />
                Venta
              </button>
              <button
                type="button"
                onClick={() => navigate('/compras')}
                className="inline-flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[8px] bg-blue-50 px-2 text-center text-[0.58rem] font-black text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
              >
                <PackageCheck size={15} />
                Compra
              </button>
              <button
                type="button"
                onClick={() => navigate('/gastos/registro')}
                className="inline-flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[8px] bg-red-50 px-2 text-center text-[0.58rem] font-black text-red-700 dark:bg-red-500/15 dark:text-red-200"
              >
                <Plus size={15} />
                Gasto
              </button>
            </section>

            {historialActivo ? (
              <div className="cs-workflow-page fixed inset-0 z-50 h-[100dvh] bg-[#f7f9fc] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                <section className="mx-auto flex h-full w-full max-w-[430px] flex-col overflow-visible bg-white dark:bg-slate-950">
                  <header className="relative z-[80] shrink-0 border-b border-slate-100 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="grid grid-cols-[42px_1fr_42px] items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setHistorialDateOpen(false);
                          setHistorialFilterFeedback(null);
                          setHistorialActivo(null);
                        }}
                        aria-label="Volver"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-blue-200 bg-[#eef2ff] text-[#102d92] shadow-sm transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-400/25 active:scale-95 dark:border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-100 dark:hover:bg-blue-500/30"
                      >
                        <ArrowLeft size={17} />
                      </button>
                      <h3 className="min-w-0 truncate text-lg font-black text-slate-950 dark:text-slate-100">
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
                    <label className="relative mt-3 block">
                      <Search
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300"
                        aria-hidden="true"
                      />
                      <input
                        value={historialSearch}
                        maxLength={60}
                        onChange={(event) =>
                          setHistorialSearch(sanitizeSearchInput(event.target.value))
                        }
                        className={`${fieldInputClass} pl-10`}
                        placeholder={historialActivo === 'GASTO' ? 'Buscar gasto' : 'Buscar registro'}
                      />
                    </label>
                    {refreshing || refreshFeedback === 'Actualizando información...' ? (
                      <p role="status" className="mt-3 rounded-[14px] bg-[#eef4ff] px-3 py-2 text-xs font-black text-[#102d92]">
                        Actualizando información...
                      </p>
                    ) : null}
                    {historialFilterFeedback ? (
                      <p role="status" className="mt-3 rounded-[14px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                        {historialFilterFeedback}
                      </p>
                    ) : null}
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {historialActivo === 'GASTO' ? (
                        <div className="min-w-0">
                          <label className={fieldLabelClass}>
                            Estado
                          </label>
                          <SmartSelect
                            value={historialEstado}
                            onChange={(event) =>
                              setHistorialEstado(event.target.value as GastoEstadoPago | 'TODOS')
                            }
                            className="min-h-[42px] rounded-[12px] text-[0.68rem]"
                            aria-label="Filtrar por estado"
                          >
                            <option value="TODOS">Todos</option>
                            <option value="PENDIENTE">Pendientes</option>
                            <option value="PAGADO">Pagados</option>
                          </SmartSelect>
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <label className={fieldLabelClass}>
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
                            {tipo === 'TODOS' ? 'Todos' : titleCase(String(tipo))}
                          </option>
                        ))}
                      </SmartSelect>
                      </div>
                      <div className="min-w-0">
                        <label className={fieldLabelClass}>
                          Ordenar por
                        </label>
                      <SmartSelect
                        value={historialSort}
                        onChange={(event) => {
                          const nextSort = event.target.value as typeof historialSort;
                          setHistorialSort(nextSort);
                        }}
                        className="min-h-[42px] rounded-[12px] text-[0.68rem]"
                        aria-label="Ordenar historial"
                      >
                        <option value="recent">Más reciente</option>
                        <option value="oldest">Más antiguo</option>
                        <option value="amount-desc">Mayor valor</option>
                        <option value="amount-asc">Menor valor</option>
                        <option value="date">Fecha específica</option>
                      </SmartSelect>
                      </div>
                    </div>
                    {historialSort === 'date' ? (
                      <div className="mt-3 rounded-[14px] border border-[#dbe2f0] bg-[#f8faff] px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                        <label className="mb-1 block text-[0.58rem] font-black uppercase tracking-[0.08em] text-slate-500 dark:text-slate-300">
                          Fecha específica
                        </label>
                        <HistoryDatePicker
                          value={historialDate}
                          open={historialDateOpen}
                          onToggle={() => setHistorialDateOpen((open) => !open)}
                          onClose={() => setHistorialDateOpen(false)}
                          onChange={setHistorialDate}
                        />
                      </div>
                    ) : null}
                    {historialSort === 'date' && historialDate ? (
                      <div className="mt-3 rounded-[14px] border border-[#dbe6ff] bg-[#f5f8ff] px-3 py-2 text-xs font-bold text-[#102d92] dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-100">
                        Fecha: {formatDateLabel(historialDate)}
                      </div>
                    ) : null}
                    {historialFiltrosActivos ? (
                      <button
                        type="button"
                        onClick={limpiarFiltrosHistorial}
                        className="mt-3 inline-flex min-h-[38px] w-full items-center justify-center rounded-[13px] border border-[#d5deee] bg-white px-3 text-xs font-black text-[#334b85] transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-950 dark:text-blue-100 dark:hover:bg-slate-800"
                      >
                        Limpiar filtros
                      </button>
                    ) : null}
                    <div className="mt-3 rounded-[14px] bg-[#eef4ff] px-3 py-2 text-sm font-black text-[#102d92] dark:bg-blue-500/10 dark:text-blue-100">
                      Total acumulado: {formatCurrency(historialTotal)}
                    </div>
                    {historialActionMessage ? (
                      <p className="mt-3 rounded-[14px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                        {historialActionMessage}
                      </p>
                    ) : null}
                  </header>
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {historialError || historialActivoError ? (
                      <div className="flex min-h-full items-center justify-center py-4">
                        <CafeSmartErrorState
                          title="No pudimos cargar el historial"
                          message={
                            historialActivoError ??
                            historialError ??
                            HISTORIAL_SECTION_ERROR
                          }
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
                      <p className="rounded-[14px] bg-[#f8fafc] px-4 py-6 text-center text-sm font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                        {historialSort === 'date' && historialDate
                          ? historialActivo === 'VENTA'
                            ? 'No hay ventas para la fecha seleccionada.'
                            : historialActivo === 'COMPRA'
                              ? 'No hay compras para la fecha seleccionada.'
                              : 'No hay gastos para la fecha seleccionada.'
                          : historialFiltrosActivos
                            ? 'No hay registros con esos filtros.'
                            : 'Aún no hay movimientos registrados.'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {historialVisible.map((item) => {
                          const copy = getMovimientoCopy(item);
                          const Icon = copy.icon;
                          const gasto = historialActivo === 'GASTO' ? item.gasto : null;
                          return (
                            <article
                              key={`${item.tipo}-${item.id}-${item.fecha}`}
                              className="flex items-center gap-3 rounded-[14px] border border-[#eef2f7] bg-[#fbfcff] px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
                            >
                              <span
                                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${copy.tone}`}
                              >
                                <Icon size={17} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-black text-[#111827] dark:text-slate-100">
                                  {gasto ? gasto.conceptoGasto : item.nombre || copy.title}
                                </p>
                                {gasto ? (
                                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[0.62rem] font-black">
                                    <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">
                                      {titleCase(gasto.tipoGasto || 'OTROS')}
                                    </span>
                                    <span
                                      className={`rounded-full px-2 py-1 ${
                                        gasto.estadoPago === 'PAGADO'
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : 'bg-amber-50 text-amber-700'
                                      }`}
                                    >
                                      {gasto.estadoPago === 'PAGADO' ? 'Pagado' : 'Pendiente'}
                                    </span>
                                    <span className="font-semibold text-slate-500 dark:text-slate-300">
                                      {formatDate(item.fecha)}
                                    </span>
                                  </div>
                                ) : (
                                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                                    {formatDate(item.fecha)}
                                    {item.kg > 0 ? ` · ${formatKg(item.kg)}` : ''}
                                  </p>
                                )}
                              </div>
                              <p className={`shrink-0 text-sm font-black ${copy.amountTone}`}>
                                {formatCurrency(item.valor)}
                              </p>
                              {gasto ? (
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => abrirEditarGastoHistorial(gasto)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#d5deee] bg-white text-[#334b85] dark:border-slate-600 dark:bg-slate-800 dark:text-blue-100"
                                    aria-label="Editar gasto"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setGastoAEliminar(gasto)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-rose-200 bg-rose-50 text-rose-700"
                                    aria-label="Eliminar gasto"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                        {historialHasMore ? (
                          <button
                            type="button"
                            onClick={() => setHistorialVisibleCount((count) => count + 30)}
                            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#102d92] dark:border-slate-700 dark:bg-slate-900 dark:text-blue-100"
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

            {gastoEditando && gastoEditForm ? (
              <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/55 px-3 pb-3 pt-3 backdrop-blur-sm sm:items-center">
                <section className="max-h-[calc(100dvh-1.5rem)] w-full max-w-[430px] overflow-y-auto rounded-[18px] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.22)] dark:border dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-slate-950 dark:text-slate-100">Editar gasto</h2>
                      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                        Guarda cambios sin duplicar el registro.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setGastoEditando(null);
                        setGastoEditForm(null);
                        setGastoEditFechaOpen(false);
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-200"
                      aria-label="Cerrar edición"
                    >
                      <X size={17} />
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    <label className="block">
                      <span className={fieldLabelClass}>
                        Concepto del gasto
                      </span>
                      <input
                        value={gastoEditForm.conceptoGasto}
                        maxLength={60}
                        onChange={(event) =>
                          setGastoEditForm((current) =>
                            current ? { ...current, conceptoGasto: event.target.value } : current,
                          )
                        }
                        className={fieldInputClass}
                      />
                    </label>
                    <label className="block">
                      <span className={fieldLabelClass}>
                        Observación
                      </span>
                      <textarea
                        value={gastoEditForm.descripcion}
                        maxLength={200}
                        rows={2}
                        onChange={(event) =>
                          setGastoEditForm((current) =>
                            current ? { ...current, descripcion: event.target.value } : current,
                          )
                        }
                        className={`${fieldTextareaClass} max-h-36 min-h-[96px] resize-y overflow-y-auto`}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className={fieldLabelClass}>
                          Monto
                        </span>
                        <input
                          value={gastoEditForm.montoGasto}
                          inputMode="numeric"
                          onChange={(event) =>
                            setGastoEditForm((current) =>
                              current
                                ? { ...current, montoGasto: sanitizeMoneyInput(event.target.value) }
                                : current,
                            )
                          }
                          className={fieldInputClass}
                        />
                      </label>
                      <div className="block">
                        <span className={fieldLabelClass}>
                          Fecha
                        </span>
                        <HistoryDatePicker
                          value={gastoEditForm.fechaGasto}
                          open={gastoEditFechaOpen}
                          onToggle={() => setGastoEditFechaOpen((open) => !open)}
                          onClose={() => setGastoEditFechaOpen(false)}
                          onChange={(value) =>
                            setGastoEditForm((current) =>
                              current ? { ...current, fechaGasto: value } : current,
                            )
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className={fieldLabelClass}>
                          Tipo
                        </span>
                        <SmartSelect
                          value={gastoEditForm.tipoGasto}
                          onChange={(event) =>
                            setGastoEditForm((current) =>
                              current
                                ? { ...current, tipoGasto: event.target.value as GastoTipo }
                                : current,
                            )
                          }
                          className="min-h-[44px] rounded-[12px] text-[0.72rem]"
                          aria-label="Tipo de gasto"
                        >
                          {TIPOS_GASTO.map((tipo) => (
                            <option key={tipo} value={tipo}>
                              {titleCase(tipo)}
                            </option>
                          ))}
                        </SmartSelect>
                      </label>
                      <label className="block">
                        <span className={fieldLabelClass}>
                          Estado
                        </span>
                        <SmartSelect
                          value={gastoEditForm.estadoPago}
                          onChange={(event) =>
                            setGastoEditForm((current) =>
                              current
                                ? { ...current, estadoPago: event.target.value as GastoEstadoPago }
                                : current,
                            )
                          }
                          className="min-h-[44px] rounded-[12px] text-[0.72rem]"
                          aria-label="Estado del gasto"
                        >
                          <option value="PENDIENTE">Pendiente</option>
                          <option value="PAGADO">Pagado</option>
                        </SmartSelect>
                      </label>
                    </div>
                    {gastoEditError ? (
                      <p className="rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                        {gastoEditError}
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void guardarGastoEditado()}
                      disabled={guardandoGasto}
                      className={`${primaryButtonClass} rounded-[12px]`}
                    >
                      {guardandoGasto ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGastoEditando(null);
                        setGastoEditForm(null);
                        setGastoEditFechaOpen(false);
                      }}
                      disabled={guardandoGasto}
                      className={`${secondaryButtonClass} rounded-[12px]`}
                    >
                      Cancelar
                    </button>
                  </div>
                </section>
              </div>
            ) : null}

            {gastoAEliminar ? (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/55 px-4 backdrop-blur-sm">
                <section className="w-full max-w-[360px] rounded-[18px] bg-white p-5 text-center shadow-[0_24px_60px_rgba(15,23,42,0.22)] dark:border dark:border-slate-700 dark:bg-slate-900">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-700">
                    <Trash2 size={20} />
                  </div>
                  <h2 className="mt-4 text-lg font-black text-slate-950 dark:text-slate-100">
                    ¿Eliminar este gasto?
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
                    Esta acción quitará el gasto del registro. No podrás recuperarlo después.
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGastoAEliminar(null)}
                      disabled={Boolean(eliminandoGastoId)}
                      className={`${secondaryButtonClass} rounded-[12px]`}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmarEliminarGastoHistorial()}
                      disabled={Boolean(eliminandoGastoId)}
                      className={`${dangerButtonClass} rounded-[12px]`}
                    >
                      {eliminandoGastoId ? 'Eliminando...' : 'Eliminar gasto'}
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </>
        )}
      </main>

      {showMermaAudit ? (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/45 px-3 pb-3 pt-3 backdrop-blur-sm sm:items-center">
          {mermaAuditView === 'summary' ? (
            <MermaAuditSummaryCard
              data={{
                totalKg: mermaTotalKg,
                totalPercentage: mermaTotalPorcentaje,
                totalValue: mermaTotalValor,
                laboratoryAnalysis,
              }}
              onClose={closeMermaAudit}
              onOpenLaboratory={() => setMermaAuditView('laboratory')}
            />
          ) : (
            <MermaLaboratoryView
              data={{
                totalKg: mermaTotalKg,
                totalPercentage: mermaTotalPorcentaje,
                totalValue: mermaTotalValor,
                laboratoryAnalysis,
              }}
              onBack={() => setMermaAuditView('summary')}
              onClose={closeMermaAudit}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

function MermaDonutChart({
  humidityKg,
  factorKg,
}: {
  humidityKg: number;
  factorKg: number;
}) {
  const radius = 46;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  const total = Math.max(0, humidityKg + factorKg);
  const humidityShare = total > 0 ? humidityKg / total : 0;
  const humidityOffset = circumference * (1 - humidityShare);

  return (
    <div className="relative mx-auto h-32 w-32 shrink-0" aria-label="Distribución de merma calculada con datos reales de laboratorio" role="img">
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
        <span className="text-lg font-black text-slate-950">
          {total > 0 ? '100%' : '0%'}
        </span>
      </div>
    </div>
  );
}
