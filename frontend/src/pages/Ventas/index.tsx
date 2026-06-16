// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Coffee,
  Eye,
  History,
  IdCard,
  LoaderCircle,
  PackageOpen,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  ShoppingCart,
  Trash2,
  User,
  Warehouse,
  X,
} from 'lucide-react';
import { AppBottomNav } from '../../components/AppBottomNav';
import { AppFeedbackMessage } from '../../components/AppFeedbackMessage';
import { SmartSelect } from '../../components/SmartSelect';
import {
  createGuidedError,
  InlineGuidedError,
  type GuidedErrorMessage,
} from '../../components/forms/GuidedError';
import { BUSINESS_MIN_DATE_VALUE, formatDateLabel, getTodayLocalDateValue } from '../../utils/date';
import { formatPhoneNumber, sanitizeDocumentInput, sanitizeNameInput, type DocumentType } from '../../utils/personValidation';
import { sanitizeSearchInput } from '../../utils/inputLimits';
import { getLimitesVenta, isValidCantidadInput, isValidPrecioInput } from './utils';
import { useNavigate } from 'react-router-dom';
import { useVentas } from './hooks/useVentas';
import { MAX_NOMBRE_CARACTERES } from './constants';
import { LoadingCard } from './components/LoadingCard';
import { ModalConfirmacionVenta } from './components/ModalConfirmacionVenta';
import { CafeSmartErrorState } from '../../components/CafeSmartErrorState';
import { CafeSmartProcessingScreen } from '../../components/CafeSmartProcessingScreen';
import { TransactionSuccessScreen } from '../../components/TransactionSuccessScreen';
import { CafeSmartDatePicker } from '../../components/common/CafeSmartDatePicker';
import { shareMovementSummary } from '../../services/shareMovementSummary';
import { fuzzySearch } from '../../utils/fuzzySearch';
import { formatCoffeeFullName, getCoffeeCodePrefix, getSubloteCodeMap } from '../../utils/coffeeCodes';
import {
  dangerButtonClass,
  fieldHelpTextClass,
  fieldInputClass,
  fieldLabelClass,
  primaryButtonClass,
  secondaryButtonClass,
  selectMenuClass,
  selectOptionActiveClass,
  selectOptionClass,
  selectTriggerClass,
} from '../../styles/uiClasses';

type ModoVenta = 'PARCIAL' | 'TOTAL';
type Step = 1 | 2 | 3;

type ClienteOption = {
  id: string;
  nombre: string;
  documento: string;
  detalle: string;
  telefono?: string;
  tipoDocumento?: DocumentType;
  createdAt?: string;
  rapido?: boolean;
};

type ClienteForm = {
  nombre: string;
  telefono: string;
  documento: string;
  tipoDocumento: DocumentType | '';
};

function ariaExpanded(open: boolean) {
  return { 'aria-expanded': open ? 'true' : 'false' } as const;
}

const PRIVATE_ROUTE_PREVIOUS_KEY = 'cafeSmart:previousPrivateRoute';

const isSafePrivateRoute = (path: string | null) => {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return false;
  return !(
    path === '/' ||
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path.startsWith('/crear-empresa')
  );
};
type ClienteFormErrors = Partial<Record<keyof ClienteForm, string>>;
type LoteVenta = {
  id: string;
  codigo: string;
  tipoCafeId: string;
  tipoCafe: string;
  calidadId: string;
  calidad: string;
  disponibleKg: number;
  cantidadKg: string;
  precioKg: string;
  pesoVerificadoKg: string;
};

function getBodegaVentaTone(ocupacion: number) {
  if (ocupacion >= 100) {
    return {
      badge: 'Sobrecapacidad',
      border: 'border-rose-200',
      bg: 'bg-rose-50',
      badgeClass: 'bg-rose-100 text-rose-700',
      text: 'text-rose-800',
      bar: 'bg-rose-500',
      track: 'bg-slate-100',
      icon: 'text-rose-700',
    };
  }
  if (ocupacion >= 90) {
    return {
      badge: 'Casi llena',
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      badgeClass: 'bg-amber-100 text-amber-700',
      text: 'text-amber-800',
      bar: 'bg-amber-400',
      track: 'bg-slate-100',
      icon: 'text-amber-700',
    };
  }
  if (ocupacion >= 70) {
    return {
      badge: 'Casi llena',
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      badgeClass: 'bg-amber-100 text-amber-700',
      text: 'text-amber-800',
      bar: 'bg-amber-400',
      track: 'bg-slate-100',
      icon: 'text-amber-700',
    };
  }
  return {
    badge: 'Disponible',
    border: 'border-sky-200',
    bg: 'bg-sky-50',
    badgeClass: 'bg-sky-100 text-sky-700',
    text: 'text-sky-800',
    bar: 'bg-sky-500',
    track: 'bg-slate-100',
    icon: 'text-sky-700',
  };
}

function BodegaVentaInfoContent({
  capacidadKg,
  inventarioKg,
  ventaKg,
}: {
  capacidadKg: number | null | undefined;
  inventarioKg: number;
  ventaKg: number;
}) {
  if (!capacidadKg || !Number.isFinite(capacidadKg) || capacidadKg <= 0) {
    return null;
  }

  const inventarioActual = Math.max(0, inventarioKg);
  const liberadoKg = Math.max(0, ventaKg);
  const inventarioDespues = Math.max(0, inventarioActual - liberadoKg);
  const libreActual = Math.max(0, capacidadKg - inventarioActual);
  const libreDespues = Math.max(0, capacidadKg - inventarioDespues);
  const ocupacionActual = Math.min(100, Math.max(0, (inventarioActual / capacidadKg) * 100));
  const ocupacionDespues = Math.min(100, Math.max(0, (inventarioDespues / capacidadKg) * 100));
  const tone = getBodegaVentaTone(ocupacionActual);
  const liberaMucho = liberadoKg >= Math.max(25, capacidadKg * 0.05);

  return (
    <div className="space-y-3 pr-1" aria-live="polite">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.08em] ${tone.badgeClass}`}>
            <Warehouse size={12} aria-hidden="true" />
            {tone.badge}
          </span>
        </div>
        <span className="text-[0.72rem] font-black uppercase tracking-[0.08em] text-slate-500">
          Espacio disponible
        </span>
      </div>

      <p className={`whitespace-nowrap text-[1.2rem] font-black leading-none ${tone.text}`}>
        {kg(libreActual)} libres
      </p>

      <div className={`h-2 overflow-hidden rounded-full ${tone.track}`}>
        <div
          className={`h-full rounded-full ${tone.bar}`}
          style={{ width: `${ocupacionActual}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 rounded-[14px] bg-slate-50 px-3 py-2 text-[0.78rem]">
        <span className="whitespace-nowrap font-black text-slate-500">
          Disponible después:
        </span>
        <span className={`whitespace-nowrap font-black leading-tight ${tone.text}`}>
          {kg(libreDespues)}
        </span>
      </div>

      {ventaKg > 0 ? (
        <AppFeedbackMessage
          variant={liberaMucho ? 'success' : 'warning'}
          title={
            liberaMucho
              ? 'La venta ayudará a liberar espacio en bodega.'
              : 'La capacidad seguirá alta después de esta venta.'
          }
          className="mt-1"
          autoClose
          duration={liberaMucho ? 2600 : 4000}
        />
      ) : null}
      <p className="text-[0.72rem] font-bold text-slate-500">
        Ocupación después: {Math.round(ocupacionDespues)}%
      </p>
    </div>
  );
}

function BodegaVentaInfoModal({
  open,
  onClose,
  capacidadKg,
  inventarioKg,
  ventaKg,
}: {
  open: boolean;
  onClose: () => void;
  capacidadKg: number | null | undefined;
  inventarioKg: number;
  ventaKg: number;
}) {
  if (!open || !capacidadKg || !Number.isFinite(capacidadKg) || capacidadKg <= 0) {
    return null;
  }

  const ocupacionActual = Math.min(
    100,
    Math.max(0, (Math.max(0, inventarioKg) / capacidadKg) * 100),
  );
  const tone = getBodegaVentaTone(ocupacionActual);

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/45 px-3 pb-4 pt-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="venta-bodega-info-title"
        className={`w-full max-w-[360px] rounded-[16px] border px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-sm ${tone.border} ${tone.bg}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-500">
              Bodega
            </p>
            <h2 id="venta-bodega-info-title" className="mt-1 text-lg font-black leading-tight text-slate-950">
              Espacio disponible
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar información de bodega"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-slate-500 transition hover:bg-white hover:text-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4">
          <BodegaVentaInfoContent
            capacidadKg={capacidadKg}
            inventarioKg={inventarioKg}
            ventaKg={ventaKg}
          />
        </div>
      </section>
    </div>
  );
}
type VentaFifoItem = {
  groupId: string;
  subloteId: string;
  subloteCodigo: string;
  subloteNombre: string;
  tipoCafe: string;
  calidad: string;
  nombreCafe: string;
  fifoPosition: number;
  pesoAsignado: number;
  pesoRestante: number;
  fechaEntrada: string;
  costoBase: number | null;
};
type VentaGuardadaResumen = {
  referenciaId: string;
  fecha: string;
  clienteNombre: string;
  clienteDocumento: string;
  totalKg: number;
  totalVenta: number;
  items: Array<{
    codigo: string;
    tipoCafe: string;
    calidad: string;
    cantidadKg: number;
    subtotal: number;
  }>;
  fifoBreakdown?: VentaFifoItem[];
};
type VentaParcialCardAlert = {
  title: string;
  detail: string;
};

const LIMITE = 6;
type ClienteSortMode = 'recent' | 'oldest' | 'az' | 'za' | 'doc-asc' | 'doc-desc';
const CLIENTE_SORT_OPTIONS: Array<{ value: ClienteSortMode; label: string }> = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguos' },
  { value: 'az', label: 'A-Z' },
  { value: 'za', label: 'Z-A' },
  { value: 'doc-asc', label: 'Número menor a mayor' },
  { value: 'doc-desc', label: 'Número mayor a menor' },
];
const DOCUMENT_TYPE_OPTIONS: Array<{ value: DocumentType; label: string }> = [
  { value: 'CEDULA', label: 'Cédula de ciudadanía' },
  { value: 'NIT', label: 'NIT' },
];
const VENTA_FILTRO_TODOS = 'TODOS';
const VENTA_DRAFT_STORAGE_KEY = 'cafe-smart:venta-draft:v1';
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
const WEEKDAYS_ES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

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

function formatLongDateLabel(value: string) {
  const date = parseLocalDateValue(value);
  if (!date) return '';
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function isDateValueInRange(value: string, min: string, max: string) {
  return value >= min && value <= max;
}

function CompactSelect<T extends string>({
  id,
  labelledById,
  value,
  options,
  placeholder,
  open,
  icon,
  onToggle,
  onClose,
  onChange,
}: {
  id: string;
  labelledById?: string;
  value: T | '';
  options: Array<{ value: T; label: string }>;
  placeholder: string;
  open: boolean;
  icon?: React.ReactNode;
  onToggle: () => void;
  onClose: () => void;
  onChange: (value: T) => void;
}) {
  const selected = options.find((option) => option.value === value);
  const buttonId = `${id}-button`;
  const listId = `${id}-list`;
  const resolvedIcon = icon === undefined ? <IdCard size={16} /> : icon;

  return (
    <div className="relative">
      <button
        id={buttonId}
        type="button"
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-labelledby={labelledById ? `${labelledById} ${buttonId}` : undefined}
        {...ariaExpanded(open)}
        onClick={onToggle}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
            onClose();
          }
        }}
        className={`${selectTriggerClass} min-h-[48px] rounded-[16px] text-sm`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {resolvedIcon ? (
            <span className="text-[#1f3fa7]" aria-hidden="true">
              {resolvedIcon}
            </span>
          ) : null}
          <span className={selected ? 'block truncate' : 'block truncate text-slate-400'}>
            {selected?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-labelledby={buttonId}
          className={selectMenuClass}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                {...(active
                  ? ({ 'aria-selected': 'true' } as const)
                  : ({ 'aria-selected': 'false' } as const))}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  onClose();
                }}
                className={`${selectOptionClass} flex items-center justify-between ${
                  active ? selectOptionActiveClass : ''
                }`}
              >
                {option.label}
                {active ? <Check size={15} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const clienteModalLabelClass =
  'mb-2 block text-[0.9rem] font-semibold text-slate-900 dark:text-slate-100';

const clienteModalHintClass =
  'mt-1.5 text-xs font-medium leading-5 text-slate-500 dark:text-slate-300';

function getClienteModalInputClass(hasError = false) {
  return `w-full rounded-[14px] border px-4 py-3 text-[0.95rem] text-slate-900 outline-none transition-all placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400 disabled:placeholder:text-slate-400 focus:border-[#173ea6] focus:bg-white focus:ring-4 focus:ring-[#173ea6]/10 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-300 dark:focus:bg-slate-900 dark:focus:ring-blue-300/15 ${
    hasError
      ? 'border-rose-200 bg-rose-50/40 dark:border-red-400 dark:bg-red-950/30'
      : 'border-[#dde4f1] bg-[#f7f9fd] dark:border-slate-700 dark:bg-slate-900'
  }`;
}

function ClienteModalFieldError({ id, message }: { id?: string; message: string }) {
  return (
    <AppFeedbackMessage
      id={id}
      variant="error"
      description={message}
      className="mt-2"
    />
  );
}

function SalesDatePicker({
  value,
  min,
  max,
  open,
  onToggle,
  onClose,
  onChange,
}: {
  value: string;
  min: string;
  max: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
}) {
  const selectedDate = parseLocalDateValue(value);
  const todayValue = getTodayLocalDateValue();
  const todaySelectable = isDateValueInRange(todayValue, min, max) ? todayValue : max;
  const maxDate = parseLocalDateValue(max) ?? new Date();
  const minDate = parseLocalDateValue(min) ?? new Date(2026, 0, 1);
  const visibleDate = selectedDate ?? parseLocalDateValue(todaySelectable) ?? maxDate;
  const [calendarView, setCalendarView] = React.useState<'days' | 'months' | 'years'>('days');
  const [visibleMonth, setVisibleMonth] = React.useState(
    () => new Date(visibleDate.getFullYear(), visibleDate.getMonth(), 1),
  );

  React.useEffect(() => {
    if (open) {
      const nextDate = parseLocalDateValue(value) ?? parseLocalDateValue(todaySelectable) ?? maxDate;
      setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
      setCalendarView('days');
    }
  }, [max, open, todaySelectable, value]);

  const calendarDays = React.useMemo(() => {
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
      className="relative"
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
        {...ariaExpanded(open)}
        onClick={onToggle}
        className={`flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-2 rounded-[13px] border bg-[#f8f9ff] px-3 py-2 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition hover:border-[#9fb0d4] hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/10 ${
          open ? 'border-[#102d92] bg-white' : 'border-[#d8e0ee]'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-black leading-none text-[#08256d]">
          {value ? formatLongDateLabel(value) : 'Selecciona una fecha'}
        </span>
        <CalendarDays size={20} className={open ? 'text-[#102d92]' : 'text-slate-500'} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Calendario de fecha de venta"
          className="absolute left-1/2 right-auto z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[18px] border border-[#d5deee] bg-white p-2 shadow-[0_18px_38px_rgba(15,23,42,0.16)]"
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
                <span key={day} className="py-1 text-center text-[0.72rem] font-black text-slate-500">
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
                    className={`h-8 rounded-full text-xs font-black transition disabled:cursor-not-allowed disabled:text-slate-300 ${
                      day.value === value
                        ? 'bg-[#102d92] text-white shadow-[0_8px_18px_rgba(16,45,146,0.22)]'
                        : day.value === todaySelectable
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
                onChange(todaySelectable);
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

function SelectionCheck({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
        active
          ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white dark:border-blue-300 dark:bg-blue-600 dark:text-white'
          : 'border-[#cad2e2] bg-white text-transparent dark:border-blue-300 dark:bg-slate-900 dark:text-transparent'
      }`}
      aria-hidden="true"
    >
      <span className="inline-flex h-6 w-6 items-center justify-center">
        {/* Usa CheckCircle2 para mantener look/feeling visual del sistema */}
      </span>
    </span>
  );
}

function SelectionCheckIcon({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
        active
          ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white dark:border-blue-300 dark:bg-blue-600 dark:text-white'
          : 'border-transparent bg-white text-transparent dark:border-blue-300 dark:bg-slate-900 dark:text-transparent'
      }`}
      aria-hidden="true"
    >
      <span className="inline-flex h-6 w-6 items-center justify-center">
        {/* placeholder */}
      </span>
    </span>
  );
}

function getSelectableCardClass(active: boolean, compact = false) {
  return `w-full cursor-pointer rounded-[20px] border text-left transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/15 ${
    compact ? 'px-3.5 py-3.5' : 'px-4 py-3.5'
  } ${
    active
      ? 'border-[#1f3fa7] bg-[#f4f7ff] shadow-[0_14px_30px_rgba(31,63,167,0.14)] dark:border-blue-400 dark:bg-blue-950/40 dark:text-slate-100'
      : 'border-[#e3e7f3] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.04)] hover:border-[#ccd6ea] hover:bg-[#fbfdff] hover:shadow-[0_12px_26px_rgba(15,23,42,0.07)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-400/60 dark:hover:bg-slate-800'
  }`;
}

function SelectableOptionCard({
  active,
  icon,
  title,
  subtitle,
  onClick,
  compact = false,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...ariaPressed(active)}
      className={getSelectableCardClass(active, compact)}
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex shrink-0 items-center justify-center rounded-full transition ${
            compact ? 'h-10 w-10' : 'h-12 w-12'
          } ${active ? 'bg-[#1f3fa7] text-white dark:bg-blue-600 dark:text-white' : 'bg-[#eef2f7] text-slate-500 dark:border dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-200'}`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.05rem] font-bold leading-tight text-slate-900">
            {title}
          </span>
          <span className="mt-1 block truncate text-[0.9rem] font-medium text-slate-500">
            {subtitle}
          </span>
        </span>
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full border transition ${
            active
              ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white dark:border-blue-300 dark:bg-blue-600 dark:text-white'
              : 'border-[#cad2e2] bg-white text-transparent dark:border-blue-300 dark:bg-slate-900 dark:text-transparent'
          }`}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0"
          >
            <path
              d="M20 6L9 17L4 12"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </button>
  );
}

function getClienteInitials(nombre: string) {
  const words = nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return words.map((w) => w[0]?.toUpperCase()).join('') || 'C';
}

function ClienteCard({
  cliente,
  active,
  onSelect,
  onDetail,
  onEdit,
}: {
  cliente: ClienteOption;
  active: boolean;
  onSelect: () => void;
  onDetail?: () => void;
  onEdit?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      {...ariaPressed(active)}
      className={getSelectableCardClass(active, true)}
    >
      <span className="flex w-full items-center gap-3">
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-black shadow-sm transition ${
            active
              ? 'bg-[#1f3fa7] text-white dark:bg-blue-600 dark:text-white'
              : 'bg-[#edf3ff] text-[#1f3fa7] dark:border dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-200'
          }`}
        >
          {getClienteInitials(cliente.nombre)}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-[0.98rem] font-black leading-5 text-slate-900"
            title={cliente.nombre}
          >
            {cliente.nombre}
          </span>
          <span className="mt-1 block truncate text-xs font-medium leading-4 text-slate-500">
            {cliente.documento}
          </span>
          {cliente.telefono ? (
            <span className="mt-0.5 block truncate text-xs font-medium text-slate-400">
              {formatPhoneNumber(cliente.telefono)}
            </span>
          ) : null}
        </span>

        {onDetail || onEdit ? (
          <span className="ml-auto flex shrink-0 flex-col items-end gap-1">
            {onDetail ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onDetail();
                }}
                className="rounded-full bg-white px-2.5 py-1 text-[0.66rem] font-black text-[#1f3fa7] shadow-sm"
              >
                Ver detalle
              </span>
            ) : null}
            {onEdit ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
                className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-[0.66rem] font-black text-[#1f3fa7]"
              >
                Editar
              </span>
            ) : null}
          </span>
        ) : (
          <SelectionCheck active={active} />
        )}
      </span>
    </button>
  );
}

const CLIENTE_GENERAL: ClienteOption = {
  id: 'general',
  nombre: 'Cliente General',
  documento: 'Venta rapida',
  detalle:
    'Para ventas rapidas o clientes ocasionales no registrados en el sistema.',
  rapido: true,
};

const kg = (v: number) =>
  `${v.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`;
const money = (v: number) =>
  `$${v.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
const toNum = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const soloDigitos = (v: string) => v.replace(/\D/g, '');
const norm = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function getQualityStyles(calidad: string) {
  const key = norm(calidad);

  if (key.includes('bueno')) {
    return {
      card: 'border-emerald-200 bg-emerald-50/45 dark:border-emerald-500/50 dark:bg-emerald-950/25',
      accent: 'border-l-4 border-l-emerald-400',
      icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100',
      chip: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-100',
      text: 'text-emerald-700 dark:text-emerald-100',
    };
  }

  if (key.includes('regular')) {
    return {
      card: 'border-amber-200 bg-amber-50/45 dark:border-amber-500/50 dark:bg-amber-950/25',
      accent: 'border-l-4 border-l-amber-400',
      icon: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100',
      chip: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-100',
      text: 'text-amber-700 dark:text-amber-100',
    };
  }

  if (key.includes('malo')) {
    return {
      card: 'border-rose-200 bg-rose-50/45 dark:border-rose-500/50 dark:bg-rose-950/25',
      accent: 'border-l-4 border-l-rose-400',
      icon: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100',
      chip: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-100',
      text: 'text-rose-700 dark:text-rose-100',
    };
  }

  return {
    card: 'border-[#e5e8f3] bg-[#fcfcff] dark:border-slate-600 dark:bg-slate-900',
    accent: 'border-l-4 border-l-[#1f3fa7]',
    icon: 'bg-[#eef4ff] text-[#102d92] dark:bg-blue-500/20 dark:text-blue-100',
    chip: 'border-[#dbe4ff] bg-[#eef4ff] text-[#102d92] dark:border-blue-500/50 dark:bg-blue-500/15 dark:text-blue-100',
    text: 'text-[#102d92] dark:text-blue-100',
  };
}

function mkLotes(lotes: LoteResumen[]): LoteVenta[] {
  return lotes
    .filter((l) => {
      const searchable = norm(
        `${l.id} ${l.codigo} ${l.tipoCafeId} ${l.tipoCafe} ${l.calidadId} ${l.calidad}`,
      );
      const noVendible =
        searchable.includes('en secado') ||
        searchable.includes('secado activo') ||
        searchable.includes('proceso de secado') ||
        searchable.includes('no disponible') ||
        searchable.includes('virtual-en-secado') ||
        searchable.includes('secado-proceso');

      return l.pesoActual > 0 && !noVendible;
    })
    .map((l) => ({
      id: l.id,
      codigo: l.codigo,
      tipoCafeId: l.tipoCafeId,
      tipoCafe: l.tipoCafe,
      calidadId: l.calidadId,
      calidad: l.calidad,
      disponibleKg: l.pesoActual,
      cantidadKg: '',
      precioKg: String(Math.round(l.precioPromedioKg || 0)),
      pesoVerificadoKg: '',
    }));
}

const uid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function readVentaDraft() {
  if (typeof window === 'undefined') return null;

  try {
    const { value } = await Preferences.get({ key: VENTA_DRAFT_STORAGE_KEY });
    const raw = value ?? window.localStorage.getItem(VENTA_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== 'object') return null;
    return draft;
  } catch {
    return null;
  }
}

async function writeVentaDraft(draft: Record<string, unknown>) {
  if (typeof window === 'undefined') return;

  const raw = JSON.stringify(draft);
  try {
    await Preferences.set({ key: VENTA_DRAFT_STORAGE_KEY, value: raw });
  } catch {
    // No bloquear la experiencia si Preferences falla.
  }

  try {
    window.localStorage.setItem(VENTA_DRAFT_STORAGE_KEY, raw);
  } catch {
    // El borrador no debe bloquear el registro de venta.
  }
}

async function clearVentaDraft() {
  if (typeof window === 'undefined') return;

  try {
    await Preferences.remove({ key: VENTA_DRAFT_STORAGE_KEY });
  } catch {
    // No bloquear la experiencia si Preferences falla.
  }

  try {
    window.localStorage.removeItem(VENTA_DRAFT_STORAGE_KEY);
  } catch {
    // No bloquear la experiencia si el almacenamiento local falla.
  }
}

function mapClienteToOption(cliente: ClienteItem): ClienteOption {
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    documento: cliente.documento?.trim() || 'Documento pendiente',
    detalle: cliente.telefono?.trim() || 'Cliente registrado en sistema',
    telefono: cliente.telefono ?? undefined,
    tipoDocumento: (cliente as ClienteItem & { tipoDocumento?: DocumentType | null }).tipoDocumento ?? 'CEDULA',
    createdAt: cliente.createdAt,
  };
}

function clavePersona(nombre: string, documento: string) {
  const documentoNormalizado = soloDigitos(documento);
  return documentoNormalizado
    ? `documento:${documentoNormalizado}`
    : `nombre:${norm(nombre.trim())}`;
}

function dedupeClientesOptions(clientes: ClienteOption[]) {
  const vistos = new Set<string>();

  return clientes.filter((cliente) => {
    const key = clavePersona(cliente.nombre, cliente.documento);

    if (vistos.has(key)) {
      return false;
    }

    vistos.add(key);
    return true;
  });
}

function findClienteExistente(
  clientes: ClienteOption[],
  nombre: string,
  documento: string,
  excludeId?: string,
) {
  const key = clavePersona(nombre, documento);
  return clientes.find(
    (cliente) =>
      cliente.id !== excludeId && clavePersona(cliente.nombre, cliente.documento) === key,
  );
}

function crearResumenVentaGuardada(
  respuesta: CreateVentaResponse,
): VentaGuardadaResumen {
  const ventaTotalKg = respuesta.detalles.reduce(
    (total, item) => total + item.pesoVendido,
    0,
  );
  return {
    referenciaId: respuesta.venta.id,
    fecha: respuesta.venta.fecha,
    clienteNombre: 'Cliente registrado',
    clienteDocumento: 'Sin detalle',
    totalKg: ventaTotalKg,
    totalVenta: respuesta.detalles.reduce(
      (total, item) => total + item.subtotal,
      0,
    ),
    items: [],
  };
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getPesoVerificado(lote: LoteVenta) {
  if (!lote.pesoVerificadoKg.trim()) return null;
  return round2(toNum(lote.pesoVerificadoKg));
}

function getDisponibleVenta(lote: LoteVenta) {
  const verificado = getPesoVerificado(lote);
  if (verificado === null) return lote.disponibleKg;
  return Math.max(0, Math.min(lote.disponibleKg, verificado));
}

function pesoVerificadoInvalido(lote: LoteVenta) {
  const verificado = getPesoVerificado(lote);
  return (
    verificado !== null && (verificado < 0 || verificado > lote.disponibleKg)
  );
}

function distribuirPesoVerificado(
  pool: Array<{ subloteId: string; disponibleKg: number }>,
  pesoVerificado: number,
) {
  const totalActual = round2(
    pool.reduce((sum, item) => sum + item.disponibleKg, 0),
  );
  if (pesoVerificado >= totalActual || totalActual <= 0) return pool;

  let acumulado = 0;
  return pool.map((item, index) => {
    const disponibleKg =
      index === pool.length - 1
        ? round2(Math.max(0, pesoVerificado - acumulado))
        : round2((item.disponibleKg / totalActual) * pesoVerificado);
    acumulado = round2(acumulado + disponibleKg);

    return {
      ...item,
      disponibleKg,
    };
  });
}

function datosPasoVenta(step: Step) {
  if (step === 1) {
    return {
      titulo: 'Cliente',
      progreso: 33,
    };
  }
  if (step === 2) {
    return {
      titulo: 'Seleccionar cafe',
      progreso: 66,
    };
  }
  return {
    titulo: 'Confirmar venta',
    progreso: 100,
  };
}

function getVentasGuidance(message: string): GuidedErrorMessage {
  const normalized = message.toLowerCase();

  if (normalized.includes('nombre del cliente') || normalized.includes('nombre')) {
    return createGuidedError(
      message,
      'Nombre incompleto.',
      'Ingresa el nombre del cliente.',
      'El nombre debe tener al menos 2 caracteres y no contener números.',
    );
  }

if (
  normalized.includes('teléfono') ||
  normalized.includes('telefono') ||
  normalized.includes('celular') ||
  normalized.includes('símbolos') ||
  normalized.includes('simbolos')
) {
    return createGuidedError(
      message,
      'Teléfono inválido.',
      'Número celular colombiano opcional.',
      'Ingresa un celular válido que empiece por 3 y tenga 10 dígitos.',
    );
  }

  if (
    normalized.includes('tipo de documento') ||
    (normalized.includes('tipo de') && normalized.includes('documento'))
  ) {
    return createGuidedError(
      message,
      'Selecciona el tipo de documento.',
      'Selecciona si el cliente usa cédula o NIT.',
      'Luego escribe el número de documento.',
    );
  }

  if (normalized.includes('documento')) {
    if (!message.trim() || normalized.includes('ingresa')) {
      return createGuidedError(
        message,
        'Falta el documento.',
        'Ingresa el número de documento.',
        'Escribe solo los dígitos del documento.',
      );
    }

    if (normalized.includes('solo') && normalized.includes('números')) {
      return createGuidedError(
        message,
        'Documento inválido.',
        'La cédula solo puede contener números.',
        'Borra letras y deja únicamente números.',
      );
    }

    if (
      normalized.includes('caracteres no permitidos') ||
      normalized.includes('puntos') ||
      normalized.includes('guiones') ||
      normalized.includes('espacios')
    ) {
      return createGuidedError(
        message,
        'Documento con formato inválido.',
        'El documento contiene caracteres no permitidos.',
        'Ingresa el documento solo con números.',
      );
    }

    if (normalized.includes('supera') || normalized.includes('permitida')) {
      return createGuidedError(
        message,
        'Documento demasiado largo.',
        message,
        'Quita los dígitos sobrantes e intenta de nuevo.',
      );
    }

    if (normalized.includes('muy pocos')) {
      return createGuidedError(
        message,
        'Documento muy corto.',
        'El documento tiene muy pocos números.',
        'Revisa la cantidad de dígitos e intenta de nuevo.',
      );
    }

    if (normalized.includes('repetir') || normalized.includes('mismo número')) {
      return createGuidedError(
        message,
        'Documento repetido.',
        message,
        'Corrige el número del documento.',
      );
    }

    return createGuidedError(
      message,
      'Documento inválido.',
      'Ingresa el número de documento sin formato.',
      'Revisa el dato marcado e intenta de nuevo.',
    );
  }

  if (message === 'No hay suficiente inventario para realizar la venta') {
    return createGuidedError(
      message,
      'Inventario insuficiente',
      'La venta queda bloqueada porque no hay cafe suficiente.',
      'Actualiza el inventario o reduce la cantidad.',
    );
  }

  if (message.includes('No hay lotes disponibles')) {
    return createGuidedError(
      message,
      'Sin inventario disponible',
      'No puedes registrar una venta porque no tienes producto en bodega.',
      'Registra una compra para continuar.',
    );
  }

  if (message.includes('nombre del cliente')) {
    return createGuidedError(
      message,
      'Falta identificar al cliente.',
      'Necesitamos su nombre para registrar la venta.',
      'Toca la casilla y escribe su nombre.',
    );
  }

  if (message.includes('Selecciona un cliente')) {
    return createGuidedError(
      message,
      'Selecciona un cliente',
      'No elegiste a quien registrar la venta.',
      'Usa Cliente General o busca uno.',
    );
  }

  if (message.includes('Guarda el cliente')) {
    return createGuidedError(
      message,
      'Guarda el cliente para continuar.',
      'Completa los datos del cliente y presiona "Guardar cliente".',
      'Guarda el cliente para poder avanzar.',
    );
  }

  if (message.includes('modo de venta') || message.includes('como deseas realizar la venta')) {
    return createGuidedError(
      message,
      'Selecciona como vender',
      'No elegiste el tipo de venta.',
      'Una parte o todo el inventario.',
    );
  }

  if (message.includes('supera el máximo permitido')) {
    return createGuidedError(
      message,
      'Precio demasiado alto.',
      'El valor supera el límite permitido.',
      'Reduce el precio para continuar.',
    );
  }

  if (
    message.includes('precio válido por kilogramo') ||
    message.includes('solo números válidos')
  ) {
    return createGuidedError(
      message,
      'Precio inválido.',
      'El formato del precio no es válido.',
      'Ingresa solo números válidos.',
    );
  }

  if (message.includes('precio por kilo') || message.includes('precio por kg')) {
    return createGuidedError(
      message,
      'Falta el precio por kilo.',
      'El precio minimo permitido es $1,000 por kg.',
      'Ingresa un valor desde $1,000.',
    );
  }

  if (message.includes('supera el disponible')) {
    return createGuidedError(
      message,
      'Cantidad excedida',
      'Estas intentando vender mas de lo disponible.',
      'Reduce la cantidad o revisa el inventario.',
    );
  }

  if (message.includes('cantidad')) {
    return createGuidedError(
      message,
      'Cantidad invalida',
      'Ingresa una cantidad mayor a 0.',
      'Revisa el campo de cantidad.',
    );
  }

  return createGuidedError(
    message,
    'No se pudo guardar la venta.',
    'Revisa los campos señalados.',
    'Revisa el dato marcado y vuelve a intentarlo.',
  );
}

function getClienteSeleccionGuidance(): GuidedErrorMessage {
  return createGuidedError(
    'Elige una opción para continuar.',
    'Opción no seleccionada.',
    'Selecciona un cliente o una forma de registro.',
    'Buscar cliente, Cliente genérico o Registrar cliente.',
  );
}

function getClientePhoneError(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  if (/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(raw) || /[^\d\s]/.test(raw)) {
    return 'No uses letras ni símbolos.';
  }
  const digits = sanitizePersonDigits(raw, 10);
  if (digits.length !== 10) return 'El celular debe tener 10 números.';
  if (!digits.startsWith('3')) {
    return 'Ingresa un celular colombiano que empiece por 3.';
  }
  return null;
}

function getVentaSubmitMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return 'No tienes conexión. Guardamos tu borrador para intentarlo después.';
    }

    if (error.status >= 500) {
      return 'La venta no se pudo guardar por un problema del servidor. Tus datos siguen seguros. Intenta nuevamente.';
    }

    if (
      error.code === 'INSUFFICIENT_STOCK' ||
      error.code === 'VENTA_INVENTARIO_INSUFICIENTE'
    ) {
      return 'No hay suficiente inventario para realizar la venta';
    }

    if (error.code === 'VENTA_CANTIDAD_INVALIDA') {
      return 'La cantidad a vender debe ser mayor a 0.';
    }

    if (error.code === 'VENTA_PRECIO_INVALIDO') {
      return 'El precio por kg debe ser mínimo $1,000.';
    }

    if (
      error.code === 'VENTA_SUBLOTE_INVALIDO' ||
      error.code === 'SUBLOTE_NOT_FOUND'
    ) {
      return 'No encontramos el lote seleccionado. Actualiza el inventario e intenta de nuevo.';
    }
  }

  return 'No fue posible registrar la venta. Intenta nuevamente.';
}

function esErrorGeneralGuardadoVenta(error: unknown) {
  if (!(error instanceof ApiRequestError)) {
    return false;
  }

  if (error.status === 0 || error.status >= 500) {
    return true;
  }

  const erroresCorregibles = new Set([
    'INSUFFICIENT_STOCK',
    'VENTA_INVENTARIO_INSUFICIENTE',
    'VENTA_CANTIDAD_INVALIDA',
    'VENTA_PRECIO_INVALIDO',
    'VENTA_SUBLOTE_INVALIDO',
    'SUBLOTE_NOT_FOUND',
  ]);

  return !error.field && !erroresCorregibles.has(error.code ?? '');
}

function getCantidadLoteGuidance(
  lote: LoteVenta,
  cantidad: number,
): GuidedErrorMessage {
  const disponible = getDisponibleVenta(lote);

  if (cantidad > disponible) {
    return createGuidedError(
      `La cantidad supera el disponible en ${lote.codigo}.`,
      'Cantidad excedida',
      'Solo puedes vender hasta lo disponible.',
      `Disponible: ${kg(disponible)}.`,
    );
  }

  return createGuidedError(
    `La cantidad debe ser mayor a 0 en ${lote.codigo}.`,
    'Cantidad invalida',
    'Ingresa una cantidad mayor a 0.',
    `Disponible: ${kg(disponible)}.`,
  );
}

function SalesEmptyInventoryAnimations() {
  return (
    <style>
      {`
        @keyframes salesEmptyFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes salesEmptyFloat {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-8px) rotate(1deg); }
        }

        @keyframes salesEmptyGlow {
          0%, 100% { opacity: .68; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.055); }
        }

        @keyframes salesEmptyParticle {
          0%, 100% { opacity: .25; transform: translate3d(0, 0, 0); }
          50% { opacity: .8; transform: translate3d(5px, -9px, 0); }
        }
      `}
    </style>
  );
}

function SalesEmptyInventoryIllustration() {
  return (
    <div className="relative mx-auto h-[188px] w-[236px]">
      <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#dbeeff] blur-2xl animate-[salesEmptyGlow_3.1s_ease-in-out_infinite]" />
      <div className="absolute left-1/2 top-8 h-28 w-44 -translate-x-1/2 rounded-full border border-white/70 bg-white/45 shadow-[0_28px_70px_rgba(37,99,235,0.13)] backdrop-blur-sm" />

      <span className="absolute left-5 top-8 h-2.5 w-2.5 rounded-full bg-[#8cc8ff] animate-[salesEmptyParticle_3.2s_ease-in-out_infinite]" />
      <span className="absolute right-10 top-3 h-2 w-2 rounded-full bg-[#b8dcff] animate-[salesEmptyParticle_3.7s_ease-in-out_infinite_140ms]" />
      <span className="absolute right-2 top-24 h-3 w-3 rounded-full bg-[#d6ebff] animate-[salesEmptyParticle_3.5s_ease-in-out_infinite_90ms]" />
      <span className="absolute left-3 bottom-[60px] h-2 w-2 rounded-full bg-[#a8d4ff] animate-[salesEmptyParticle_3.9s_ease-in-out_infinite_240ms]" />

      <div className="absolute inset-x-0 bottom-6 mx-auto h-7 w-36 rounded-full bg-[#103b8f]/10 blur-md" />

      <div className="absolute left-1/2 top-7 h-[145px] w-[178px] -translate-x-1/2 animate-[salesEmptyFloat_4.2s_ease-in-out_infinite]">
        <div className="absolute left-3 top-[45px] h-16 w-[150px] rounded-[24px] border border-[#d7e4f4] bg-white shadow-[0_22px_46px_rgba(15,23,42,0.12)]" />
        <div className="absolute left-5 top-[84px] h-20 w-28 rounded-[20px] border border-[#d7e4f4] bg-[#f8fbff] shadow-[0_24px_46px_rgba(15,23,42,0.11)]">
          <div className="absolute left-4 right-4 top-5 h-3 rounded-full bg-[#e2eefb]" />
          <div className="absolute left-4 right-10 top-10 h-3 rounded-full bg-[#eef6ff]" />
          <div className="absolute bottom-0 left-0 right-0 h-6 rounded-b-[20px] bg-[#eef6ff]" />
          <PackageOpen
            className="absolute -top-5 left-8 text-[#2f80ed]"
            size={34}
            strokeWidth={2.1}
          />
        </div>

        <div className="absolute right-4 top-16 flex h-[84px] w-[76px] rotate-[5deg] items-end justify-center rounded-[24px] border border-[#d9e4ee] bg-[#ead9bf] shadow-[0_22px_44px_rgba(15,23,42,0.12)]">
          <div className="absolute top-4 h-8 w-11 rounded-full border-2 border-[#d2bea0]" />
          <div className="absolute bottom-0 h-12 w-full rounded-[22px] bg-[#f1e2ca]" />
          <Coffee
            className="relative mb-4 text-[#8d642f]"
            size={28}
            strokeWidth={2.4}
          />
        </div>

        <div className="absolute left-14 top-5 flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-[#2f80ed] text-white shadow-[0_16px_30px_rgba(47,128,237,0.28)]">
          <ShoppingCart size={23} strokeWidth={2.4} />
        </div>
      </div>
    </div>
  );
}

function SalesEmptyInventoryWaves() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[170px] overflow-hidden">
      <svg
        className="absolute bottom-0 h-full w-full"
        viewBox="0 0 430 170"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 72C58 42 111 60 162 89C218 121 264 84 316 75C363 67 395 86 430 108V170H0V72Z"
          fill="#e8f4ff"
          opacity="0.92"
        />
        <path
          d="M0 112C62 82 118 94 174 119C226 143 273 113 321 104C365 95 397 113 430 130V170H0V112Z"
          fill="#cfe6ff"
          opacity="0.55"
        />
      </svg>
    </div>
  );
}

function NoInventorySalesScreen({
  onBack,
  onRegisterPurchase,
}: {
  onBack: () => void;
  onRegisterPurchase: () => void;
}) {
  return (
    <div className="cs-workflow-page relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_50%_12%,rgba(47,128,237,0.13),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fbff_52%,#edf6ff_100%)] px-5 pb-28 pt-6 text-center text-[#07153b]">
      <SalesEmptyInventoryAnimations />
      <div className="pointer-events-none absolute left-6 top-10 h-20 w-20 rounded-full bg-[#e6f3ff]/70 blur-2xl" />
      <div className="pointer-events-none absolute right-0 top-28 h-28 w-28 rounded-full bg-[#dbeeff]/70 blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-[430px] items-center justify-center">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-0 inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-900 transition hover:bg-white/70 hover:opacity-75"
          aria-label="Salir a inicio"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-[1.35rem] font-semibold text-slate-900">
          Nueva Venta
        </h1>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-12rem)] w-full max-w-[390px] flex-col items-center justify-center">
        <div className="animate-[salesEmptyFadeUp_320ms_ease-out_both]">
          <SalesEmptyInventoryIllustration />
        </div>

        <div className="mt-2 animate-[salesEmptyFadeUp_340ms_ease-out_80ms_both]">
          <p className="mx-auto mb-3 inline-flex min-h-[34px] items-center rounded-full border border-[#d9ebff] bg-white/70 px-4 text-[0.72rem] font-black uppercase tracking-[0.12em] text-[#4d8ee9] shadow-[0_12px_28px_rgba(37,99,235,0.08)] backdrop-blur">
            Inventario requerido
          </p>
          <h2 className="mx-auto max-w-[340px] text-[1.78rem] font-black leading-[1.08] text-[#07153b]">
            Aún no tienes café disponible para vender
          </h2>
          <p className="mx-auto mt-4 max-w-[318px] text-[0.98rem] font-semibold leading-6 text-slate-500">
            Registra una compra para llenar tu inventario y comenzar a realizar
            ventas.
          </p>
        </div>

        <article className="mt-6 w-full max-w-[318px] rounded-[20px] border border-[#d9ebff] bg-white/78 p-4 text-left shadow-[0_18px_42px_rgba(37,99,235,0.1)] backdrop-blur animate-[salesEmptyFadeUp_340ms_ease-out_130ms_both]">
          <p className="text-[0.72rem] font-black uppercase tracking-[0.12em] text-slate-500">
            Inventario actual
          </p>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-[1.85rem] font-black leading-none text-[#102d92]">
                0 kg
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                disponibles
              </p>
            </div>
            <span className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-[#eef6ff] text-[#2f80ed] shadow-[0_12px_26px_rgba(37,99,235,0.1)]">
              <PackageOpen size={25} strokeWidth={2.2} />
            </span>
          </div>
        </article>

        <button
          type="button"
          onClick={onRegisterPurchase}
          className="mt-7 inline-flex min-h-[56px] w-full max-w-[318px] items-center justify-center gap-2 rounded-[18px] bg-[#2f80ed] px-6 text-[1rem] font-black text-white shadow-[0_18px_34px_rgba(47,128,237,0.28),0_0_0_6px_rgba(47,128,237,0.08)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#1f6fe0] hover:shadow-[0_22px_42px_rgba(47,128,237,0.34),0_0_0_8px_rgba(47,128,237,0.1)] active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#93c5fd] animate-[salesEmptyFadeUp_340ms_ease-out_180ms_both]"
        >
          <ShoppingCart size={19} strokeWidth={2.4} />
          Registrar compra
          <ArrowRight size={18} strokeWidth={2.4} />
        </button>
      </main>

      <SalesEmptyInventoryWaves />
    </div>
  );
}

export default function Ventas() {
  const navigate = useNavigate();
  const nombreMaxToastTimerRef = React.useRef<number | null>(null);
  const [showBodegaVentaInfo, setShowBodegaVentaInfo] = React.useState(false);
  const ventas = useVentas() as any;
  const {
    isOffline, cargando, loadError, guardandoVenta, validandoPasoVenta, submitError, registroErrorMensaje, ventaGuardada, paso,
    botonConfirmarPresionado, intentoPaso1, intentoPaso2, clienteMetodo, clienteSeleccionado,
    busquedaCliente, clientes, clientesRecientes, clientesRecientesUsaSimilares, clienteForm, clienteFormErrors, clienteFormError,
    clienteEditando, clienteDetalle, sinClientesRegistrados, clientesSearchRef, busquedaClientesModal,
    busquedaClientesModalDebounced, clientesSortMode, clientesSortDropdownOpen, clienteDocumentoDropdownOpen, nombreMaxToast,
    mostrarModal, mostrarModalClientes, mostrarModalConfirmar, mostrarModalCancelar,
    mostrarModalBorradorVenta, mostrarHistorialLotesVenta, mostrarDesgloseSublotesVenta,
    mostrarHistorialVentas, modoVenta, fechaVenta, fechaVentaPickerOpen, fechaVentaValidacion,
    lotesVenta, bodegaConfig, lotesConCantidad, totalKg, totalEstimado, totalDisponibleVenta, busquedaCafeVenta,
    tipoCafeFiltroVenta, calidadFiltroVenta, tipoCafeFiltroOpen, calidadFiltroOpen,
    mostrarTodosCafeVenta, tipoCafeFiltroOpciones, calidadFiltroOpciones, lotesVentaParcialFiltrados, lotesVentaParcialVisibles, lotesVentaParcialUsaSimilares,
    preciosVentaTotal, preciosVentaTotalInvalidos, resumenDisponiblePorTipo, ventaParcialOpenId,
    ventaParcialAlert, ventaParcialCardAlerts, ajustesVentaParcialConfirmados, puedeAvanzarPaso2,
    ventaFifoBreakdown, historialVentaFecha, historialVentaFechaPickerOpen, historialVentaCliente,
    historialVentaOrden, ventasRealizadas, ventasHistorialFiltradas, historialVentaClientes,
    borradorVentaPendiente, pasoActual, clienteInvalido, modoInvalido, fechaVentaInvalida,
    precioTotalInvalido, sinInventario, parcialSinSeleccion, revisionDeleteAlert,
    anterior: volverPasoAnterior, siguiente, confirmar, reiniciar, cargarLotes, seleccionarCliente, buscarCliente, validarPasoVenta,
    guardarCliente, updateLote, confirmarAjusteParcial, cancelarAjusteParcial, continuarBorradorVenta,
    empezarVentaNuevaDesdeBorrador, getVentaParcialCardAlert, editarLoteDesdeRevision,
    eliminarLoteDesdeRevision, confirmarCancelarVenta,
    setModoVenta, setFechaVenta, setPaso, setClienteSeleccionado, setClienteMetodo,
    setBusquedaCliente, setLotesVenta, setPreciosVentaTotal, setMostrarModal,
    setMostrarModalClientes, setMostrarModalConfirmar, setClienteForm, setClienteFormErrors,
    setClienteFormError, setClienteEditando, setClienteDetalle, setMostrarModalBorradorVenta,
    setBorradorVentaPendiente, setVentaParcialOpenId, setBusquedaCafeVenta,
    setTipoCafeFiltroVenta, setCalidadFiltroVenta, setTipoCafeFiltroOpen, setCalidadFiltroOpen,
    setMostrarTodosCafeVenta, setVentaParcialCardAlerts, setAjustesVentaParcialConfirmados,
    setBusquedaClientesModal, setClientesSortMode, setClientesSortDropdownOpen,
    setClienteDocumentoDropdownOpen, setSubmitError, setRegistroErrorMensaje,
    setFechaVentaPickerOpen, setIntentoPaso1, setIntentoPaso2, setMostrarHistorialVentas,
    setHistorialVentaFecha, setHistorialVentaFechaPickerOpen, setHistorialVentaCliente,
    setHistorialVentaOrden, setMostrarHistorialLotesVenta, setVentasRealizadas,
    setMostrarDesgloseSublotesVenta, setMostrarModalCancelar, setNombreMaxToast,
    setRevisionDeleteAlert,
  } = ventas;
  const lotesVentaCodeMap = React.useMemo(
    () => getSubloteCodeMap(lotesVenta ?? []),
    [lotesVenta],
  );
  const [ventasTecnicasAbiertas, setVentasTecnicasAbiertas] = React.useState<Record<string, boolean>>({});
  const [showDetails, setShowDetails] = React.useState(false);

  React.useEffect(() => {
    if (!ventaGuardada) {
      setShowDetails(false);
    }
  }, [ventaGuardada]);

  const volverDesdeEncabezado = React.useCallback(() => {
    if (paso > 1) {
      volverPasoAnterior();
      return;
    }

    const previousPrivateRoute =
      typeof window !== 'undefined'
        ? window.sessionStorage.getItem(PRIVATE_ROUTE_PREVIOUS_KEY)
        : null;

    if (
      isSafePrivateRoute(previousPrivateRoute) &&
      previousPrivateRoute !== '/ventas'
    ) {
      navigate(previousPrivateRoute);
      return;
    }

    if (typeof window !== 'undefined') {
      try {
        const referrerUrl = document.referrer ? new URL(document.referrer) : null;
        if (
          referrerUrl?.origin === window.location.origin &&
          isSafePrivateRoute(referrerUrl.pathname) &&
          !referrerUrl.pathname.startsWith('/ventas')
        ) {
          navigate(referrerUrl.pathname);
          return;
        }
      } catch {
        // Fallback below keeps the user inside the authenticated app.
      }
    }

    navigate('/ventas', { replace: true });
  }, [navigate, paso, volverPasoAnterior]);

  const actualizarPrecioVentaTotal = React.useCallback(
    (tipoCafeId: string, rawValue: string) => {
      const nextValue = rawValue.replace(/[^\d]/g, '').slice(0, 8);
      const precio = toNum(nextValue);
      const limitesVenta = getLimitesVenta();

      if (nextValue && precio > limitesVenta.maxPrecioVentaKg) {
        setSubmitError('El precio ingresado supera el máximo permitido.');
        return;
      }

      setSubmitError(null);
      setPreciosVentaTotal((actual) => ({
        ...actual,
        [tipoCafeId]: nextValue,
      }));
    },
    [setPreciosVentaTotal, setSubmitError],
  );

  const ventaHistorialItems = React.useMemo(() => {
    const lotesPorId = new Map(lotesConCantidad.map((lote: any) => [lote.id, lote]));

    if (ventaFifoBreakdown.length > 0) {
      return ventaFifoBreakdown.map((item: any, index: number) => {
        const lote = lotesPorId.get(item.groupId);
        const precioVenta = Number(lote?.precio ?? 0);
        const peso = Number(item.pesoAsignado ?? 0);
        const precioCompra =
          item.precioCompra ??
          item.precio_compra ??
          item.costoBase ??
          item.sublote?.precioCompra ??
          item.sublote?.precio_compra ??
          null;
        const fechaIngreso =
          item.fechaIngreso ??
          item.fecha_ingreso ??
          item.fechaEntrada ??
          item.sublote?.fechaIngreso ??
          item.sublote?.fecha_ingreso ??
          null;
        const restante =
          item.restante ??
          item.pesoRestante ??
          item.peso_restante ??
          item.sublote?.pesoDisponible ??
          item.sublote?.peso_disponible ??
          null;
        return {
          id: `${item.groupId}-${item.subloteId}-${index}`,
          groupId: item.groupId,
          code: item.subloteCodigo ?? item.subloteNombre ?? `Sublote ${index + 1}`,
          peso,
          total: precioVenta > 0 ? peso * precioVenta : 0,
          precioCompra,
          fechaIngreso,
          restante,
          canDelete: lotesConCantidad.length > 1,
        };
      });
    }

    return lotesConCantidad.map((lote: any) => ({
      id: lote.id,
      groupId: lote.id,
      code: lote.codigo || [lote.tipoCafe, lote.calidad].filter(Boolean).join(' '),
      peso: Number(lote.cantidad ?? 0),
      total: Number(lote.cantidad ?? 0) * Number(lote.precio ?? 0),
      precioCompra: null,
      fechaIngreso: null,
      restante: null,
      canDelete: lotesConCantidad.length > 1,
    }));
  }, [lotesConCantidad, ventaFifoBreakdown]);

  const validarPasoVentaSeguro = React.useCallback(() => {
    if (typeof validarPasoVenta === 'function') {
      return validarPasoVenta();
    }

    if (!fechaVentaValidacion?.isValid) {
      return fechaVentaValidacion?.message ?? 'Selecciona la fecha de venta.';
    }
    if (!modoVenta) return 'Selecciona como deseas realizar la venta.';
    if (modoVenta === 'TOTAL') {
      const tipoSinPrecio = resumenDisponiblePorTipo.find((item: any) =>
        preciosVentaTotalInvalidos.has(item.tipoCafeId),
      );
      if (tipoSinPrecio) {
        const precio = preciosVentaTotal[tipoSinPrecio.tipoCafeId] ?? '';
        const limitesVenta = getLimitesVenta();
        if (!precio.trim()) return 'Ingresa el precio por kilo.';
        if (Number(precio) > limitesVenta.maxPrecioVentaKg) return 'El precio supera el máximo permitido.';
        if (Number(precio) < limitesVenta.minPrecioVentaKg) return 'El precio está por debajo del mínimo permitido.';
        return 'Ingresa solo números válidos.';
      }
    }
    if (modoVenta === 'PARCIAL' && !lotesConCantidad.length) {
      return 'Ingresa al menos una cantidad para continuar.';
    }
    return null;
  }, [
    fechaVentaValidacion?.isValid,
    fechaVentaValidacion?.message,
    lotesConCantidad.length,
    modoVenta,
    preciosVentaTotal,
    preciosVentaTotalInvalidos,
    resumenDisponiblePorTipo,
    validarPasoVenta,
  ]);

  if (registroErrorMensaje) {
    return (
      <CafeSmartErrorState
        fullScreen
        title="No se pudo guardar la venta"
        message={registroErrorMensaje}
        info="Los datos de la venta siguen disponibles. Puedes volver a editar o intentar nuevamente."
        secondaryLabel="Volver a editar"
        onPrimary={() => void confirmar()}
        onSecondary={() => {
          setRegistroErrorMensaje(null);
          setPaso(3);
        }}
        primaryBusy={guardandoVenta}
      />
    );
  }

  if (ventaGuardada) {
    return (
      <div>
        <TransactionSuccessScreen
          title={ventaGuardada.pendienteOffline ? 'Venta guardada en este dispositivo' : 'Venta registrada con éxito'}
          message={
            ventaGuardada.pendienteOffline
              ? 'Se validará y descontará del inventario cuando vuelva la conexión.'
              : 'La venta fue guardada correctamente en el sistema.'
          }
          info={
            ventaGuardada.pendienteOffline
              ? 'No se descontó inventario real. El backend validará la venta al sincronizar.'
              : 'El movimiento quedó disponible en tus registros de venta.'
          }
          totalLabel="Total vendido"
          totalValue={money(ventaGuardada.totalVenta)}
          primaryLabel="Registrar otra venta"
          onPrimary={reiniciar}
          onHome={() => navigate('/inicio')}
          onShareSummary={(format) => {
            const firstItem = ventaGuardada.items[0];
            const uniqueTipos = Array.from(
              new Set(ventaGuardada.items.map((item) => item.tipoCafe).filter(Boolean)),
            );
            const uniqueCalidades = Array.from(
              new Set(ventaGuardada.items.map((item) => item.calidad).filter(Boolean)),
            );

            return shareMovementSummary({
              type: 'venta',
              format,
              data: {
                cliente: ventaGuardada.clienteNombre,
                tipoCafe:
                  uniqueTipos.length === 1
                    ? uniqueTipos[0]
                    : firstItem?.tipoCafe
                      ? 'Varios'
                      : undefined,
                calidad:
                  uniqueCalidades.length === 1
                    ? uniqueCalidades[0]
                    : firstItem?.calidad
                      ? 'Varias'
                      : undefined,
                totalKg: ventaGuardada.totalKg,
                precioKg:
                  ventaGuardada.totalKg > 0
                    ? ventaGuardada.totalVenta / ventaGuardada.totalKg
                    : undefined,
                totalVenta: ventaGuardada.totalVenta,
                fecha: ventaGuardada.fecha,
                referencia: ventaGuardada.referenciaId,
              },
            });
          }}
          capacityNotice={
            ventaGuardada.items.length > 0 ? (
              <section className="rounded-[18px] border border-blue-100 bg-[#f8fbff] p-3 text-left dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-950 dark:text-slate-100">
                      Historial completo de la venta
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                      {ventaGuardada.items.length} registros · {kg(ventaGuardada.totalKg)} · {money(ventaGuardada.totalVenta)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDetails((value) => !value)}
                    className="inline-flex min-h-[34px] shrink-0 items-center justify-center rounded-[12px] border border-[#cdd8ef] bg-white px-3 text-xs font-black text-[#173ea6] transition hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-slate-700"
                    {...ariaExpanded(showDetails)}
                  >
                    {showDetails ? 'Ocultar' : 'Ver detalles'}
                  </button>
                </div>

                {showDetails ? (
                  <div className="mt-3 space-y-2">
                    {ventaGuardada.items.map((item, index) => (
                      <article
                        key={`${item.codigo}-${index}`}
                        className="rounded-[14px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <p className="text-sm font-black uppercase text-slate-950 dark:text-slate-100">
                          {[item.tipoCafe, item.calidad].filter(Boolean).join(' ') || item.codigo}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">
                          {kg(item.cantidadKg)} · {money(item.subtotal)}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null
          }
          rows={[
            {
              icon: '1',
              label: 'Cliente',
              value: ventaGuardada.clienteNombre,
            },
            {
              icon: <ShoppingCart size={16} />,
              label: 'Total kg',
              value: kg(ventaGuardada.totalKg),
            },
          ]}
        />
      </div>
    );
  }

  if (cargando) {
    return <LoadingCard mode="page" text="Cargando inventario para venta..." />;
  }

  if (loadError) {
    return (
      <CafeSmartErrorState
        fullScreen
        title={
          loadError.includes('No hay inventario guardado')
            ? 'No hay inventario guardado'
            : loadError.includes('No hay clientes guardados')
              ? 'No hay clientes guardados'
              : 'No se pudo cargar el inventario'
        }
        message={
          loadError.includes('No hay inventario guardado') ||
          loadError.includes('No hay clientes guardados')
            ? loadError
            : 'Revisa tu conexión e intenta de nuevo.'
        }
        primaryLabel="Reintentar"
        secondaryLabel="Volver a inicio"
        onPrimary={() => void cargarLotes()}
        onSecondary={() => navigate('/inicio')}
      />
    );
  }

  if (!cargando && !loadError && totalDisponibleVenta <= 0) {
    return (
      <NoInventorySalesScreen
        onBack={() => navigate('/inicio')}
        onRegisterPurchase={() => navigate('/compras')}
      />
    );
  }

  return (
    <div className="cs-workflow-page min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-5 pb-[145px] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-[430px] space-y-4">
        <header className="px-4 py-4 pt-6">
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              onClick={volverDesdeEncabezado}
              className="absolute left-0 inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-900 transition hover:bg-white/70 hover:opacity-75 dark:bg-slate-800 dark:text-blue-100 dark:hover:bg-slate-700"
              aria-label={
                paso > 1 ? 'Volver al paso anterior' : 'Volver a la pantalla anterior'
              }
            >
              <ArrowLeft size={22} />
            </button>
            <h1 className="text-[1.35rem] font-semibold text-slate-900 dark:text-slate-100">
              Nueva Venta
            </h1>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between text-[1.05rem] font-medium text-slate-900 dark:text-slate-100">
              <span>
                Paso {paso}: {pasoActual.titulo}
              </span>
              <span className="text-[1.05rem] text-[#002f6c] dark:text-blue-100">{paso} de 3</span>
            </div>
            <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#d0dbeb] dark:bg-slate-800">
              <div
                className={`h-full rounded-full bg-[#04337b] transition-all duration-300 ${
                  pasoActual.progreso === 33
                    ? 'w-1/3'
                    : pasoActual.progreso === 66
                      ? 'w-2/3'
                      : 'w-full'
                }`}
              />
            </div>
          </div>
        </header>
        {(
          <>
            {paso === 2 ? (
              <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[0.7rem] font-black uppercase tracking-[0.12em] text-[#52657d] dark:text-slate-300">
                  Seleccionar café
                </p>
                <h2 className="mt-2 text-[1.3rem] font-semibold text-[#102d92] dark:text-blue-100">
                  ¿Cómo deseas realizar la venta?
                </h2>

                <div className="mt-3 rounded-[14px] border border-[#dbe1f1] bg-[#f7f8fe] p-3 dark:border-slate-700 dark:bg-slate-950">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-300">
                    Cliente seleccionado
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {clienteSeleccionado?.nombre ?? 'Sin cliente'}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {clienteSeleccionado?.documento ?? 'Selección pendiente'}
                  </p>
                </div>

                <div className="mt-4 rounded-[14px] border border-[#dbe1f1] bg-[#f7f8fe] p-3 dark:border-slate-700 dark:bg-slate-950">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className={`${fieldLabelClass} mb-0`}>
                      Fecha de venta
                    </span>
                    <div className="min-w-0 flex-1 sm:max-w-[55%]">
                      <CafeSmartDatePicker
                        value={fechaVenta}
                        minDate={BUSINESS_MIN_DATE_VALUE}
                        maxDate={getTodayLocalDateValue()}
                        open={fechaVentaPickerOpen}
                        label="Fecha de venta"
                        placeholder="Selecciona fecha"
                        clearable={false}
                        dialogLabel="Calendario de fecha de venta"
                        onToggle={() => setFechaVentaPickerOpen((open) => !open)}
                        onClose={() => setFechaVentaPickerOpen(false)}
                        onChange={(value) => {
                          setFechaVenta(value || getTodayLocalDateValue());
                          setSubmitError(null);
                        }}
                      />
                    </div>
                  </div>
                  {fechaVentaInvalida ? (
                    <InlineGuidedError
                      message={getVentasGuidance(
                        fechaVentaValidacion.message ??
                          'Selecciona la fecha de venta.',
                      )}
                      className="mt-2"
                    />
                  ) : null}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setModoVenta('PARCIAL');
                      setIntentoPaso2(false);
                      setSubmitError(null);
                    }}
                    disabled={sinInventario}
                    className={`min-h-[86px] rounded-[18px] border p-3.5 text-left transition ${
                      modoVenta === 'PARCIAL'
                        ? 'border-[#102d92] bg-[#eef4ff] shadow-[0_10px_24px_rgba(16,45,146,0.08)]'
                        : sinInventario
                          ? 'cursor-not-allowed border-[#e3e7f3] bg-slate-50 opacity-60'
                          : modoInvalido
                            ? 'border-[#f2c17b] bg-[#fff9ef]'
                            : 'border-[#e3e7f3] bg-white'
                    }`}
                  >
                    <p className="text-base font-black text-slate-900">
                      Venta parcial
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Seleccionar cantidad a vender
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModoVenta('TOTAL');
                      setIntentoPaso2(false);
                      setSubmitError(null);
                    }}
                    disabled={sinInventario}
                    className={`min-h-[86px] rounded-[18px] border p-3.5 text-left transition ${
                      modoVenta === 'TOTAL'
                        ? 'border-[#102d92] bg-[#eef4ff] shadow-[0_10px_24px_rgba(16,45,146,0.08)]'
                        : sinInventario
                          ? 'cursor-not-allowed border-[#e3e7f3] bg-slate-50 opacity-60'
                          : modoInvalido
                            ? 'border-[#f2c17b] bg-[#fff9ef]'
                            : 'border-[#e3e7f3] bg-white'
                    }`}
                  >
                    <p className="text-base font-black text-slate-900">
                      Venta total
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Vender todo el inventario disponible
                    </p>
                  </button>
                </div>
                {sinInventario ? (
                  <InlineGuidedError
                    message={getVentasGuidance(
                      'No hay lotes disponibles para vender.',
                    )}
                    className="mt-2"
                  />
                ) : null}
                {modoInvalido ? (
                  <InlineGuidedError
                    message={getVentasGuidance(
                      'Selecciona como deseas realizar la venta.',
                    )}
                    className="mt-2"
                  />
                ) : null}
                {modoVenta === 'TOTAL' ? (
                  <div className="mt-6 space-y-4">
                    <div className="text-center">
                      <h2 className="text-[1.5rem] font-black leading-tight text-slate-950">
                        Se venderá todo el café disponible en inventario
                      </h2>
                      <p className="mt-2 text-sm font-semibold text-slate-500">
                        Incluye todos los tipos y calidades disponibles.
                      </p>
                    </div>

                    <article className="rounded-[18px] bg-white p-4 shadow-sm">
                      <p className="text-[0.72rem] font-black uppercase tracking-[0.12em] text-slate-500">
                        Resumen por tipo
                      </p>
                      <div className="mt-4 divide-y divide-slate-100">
                        {resumenDisponiblePorTipo.map((item) => (
                          <div
                            key={item.tipoCafeId}
                            className="flex items-center justify-between py-3"
                          >
                            <span className="font-semibold text-slate-600">
                              Café {item.tipoCafe.toLowerCase()}
                            </span>
                            <span className="font-black text-slate-950">
                              {kg(item.pesoKg)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="rounded-[18px] border border-[#e2e7f2] bg-[#f8faff] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold text-slate-700">
                          Total a vender
                        </span>
                        <span className="text-[1.55rem] font-black text-slate-950">
                          {kg(totalDisponibleVenta)}
                        </span>
                      </div>
                    </article>

                    <div className="rounded-[18px] bg-white p-4 shadow-sm">
                      <p className="text-[0.72rem] font-black uppercase tracking-[0.12em] text-slate-500">
                        Precio por kg por tipo
                      </p>
                      <div className="mt-3 space-y-3">
                        {resumenDisponiblePorTipo.map((item) => {
                          const precioTipo =
                            preciosVentaTotal[item.tipoCafeId] ?? '';
                          const precioTipoFormatoInvalido =
                            modoVenta === 'TOTAL' &&
                            precioTipo.trim() !== '' &&
                            !isValidPrecioInput(precioTipo);
                          const precioTipoInvalido =
                            modoVenta === 'TOTAL' &&
                            (intentoPaso2 || precioTipo.trim() !== '') &&
                            (precioTipoFormatoInvalido ||
                              toNum(precioTipo) < getLimitesVenta().minPrecioVentaKg);
                          const precioTipoSuperaMaximo =
                            modoVenta === 'TOTAL' &&
                            precioTipo.trim() !== '' &&
                            toNum(precioTipo) > getLimitesVenta().maxPrecioVentaKg;

                          return (
                            <div key={item.tipoCafeId}>
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <span className={fieldLabelClass}>
                                  Café {item.tipoCafe.toLowerCase()}
                                </span>
                                <span className={fieldHelpTextClass}>
                                  {kg(item.pesoKg)}
                                </span>
                              </div>
                              <label
                                className={`${fieldInputClass} flex min-h-[56px] items-center rounded-[14px] px-4 ${
                                  precioTipoInvalido
                                    ? 'border-[#ef4444]'
                                    : ''
                                }`}
                              >
                                <span className="mr-3 text-xl font-black text-[#1f3fa7]">
                                  $
                                </span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={8}
                                  value={precioTipo}
                                  onChange={(event) =>
                                    actualizarPrecioVentaTotal(
                                      item.tipoCafeId,
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Ej. 14500"
                                  className="w-full bg-transparent text-xl font-black text-slate-950 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                                />
                              </label>
                              {precioTipoInvalido ? (
                                <InlineGuidedError
                                  message={getVentasGuidance(
                                    precioTipoSuperaMaximo
                                      ? 'El precio ingresado supera el máximo permitido.'
                                      : precioTipo.trim()
                                        ? 'Ingresa un precio válido por kilogramo.'
                                        : 'Ingresa el precio por kilo.',
                                  )}
                                  className="mt-2"
                                />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                      {precioTotalInvalido ? (
                        <p className="mt-2 text-xs font-semibold text-[#b42318]">
                          Completa el precio de cada tipo de café para
                          continuar.
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {modoVenta === 'PARCIAL' ? (
                  <div className="mt-5 space-y-3">
                    <div className="space-y-2 rounded-[18px] border border-[#dfe6f4] bg-[#f8faff] p-3">
                      <div className="flex items-center gap-2 rounded-[12px] bg-white px-3 py-2">
                        <p className={`${fieldHelpTextClass} min-w-0 flex-1 leading-5`}>
                          Completa cantidad y precio, luego confirma el ajuste para agregarlo a la venta.
                        </p>
                        {bodegaConfig?.capacidadKg ? (
                          <button
                            type="button"
                            onClick={() => setShowBodegaVentaInfo(true)}
                            aria-label="Ver espacio disponible en bodega"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-100 bg-sky-50 text-sky-700 shadow-sm transition hover:bg-sky-100 active:scale-95"
                          >
                            <Warehouse size={18} />
                          </button>
                        ) : null}
                      </div>
                      <label className="relative block">
                        <Search
                          size={16}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                          aria-hidden="true"
                        />
                        <input
                          type="text"
                          value={busquedaCafeVenta}
                          onChange={(event) => {
                            setBusquedaCafeVenta(event.target.value);
                            setMostrarTodosCafeVenta(false);
                          }}
                          placeholder="Buscar café"
                          className={`${fieldInputClass} h-11 rounded-[14px] pl-9 pr-3`}
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <CompactSelect
                          id="venta-tipo-cafe-filtro"
                          value={tipoCafeFiltroVenta}
                          options={tipoCafeFiltroOpciones}
                          placeholder="Tipo"
                          open={tipoCafeFiltroOpen}
                          icon={<Coffee size={16} />}
                          onToggle={() => setTipoCafeFiltroOpen((open) => !open)}
                          onClose={() => setTipoCafeFiltroOpen(false)}
                          onChange={(value) => {
                            setTipoCafeFiltroVenta(value);
                            setMostrarTodosCafeVenta(false);
                          }}
                        />
                        <CompactSelect
                          id="venta-calidad-filtro"
                          value={calidadFiltroVenta}
                          options={calidadFiltroOpciones}
                          placeholder="Calidad"
                          open={calidadFiltroOpen}
                          icon={<CheckCircle2 size={16} />}
                          onToggle={() => setCalidadFiltroOpen((open) => !open)}
                          onClose={() => setCalidadFiltroOpen(false)}
                          onChange={(value) => {
                            setCalidadFiltroVenta(value);
                            setMostrarTodosCafeVenta(false);
                          }}
                        />
                      </div>
                    </div>

                    {lotesVentaParcialUsaSimilares ? (
                      <p className="rounded-[12px] border border-[#dbeafe] bg-[#eff6ff] px-3 py-2 text-xs font-bold text-[#1d4ed8]">
                        Mostrando resultados similares
                      </p>
                    ) : null}

                    {lotesVentaParcialVisibles.map((lote) => {
                      const cantidad = toNum(lote.cantidadKg);
                      const cantidadIngresada = lote.cantidadKg.trim() !== '';
                      const disponibleVenta = getDisponibleVenta(lote);
                      const cantidadFormatoInvalido =
                        modoVenta === 'PARCIAL' &&
                        cantidadIngresada &&
                        cantidad <= 0;
                      const cantidadExcedeDisponible =
                        modoVenta === 'PARCIAL' &&
                        cantidadIngresada &&
                        cantidad > disponibleVenta;
                      const cantidadEntradaInvalida =
                        modoVenta === 'PARCIAL' &&
                        cantidadIngresada &&
                        !cantidadFormatoInvalido &&
                        !cantidadExcedeDisponible &&
                        !isValidCantidadInput(lote.cantidadKg, disponibleVenta);
                      const cantidadInvalida =
                        modoVenta === 'PARCIAL' &&
                        cantidadIngresada &&
                        (cantidadFormatoInvalido ||
                          cantidadExcedeDisponible ||
                          cantidadEntradaInvalida);
                      const precioFormatoInvalido =
                        modoVenta === 'PARCIAL' &&
                        lote.precioKg.trim() !== '' &&
                        !isValidPrecioInput(lote.precioKg);
                      const precioInvalido =
                        modoVenta === 'PARCIAL' &&
                        cantidadIngresada &&
                        (precioFormatoInvalido ||
                          toNum(lote.precioKg) < getLimitesVenta().minPrecioVentaKg);
                      const ajusteVentaAbierto = ventaParcialOpenId === lote.id;
                      const alertaTarjeta = ventaParcialCardAlerts[lote.id];
                      const ajustePendiente =
                        !ajustesVentaParcialConfirmados[lote.id] &&
                        toNum(lote.cantidadKg) > 0;
                      const codigoVisible =
                        lotesVentaCodeMap.get(lote.id) ||
                        lote.codigo ||
                        getCoffeeCodePrefix(lote);
                      const nombreCafe = formatCoffeeFullName(lote);
                      const qualityStyles = getQualityStyles(lote.calidad);
                      const ajusteConfirmado =
                        Boolean(ajustesVentaParcialConfirmados[lote.id]) &&
                        cantidad > 0;

                      return (
                        <article
                          key={lote.id}
                          className={`rounded-[14px] border p-2.5 shadow-[0_6px_18px_rgba(15,23,42,0.045)] transition ${qualityStyles.card} ${qualityStyles.accent} ${
                            ajusteConfirmado ? 'ring-2 ring-[#1f3fa7]/15' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${qualityStyles.icon}`}>
                                <Coffee size={16} aria-hidden="true" />
                              </span>
                              <div className="min-w-0">
                                <p className={`truncate text-[0.95rem] font-black uppercase leading-tight ${qualityStyles.text}`}>
                                  {codigoVisible}
                                </p>
                                <p className="mt-0.5 truncate text-[0.68rem] font-semibold text-slate-600 dark:text-slate-300">
                                  {nombreCafe} · Disponible: {kg(disponibleVenta)}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setVentaParcialOpenId((actual) =>
                                  actual === lote.id ? null : lote.id,
                                )
                              }
                              className={`inline-flex min-h-[34px] shrink-0 items-center rounded-[10px] border px-3 text-[0.68rem] font-black transition ${
                                ajusteConfirmado
                                  ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white dark:border-blue-500 dark:bg-blue-600'
                                  : 'border-[#dbe4ff] bg-white text-[#102d92] dark:border-blue-500/50 dark:bg-blue-500/15 dark:text-blue-100'
                              }`}
                              aria-label={`${ajusteVentaAbierto ? 'Ocultar ajuste' : 'Vender'} ${codigoVisible}`}
                              {...ariaExpanded(ajusteVentaAbierto)}
                            >
                              {ajusteConfirmado ? 'Ajustar' : 'Vender'}
                            </button>
                          </div>

                          {cantidad > 0 ? (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span className={`rounded-full border px-2 py-1 text-[0.6rem] font-black ${qualityStyles.chip}`}>
                                Peso: {kg(cantidad)}
                              </span>
                              <span className="rounded-full border border-[#dbe4ff] bg-white px-2 py-1 text-[0.6rem] font-black text-[#102d92] dark:border-slate-600 dark:bg-slate-900 dark:text-blue-100">
                                Precio/kg: {money(toNum(lote.precioKg))}
                              </span>
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[0.6rem] font-black text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200">
                                Total: {money(cantidad * toNum(lote.precioKg))}
                              </span>
                              {!ajustesVentaParcialConfirmados[lote.id] ? (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[0.58rem] font-black text-amber-800">
                                  Pendiente
                                </span>
                              ) : null}
                            </div>
                          ) : null}

                          {ajusteVentaAbierto ? (
                            <>
                              <div className="mt-2 grid grid-cols-2 gap-2 rounded-[12px] border border-white/80 bg-white/70 p-2 dark:border-slate-700 dark:bg-slate-900/70">
                                <label className="min-w-0">
                                  <span className={`${fieldLabelClass} text-[0.58rem] uppercase tracking-[0.08em]`}>
                                    Cantidad
                                  </span>
                                  <div className={`${fieldInputClass} mt-1 flex h-9 min-h-0 items-center rounded-[9px] px-2 py-0`}>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      pattern="^\\d{0,8}(?:\\.\\d{0,3})?$"
                                      maxLength={12}
                                      value={lote.cantidadKg}
                                      onChange={(event) =>
                                        updateLote(
                                          lote.id,
                                          'cantidadKg',
                                          event.target.value,
                                        )
                                      }
                                      placeholder="0"
                                      className="min-w-0 flex-1 bg-transparent text-right text-[0.78rem] font-black text-slate-900 outline-none dark:text-slate-100"
                                      aria-label={`Cantidad a vender de ${codigoVisible}`}
                                    />
                                    <span className="ml-1 shrink-0 text-[0.62rem] font-black text-slate-500 dark:text-slate-300">
                                      kg
                                    </span>
                                  </div>
                                  {cantidadFormatoInvalido ? (
                                    <p className={`${fieldHelpTextClass} text-[0.58rem] text-rose-700 dark:text-rose-300`}>
                                      Ingresa una cantidad mayor a 0.
                                    </p>
                                  ) : cantidadExcedeDisponible ? (
                                    <p className={`${fieldHelpTextClass} text-[0.58rem] text-rose-700 dark:text-rose-300`}>
                                      No puedes superar {kg(disponibleVenta)}.
                                    </p>
                                  ) : cantidadEntradaInvalida ? (
                                    <p className={`${fieldHelpTextClass} text-[0.58rem] text-rose-700 dark:text-rose-300`}>
                                      Número válido hasta {kg(disponibleVenta)}.
                                    </p>
                                  ) : null}
                                </label>
                                <label className="min-w-0">
                                  <span className={`${fieldLabelClass} text-[0.58rem] uppercase tracking-[0.08em]`}>
                                    Precio/kg
                                  </span>
                                  <div className={`${fieldInputClass} mt-1 flex h-9 min-h-0 items-center rounded-[9px] px-2 py-0`}>
                                    <span className="mr-1 shrink-0 text-[0.62rem] font-black text-slate-500 dark:text-slate-300">
                                      $
                                    </span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="^[0-9]{0,8}$"
                                      maxLength={8}
                                      value={lote.precioKg}
                                      onChange={(event) =>
                                        updateLote(
                                          lote.id,
                                          'precioKg',
                                          event.target.value,
                                        )
                                      }
                                      placeholder="Precio"
                                      className="min-w-0 flex-1 bg-transparent text-right text-[0.78rem] font-black text-slate-900 outline-none dark:text-slate-100"
                                      aria-label={`Precio por kg de ${codigoVisible}`}
                                    />
                                  </div>
                                  {precioFormatoInvalido ? (
                                    <p className={`${fieldHelpTextClass} text-[0.58rem] text-rose-700 dark:text-rose-300`}>
                                      Ingresa un precio válido.
                                    </p>
                                  ) : null}
                                </label>
                              </div>
                              <div className="mt-2 flex items-center justify-between rounded-[10px] bg-[#eef3ff] px-3 py-2 text-[0.72rem] font-black text-[#102d92] dark:bg-blue-500/15 dark:text-blue-100">
                                <span>
                                  Total: {kg(cantidad)} x {money(toNum(lote.precioKg))}/kg
                                </span>
                                <span>{money(cantidad * toNum(lote.precioKg))}</span>
                              </div>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => confirmarAjusteParcial(lote)}
                                  disabled={cantidadInvalida || precioInvalido}
                                  className={`${primaryButtonClass} min-h-[36px] rounded-[10px] text-[0.68rem] ${
                                    cantidadInvalida || precioInvalido
                                      ? 'cursor-not-allowed bg-slate-400 dark:bg-slate-600'
                                      : ''
                                  }`}
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => cancelarAjusteParcial(lote.id)}
                                  className={`${secondaryButtonClass} min-h-[36px] rounded-[10px] text-[0.68rem]`}
                                >
                                  Cancelar
                                </button>
                              </div>
                              {alertaTarjeta ? (
                                <AppFeedbackMessage
                                  variant="error"
                                  title={alertaTarjeta.title}
                                  description={alertaTarjeta.detail}
                                  className="mt-2"
                                />
                              ) : ajustePendiente ? (
                                <AppFeedbackMessage
                                  variant="warning"
                                  title={`Ajuste pendiente en ${codigoVisible}.`}
                                  description="Confirma o cancela este ajuste."
                                  className="mt-2"
                                />
                              ) : null}
                            </>
                          ) : null}
                        </article>
                      );
                    })}
                    {lotesVentaParcialFiltrados.length > lotesVentaParcialVisibles.length ? (
                      <button
                        type="button"
                        onClick={() => setMostrarTodosCafeVenta(true)}
                        className={`${secondaryButtonClass} min-h-[42px] w-full rounded-[14px] text-sm`}
                      >
                        Ver más cafés
                      </button>
                    ) : null}
                    {lotesVentaParcialFiltrados.length === 0 ? (
                      <div className="rounded-[16px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-5 text-center text-sm font-semibold text-slate-500">
                        No encontramos cafés con esos filtros.
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-30 mt-4 space-y-3 rounded-[18px] border border-[#c7d8ff] bg-white/95 p-3 text-[#102d92] shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur dark:border-slate-700 dark:bg-slate-950/95 dark:text-blue-100">
                <article className="rounded-[14px] border border-[#dbe4ff] bg-white/80 p-3 text-[#102d92] dark:border-slate-700 dark:bg-slate-900/80 dark:text-blue-100">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-[10px] bg-[#eef3ff] px-3 py-2 dark:bg-blue-500/15">
                      <p className="text-[0.58rem] font-black uppercase tracking-[0.08em] text-[#334b85] dark:text-blue-100">
                        Kg seleccionados
                      </p>
                      <p className="mt-0.5 text-sm font-black">{kg(totalKg)}</p>
                    </div>
                    <div className="rounded-[10px] bg-[#eef3ff] px-3 py-2 text-right dark:bg-blue-500/15">
                      <p className="text-[0.58rem] font-black uppercase tracking-[0.08em] text-[#334b85] dark:text-blue-100">
                        Total estimado
                      </p>
                      <p className="mt-0.5 text-sm font-black">{money(totalEstimado)}</p>
                    </div>
                  </div>
                </article>
                {submitError && paso === 2 && modoVenta === 'PARCIAL' ? (
                  <AppFeedbackMessage
                    variant="warning"
                    title={
                      submitError === 'Todavía hay cafés sin confirmar.'
                        ? 'Todavía hay cafés sin confirmar.'
                        : 'Revisa este ajuste.'
                    }
                    description={
                      submitError === 'Todavía hay cafés sin confirmar.'
                        ? 'Confirma o cancela únicamente los cafés marcados antes de continuar.'
                        : submitError
                    }
                    className="mt-0"
                  />
                ) : submitError && paso === 2 && !modoInvalido ? (
                  <AppFeedbackMessage
                    variant="error"
                    title={getVentasGuidance(submitError).why}
                    description={getVentasGuidance(submitError).action}
                    className="mt-4"
                  >
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={siguiente}
                        className={`${primaryButtonClass} min-h-[40px] rounded-[12px] text-xs`}
                      >
                        Reintentar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitError(null);
                          setIntentoPaso2(false);
                          setPaso(1);
                        }}
                        className={`${dangerButtonClass} min-h-[40px] rounded-[12px] bg-white text-xs text-rose-800 ring-1 ring-rose-200 dark:bg-slate-900 dark:text-rose-200`}
                      >
                        Volver a ventas
                      </button>
                    </div>
                  </AppFeedbackMessage>
                ) : null}

                <div className="grid grid-cols-[0.8fr_1.2fr] gap-3">
                  <button
                    type="button"
                    onClick={volverPasoAnterior}
                    className={`${secondaryButtonClass} min-h-[52px] rounded-[14px] text-sm`}
                  >
                    <ArrowLeft size={16} />
                    Regresar
                  </button>
                  <button
                    type="button"
                    onClick={siguiente}
                    disabled={sinInventario || validandoPasoVenta}
                    className={`${primaryButtonClass} min-h-[52px] w-full rounded-[16px] text-sm ${
                      sinInventario || validandoPasoVenta
                        ? 'cursor-not-allowed bg-[#7f93cf] dark:bg-slate-600'
                        : ''
                    }`}
                  >
                    {validandoPasoVenta ? (
                      <>
                        <LoaderCircle size={18} className="animate-spin" />
                        Validando...
                      </>
                    ) : (
                      <>
                        Siguiente paso
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </div>
                </div>
              </section>
            ) : null}

            {paso === 1 ? (
              <section className="flex flex-col gap-4">
                <SelectableOptionCard
                  active={clienteMetodo === 'BUSCAR'}
                  icon={<Search size={20} />}
                  title="Buscar cliente"
                  subtitle="Selecciona un cliente registrado"
                  onClick={() => {
                    setClienteMetodo('BUSCAR');
                    if (clienteSeleccionado?.id === CLIENTE_GENERAL.id) {
                      setClienteSeleccionado(null);
                    }
                  }}
                />

                {clienteMetodo === 'BUSCAR' ? (
                  <div className="space-y-4 rounded-[24px] border border-[#e3e9f5] bg-[#fbfcff] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-[1.05rem] font-black leading-6 text-slate-950">
                          Clientes registrados
                        </p>
                        <p className="mt-1 text-sm font-medium leading-5 text-slate-500">
                          Máximo 2 recientes
                        </p>
                      </div>
                      <span
                        className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] px-2 text-sm font-black text-[#1f3fa7] shadow-[0_8px_18px_rgba(31,63,167,0.14)]"
                        aria-label={`${clientes.length} clientes registrados`}
                      >
                        {clientes.length}
                      </span>
                    </div>

                    {sinClientesRegistrados ? (
                      <div className="rounded-[16px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        <p className="font-bold text-slate-800 dark:text-slate-100">
                          Aún no tienes clientes registrados.
                        </p>
                        <p className="mt-1 leading-5 text-slate-600 dark:text-slate-300">
                          Registra un cliente para asociarlo a esta venta.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setClienteMetodo('REGISTRAR');
                            setClienteSeleccionado(null);
                            setSubmitError(null);
                            setIntentoPaso1(false);
                            setClienteEditando(null);
                            setClienteForm({ nombre: '', telefono: '', documento: '', tipoDocumento: '' });
                            setClienteFormErrors({});
                            setClienteFormError(null);
                            setMostrarModal(true);
                          }}
                          className={`${primaryButtonClass} mt-3 min-h-[40px] rounded-[12px] text-sm`}
                        >
                          Registrar cliente
                        </button>
                      </div>
                    ) : (
                      <>
                        {clientesRecientesUsaSimilares ? (
                          <p className="rounded-[12px] border border-[#dbeafe] bg-[#eff6ff] px-3 py-2 text-xs font-bold text-[#1d4ed8]">
                            Mostrando resultados similares
                          </p>
                        ) : null}
                        <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2">
                          {clientesRecientes.slice(0, 2).map((cliente) => (
                            <ClienteCard
                              key={cliente.id}
                              cliente={cliente}
                              active={clienteSeleccionado?.id === cliente.id}
                              onSelect={() => seleccionarCliente(cliente)}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {!sinClientesRegistrados ? (
                          <button
                            type="button"
                            onClick={() => {
                              setMostrarModalClientes(true);
                              window.setTimeout(() => {
                                clientesSearchRef.current?.focus();
                              }, 80);
                            }}
                            className={`${secondaryButtonClass} group min-h-[52px] w-full justify-between rounded-[16px] text-left text-sm`}
                          >
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eef4ff] transition group-hover:bg-white">
                                <Search size={16} />
                              </span>
                              Ver todos →
                            </span>
                            <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
                          </button>
                    ) : null}
                  </div>
                ) : null}

                <SelectableOptionCard
                  active={clienteMetodo === 'GENERAL'}
                  icon={<User size={20} />}
                  title="Cliente genérico"
                  subtitle="Venta rápida sin cliente registrado"
                  onClick={() => {
                    setClienteMetodo('GENERAL');
                    seleccionarCliente(CLIENTE_GENERAL);
                  }}
                />

                <SelectableOptionCard
                  active={clienteMetodo === 'REGISTRAR'}
                  icon={<Plus size={20} />}
                  title="Registrar cliente"
                  subtitle="Crear un nuevo cliente"
                  onClick={() => {
                    setClienteMetodo('REGISTRAR');
                    setClienteSeleccionado(null);
                    setSubmitError(null);
                    setIntentoPaso1(false);
                    setClienteEditando(null);
                    setClienteForm({ nombre: '', telefono: '', documento: '', tipoDocumento: '' });
                    setClienteFormErrors({});
                    setClienteFormError(null);
                    setMostrarModal(true);
                  }}
                />

                {clienteSeleccionado ? (
                  <article className="mt-2 rounded-[18px] border border-[#d9e4ff] bg-[#f7faff] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[0.78rem] font-black uppercase tracking-[0.08em] text-[#1f3fa7]">
                          Cliente seleccionado
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1f3fa7] text-xs font-black text-white">
                            <User size={16} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[1rem] font-bold text-slate-900">
                              {clienteSeleccionado.nombre}
                            </p>
                            <p className="truncate text-[0.86rem] font-medium text-slate-500">
                              {clienteSeleccionado.rapido
                                ? 'Venta rápida'
                                : clienteSeleccionado.detalle || clienteSeleccionado.documento}
                            </p>
                          </div>
                        </div>
                      </div>
                      {!clienteSeleccionado.rapido ? (
                        <button
                          type="button"
                          onClick={() => setMostrarModal(true)}
                          className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#1f3fa7] shadow-sm"
                        >
                          Cambiar cliente
                        </button>
                      ) : null}
                    </div>
                  </article>
                ) : null}

                {clienteInvalido ? (
                  <InlineGuidedError
                    message={getClienteSeleccionGuidance()}
                  />
                ) : null}
                {submitError && paso === 1 ? (
                  <AppFeedbackMessage
                    variant="error"
                    title={getVentasGuidance(submitError).why}
                    description={getVentasGuidance(submitError).action}
                  >
                    {submitError.includes('Guarda el cliente') ? null : (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={siguiente}
                          className="inline-flex min-h-[40px] items-center justify-center rounded-[12px] bg-[#1f3fa7] px-3 text-xs font-black text-white"
                        >
                          Reintentar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSubmitError(null);
                            setIntentoPaso1(false);
                            setPaso(1);
                          }}
                          className="inline-flex min-h-[40px] items-center justify-center rounded-[12px] border border-rose-200 bg-white px-3 text-xs font-black text-rose-800"
                        >
                          Volver a ventas
                        </button>
                      </div>
                    )}
                  </AppFeedbackMessage>
                ) : null}

                <button
                  type="button"
                  onClick={siguiente}
                  disabled={validandoPasoVenta}
                  className="inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[16px] bg-[#1f3fa7] px-5 py-4 text-[1.1rem] font-semibold text-white shadow-[0_12px_28px_rgba(16,45,146,0.26)] transition hover:bg-[#18358f] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {validandoPasoVenta ? (
                    <>
                      <LoaderCircle size={20} className="animate-spin" />
                      Validando...
                    </>
                  ) : (
                    <>
                      Siguiente paso
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </section>
            ) : null}

            {paso === 3 ? (
              <section className="space-y-4">
                <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-4 shadow-sm">
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.12em] text-[#52657d]">
                    Datos de la venta
                  </p>
                  <h2 className="mt-2 text-[1.3rem] font-semibold text-[#102d92]">
                    Confirma los datos de la venta
                  </h2>

                  <div className="mt-4 grid gap-2 rounded-[14px] border border-[#dbe1f1] bg-[#f7f8fe] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
                        Cliente
                      </span>
                      <span className="min-w-0 truncate text-right text-sm font-black text-slate-900">
                        {clienteSeleccionado?.nombre ?? 'Sin cliente'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
                        Fecha
                      </span>
                      <span className="min-w-0 truncate text-right text-sm font-black text-slate-900">
                        {formatDateLabel(fechaVenta)}
                      </span>
                    </div>
                  </div>
                </section>

                {submitError ? (
                  <InlineGuidedError
                    message={getVentasGuidance(submitError)}
                  />
                ) : null}
                {revisionDeleteAlert ? (
                  <AppFeedbackMessage
                    variant="warning"
                    title={revisionDeleteAlert.title}
                    description={revisionDeleteAlert.detail}
                  />
                ) : null}

                <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[0.72rem] font-black uppercase tracking-[0.12em] text-[#52657d]">
                        Historial de la venta
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">
                        Revisa cada café antes de confirmar. Puedes editar o eliminar un producto si lo necesitas.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#edf3ff] px-2.5 py-1 text-[0.68rem] font-black text-[#173ea6]">
                      {lotesConCantidad.length}
                    </span>
                  </div>

                {lotesConCantidad.length ? (
                  <div className="mt-4 space-y-3">
                    {(lotesConCantidad.length > 2
                      ? lotesConCantidad.slice(-2)
                      : lotesConCantidad
                    ).map((lote) => (
                      <article
                        key={lote.id}
                        className="rounded-[18px] border border-[#e2e8f4] bg-[#fbfcff] px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-slate-950">
                              {getCoffeeCodePrefix(lote)} · {formatCoffeeFullName(lote)}
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-600">
                              {kg(lote.cantidad)} · {money(lote.cantidad * lote.precio)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={editarLoteDesdeRevision}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] bg-[#eef4ff] text-[#173ea6]"
                              title="Editar producto"
                              aria-label={`Editar ${lote.codigo}`}
                            >
                              <Pencil size={14} />
                            </button>
                            {lotesConCantidad.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => eliminarLoteDesdeRevision(lote.id)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] bg-[#fff1f3] text-[#d63b4a]"
                                title="Quitar producto"
                                aria-label={`Quitar ${lote.codigo}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
                  {lotesConCantidad.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => setMostrarHistorialLotesVenta(true)}
                      className={`${secondaryButtonClass} mt-3 min-h-[42px] w-full rounded-[14px] text-sm`}
                    >
                      Ver historial completo
                      <ArrowRight size={15} />
                    </button>
                  ) : null}
                </section>

                <article className="rounded-[22px] border border-[#dbe5fb] bg-white p-4 shadow-[0_16px_38px_rgba(15,23,42,0.06)]">
                  <p className="mb-3 text-[0.72rem] font-black uppercase tracking-[0.12em] text-[#52657d]">
                    Resumen financiero
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="min-w-0 rounded-[18px] bg-[#f7f9ff] px-3 py-3">
                      <span className="block text-[clamp(1.15rem,5vw,1.55rem)] font-black leading-tight text-[#173a8a]">
                        {kg(totalKg)}
                      </span>
                      <span className="mt-1 block text-[0.72rem] font-black uppercase tracking-[0.08em] text-slate-500">
                        Total vendido
                      </span>
                    </div>
                    <div className="min-w-0 rounded-[18px] bg-[#eef4ff] px-3 py-3">
                      <span className="block text-[clamp(1.15rem,5vw,1.55rem)] font-black leading-tight text-[#08256d]">
                        {money(totalEstimado)}
                      </span>
                      <span className="mt-1 block text-[0.72rem] font-black uppercase tracking-[0.08em] text-[#52657d]">
                        Total estimado
                      </span>
                    </div>
                  </div>
                </article>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={volverPasoAnterior}
                    className={`${secondaryButtonClass} min-h-[52px] rounded-[14px] text-sm`}
                  >
                    <ArrowLeft size={16} />
                    Regresar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const errorRevision = validarPasoVentaSeguro();
                      if (errorRevision || !lotesConCantidad.length) {
                        setSubmitError(
                          errorRevision ??
                            'Agrega al menos un café válido para confirmar la venta.',
                        );
                        setPaso(2);
                        setIntentoPaso2(true);
                        return;
                      }
                      setMostrarModalConfirmar(true);
                    }}
                    disabled={guardandoVenta || botonConfirmarPresionado}
                    className={`${primaryButtonClass} min-h-[52px] rounded-[14px] text-sm ${
                      guardandoVenta || botonConfirmarPresionado
                        ? 'bg-[#7f93cf] cursor-wait'
                        : ''
                    }`}
                  >
                    {guardandoVenta || botonConfirmarPresionado ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Guardando venta...
                      </>
                    ) : (
                      <>
                        {isOffline ? 'Guardar venta pendiente' : 'Registrar venta'}
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarModalCancelar(true)}
                  disabled={guardandoVenta || botonConfirmarPresionado}
                  className={`${secondaryButtonClass} mt-3 min-h-[48px] w-full rounded-[14px] text-sm text-slate-500`}
                >
                  Cancelar
                </button>
              </section>
            ) : null}
          </>
        )}
      </div>

      {mostrarModalBorradorVenta ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="venta-draft-title"
            aria-describedby="venta-draft-description"
            className="w-full max-w-[430px] rounded-[26px] bg-white p-5 shadow-[0_28px_70px_rgba(15,23,42,0.24)]"
          >
            <div className="mx-auto h-1.5 w-12 rounded-full bg-[#cfd8e6]" />
            <div className="mt-5 flex items-start gap-4">
              <span
                className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#eef4ff] text-[#173ea6]"
                aria-hidden="true"
              >
                <Save size={24} />
              </span>
              <div className="min-w-0">
                <p className="text-[0.78rem] font-black uppercase tracking-[0.11em] text-[#40516d]">
                  Borrador guardado
                </p>
                <h2
                  id="venta-draft-title"
                  className="mt-1 text-[1.45rem] font-black leading-tight text-slate-950"
                >
                  Registro en progreso
                </h2>
                <p
                  id="venta-draft-description"
                  className="mt-2 text-[0.98rem] font-semibold leading-6 text-slate-700"
                >
                  Tienes una venta pendiente. ¿Deseas continuarla o iniciar una nueva?
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[18px] border border-[#dbe5fb] bg-[#f8faff] px-4 py-3 text-sm font-semibold text-[#52657d]">
              <div className="flex items-center justify-between gap-3">
                <span>Último paso</span>
                <span className="font-black text-[#102d92]">
                  Paso {borradorVentaPendiente?.paso ?? borradorVentaPendiente?.step ?? 1} de 3
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#dbe5fb] pt-2">
                <span>Cafés agregados</span>
                <span className="font-black text-slate-800">
                  {borradorVentaPendiente?.lotesVenta?.filter((item: any) => Number(item.cantidad) > 0).length ?? 0}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={continuarBorradorVenta}
                className={`${primaryButtonClass} min-h-[54px] min-w-[150px] flex-1 rounded-[16px] text-[0.98rem]`}
              >
                Continuar registro
              </button>
              <button
                type="button"
                onClick={empezarVentaNuevaDesdeBorrador}
                className={`${secondaryButtonClass} min-h-[52px] min-w-[150px] flex-1 rounded-[16px] text-[0.96rem]`}
              >
                Empezar de nuevo
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {mostrarDesgloseSublotesVenta ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 px-3 pb-3 pt-3 backdrop-blur-sm sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="desglose-sublotes-venta-title"
            className="max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-[24px] border border-[#dbe1f1] bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.24)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#102d92]">
                  Venta parcial
                </p>
                <h2 id="desglose-sublotes-venta-title" className="mt-1 text-lg font-black text-slate-950">
                  Detalle de sublotes usados
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setMostrarDesgloseSublotesVenta(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
                aria-label="Cerrar desglose de sublotes"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {ventaFifoBreakdown.map((item, index) => (
                <article
                  key={`${item.groupId}-${item.subloteId}`}
                  className="rounded-[16px] border border-[#e6ebf5] bg-[#f8fbff] px-3 py-3"
                >
                  <p className="text-sm font-black text-[#102d92]">
                    {item.subloteCodigo ?? item.subloteNombre} · {item.nombreCafe || [item.tipoCafe, item.calidad].filter(Boolean).join(' ') || item.subloteNombre}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {kg(item.pesoAsignado)} vendidos · Ingreso:{' '}
                    {formatDateLabel(item.fechaEntrada)}
                  </p>
                  {item.origenSublote ? (
                    <p className="mt-0.5 text-xs font-bold text-slate-500">
                      {item.origenSublote}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">
                    Inventario restante: {kg(item.pesoRestante)}
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-slate-500">
                    venta #{index + 1}{index === 0 ? ' · Más antiguo' : ''}
                  </p>
                  {item.costoBase !== null ? (
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Costo base: {money(item.costoBase)}/kg
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {mostrarHistorialLotesVenta ? (
        <div
          className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center overflow-y-auto bg-slate-900/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:px-5 sm:py-6"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="venta-items-history-title"
            className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.28)] sm:max-h-[min(88dvh,720px)]"
          >
            <header className="shrink-0 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2
                    id="venta-items-history-title"
                    className="text-lg font-black text-slate-950"
                  >
                    Historial completo de la venta
                  </h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {ventaHistorialItems.length} registros · {kg(totalKg)} · {money(totalEstimado)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDetails(false);
                    setMostrarHistorialLotesVenta(false);
                  }}
                  aria-label="Cerrar historial de la venta"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                >
                  <X size={18} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowDetails((prev) => !prev)}
                {...ariaExpanded(showDetails)}
                aria-label={showDetails ? 'Ocultar detalles de sublotes' : 'Ver detalles de sublotes'}
                className="mt-3 inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-[11px] border border-[#d5deee] bg-white px-3 text-xs font-black text-[#173ea6] shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition hover:bg-[#f8fbff]"
              >
                <Eye size={14} />
                {showDetails ? 'Ocultar detalles' : 'Ver detalles'}
              </button>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {ventaHistorialItems.map((item: any) => (
                <article
                  key={item.id}
                  className="rounded-[18px] border border-[#e2e8f4] bg-[#fbfcff] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-950">
                        {item.code}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-600">
                        {kg(item.peso)} · {money(item.total)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        aria-label={`Editar ${item.code}`}
                        onClick={() => {
                          setMostrarHistorialLotesVenta(false);
                          editarLoteDesdeRevision();
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] bg-[#eef4ff] text-[#173ea6]"
                      >
                        <Pencil size={14} />
                      </button>
                      {item.canDelete ? (
                        <button
                          type="button"
                          aria-label={`Eliminar ${item.code}`}
                          onClick={() => eliminarLoteDesdeRevision(item.groupId)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] bg-[#fff1f3] text-[#d63b4a]"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {showDetails ? (
                    <div className="mt-3 space-y-1 text-xs font-semibold leading-5 text-slate-600">
                      <p>
                        Precio compra:{' '}
                        <span className="font-black text-slate-800">
                          {item.precioCompra !== null && Number.isFinite(Number(item.precioCompra))
                            ? `${money(Number(item.precioCompra))}/kg`
                            : 'No disponible'}
                        </span>
                      </p>
                      <p>
                        Fecha ingreso:{' '}
                        <span className="font-black text-slate-800">
                          {item.fechaIngreso ? formatDateLabel(item.fechaIngreso) : 'No disponible'}
                        </span>
                      </p>
                      <p>
                        Restante:{' '}
                        <span className="font-black text-slate-800">
                          {item.restante !== null && Number.isFinite(Number(item.restante))
                            ? kg(Number(item.restante))
                            : 'No disponible'}
                        </span>
                      </p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {mostrarModalClientes ? (
        <div
          className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center overflow-y-auto bg-slate-900/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:px-5 sm:py-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setMostrarModalClientes(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="clientes-registrados-title"
            aria-describedby="clientes-registrados-description"
            className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.28)] sm:max-h-[min(88dvh,720px)]"
          >
            <header className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2
                    id="clientes-registrados-title"
                    className="text-[1.25rem] font-black leading-tight text-slate-900"
                  >
                    Clientes registrados
                  </h2>
                  <p
                    id="clientes-registrados-description"
                    className="mt-1 text-sm font-medium leading-5 text-slate-500"
                  >
                    Busca y selecciona un cliente para esta venta.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarModalClientes(false)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                  aria-label="Cerrar clientes registrados"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    ref={clientesSearchRef}
                    type="text"
                    value={busquedaClientesModal}
                    maxLength={60}
                    onChange={(event) => {
                      setBusquedaClientesModal(sanitizeSearchInput(event.target.value));
                    }}
                    placeholder="Buscar por nombre, documento o teléfono"
                    className={`${fieldInputClass} rounded-[16px] px-10 py-3 text-[0.95rem]`}
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className={`${fieldLabelClass} mb-0 shrink-0 text-[0.82rem] uppercase tracking-[0.11em]`}>
                    Ordenar por
                  </label>
                  <div className="w-full max-w-[220px]">
                  <CompactSelect
                    id="clientes-sort-select"
                    value={clientesSortMode}
                    options={CLIENTE_SORT_OPTIONS}
                    placeholder="Más recientes"
                    open={clientesSortDropdownOpen}
                    icon={<History size={16} />}
                    onToggle={() =>
                      setClientesSortDropdownOpen((open) => !open)
                    }
                    onClose={() => setClientesSortDropdownOpen(false)}
                    onChange={(value) =>
                      setClientesSortMode(value as ClienteSortMode)
                    }
                  />
                  </div>
                </div>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {sinClientesRegistrados ? (
                <div className="rounded-[18px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <p className="font-bold text-slate-800 dark:text-slate-100">
                    Aún no tienes clientes registrados.
                  </p>
                  <p className="mt-1 leading-5 text-slate-600 dark:text-slate-300">
                    Registra un cliente para poder asociarlo a esta venta.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarModalClientes(false);
                      setClienteMetodo('REGISTRAR');
                      setClienteSeleccionado(null);
                      setSubmitError(null);
                      setIntentoPaso1(false);
                      setClienteForm({
                        nombre: '',
                        telefono: '',
                        documento: '',
                        tipoDocumento: '',
                      });
                      setClienteFormErrors({});
                      setClienteFormError(null);
                      setMostrarModal(true);
                    }}
                    className={`${primaryButtonClass} mt-4 min-h-[42px] rounded-[12px] text-sm`}
                  >
                    {clienteEditando ? 'Editar cliente' : 'Registrar cliente'}
                  </button>
                </div>
              ) : (
                (() => {
                  const base = dedupeClientesOptions([...clientes]);
                  const resultadoBusquedaClientes = fuzzySearch(
                    base,
                    busquedaClientesModalDebounced,
                    (c) => [c.nombre, c.documento, c.detalle, c.telefono ?? ''],
                  );
                  const filtrados = resultadoBusquedaClientes.items;

                  const ordenados = (() => {
                    const arr = [...filtrados];
                    if (clientesSortMode === 'az') {
                      arr.sort((a, b) =>
                        a.nombre.localeCompare(b.nombre, 'es', {
                          sensitivity: 'base',
                        }),
                      );
                    } else if (clientesSortMode === 'za') {
                      arr.sort((a, b) =>
                        b.nombre.localeCompare(a.nombre, 'es', {
                          sensitivity: 'base',
                        }),
                      );
                    } else if (clientesSortMode === 'oldest') {
                      arr.reverse();
                    } else if (clientesSortMode === 'doc-asc' || clientesSortMode === 'doc-desc') {
                      const docDigits = (value: string) => value.replace(/\D/g, '');
                      arr.sort((a, b) => {
                        const ad = Number(docDigits(a.documento)) || 0;
                        const bd = Number(docDigits(b.documento)) || 0;
                        return clientesSortMode === 'doc-asc' ? ad - bd : bd - ad;
                      });
                    }
                    // recent: mantener orden original
                    return arr;
                  })();

                  if (ordenados.length === 0) {
                    return (
                      <div className="rounded-[18px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        <p className="font-bold text-slate-800 dark:text-slate-100">
                          No encontramos clientes con ese dato.
                        </p>
                        <p className="mt-1 leading-5 text-slate-600 dark:text-slate-300">
                          Prueba buscando por nombre o documento.
                        </p>
                      </div>
                    );
                  }

                  return <div className="space-y-2 pb-4">
                    {resultadoBusquedaClientes.isSimilar ? (
                      <p className="rounded-[12px] border border-[#dbeafe] bg-[#eff6ff] px-3 py-2 text-xs font-bold text-[#1d4ed8]">
                        Mostrando resultados similares
                      </p>
                    ) : null}
                    {ordenados.map((c) => (
                      <ClienteCard
                        key={c.id}
                        cliente={c}
                        active={clienteSeleccionado?.id === c.id}
                        onSelect={() => {
                          seleccionarCliente(c);
                          setMostrarModalClientes(false);
                        }}
                        onDetail={() => setClienteDetalle(c)}
                        onEdit={() => {
                          setClienteEditando(c);
                          setClienteForm({
                            nombre: c.nombre,
                            telefono: c.telefono ? formatPhoneNumber(c.telefono) : '',
                            documento: c.documento === 'Documento pendiente' ? '' : c.documento,
                            tipoDocumento: c.documento.includes('-') ? 'NIT' : 'CEDULA',
                          });
                          setClienteFormErrors({});
                          setClienteFormError(null);
                          setMostrarModal(true);
                        }}
                      />
                    ))}
                  </div>;
                })()
              )}
            </div>
          </section>
        </div>
      ) : null}

      {clienteDetalle ? (
        <div className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center bg-slate-900/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cliente-detalle-title"
            className="w-full max-w-[410px] rounded-[22px] bg-white p-4 shadow-[0_28px_70px_rgba(15,23,42,0.28)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[#1f3fa7]">
                  Cliente
                </p>
                <h2 id="cliente-detalle-title" className="mt-1 text-lg font-black text-slate-950">
                  {clienteDetalle.nombre}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setClienteDetalle(null)}
                aria-label="Cerrar detalle de cliente"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm font-semibold text-slate-600">
              <p>Cédula/NIT: <span className="font-black text-slate-900">{clienteDetalle.documento}</span></p>
              <p>Teléfono: <span className="font-black text-slate-900">{clienteDetalle.telefono ? formatPhoneNumber(clienteDetalle.telefono) : 'No registrado'}</span></p>
              <p>Dirección: <span className="font-black text-slate-900">No disponible</span></p>
              <p>Observaciones: <span className="font-black text-slate-900">No disponible</span></p>
              <p>Ubicación: <span className="font-black text-slate-900">No disponible</span></p>
            </div>
            <button
              type="button"
              onClick={() => {
                const c = clienteDetalle;
                setClienteDetalle(null);
                setClienteEditando(c);
                setClienteForm({
                  nombre: c.nombre,
                  telefono: c.telefono ? formatPhoneNumber(c.telefono) : '',
                  documento: c.documento === 'Documento pendiente' ? '' : c.documento,
                  tipoDocumento: c.documento.includes('-') ? 'NIT' : 'CEDULA',
                });
                setMostrarModal(true);
              }}
              className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white"
            >
              Editar
            </button>
          </section>
        </div>
      ) : null}

      <ModalConfirmacionVenta
        mostrar={mostrarModalConfirmar}
        guardando={guardandoVenta}
        presionado={botonConfirmarPresionado}
        offline={Boolean(isOffline)}
        onCancel={() => setMostrarModalConfirmar(false)}
        onConfirm={() => {
          setMostrarModalConfirmar(false);
          void confirmar();
        }}
      />

      {mostrarModalCancelar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[390px] rounded-[24px] border border-rose-100 bg-white p-5 text-center shadow-[0_24px_60px_rgba(190,18,60,0.16)]">
            <div className="mx-auto h-1.5 w-14 rounded-full bg-[#d7deeb]" />
            <div className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500 shadow-[0_0_36px_rgba(244,63,94,0.18)]">
              <AlertTriangle size={24} strokeWidth={2.4} />
            </div>
            <h2 className="mt-4 text-[1.45rem] font-black leading-tight text-slate-950">
              ¿Cancelar venta?
            </h2>
            <p className="mx-auto mt-2 max-w-[300px] text-sm font-semibold leading-5 text-slate-600">
              Si cancelas ahora, perderás todo el progreso de esta venta.
            </p>
            <p className="mx-auto mt-1 max-w-[300px] text-xs font-semibold leading-5 text-slate-400">
              Los cafés agregados y valores ingresados no se guardarán.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setMostrarModalCancelar(false)}
                className={`${secondaryButtonClass} min-h-[48px] rounded-[14px] text-sm`}
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={confirmarCancelarVenta}
                className={`${dangerButtonClass} min-h-[48px] rounded-[14px] bg-rose-50 text-sm text-rose-700 ring-1 ring-rose-100 dark:bg-rose-500/15 dark:text-rose-100`}
              >
                Cancelar venta
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModal ? (
        <div className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center overflow-y-auto bg-slate-900/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:px-5 sm:py-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setMostrarModal(false);
            }
          }}
        >
          <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.28)] dark:border dark:border-slate-700 dark:bg-slate-950 sm:max-h-[min(88dvh,720px)]">
            <header className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-3 dark:border-slate-800">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-[#cfd8e6] dark:bg-slate-700" />
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[1.35rem] font-semibold leading-tight text-[#111827] dark:text-slate-100">
                    {clienteEditando ? 'Editar cliente' : 'Registrar cliente'}
                  </h2>
                  <p className="mt-1 text-sm font-medium leading-5 text-slate-500 dark:text-slate-300">
                    {clienteEditando
                      ? 'Actualiza los datos del cliente.'
                      : 'Completa los datos básicos del cliente.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarModal(false);
                    setClienteEditando(null);
                    setClienteFormErrors({});
                    setClienteFormError(null);
                  }}
                  aria-label="Cerrar registro de cliente"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500 dark:bg-slate-800 dark:text-slate-200"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              <div className="flex flex-col gap-5 pb-6">
                <div className="order-2">
                  <label htmlFor="cliente-nombre" className={clienteModalLabelClass}>
                    {clienteForm.tipoDocumento === 'NIT'
                      ? 'Nombre de la empresa'
                      : 'Nombre completo'}
                    <span
                      className={`ml-2 inline-flex text-[0.72rem] font-black ${
                        clienteForm.nombre.trim().length >= MAX_NOMBRE_CARACTERES
                          ? 'text-amber-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {clienteForm.nombre.trim().length}/{MAX_NOMBRE_CARACTERES}
                    </span>
                  </label>
                  <input
                    id="cliente-nombre"
                    type="text"
                    value={clienteForm.nombre}
                    disabled={!clienteForm.tipoDocumento}
                    aria-invalid={clienteFormErrors.nombre ? 'true' : 'false'}
                    aria-describedby={clienteFormErrors.nombre ? 'cliente-nombre-error' : undefined}
                    placeholder={
                      !clienteForm.tipoDocumento
                        ? 'Primero selecciona el tipo de documento'
                        : clienteForm.tipoDocumento === 'NIT'
                        ? 'Ej. Café Los Alpes'
                        : 'Ej. Juan Pérez Rodríguez'
                    }
                    onChange={(event) => {
                      const raw =
                        clienteForm.tipoDocumento === 'NIT'
                          ? event.target.value
                          : sanitizeNameInput(event.target.value);
                      const next = raw.slice(0, MAX_NOMBRE_CARACTERES);

                      if (raw.length > MAX_NOMBRE_CARACTERES) {
                        setNombreMaxToast(true);
                        if (nombreMaxToastTimerRef.current) {
                          window.clearTimeout(nombreMaxToastTimerRef.current);
                        }
                        nombreMaxToastTimerRef.current = window.setTimeout(() => {
                          setNombreMaxToast(false);
                        }, 3000);
                      }

                      setClienteForm((actual) => ({
                        ...actual,
                        nombre: next,
                      }));
                      setClienteFormErrors((actual) => ({
                        ...actual,
                        nombre: undefined,
                      }));
                      setClienteFormError(null);
                    }}
                    className={getClienteModalInputClass(Boolean(clienteFormErrors.nombre))}
                  />
                  <p className={clienteModalHintClass}>
                    {clienteForm.tipoDocumento === 'NIT'
                      ? 'Coloca el nombre legal o comercial de la empresa.'
                      : 'Coloca su nombre y apellidos.'}
                  </p>

                  {nombreMaxToast ? (
                    <AppFeedbackMessage
                      variant="warning"
                      description={`No puedes ingresar más de ${MAX_NOMBRE_CARACTERES} caracteres.`}
                      className="mt-2"
                    />
                  ) : null}

                  {clienteFormErrors.nombre ? (
                    <ClienteModalFieldError id="cliente-nombre-error" message={clienteFormErrors.nombre} />
                  ) : null}
                </div>

                <div className="order-1">
                  <label id="cliente-document-type-label" className={clienteModalLabelClass}>
                    Tipo de documento
                  </label>
                  <p className={clienteModalHintClass}>
                    Selecciona si el cliente usa cédula o NIT.
                  </p>
                  <div className="mt-2">
                    <CompactSelect
                      id="cliente-document-type"
                      labelledById="cliente-document-type-label"
                      value={clienteForm.tipoDocumento}
                      options={DOCUMENT_TYPE_OPTIONS}
                      placeholder="Selecciona el tipo de documento"
                      open={clienteDocumentoDropdownOpen}
                      icon={null}
                      onToggle={() =>
                        setClienteDocumentoDropdownOpen((open) => !open)
                      }
                      onClose={() => setClienteDocumentoDropdownOpen(false)}
                      onChange={(value) => {
                        setClienteForm((actual) => ({
                          ...actual,
                          tipoDocumento: value,
                          documento: '',
                        }));
                        setClienteFormErrors((actual) => ({
                          ...actual,
                          tipoDocumento: undefined,
                          documento: undefined,
                        }));
                        setClienteFormError(null);
                      }}
                    />
                  </div>
                  {clienteFormErrors.tipoDocumento ? (
                    <ClienteModalFieldError id="cliente-document-type-error" message={clienteFormErrors.tipoDocumento} />
                  ) : null}
                </div>

                <div className="order-3">
                  <label htmlFor="cliente-documento" className={clienteModalLabelClass}>
                    Número de documento
                  </label>
                  <input
                    id="cliente-documento"
                    type="text"
                    inputMode={
                      clienteForm.tipoDocumento === 'NIT' ? 'text' : 'numeric'
                    }
                    disabled={!clienteForm.tipoDocumento}
                    onPaste={(event) => {
                      if (!clienteForm.tipoDocumento) {
                        event.preventDefault();
                      }
                    }}
                    maxLength={clienteForm.tipoDocumento === 'NIT' ? 11 : 10}
                    value={clienteForm.documento}
                    aria-invalid={clienteFormErrors.documento ? 'true' : 'false'}
                    aria-describedby={clienteFormErrors.documento ? 'cliente-documento-error' : undefined}
                    onChange={(event) => {
                      setClienteForm((actual) => ({
                        ...actual,
                        documento: sanitizeDocumentInput(
                          event.target.value,
                          actual.tipoDocumento || 'CEDULA',
                        ),
                      }));
                      setClienteFormErrors((actual) => ({
                        ...actual,
                        documento: undefined,
                      }));
                      setClienteFormError(null);
                    }}
                    placeholder={
                      !clienteForm.tipoDocumento
                        ? 'Primero selecciona el tipo de documento'
                        : clienteForm.tipoDocumento === 'NIT'
                        ? '900123456-7'
                        : '1234567890'
                    }
                    className={getClienteModalInputClass(Boolean(clienteFormErrors.documento))}
                  />
                  <p className={clienteModalHintClass}>
                    {clienteForm.tipoDocumento === 'NIT'
                      ? 'Escribe el NIT con dígito de verificación si lo tienes.'
                      : 'Escribe solo números, sin puntos ni espacios.'}
                  </p>
                  {clienteFormErrors.documento ? (
                    <ClienteModalFieldError id="cliente-documento-error" message={clienteFormErrors.documento} />
                  ) : null}
                </div>

                <div className="order-4">
                  <label htmlFor="cliente-telefono" className={clienteModalLabelClass}>
                    Teléfono (opcional)
                  </label>
                  <input
                    id="cliente-telefono"
                    type="text"
                    inputMode="numeric"
                    maxLength={12}
                    value={clienteForm.telefono}
                    aria-invalid={clienteFormErrors.telefono ? 'true' : 'false'}
                    aria-describedby={clienteFormErrors.telefono ? 'cliente-telefono-error' : undefined}
                    onChange={(event) => {
                      const raw = event.target.value;
                      const hasInvalid = /[^\d\s]/.test(raw);
                      const next = formatPhoneNumber(raw);
                      setClienteForm((actual) => ({
                        ...actual,
                        telefono: next,
                      }));
                      setClienteFormErrors((actual) => ({
                        ...actual,
                        telefono: hasInvalid
                          ? 'No uses letras ni símbolos.'
                          : undefined,
                      }));
                      setClienteFormError(null);
                    }}
                    placeholder="Ej. 300 123 4567"
                    className={getClienteModalInputClass(Boolean(clienteFormErrors.telefono))}
                  />
                  <p className={clienteModalHintClass}>Número celular colombiano.</p>
                  {clienteFormErrors.telefono ? (
                    <ClienteModalFieldError id="cliente-telefono-error" message={clienteFormErrors.telefono} />
                  ) : null}
                </div>

                {clienteFormError ? (
                  <div className="order-5">
                    <AppFeedbackMessage
                      variant="error"
                      title={getVentasGuidance(clienteFormError).why}
                      description={getVentasGuidance(clienteFormError).action}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <footer className="shrink-0 border-t border-[#eef2f7] bg-[#fbfcff] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarModal(false);
                    setClienteEditando(null);
                    setClienteFormErrors({});
                    setClienteFormError(null);
                  }}
                  className={`${secondaryButtonClass} min-h-[50px] w-full rounded-[14px] px-5 py-3 text-[0.95rem] font-semibold`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardarCliente}
                  className={`${primaryButtonClass} min-h-[50px] w-full rounded-[14px] px-5 py-3 text-[0.95rem] font-semibold`}
                >
                  {clienteEditando ? 'Guardar cambios' : 'Guardar cliente'}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      <BodegaVentaInfoModal
        open={showBodegaVentaInfo}
        onClose={() => setShowBodegaVentaInfo(false)}
        capacidadKg={bodegaConfig?.capacidadKg}
        inventarioKg={totalDisponibleVenta}
        ventaKg={totalKg}
      />

      {guardandoVenta || botonConfirmarPresionado ? (
        <div className="fixed inset-0 z-50">
          <CafeSmartProcessingScreen
            title="Registrando venta..."
            subtitle="Espera un momento mientras guardamos la información."
            helperText="Estamos actualizando inventario e historial financiero."
            trustTitle="Venta segura"
            trustText="Tu información y registro están siendo procesados de forma segura."
          />
        </div>
      ) : null}

      <AppBottomNav hidden={mostrarModal || paso >= 1} />
    </div>
  );
}


