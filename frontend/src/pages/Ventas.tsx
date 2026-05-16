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
  History,
  IdCard,
  PackageOpen,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppBottomNav } from '../components/AppBottomNav';
import {
  createGuidedError,
  InlineGuidedError,
  type GuidedErrorMessage,
} from '../components/forms/GuidedError';
import { obtenerDeviceId } from '../utils/deviceId';
import {
  actualizarCliente,
  crearCliente,
  listarClientes,
  type ClienteItem,
} from '../services/clientesService';
import {
  LoteResumen,
  obtenerDetalleLote,
  obtenerLotes,
  guardarPesosSublotes,
} from '../services/lotesService';
import { CreateVentaResponse, crearVenta } from '../services/ventasService';
import { ApiRequestError } from '../services/apiService';
import { Preferences } from '@capacitor/preferences';
import { ENABLE_SECADO_PROTOTYPE } from '../config/features';
import { applySecadoToDetalle, applySecadoToLots } from '../utils/secadoFlow';
import { PRECIO_MINIMO_KG } from '../utils/businessRules';
import {
  BUSINESS_MIN_DATE_VALUE,
  formatDateLabel,
  getTodayLocalDateValue,
  toIsoDateAtUtcNoon,
  validateBusinessDateRange,
} from '../utils/date';
import {
  formatPhoneNumber,
  normalizeCompanyName,
  normalizeHumanName,
  normalizeDocumentForStorage,
  sanitizeDocumentInput,
  sanitizeDigits as sanitizePersonDigits,
  sanitizeNameInput,
  validateCompanyName,
  type DocumentType,
  validateDocumentNumber,
  validatePersonName,
} from '../utils/personValidation';
import { CafeSmartErrorState } from '../components/CafeSmartErrorState';

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
type VentaFifoItem = {
  groupId: string;
  subloteId: string;
  subloteNombre: string;
  fifoPosition: number;
  pesoAsignado: number;
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
  { value: 'CEDULA', label: 'Cédula' },
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

function isDateValueInRange(value: string, min: string, max: string) {
  return value >= min && value <= max;
}

function CompactSelect<T extends string>({
  id,
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

  return (
    <div className="relative">
      <button
        id={buttonId}
        type="button"
        aria-haspopup="listbox"
        aria-controls={listId}
        {...ariaExpanded(open)}
        onClick={onToggle}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
            onClose();
          }
        }}
        className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-[16px] border border-[#dbe2f0] bg-white px-4 py-2.5 text-left text-sm font-black text-slate-900 shadow-sm transition focus:border-[#1f3fa7] focus:outline-none focus:ring-4 focus:ring-[#1f3fa7]/10"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-[#1f3fa7]" aria-hidden="true">
            {icon ?? <IdCard size={16} />}
          </span>
          <span className={selected ? 'truncate' : 'truncate text-slate-400'}>
            {selected?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-labelledby={buttonId}
          className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-50 overflow-hidden rounded-[16px] border border-[#dbe2f0] bg-white p-1.5 shadow-[0_18px_42px_rgba(15,23,42,0.16)]"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active ? 'true' : 'false'}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  onClose();
                }}
                className={`flex min-h-[40px] w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-sm font-black transition ${
                  active
                    ? 'bg-[#eef4ff] text-[#1f3fa7]'
                    : 'text-slate-700 hover:bg-slate-50'
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
  const maxDate = parseLocalDateValue(max) ?? new Date();
  const minDate = parseLocalDateValue(min) ?? new Date(2026, 0, 1);
  const visibleDate = selectedDate ?? maxDate;
  const [calendarView, setCalendarView] = React.useState<'days' | 'months' | 'years'>('days');
  const [visibleMonth, setVisibleMonth] = React.useState(
    () => new Date(visibleDate.getFullYear(), visibleDate.getMonth(), 1),
  );

  React.useEffect(() => {
    if (open) {
      const nextDate = parseLocalDateValue(value) ?? maxDate;
      setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
      setCalendarView('days');
    }
  }, [max, open, value]);

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
        className={`mt-2.5 flex min-h-[58px] w-full cursor-pointer items-center justify-between gap-3 rounded-[16px] border bg-[#f8f9ff] px-4 py-3 text-left shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition hover:border-[#9fb0d4] hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/10 ${
          open ? 'border-[#102d92] bg-white' : 'border-[#d8e0ee]'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-[1.18rem] font-black leading-none text-[#08256d]">
          {value ? formatDateLabel(value) : 'Selecciona una fecha'}
        </span>
        <CalendarDays size={20} className={open ? 'text-[#102d92]' : 'text-slate-500'} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Calendario de fecha de venta"
          className="absolute left-0 right-0 z-30 mt-2 rounded-[22px] border border-[#d5deee] bg-white p-3 shadow-[0_22px_48px_rgba(15,23,42,0.18)]"
        >
          <div className="flex items-center justify-between gap-3 px-1 pb-3">
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => setVisibleMonth(previousMonth)}
              aria-label="Mes anterior"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#102d92] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:text-slate-300"
            >
              <ArrowLeft size={17} />
            </button>
            <div className="flex min-w-0 items-center justify-center gap-1 rounded-full bg-[#f8faff] p-1">
              <button
                type="button"
                {...ariaPressed(calendarView === 'months')}
                onClick={() => setCalendarView((current) => (current === 'months' ? 'days' : 'months'))}
                className={`rounded-full px-3 py-1.5 text-sm font-black transition ${calendarView === 'months' ? 'bg-[#102d92] text-white' : 'text-slate-900 hover:bg-[#eef4ff]'}`}
              >
                {MONTHS_ES[visibleMonth.getMonth()]}
              </button>
              <button
                type="button"
                {...ariaPressed(calendarView === 'years')}
                onClick={() => setCalendarView((current) => (current === 'years' ? 'days' : 'years'))}
                className={`rounded-full px-3 py-1.5 text-sm font-black transition ${calendarView === 'years' ? 'bg-[#102d92] text-white' : 'text-slate-900 hover:bg-[#eef4ff]'}`}
              >
                {visibleYear}
              </button>
            </div>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setVisibleMonth(nextMonth)}
              aria-label="Mes siguiente"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#102d92] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:text-slate-300"
            >
              <ArrowRight size={17} />
            </button>
          </div>

          {calendarView === 'months' ? (
            <div className="grid grid-cols-3 gap-2 px-1 py-1">
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
                    className={`min-h-[44px] rounded-[14px] px-2 text-xs font-black transition disabled:cursor-not-allowed disabled:text-slate-300 ${active ? 'bg-[#102d92] text-white' : 'text-slate-800 hover:bg-[#f4f7ff]'}`}
                  >
                    {month}
                  </button>
                );
              })}
            </div>
          ) : calendarView === 'years' ? (
            <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto px-1 py-1">
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
                    className={`min-h-[44px] rounded-[14px] px-2 text-sm font-black transition ${active ? 'bg-[#102d92] text-white' : 'text-slate-800 hover:bg-[#f4f7ff]'}`}
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
                    className={`h-10 rounded-full text-sm font-black transition disabled:cursor-not-allowed disabled:text-slate-300 ${
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

          <div className="mt-3 flex items-center justify-between border-t border-[#edf1f7] px-1 pt-3">
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

function SelectionCheck({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
        active
          ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white'
          : 'border-[#cad2e2] bg-white text-transparent'
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
          ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white'
          : 'border-transparent bg-white text-transparent'
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
      ? 'border-[#1f3fa7] bg-[#f4f7ff] shadow-[0_14px_30px_rgba(31,63,167,0.14)]'
      : 'border-[#e3e7f3] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.04)] hover:border-[#ccd6ea] hover:bg-[#fbfdff] hover:shadow-[0_12px_26px_rgba(15,23,42,0.07)]'
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
          } ${active ? 'bg-[#1f3fa7] text-white' : 'bg-[#eef2f7] text-slate-500'}`}
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
              ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white'
              : 'border-[#cad2e2] bg-white text-transparent'
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
        {onDetail || onEdit ? (
          <span className="flex shrink-0 flex-col gap-1">
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
        ) : null}

        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-black shadow-sm transition ${
            active
              ? 'bg-[#1f3fa7] text-white'
              : 'bg-[#edf3ff] text-[#1f3fa7]'
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

        <span
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
            active
              ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white'
              : 'border-transparent text-transparent'
          }`}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
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
    if (normalized.includes('solo') && normalized.includes('números')) {
      return createGuidedError(
        message,
        'Documento inválido.',
        'El documento solo puede contener números.',
        'Borra letras y deja únicamente números.',
      );
    }

    if (normalized.includes('puntos') || normalized.includes('guiones') || normalized.includes('espacios')) {
      return createGuidedError(
        message,
        'Documento con formato inválido.',
        'No uses puntos, espacios ni guiones.',
        'Ingresa el documento sin esos caracteres.',
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

    return createGuidedError(
      message,
      'Documento inválido.',
      'Ingresa el número de documento sin formato.',
      'Verifica cédula/NIT según el tipo seleccionado.',
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

  if (message.includes('modo de venta') || message.includes('como deseas realizar la venta')) {
    return createGuidedError(
      message,
      'Selecciona como vender',
      'No elegiste el tipo de venta.',
      'Una parte o todo el inventario.',
    );
  }

  if (message.includes('precio por kg')) {
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
      return 'Revisa la conexión a internet y vuelve a intentarlo.';
    }

    if (error.status >= 500) {
      return 'No pudimos completar la venta. Vuelve a intentarlo.';
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

    if (error.code === 'VENTA_SUBLOTE_INVALIDO') {
      return 'El sublote seleccionado no esta disponible para la venta.';
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
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_50%_12%,rgba(47,128,237,0.13),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fbff_52%,#edf6ff_100%)] px-5 pb-28 pt-6 text-center text-[#07153b]">
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
  const [cargando, setCargando] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [guardandoVenta, setGuardandoVenta] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [registroErrorMensaje, setRegistroErrorMensaje] = React.useState<
    string | null
  >(null);
  const [ventaGuardada, setVentaGuardada] =
    React.useState<VentaGuardadaResumen | null>(null);
  const [paso, setPaso] = React.useState<Step>(1);
  const [botonConfirmarPresionado, setBotonConfirmarPresionado] =
    React.useState(false);
  const [intentoPaso1, setIntentoPaso1] = React.useState(false);
  const [intentoPaso2, setIntentoPaso2] = React.useState(false);
  const [clienteMetodo, setClienteMetodo] = React.useState<
    'BUSCAR' | 'GENERAL' | 'REGISTRAR' | null
  >(null);
  const [modoVenta, setModoVenta] = React.useState<ModoVenta | null>(null);
  const [fechaVenta, setFechaVenta] = React.useState(getTodayLocalDateValue());
  const [fechaVentaPickerOpen, setFechaVentaPickerOpen] = React.useState(false);
  const [preciosVentaTotal, setPreciosVentaTotal] = React.useState<
    Record<string, string>
  >({});
  const [lotesVenta, setLotesVenta] = React.useState<LoteVenta[]>([]);
  const [ventaParcialOpenId, setVentaParcialOpenId] = React.useState<string | null>(null);
  const [busquedaCafeVenta, setBusquedaCafeVenta] = React.useState('');
  const [tipoCafeFiltroVenta, setTipoCafeFiltroVenta] = React.useState(VENTA_FILTRO_TODOS);
  const [calidadFiltroVenta, setCalidadFiltroVenta] = React.useState(VENTA_FILTRO_TODOS);
  const [tipoCafeFiltroOpen, setTipoCafeFiltroOpen] = React.useState(false);
  const [calidadFiltroOpen, setCalidadFiltroOpen] = React.useState(false);
  const [mostrarTodosCafeVenta, setMostrarTodosCafeVenta] = React.useState(false);
  const [ventaParcialAlert, setVentaParcialAlert] = React.useState<string | null>(null);
  const ventaParcialAlertTimerRef = React.useRef<number | null>(null);
  const [ventaParcialCardAlerts, setVentaParcialCardAlerts] = React.useState<
    Record<string, VentaParcialCardAlert>
  >({});
  const ventaParcialCardAlertTimerRef = React.useRef<number | null>(null);
  const [ajustesVentaParcialConfirmados, setAjustesVentaParcialConfirmados] =
    React.useState<Record<string, true>>({});
  const [ventaFifoBreakdown, setVentaFifoBreakdown] = React.useState<
    VentaFifoItem[]
  >([]);
  const [revisionDeleteAlert, setRevisionDeleteAlert] =
    React.useState<VentaParcialCardAlert | null>(null);
  const revisionDeleteAlertTimerRef = React.useRef<number | null>(null);
  const [borradorVentaPendiente, setBorradorVentaPendiente] = React.useState<any | null>(null);
  const [mostrarModalBorradorVenta, setMostrarModalBorradorVenta] = React.useState(false);
  const [clientes, setClientes] = React.useState<ClienteOption[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] =
    React.useState<ClienteOption | null>(null);
  const [busquedaCliente, setBusquedaCliente] = React.useState('');
  const [busquedaAplicada, setBusquedaAplicada] = React.useState('');
  const [mostrarModal, setMostrarModal] = React.useState(false);
  const [mostrarModalClientes, setMostrarModalClientes] =
    React.useState(false);
  const [clienteDetalle, setClienteDetalle] = React.useState<ClienteOption | null>(null);
  const [clienteEditando, setClienteEditando] = React.useState<ClienteOption | null>(null);
  const [mostrarModalConfirmar, setMostrarModalConfirmar] =
    React.useState(false);
  const [mostrarModalCancelar, setMostrarModalCancelar] =
    React.useState(false);

  const clientesSearchRef = React.useRef<HTMLInputElement | null>(null);
  const [busquedaClientesModal, setBusquedaClientesModal] =
    React.useState('');

  const [clientesSortMode, setClientesSortMode] = React.useState<
    ClienteSortMode
  >('recent');
  const [clientesSortDropdownOpen, setClientesSortDropdownOpen] =
    React.useState(false);
  const [clienteDocumentoDropdownOpen, setClienteDocumentoDropdownOpen] =
    React.useState(false);
  const [mostrarHistorialVentas, setMostrarHistorialVentas] =
    React.useState(false);
  const [historialVentaFecha, setHistorialVentaFecha] = React.useState('');
  const [historialVentaCliente, setHistorialVentaCliente] = React.useState('TODOS');
  const [historialVentaOrden, setHistorialVentaOrden] = React.useState<'recent' | 'oldest'>('recent');
  const [mostrarHistorialLotesVenta, setMostrarHistorialLotesVenta] =
    React.useState(false);
  const [ventasRealizadas, setVentasRealizadas] = React.useState<
    VentaGuardadaResumen[]
  >([]);
  const [clienteForm, setClienteForm] = React.useState<ClienteForm>({
    nombre: '',
    telefono: '',
    documento: '',
    tipoDocumento: '',
  });
  const [nombreMaxToast, setNombreMaxToast] = React.useState(false);
  const nombreMaxToastTimerRef = React.useRef<number | null>(null);
  const MAX_NOMBRE_CARACTERES = 60 as const;
  const MIN_NOMBRE_CARACTERES = 2 as const;
  const [clienteFormErrors, setClienteFormErrors] =
    React.useState<ClienteFormErrors>({});
  const [clienteFormError, setClienteFormError] = React.useState<string | null>(
    null,
  );
  const ventaLocalIdRef = React.useRef(uid());

  const cargarLotes = React.useCallback(async () => {
    try {
      setCargando(true);
      setLoadError(null);
      const [lotesResult, clientesResult] = await Promise.allSettled([
        obtenerLotes(),
        listarClientes(),
      ]);
      if (lotesResult.status === 'rejected') {
        if (import.meta.env.DEV) {
          console.warn('[Ventas] Error cargando inventario', lotesResult.reason);
        }
        throw lotesResult.reason;
      }
      if (clientesResult.status === 'rejected') {
        if (import.meta.env.DEV) {
          console.warn('[Ventas] Error cargando clientes', clientesResult.reason);
        }
        setClientes([]);
      }
      const lotes = lotesResult.value;
      const clientesData =
        clientesResult.status === 'fulfilled' ? clientesResult.value : [];
      const lotesDisponibles = ENABLE_SECADO_PROTOTYPE
        ? applySecadoToLots(lotes, { includeGeneratedOutputs: false })
        : lotes;
      setLotesVenta(mkLotes(lotesDisponibles));
      setClientes(dedupeClientesOptions(clientesData.map(mapClienteToOption)));
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[Ventas] No se pudo cargar la pantalla de venta', e);
      }
      setLoadError(
        e instanceof Error
          ? e.message
          : 'No fue posible cargar el inventario para venta.',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  React.useEffect(() => {
    void cargarLotes();
  }, [cargarLotes]);

  React.useEffect(() => {
    const loadDraft = async () => {
      const draft = await readVentaDraft();
      if (draft?.savedAt) {
        setBorradorVentaPendiente(draft);
        setMostrarModalBorradorVenta(true);
      }
    };

    void loadDraft();
  }, []);

  React.useEffect(() => {
    if (
      cargando ||
      ventaGuardada ||
      registroErrorMensaje ||
      mostrarModalBorradorVenta ||
      borradorVentaPendiente
    )
      return;
    const hasProgress =
      paso > 1 ||
      Boolean(clienteSeleccionado) ||
      Boolean(modoVenta) ||
      lotesVenta.some((lote) => lote.cantidadKg || lote.pesoVerificadoKg) ||
      Object.values(preciosVentaTotal).some((precio) => precio.trim() !== '');

    if (!hasProgress) {
      clearVentaDraft();
      return;
    }

    const timer = window.setTimeout(() => {
      writeVentaDraft({
        savedAt: Date.now(),
        paso,
        clienteSeleccionado,
        clienteMetodo,
        fechaVenta,
        modoVenta,
        lotesVenta,
        preciosVentaTotal,
        ajustesVentaParcialConfirmados,
        localId: ventaLocalIdRef.current,
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    cargando,
    borradorVentaPendiente,
    clienteMetodo,
    clienteSeleccionado,
    fechaVenta,
    lotesVenta,
    mostrarModalBorradorVenta,
    modoVenta,
    paso,
    preciosVentaTotal,
    registroErrorMensaje,
    ventaGuardada,
    ajustesVentaParcialConfirmados,
  ]);

  const clientesRecientes = React.useMemo(() => {
    const base = dedupeClientesOptions([...clientes]);
    const term = norm(busquedaAplicada.trim());
    if (!term) return base;
    return base.filter((c) =>
      [c.nombre, c.documento, c.detalle].some((v) => norm(v).includes(term)),
    );
  }, [busquedaAplicada, clientes]);
  const sinClientesRegistrados = clientes.length === 0;
  const busquedaClienteActiva =
    busquedaCliente.trim().length > 0 || busquedaAplicada.trim().length > 0;
  const mostrarResultadosClientes =
    clienteMetodo === 'BUSCAR' &&
    (!clienteSeleccionado || busquedaClienteActiva);
  const historialVentaClientes = React.useMemo(() => {
    const options = new Map<string, string>();
    options.set('TODOS', 'Todos');
    options.set('NO_REGISTRADO', 'Cliente no registrado');
    ventasRealizadas.forEach((venta) => {
      const nombre = venta.clienteNombre?.trim();
      if (nombre) options.set(nombre, nombre);
    });
    return Array.from(options.entries());
  }, [ventasRealizadas]);
  const ventasHistorialFiltradas = React.useMemo(() => {
    const sameDate = (value: string) => value.slice(0, 10) === historialVentaFecha;
    return [...ventasRealizadas]
      .filter((venta) => !historialVentaFecha || sameDate(venta.fecha))
      .filter((venta) => {
        if (historialVentaCliente === 'TODOS') return true;
        const noRegistrado =
          venta.clienteNombre === CLIENTE_GENERAL.nombre ||
          venta.clienteDocumento === CLIENTE_GENERAL.documento;
        if (historialVentaCliente === 'NO_REGISTRADO') return noRegistrado;
        return venta.clienteNombre === historialVentaCliente;
      })
      .sort((a, b) =>
        historialVentaOrden === 'oldest'
          ? new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
          : new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      );
  }, [
    historialVentaCliente,
    historialVentaFecha,
    historialVentaOrden,
    ventasRealizadas,
  ]);

  const lotesConCantidad = React.useMemo(() => {
    if (modoVenta === 'TOTAL') {
      return lotesVenta
        .filter((l) => getDisponibleVenta(l) > 0)
        .map((l) => ({
          ...l,
          cantidad: getDisponibleVenta(l),
          precio: toNum(preciosVentaTotal[l.tipoCafeId] ?? ''),
        }));
    }
    if (modoVenta !== 'PARCIAL') {
      return [];
    }
    return lotesVenta
      .map((l) => ({
        ...l,
        cantidad: toNum(l.cantidadKg),
        precio: toNum(l.precioKg),
      }))
      .filter((l) => ajustesVentaParcialConfirmados[l.id] && l.cantidad > 0);
  }, [ajustesVentaParcialConfirmados, lotesVenta, modoVenta, preciosVentaTotal]);

  const totalKg = React.useMemo(
    () => lotesConCantidad.reduce((a, l) => a + l.cantidad, 0),
    [lotesConCantidad],
  );
  const totalEstimado = React.useMemo(
    () => lotesConCantidad.reduce((a, l) => a + l.cantidad * l.precio, 0),
    [lotesConCantidad],
  );
  const totalDisponibleVenta = React.useMemo(
    () =>
      lotesVenta.reduce((total, lote) => total + getDisponibleVenta(lote), 0),
    [lotesVenta],
  );

  React.useEffect(() => {
    if (paso === 3 && !lotesConCantidad.length && !ventaGuardada) {
      setPaso(2);
      setIntentoPaso2(true);
    }
  }, [lotesConCantidad.length, paso, ventaGuardada]);
  const tipoCafeFiltroOpciones = React.useMemo(() => {
    const vistos = new Set<string>();
    return [
      { value: VENTA_FILTRO_TODOS, label: 'Todos los tipos' },
      ...lotesVenta.reduce<Array<{ value: string; label: string }>>((opciones, lote) => {
        const key = lote.tipoCafe.trim().toLowerCase();
        if (!key || vistos.has(key)) return opciones;
        vistos.add(key);
        opciones.push({ value: lote.tipoCafe, label: lote.tipoCafe });
        return opciones;
      }, []),
    ];
  }, [lotesVenta]);
  const calidadFiltroOpciones = React.useMemo(() => {
    const vistos = new Set<string>();
    return [
      { value: VENTA_FILTRO_TODOS, label: 'Todas las calidades' },
      ...lotesVenta.reduce<Array<{ value: string; label: string }>>((opciones, lote) => {
        const key = lote.calidad.trim().toLowerCase();
        if (!key || vistos.has(key)) return opciones;
        vistos.add(key);
        opciones.push({ value: lote.calidad, label: lote.calidad });
        return opciones;
      }, []),
    ];
  }, [lotesVenta]);
  const lotesVentaParcialFiltrados = React.useMemo(() => {
    const termino = norm(busquedaCafeVenta.trim());
    return lotesVenta.filter((lote) => {
      const texto = norm(`${lote.tipoCafe} ${lote.calidad} ${lote.codigo}`);
      const coincideBusqueda = !termino || texto.includes(termino);
      const coincideTipo =
        tipoCafeFiltroVenta === VENTA_FILTRO_TODOS ||
        norm(lote.tipoCafe) === norm(tipoCafeFiltroVenta);
      const coincideCalidad =
        calidadFiltroVenta === VENTA_FILTRO_TODOS ||
        norm(lote.calidad) === norm(calidadFiltroVenta);
      return coincideBusqueda && coincideTipo && coincideCalidad;
    });
  }, [busquedaCafeVenta, calidadFiltroVenta, lotesVenta, tipoCafeFiltroVenta]);
  const lotesVentaParcialVisibles = mostrarTodosCafeVenta
    ? lotesVentaParcialFiltrados
    : lotesVentaParcialFiltrados.slice(0, 3);
  const resumenDisponiblePorTipo = React.useMemo(() => {
    const resumen = new Map<
      string,
      { tipoCafeId: string; tipoCafe: string; pesoKg: number }
    >();

    for (const lote of lotesVenta) {
      const actual = resumen.get(lote.tipoCafeId);
      resumen.set(lote.tipoCafeId, {
        tipoCafeId: lote.tipoCafeId,
        tipoCafe: lote.tipoCafe,
        pesoKg: round2((actual?.pesoKg ?? 0) + getDisponibleVenta(lote)),
      });
    }

    return Array.from(resumen.values());
  }, [lotesVenta]);
  const preciosVentaTotalInvalidos = React.useMemo(() => {
    const invalidos = new Set<string>();

    for (const item of resumenDisponiblePorTipo) {
      if (toNum(preciosVentaTotal[item.tipoCafeId] ?? '') < PRECIO_MINIMO_KG) {
        invalidos.add(item.tipoCafeId);
      }
    }

    return invalidos;
  }, [preciosVentaTotal, resumenDisponiblePorTipo]);
  const fechaVentaValidacion = React.useMemo(
    () => validateBusinessDateRange(fechaVenta),
    [fechaVenta],
  );

  const validarPasoVenta = React.useCallback(() => {
    if (!fechaVentaValidacion.isValid) {
      return fechaVentaValidacion.message ?? 'Selecciona la fecha de venta.';
    }
    if (!lotesVenta.length) return 'No hay lotes disponibles para vender.';
    if (!modoVenta) return 'Selecciona como deseas realizar la venta.';
    if (modoVenta === 'TOTAL') {
      const tipoSinPrecio = resumenDisponiblePorTipo.find((item) =>
        preciosVentaTotalInvalidos.has(item.tipoCafeId),
      );

      if (tipoSinPrecio) {
        return `Ingresa un precio por kg valido para cafe ${tipoSinPrecio.tipoCafe}.`;
      }

      return null;
    }
    if (modoVenta === 'PARCIAL' && !lotesConCantidad.length)
      return 'Ingresa al menos una cantidad para continuar.';
    for (const l of lotesConCantidad) {
      if (pesoVerificadoInvalido(l))
        return `El peso verificado no puede superar el disponible en ${l.codigo}.`;
      if (l.cantidad > getDisponibleVenta(l))
        return `La cantidad supera el disponible en ${l.codigo}.`;
      if (l.precio < PRECIO_MINIMO_KG)
        return `Ingresa un precio por kg valido en ${l.codigo}.`;
    }
    return null;
  }, [
    fechaVentaValidacion.isValid,
    fechaVentaValidacion.message,
    lotesVenta.length,
    modoVenta,
    preciosVentaTotalInvalidos,
    resumenDisponiblePorTipo,
    lotesConCantidad,
  ]);

  const hayCantidadParcial = React.useMemo(
    () =>
      lotesVenta.some(
        (l) =>
          ajustesVentaParcialConfirmados[l.id] &&
          toNum(l.cantidadKg) > 0 &&
          toNum(l.precioKg) >= PRECIO_MINIMO_KG &&
          toNum(l.cantidadKg) <= getDisponibleVenta(l),
      ),
    [ajustesVentaParcialConfirmados, lotesVenta],
  );
  const parcialConErrores = React.useMemo(() => {
    if (modoVenta !== 'PARCIAL') return false;
    return lotesVenta.some((lote) => {
      if (!ajustesVentaParcialConfirmados[lote.id]) return false;
      const cantidad = toNum(lote.cantidadKg);
      return (
        cantidad <= 0 ||
        cantidad > getDisponibleVenta(lote) ||
        toNum(lote.precioKg) < PRECIO_MINIMO_KG ||
        pesoVerificadoInvalido(lote)
      );
    });
  }, [ajustesVentaParcialConfirmados, lotesVenta, modoVenta]);
  const puedeAvanzarPaso2 =
    !fechaVentaValidacion.isValid || modoVenta === null
      ? false
      : modoVenta === 'TOTAL'
        ? resumenDisponiblePorTipo.length > 0 &&
          preciosVentaTotalInvalidos.size === 0 &&
          !lotesVenta.some(pesoVerificadoInvalido)
        : hayCantidadParcial && !parcialConErrores;

  const mostrarAlertaVentaParcial = React.useCallback((message: string) => {
    setVentaParcialAlert(message);
    if (ventaParcialAlertTimerRef.current) {
      window.clearTimeout(ventaParcialAlertTimerRef.current);
    }
    ventaParcialAlertTimerRef.current = window.setTimeout(() => {
      setVentaParcialAlert(null);
    }, 4200);
  }, []);

  const getVentaParcialCardAlert = React.useCallback(
    (
      lote: LoteVenta,
      requireEmpty = false,
      skipConfirmCheck = false,
    ): VentaParcialCardAlert | null => {
      const nombreCafe = `${lote.tipoCafe} ${lote.calidad}`;
      const cantidadTexto = lote.cantidadKg.trim();
      const precioTexto = lote.precioKg.trim();
      const cantidad = toNum(lote.cantidadKg);
      const precio = toNum(lote.precioKg);
      const disponible = getDisponibleVenta(lote);

      if (!cantidadTexto && !precioTexto) {
        return requireEmpty
          ? {
              title: `Confirma el ajuste de ${nombreCafe}.`,
              detail:
                'Completa cantidad y precio, luego confirma el ajuste para agregarlo a la venta.',
            }
          : null;
      }

      if (!cantidadTexto && precioTexto) {
        return {
          title: `Falta la cantidad en ${nombreCafe}.`,
          detail: 'Ingresa cuántos kg deseas vender.',
        };
      }

      if (cantidad <= 0) {
        return {
          title: `Falta la cantidad en ${nombreCafe}.`,
          detail: 'Ingresa cuántos kg deseas vender.',
        };
      }

      if (cantidad > disponible) {
        return {
          title: `La cantidad supera el disponible de ${nombreCafe}.`,
          detail: `Disponible: ${kg(disponible)}.`,
        };
      }

      if (!precioTexto) {
        return {
          title: `Falta el precio en ${nombreCafe}.`,
          detail: 'Ingresa el precio por kg.',
        };
      }

      if (precio < PRECIO_MINIMO_KG) {
        return {
          title: `El precio de ${nombreCafe} es demasiado bajo.`,
          detail: 'Ingresa un valor desde $1.000 por kg.',
        };
      }

      if (pesoVerificadoInvalido(lote)) {
        return {
          title: `Revisa el peso de ${nombreCafe}.`,
          detail: `No puede superar el disponible: ${kg(disponible)}.`,
        };
      }

      if (!skipConfirmCheck && !ajustesVentaParcialConfirmados[lote.id]) {
        return {
          title: `Confirma el ajuste de ${nombreCafe}.`,
          detail: 'Presiona “Confirmar ajuste” para agregarlo a la venta.',
        };
      }

      return null;
    },
    [ajustesVentaParcialConfirmados],
  );

  const mostrarAlertaTarjetaVentaParcial = React.useCallback(
    (loteId: string, alert: VentaParcialCardAlert) => {
      setVentaParcialCardAlerts({ [loteId]: alert });
      if (ventaParcialCardAlertTimerRef.current) {
        window.clearTimeout(ventaParcialCardAlertTimerRef.current);
      }
      ventaParcialCardAlertTimerRef.current = window.setTimeout(() => {
        setVentaParcialCardAlerts({});
      }, 4200);
    },
    [],
  );

  const mostrarAlertaRevision = React.useCallback((alert: VentaParcialCardAlert) => {
    setRevisionDeleteAlert(alert);
    if (revisionDeleteAlertTimerRef.current) {
      window.clearTimeout(revisionDeleteAlertTimerRef.current);
    }
    revisionDeleteAlertTimerRef.current = window.setTimeout(() => {
      setRevisionDeleteAlert(null);
    }, 4200);
  }, []);

  const siguiente = React.useCallback(() => {
    if (paso === 1) {
      setIntentoPaso1(true);
      if (!clienteMetodo) {
        setSubmitError(null);
        // mantiene el estilo actual de errores de Ventas
        setClienteFormError(null);
        return;
      }
      if (!clienteSeleccionado) return;
      setSubmitError(null);
      setIntentoPaso2(false);
      return setPaso(2);
    }
    if (paso === 2) {
      setIntentoPaso2(true);
      if (modoVenta === 'PARCIAL') {
        if (!hayCantidadParcial) {
          const firstProblem = lotesVentaParcialFiltrados[0] ?? lotesVenta[0];
          const firstProblemAlert = firstProblem
            ? getVentaParcialCardAlert(firstProblem, true)
            : null;

          if (firstProblem && firstProblemAlert) {
            setVentaParcialOpenId(firstProblem.id);
            mostrarAlertaTarjetaVentaParcial(firstProblem.id, firstProblemAlert);
          }
        }
      }
      if (!puedeAvanzarPaso2) return;
      setVentaParcialCardAlerts({});
      setSubmitError(null);
      return setPaso(3);
    }
  }, [
    clienteMetodo,
    clienteSeleccionado,
    hayCantidadParcial,
    lotesVenta,
    lotesVentaParcialFiltrados,
    modoVenta,
    getVentaParcialCardAlert,
    mostrarAlertaTarjetaVentaParcial,
    paso,
    puedeAvanzarPaso2,
  ]);


  const anterior = React.useCallback(() => {
    setSubmitError(null);
    setPaso((p) => Math.max(1, p - 1) as Step);
  }, []);

  const editarLoteDesdeRevision = React.useCallback(() => {
    setSubmitError(null);
    setIntentoPaso2(false);
    setPaso(2);
  }, []);

  const eliminarLoteDesdeRevision = React.useCallback(
    (loteId: string) => {
      setSubmitError(null);
      setIntentoPaso2(false);

      if (lotesConCantidad.length <= 1) {
        setMostrarHistorialLotesVenta(false);
        mostrarAlertaRevision({
          title: 'Debe quedar al menos un café agregado',
          detail:
            'Si deseas cancelar completamente la venta, usa la opción “Cancelar venta”.',
        });
        return;
      }

      setLotesVenta((prev) =>
        prev.map((lote) => {
          if (modoVenta === 'TOTAL') {
            return {
              ...lote,
              cantidadKg: lote.id === loteId ? '' : String(lote.disponibleKg),
              precioKg: preciosVentaTotal[lote.tipoCafeId] || lote.precioKg,
            };
          }

          if (lote.id !== loteId) {
            return lote;
          }

          return {
            ...lote,
            cantidadKg: '',
          };
        }),
      );

      if (modoVenta === 'TOTAL') {
        setModoVenta('PARCIAL');
        setPreciosVentaTotal({});
      }
    },
    [lotesConCantidad.length, modoVenta, mostrarAlertaRevision, preciosVentaTotal],
  );

  React.useEffect(() => {
    if (paso !== 3 || modoVenta !== 'PARCIAL' || lotesConCantidad.length === 0) {
      setVentaFifoBreakdown([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      const breakdown: VentaFifoItem[] = [];

      for (const lote of lotesConCantidad) {
        const detalleBase = await obtenerDetalleLote(lote.tipoCafeId, lote.calidadId);
        const detalle = ENABLE_SECADO_PROTOTYPE
          ? applySecadoToDetalle(detalleBase, lote.tipoCafeId, lote.calidadId, {
              includeGeneratedOutputs: false,
            })
          : detalleBase;
        let restante = round2(lote.cantidad);
        const sublotesOrdenados = [...(detalle?.sublotes ?? [])]
          .filter((sublote) => sublote.pesoActual > 0)
          .sort(
            (a, b) =>
              new Date(a.fechaIngreso).getTime() -
              new Date(b.fechaIngreso).getTime(),
          );

        sublotesOrdenados.forEach((sublote, index) => {
          if (restante <= 0) return;
          const asignado = round2(Math.min(restante, sublote.pesoActual));
          if (asignado <= 0) return;

          breakdown.push({
            groupId: lote.id,
            subloteId: sublote.id,
            subloteNombre: sublote.etiqueta || `Sublote ${index + 1}`,
            fifoPosition: index + 1,
            pesoAsignado: asignado,
            fechaEntrada: sublote.fechaIngreso,
            costoBase: Number.isFinite(sublote.costoPorKg)
              ? sublote.costoPorKg
              : null,
          });
          restante = round2(restante - asignado);
        });
      }

      if (!cancelled) {
        setVentaFifoBreakdown(breakdown);
      }
    })().catch(() => {
      if (!cancelled) setVentaFifoBreakdown([]);
    });

    return () => {
      cancelled = true;
    };
  }, [lotesConCantidad, modoVenta, paso]);

  const confirmar = React.useCallback(async () => {
    if (!clienteSeleccionado) {
      setPaso(1);
      setIntentoPaso1(true);
      return;
    }
    const m = validarPasoVenta();
    if (m) {
      setPaso(2);
      setIntentoPaso2(true);
      return;
    }
    if (guardandoVenta) return;

    setGuardandoVenta(true);
    setBotonConfirmarPresionado(true);
    setSubmitError(null);
    setRegistroErrorMensaje(null);

    try {
      type PoolEntry = {
        subloteId: string;
        disponibleKg: number;
      };

      const pools = new Map<string, PoolEntry[]>();
      const detalles = [] as Array<{
        subloteId: string;
        pesoVendido: number;
        precioKg: number;
      }>;

      for (const lote of lotesConCantidad) {
        const poolKey = `${lote.tipoCafeId}::${lote.calidadId}`;

        if (!pools.has(poolKey)) {
          const detalleBase = await obtenerDetalleLote(
            lote.tipoCafeId,
            lote.calidadId,
          );
          const detalle = ENABLE_SECADO_PROTOTYPE
            ? applySecadoToDetalle(
                detalleBase,
                lote.tipoCafeId,
                lote.calidadId,
                {
                  includeGeneratedOutputs: false,
                },
              )
            : detalleBase;
          let pool = (detalle?.sublotes ?? [])
            .filter((sublote) => sublote.pesoActual > 0)
            .sort(
              (a, b) =>
                new Date(a.fechaIngreso).getTime() -
                new Date(b.fechaIngreso).getTime(),
            )
            .map((sublote) => ({
              subloteId: sublote.id,
              disponibleKg: round2(sublote.pesoActual),
            }));

          const pesoVerificado = getPesoVerificado(lote);
          const totalPool = round2(
            pool.reduce((sum, item) => sum + item.disponibleKg, 0),
          );

          if (pesoVerificado !== null && pesoVerificado < totalPool) {
            pool = distribuirPesoVerificado(pool, pesoVerificado);
            await guardarPesosSublotes(
              pool.map((entry) => ({
                id: entry.subloteId,
                pesoActual: entry.disponibleKg,
                motivo: 'Calibración antes de venta',
              })),
            );
          }

          pools.set(poolKey, pool);
        }

        const pool = pools.get(poolKey) ?? [];
        let restante = round2(lote.cantidad);

        for (const entry of pool) {
          if (restante <= 0) break;
          if (entry.disponibleKg <= 0) continue;

          const asignado = round2(Math.min(restante, entry.disponibleKg));
          if (asignado <= 0) continue;

          detalles.push({
            subloteId: entry.subloteId,
            pesoVendido: asignado,
            precioKg: round2(lote.precio),
          });

          entry.disponibleKg = round2(entry.disponibleKg - asignado);
          restante = round2(restante - asignado);
        }

        if (restante > 0.001) {
          throw new Error(
            `La cantidad supera el disponible en ${lote.codigo}.`,
          );
        }
      }

      const fechaVentaIso = toIsoDateAtUtcNoon(fechaVenta);
      const respuesta = await crearVenta({
        ...(fechaVentaIso ? { fecha: fechaVentaIso } : {}),
        ...(!clienteSeleccionado.rapido
          ? { clienteId: clienteSeleccionado.id }
          : {}),
        deviceId: await obtenerDeviceId(),
        localId: ventaLocalIdRef.current,
        detalles,
      });

      const ventaResumen = {
        ...crearResumenVentaGuardada(respuesta),
        clienteNombre: clienteSeleccionado.nombre,
        clienteDocumento: clienteSeleccionado.documento,
        totalKg,
        totalVenta: totalEstimado,
        items: lotesConCantidad.map((item) => ({
          codigo: item.codigo,
          tipoCafe: item.tipoCafe,
          calidad: item.calidad,
          cantidadKg: item.cantidad,
          subtotal: item.cantidad * item.precio,
        })),
        fifoBreakdown: ventaFifoBreakdown,
      };
      setVentaGuardada(ventaResumen);
      setVentasRealizadas((actual) => [ventaResumen, ...actual]);
      clearVentaDraft();
      void cargarLotes();
    } catch (error) {
      const mensaje = getVentaSubmitMessage(error);

      if (esErrorGeneralGuardadoVenta(error)) {
        setRegistroErrorMensaje(mensaje);
        setSubmitError(null);
      } else {
        setSubmitError(mensaje);
      }
    } finally {
      setGuardandoVenta(false);
      setBotonConfirmarPresionado(false);
    }
  }, [
    cargarLotes,
    clienteSeleccionado,
    guardandoVenta,
    lotesConCantidad,
    fechaVenta,
    totalEstimado,
    totalKg,
    ventaFifoBreakdown,
    validarPasoVenta,
  ]);

  const reiniciar = React.useCallback(() => {
    clearVentaDraft();
    setPaso(1);
    setGuardandoVenta(false);
    setSubmitError(null);
    setRegistroErrorMensaje(null);
    setVentaGuardada(null);
    setClienteSeleccionado(null);
    setClienteMetodo(null);
    setBusquedaCliente('');
    setBusquedaAplicada('');
    setModoVenta(null);
    setMostrarModalConfirmar(false);
    setMostrarModalCancelar(false);
    setFechaVenta(getTodayLocalDateValue());
    setPreciosVentaTotal({});
    setAjustesVentaParcialConfirmados({});
    setVentaFifoBreakdown([]);
    setClienteFormErrors({});
    setIntentoPaso1(false);
    setIntentoPaso2(false);
    setLoadError(null);
    ventaLocalIdRef.current = uid();
    void cargarLotes();
  }, [cargarLotes]);

  const continuarBorradorVenta = React.useCallback(() => {
    const draft = borradorVentaPendiente;
    if (!draft) return;
    setPaso((draft.paso || 1) as Step);
    setClienteSeleccionado(draft.clienteSeleccionado ?? null);
    setClienteMetodo(draft.clienteMetodo ?? null);
    setFechaVenta(draft.fechaVenta || getTodayLocalDateValue());
    setModoVenta(draft.modoVenta ?? null);
    if (Array.isArray(draft.lotesVenta)) setLotesVenta(draft.lotesVenta);
    setPreciosVentaTotal(draft.preciosVentaTotal ?? {});
    setAjustesVentaParcialConfirmados(
      draft.ajustesVentaParcialConfirmados ?? {},
    );
    ventaLocalIdRef.current = draft.localId || uid();
    setMostrarModalBorradorVenta(false);
    setBorradorVentaPendiente(null);
  }, [borradorVentaPendiente]);

  const empezarVentaNuevaDesdeBorrador = React.useCallback(() => {
    clearVentaDraft();
    setMostrarModalBorradorVenta(false);
    setBorradorVentaPendiente(null);
    reiniciar();
  }, [reiniciar]);

  const updateLote = (
    id: string,
    campo: 'cantidadKg' | 'precioKg' | 'pesoVerificadoKg',
    valor: string,
  ) => {
    setVentaParcialCardAlerts((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setSubmitError(null);
    setAjustesVentaParcialConfirmados((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setLotesVenta((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, [campo]: campo === 'precioKg' ? soloDigitos(valor) : valor }
          : l,
      ),
    );
  };

  const confirmarAjusteParcial = React.useCallback(
    (lote: LoteVenta) => {
      const alerta = getVentaParcialCardAlert(lote, false, true);
      if (alerta) {
        mostrarAlertaTarjetaVentaParcial(lote.id, alerta);
        return;
      }

      setAjustesVentaParcialConfirmados((current) => ({
        ...current,
        [lote.id]: true,
      }));
      setVentaParcialCardAlerts((current) => {
        if (!current[lote.id]) return current;
        const next = { ...current };
        delete next[lote.id];
        return next;
      });
      setVentaParcialOpenId(null);
    },
    [getVentaParcialCardAlert, mostrarAlertaTarjetaVentaParcial],
  );

  const seleccionarCliente = React.useCallback((cliente: ClienteOption) => {
    setClienteSeleccionado(cliente);
    setClienteMetodo(cliente.rapido ? 'GENERAL' : 'BUSCAR');
    setBusquedaCliente('');
    setBusquedaAplicada('');
    setIntentoPaso1(false);
    setSubmitError(null);
  }, []);

  const buscarCliente = () => setBusquedaAplicada(busquedaCliente.trim());
  const pasoActual = React.useMemo(() => datosPasoVenta(paso), [paso]);
  const clienteSeleccionadoId = clienteSeleccionado?.id ?? null;
  const clienteInvalido = paso === 1 && intentoPaso1 && !clienteSeleccionado;
  const modoInvalido = paso === 2 && intentoPaso2 && !modoVenta;
  const fechaVentaInvalida =
    paso === 2 && intentoPaso2 && !fechaVentaValidacion.isValid;
  const precioTotalInvalido =
    paso === 2 &&
    modoVenta === 'TOTAL' &&
    intentoPaso2 &&
    preciosVentaTotalInvalidos.size > 0;
  const sinInventario = paso === 2 && lotesVenta.length === 0;
  const parcialSinCantidad =
    paso === 2 && modoVenta === 'PARCIAL' && !hayCantidadParcial;
  const parcialSinSeleccion = parcialSinCantidad && intentoPaso2;
  const volverPasoAnterior = () => {
    if (paso > 1) {
      anterior();
      return;
    }

    navigate('/inicio');
  };

  const confirmarCancelarVenta = () => {
    setMostrarModalCancelar(false);
    reiniciar();
  };

  const validarClienteForm = React.useCallback(() => {
    const errores: ClienteFormErrors = {};

    const nombre =
      clienteForm.tipoDocumento === 'NIT'
        ? validateCompanyName(clienteForm.nombre)
        : validatePersonName(clienteForm.nombre, 'El nombre');
    if (!nombre.isValid) errores.nombre = nombre.message;

    // Teléfono (opcional)
    const telefono = getClientePhoneError(clienteForm.telefono);
    if (telefono) errores.telefono = telefono;

    if (!clienteForm.tipoDocumento) {
      errores.tipoDocumento = 'Selecciona el tipo de documento.';
    }

    // Documento: NO validar si no hay tipo seleccionado
    const tipoSeleccionado = clienteForm.tipoDocumento || null;
    const documento = validateDocumentNumber(
      clienteForm.documento,
      'El documento',
      {
        optional: false,
        type: tipoSeleccionado,
      },
    );

    // Si hay texto, pero no se ha elegido tipo, espera mensaje de tipo.
    if (clienteForm.documento.trim() && !clienteForm.tipoDocumento) {
      errores.documento = undefined;
    } else if (!documento.isValid) {
      errores.documento = documento.message;
    }

    return errores;
  }, [clienteForm.documento, clienteForm.nombre, clienteForm.telefono, clienteForm.tipoDocumento]);

  const guardarCliente = async () => {
    const nombre =
      clienteForm.tipoDocumento === 'NIT'
        ? normalizeCompanyName(clienteForm.nombre)
        : normalizeHumanName(clienteForm.nombre);
    const telefono = sanitizePersonDigits(clienteForm.telefono);
    const tipoDocumento = clienteForm.tipoDocumento || undefined;
    const documento = tipoDocumento
      ? normalizeDocumentForStorage(clienteForm.documento, tipoDocumento)
      : '';
    const errores = validarClienteForm();

    setClienteFormErrors(errores);
    setClienteFormError(null);

    if (Object.keys(errores).length > 0) {
      return;
    }

    const clienteExistente = findClienteExistente(
      clientes,
      nombre,
      documento,
      clienteEditando?.id,
    );
    if (clienteExistente) {
      setClienteFormErrors((actual) => ({
        ...actual,
        documento: 'Este documento ya está registrado.',
      }));
      setClienteFormError(
        'Este documento ya está registrado. Busca el registro existente o usa otro número.',
      );
      return;
    }

    try {
      const payload = {
        nombre,
        documento: documento || undefined,
        tipoDocumento,
        telefono: telefono || undefined,
      };
      const clienteGuardado = clienteEditando
        ? await actualizarCliente(clienteEditando.id, payload)
        : await crearCliente(payload);
      const nuevo = mapClienteToOption(clienteGuardado);
      setClientes((actual) =>
        dedupeClientesOptions([
          nuevo,
          ...actual.filter((cliente) => cliente.id !== nuevo.id),
        ]),
      );
      setClienteSeleccionado(nuevo);
      setIntentoPaso1(false);
      setBusquedaCliente('');
      setBusquedaAplicada('');
      setMostrarModal(false);
      setClienteEditando(null);
      setClienteMetodo('BUSCAR');
      setClienteForm({ nombre: '', telefono: '', documento: '', tipoDocumento: '' });
      setClienteFormErrors({});
      setClienteFormError(null);
      setSubmitError(null);
    } catch (error) {
      setClienteFormError('No fue posible registrar el cliente. Intenta nuevamente.');
    }
  };

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
      <CafeSmartErrorState
        fullScreen
        variant="success"
        title="Venta registrada"
        message="La venta se guardó correctamente."
        primaryLabel="Registrar nueva venta"
        secondaryLabel="Ir a inventario"
        onPrimary={reiniciar}
        onSecondary={() => navigate('/inventario')}
        info="El registro de venta quedó guardado y listo para consultarse."
      >
        <article className="rounded-[18px] border border-[#e1e7f3] bg-[#fbfcff] p-4 text-left">
              <p className="text-[0.7rem] font-black uppercase tracking-[0.12em] text-slate-500">
                Resumen de venta
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-slate-500">Cliente</span>
                  <span className="text-right font-black text-slate-950">
                    {ventaGuardada.clienteNombre}
                  </span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-slate-500">Fecha</span>
                  <span className="font-black text-slate-950">
                    {formatDateLabel(ventaGuardada.fecha)}
                  </span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-slate-500">Total kg</span>
                  <span className="font-black text-slate-950">
                    {kg(ventaGuardada.totalKg)}
                  </span>
                </div>
                <div className="rounded-[14px] bg-[#f0f4ff] px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[0.78rem] font-black uppercase text-slate-700">
                      Total recibido
                    </span>
                    <span className="text-[1.35rem] font-black text-[#173ea6]">
                      {money(ventaGuardada.totalVenta)}
                    </span>
                  </div>
                </div>
              </div>
            </article>
        {ventasRealizadas.length > 0 ? (
          <article className="mt-3 rounded-[18px] border border-[#e1e7f3] bg-white p-4 text-left">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.7rem] font-black uppercase tracking-[0.12em] text-slate-500">
                  Última venta
                </p>
                <p className="mt-1 text-sm font-black text-slate-950">
                  {ventasRealizadas[0].clienteNombre}
                </p>
              </div>
              <span className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-[0.78rem] font-black text-[#173ea6]">
                {money(ventasRealizadas[0].totalVenta)}
              </span>
            </div>
            {ventasRealizadas.length > 1 ? (
              <button
                type="button"
                onClick={() => setMostrarHistorialVentas(true)}
                className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#d5deee] bg-[#f8fbff] px-4 text-sm font-black text-[#173ea6]"
              >
                Ver historial completo
                <ArrowRight size={15} />
              </button>
            ) : null}
          </article>
        ) : null}
        {mostrarHistorialVentas ? (
          <div
            className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center overflow-y-auto bg-slate-900/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:px-5 sm:py-6"
            role="presentation"
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="ventas-history-title"
              className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[24px] bg-white text-left shadow-[0_28px_70px_rgba(15,23,42,0.28)] sm:max-h-[min(88dvh,720px)]"
            >
              <header className="shrink-0 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2
                      id="ventas-history-title"
                      className="text-lg font-black text-slate-950"
                    >
                      Historial completo de la venta
                    </h2>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {ventasHistorialFiltradas.length} registros
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMostrarHistorialVentas(false)}
                    aria-label="Cerrar historial de ventas"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-4 grid gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-black text-slate-700">Fecha</span>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={historialVentaFecha}
                        max={getTodayLocalDateValue()}
                        onChange={(event) => setHistorialVentaFecha(event.target.value)}
                        className="min-h-[42px] flex-1 rounded-[14px] border border-[#dbe2f0] bg-[#f8faff] px-3 text-sm font-bold text-slate-900 outline-none focus:border-[#1f3fa7]"
                      />
                      <button
                        type="button"
                        onClick={() => setHistorialVentaFecha('')}
                        className="min-h-[42px] rounded-[14px] bg-[#eef4ff] px-3 text-xs font-black text-[#173ea6]"
                      >
                        Limpiar fecha
                      </button>
                    </div>
                  </label>
                  {historialVentaFecha ? (
                    <p className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
                      Mostrando registros filtrados por fecha. Usa “Limpiar” para volver a ver todos.
                    </p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-black text-slate-700">Cliente</span>
                      <select
                        value={historialVentaCliente}
                        onChange={(event) => setHistorialVentaCliente(event.target.value)}
                        className="h-[42px] w-full rounded-[14px] border border-[#dbe2f0] bg-[#f8faff] px-3 text-xs font-black text-slate-700 outline-none"
                      >
                        {historialVentaClientes.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-black text-slate-700">Ordenar por</span>
                      <select
                        value={historialVentaOrden}
                        onChange={(event) => setHistorialVentaOrden(event.target.value as 'recent' | 'oldest')}
                        className="h-[42px] w-full rounded-[14px] border border-[#dbe2f0] bg-[#f8faff] px-3 text-xs font-black text-slate-700 outline-none"
                      >
                        <option value="recent">Más recientes</option>
                        <option value="oldest">Más antiguos</option>
                      </select>
                    </label>
                  </div>
                </div>
              </header>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
                {ventasHistorialFiltradas.map((venta) => (
                  <article
                    key={venta.referenciaId}
                    className="rounded-[18px] border border-[#e2e8f4] bg-[#fbfcff] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[0.68rem] font-black uppercase tracking-[0.11em] text-[#52657d]">
                          Venta del {formatDateLabel(venta.fecha)}
                        </p>
                        <p className="mt-0.5 text-sm font-black text-slate-950">
                          {venta.clienteNombre}
                        </p>
                        <p className="mt-1 text-sm font-black text-[#173ea6]">
                          {money(venta.totalVenta)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          aria-label="Editar venta"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] bg-[#eef4ff] text-[#173ea6]"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="Eliminar venta"
                          onClick={() =>
                            setVentasRealizadas((actual) =>
                              actual.filter(
                                (item) => item.referenciaId !== venta.referenciaId,
                              ),
                            )
                          }
                          className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] bg-[#fff1f3] text-[#d63b4a]"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </CafeSmartErrorState>
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-5 pb-[145px] text-slate-900">
      <div className="mx-auto max-w-[430px] space-y-4">
        <header className="px-4 py-4 pt-6">
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              onClick={volverPasoAnterior}
              className="absolute left-0 inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-900 transition hover:bg-white/70 hover:opacity-75"
              aria-label={
                paso > 1 ? 'Volver al paso anterior' : 'Salir a inicio'
              }
            >
              <ArrowLeft size={22} />
            </button>
            <h1 className="text-[1.35rem] font-semibold text-slate-900">
              Nueva Venta
            </h1>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between text-[1.05rem] font-medium text-slate-900">
              <span>
                Paso {paso}: {pasoActual.titulo}
              </span>
              <span className="text-[1.05rem] text-[#002f6c]">{paso} de 3</span>
            </div>
            <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#d0dbeb]">
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
        {cargando ? (
          <LoadingCard text="Cargando inventario para venta..." />
        ) : loadError ? (
          <section className="rounded-[18px] border border-[#f3d7dc] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0f2] text-[#d9485a]">
                <RefreshCw size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.95rem] font-semibold text-slate-900">
                  No se pudo cargar el inventario
                </p>
                <p className="mt-1 text-[0.82rem] leading-5 text-slate-500">
                  Revisa tu conexión e intenta de nuevo.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void cargarLotes()}
              className="mt-4 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#1f3fa7] px-4 text-[0.9rem] font-semibold text-white"
            >
              <RefreshCw size={14} />
              Reintentar
            </button>
          </section>
        ) : (
          <>
            {paso === 2 ? (
              <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-medium text-slate-500">
                  Seleccionar cafe
                </p>
                <h2 className="mt-2 text-[1.3rem] font-semibold text-[#102d92]">
                  Como deseas realizar la venta?
                </h2>

                <div className="mt-3 rounded-[14px] border border-[#dbe1f1] bg-[#f7f8fe] p-3">
                  <p className="text-xs font-medium text-slate-500">
                    Cliente seleccionado
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {clienteSeleccionado?.nombre ?? 'Sin cliente'}
                  </p>
                  <p className="text-xs text-slate-600">
                    {clienteSeleccionado?.documento ?? 'Selección pendiente'}
                  </p>
                </div>

                <div className="mt-4 rounded-[14px] border border-[#dbe1f1] bg-[#f7f8fe] p-3">
                  <p className="text-xs font-medium text-slate-500">
                    Fecha de venta
                  </p>
                  <SalesDatePicker
                    value={fechaVenta}
                    min={BUSINESS_MIN_DATE_VALUE}
                    max={getTodayLocalDateValue()}
                    open={fechaVentaPickerOpen}
                    onToggle={() => setFechaVentaPickerOpen((open) => !open)}
                    onClose={() => setFechaVentaPickerOpen(false)}
                    onChange={(value) => {
                      setFechaVenta(value || getTodayLocalDateValue());
                      setSubmitError(null);
                    }}
                  />
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
                    }}
                    disabled={sinInventario}
                    className={`min-h-[92px] rounded-[16px] border p-4 text-left ${
                      modoVenta === 'PARCIAL'
                        ? 'border-[#102d92] bg-[#eef2ff]'
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
                    }}
                    disabled={sinInventario}
                    className={`min-h-[92px] rounded-[16px] border p-4 text-left ${
                      modoVenta === 'TOTAL'
                        ? 'border-[#102d92] bg-[#eef2ff]'
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
                          const precioTipoInvalido =
                            modoVenta === 'TOTAL' &&
                            (intentoPaso2 || precioTipo.trim() !== '') &&
                            toNum(precioTipo) < PRECIO_MINIMO_KG;

                          return (
                            <div key={item.tipoCafeId}>
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <span className="text-sm font-black text-slate-800">
                                  Café {item.tipoCafe.toLowerCase()}
                                </span>
                                <span className="text-xs font-semibold text-slate-500">
                                  {kg(item.pesoKg)}
                                </span>
                              </div>
                              <label
                                className={`flex min-h-[56px] items-center rounded-[14px] border bg-[#f8faff] px-4 ${
                                  precioTipoInvalido
                                    ? 'border-[#ef4444]'
                                    : 'border-[#d7dcec]'
                                }`}
                              >
                                <span className="mr-3 text-xl font-black text-[#1f3fa7]">
                                  $
                                </span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={precioTipo}
                                  onChange={(event) =>
                                    setPreciosVentaTotal((actual) => ({
                                      ...actual,
                                      [item.tipoCafeId]: soloDigitos(
                                        event.target.value,
                                      ),
                                    }))
                                  }
                                  placeholder="Ej. 14500"
                                  className="w-full bg-transparent text-xl font-black text-slate-950 outline-none placeholder:text-slate-300"
                                />
                              </label>
                              {precioTipoInvalido ? (
                                <InlineGuidedError
                                  message={getVentasGuidance(
                                    `Ingresa un precio por kg valido para cafe ${item.tipoCafe}.`,
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
                      <p className="rounded-[12px] bg-white px-3 py-2 text-xs font-bold leading-5 text-slate-600">
                        Completa cantidad y precio, luego confirma el ajuste para agregarlo a la venta.
                      </p>
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
                          className="h-11 w-full rounded-[14px] border border-[#dbe2f0] bg-white pl-9 pr-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#1f3fa7] focus:ring-4 focus:ring-[#1f3fa7]/10"
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

                    {lotesVentaParcialVisibles.map((lote) => {
                      const cantidad = toNum(lote.cantidadKg);
                      const cantidadIngresada = lote.cantidadKg.trim() !== '';
                      const disponibleVenta = getDisponibleVenta(lote);
                      const cantidadInvalida =
                        modoVenta === 'PARCIAL' &&
                        cantidadIngresada &&
                        (cantidad <= 0 || cantidad > disponibleVenta);
                      const precioInvalido =
                        modoVenta === 'PARCIAL' &&
                        cantidadIngresada &&
                        toNum(lote.precioKg) < PRECIO_MINIMO_KG;
                      const ajusteVentaAbierto = ventaParcialOpenId === lote.id;
                      const alertaTarjeta = ventaParcialCardAlerts[lote.id];
                      const ajustePendiente =
                        !ajustesVentaParcialConfirmados[lote.id] &&
                        (lote.cantidadKg.trim() !== '' ||
                          lote.precioKg.trim() !== '');

                      return (
                        <article
                          key={lote.id}
                          className="rounded-[16px] border border-[#e5e8f3] bg-[#fcfcff] p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-base font-black uppercase text-[#102d92]">
                                {lote.tipoCafe} {lote.calidad}
                              </p>
                              <p className="text-sm font-semibold text-slate-600">
                                Disponible: {kg(disponibleVenta)}
                              </p>
                              {cantidad > 0 ? (
                                <p className="mt-1 text-sm font-black text-slate-900">
                                  {kg(cantidad)} · {money(cantidad * toNum(lote.precioKg))}
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setVentaParcialOpenId((actual) =>
                                  actual === lote.id ? null : lote.id,
                                )
                              }
                              className="inline-flex min-h-[38px] shrink-0 items-center rounded-[12px] bg-[#eef3ff] px-3 text-[0.72rem] font-black text-[#102d92]"
                              {...ariaExpanded(ajusteVentaAbierto)}
                            >
                              Vender
                            </button>
                          </div>

                          {ajusteVentaAbierto ? (
                            <>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs font-black text-slate-700">
                                    Cantidad a vender (kg)
                                  </label>
                                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                                    No puede superar el peso disponible.
                                  </p>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  max={disponibleVenta}
                                  value={lote.cantidadKg}
                                  onChange={(event) =>
                                    updateLote(
                                      lote.id,
                                      'cantidadKg',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Cantidad kg"
                                  className="mt-2 w-full rounded-xl border border-[#d7dcec] bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#102d92]"
                                />
                                </div>
                                <div>
                                  <label className="text-xs font-black text-slate-700">
                                    Precio por kg
                                  </label>
                                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                                    Ingresa el precio de venta para este café.
                                  </p>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={lote.precioKg}
                                  onChange={(event) =>
                                    updateLote(
                                      lote.id,
                                      'precioKg',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Precio por kg"
                                  className="mt-2 w-full rounded-xl border border-[#d7dcec] bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#102d92]"
                                />
                                </div>
                              </div>
                              <div className="mt-3 flex items-center justify-between rounded-[12px] bg-[#eef3ff] px-3 py-2 text-sm font-black text-[#102d92]">
                                <span>Total estimado</span>
                                <span>{money(cantidad * toNum(lote.precioKg))}</span>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => confirmarAjusteParcial(lote)}
                                  className="inline-flex min-h-[40px] items-center justify-center rounded-[12px] bg-[#102d92] text-sm font-black text-white"
                                >
                                  Confirmar ajuste
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setVentaParcialOpenId(null)}
                                  className="inline-flex min-h-[40px] items-center justify-center rounded-[12px] border border-[#d5deee] bg-white text-sm font-black text-[#334b85]"
                                >
                                  Cancelar
                                </button>
                              </div>
                              {alertaTarjeta ? (
                                <div
                                  role="alert"
                                  className="mt-3 flex items-start gap-2 rounded-[12px] border border-rose-200 bg-rose-50/80 px-3 py-2 text-left shadow-[0_8px_18px_rgba(190,18,60,0.06)]"
                                >
                                  <AlertTriangle
                                    size={14}
                                    className="mt-0.5 shrink-0 text-rose-500"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-[0.76rem] font-black leading-4 text-rose-800">
                                      {alertaTarjeta.title}
                                    </p>
                                    <p className="mt-0.5 text-[0.68rem] font-semibold leading-4 text-rose-700/80">
                                      {alertaTarjeta.detail}
                                    </p>
                                  </div>
                                </div>
                              ) : ajustePendiente ? (
                                <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-amber-200 bg-amber-50/90 px-3 py-2 text-left">
                                  <AlertTriangle
                                    size={14}
                                    className="mt-0.5 shrink-0 text-amber-600"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-[0.78rem] font-black leading-4 text-amber-900">
                                      Ajuste pendiente en {lote.tipoCafe} {lote.calidad}.
                                    </p>
                                    <p className="mt-1 text-[0.7rem] font-semibold leading-4 text-amber-800">
                                      Confirma o cancela este ajuste.
                                    </p>
                                  </div>
                                </div>
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
                        className="inline-flex min-h-[42px] w-full items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#173ea6]"
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
                <article className="mt-4 rounded-[16px] border border-[#d6e2ff] bg-[#eef3ff] p-3 text-[#102d92]">
                  <div className="flex items-center justify-between text-sm font-black">
                    <span>Total seleccionado</span>
                    <span>{kg(totalKg)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-lg font-black">
                    <span>Total estimado</span>
                    <span>{money(totalEstimado)}</span>
                  </div>
                </article>

                <div className="mt-4 grid grid-cols-[0.8fr_1.2fr] gap-3">
                  <button
                    type="button"
                    onClick={anterior}
                    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-[#edf1fa] px-3 py-3 text-sm font-semibold text-slate-600"
                  >
                    <ArrowLeft size={16} />
                    Regresar
                  </button>
                  <button
                    type="button"
                    onClick={siguiente}
                    disabled={sinInventario}
                    className={`inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[16px] px-3 py-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(16,45,146,0.26)] ${
                      sinInventario
                        ? 'cursor-not-allowed bg-[#7f93cf]'
                        : 'bg-[#1f3fa7]'
                    }`}
                  >
                    Siguiente paso
                    <ArrowRight size={18} />
                  </button>
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
                      <div className="rounded-[16px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-5 text-center text-sm text-slate-500">
                        <p className="font-bold text-slate-800">
                          Aún no tienes clientes registrados.
                        </p>
                        <p className="mt-1 leading-5">
                          Registra un cliente para asociarlo a esta venta.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setClienteMetodo('REGISTRAR');
                            setClienteEditando(null);
                            setClienteForm({ nombre: '', telefono: '', documento: '', tipoDocumento: '' });
                            setClienteFormErrors({});
                            setClienteFormError(null);
                            setMostrarModal(true);
                          }}
                          className="mt-3 inline-flex min-h-[40px] items-center justify-center rounded-[12px] bg-[#1f3fa7] px-4 text-sm font-bold text-white"
                        >
                          Registrar cliente
                        </button>
                      </div>
                    ) : (
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
                            className="group flex min-h-[52px] w-full items-center justify-between rounded-[16px] border border-[#dbe2f0] bg-white px-4 py-3 text-left text-sm font-black text-[#1f3fa7] shadow-[0_10px_22px_rgba(15,23,42,0.04)] transition duration-200 hover:border-[#1f3fa7]/40 hover:bg-[#f4f7ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/15"
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
                              {clienteSeleccionado.rapido ? 'Venta rápida' : clienteSeleccionado.documento}
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

                <button
                  type="button"
                  onClick={siguiente}
                  className="inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[16px] bg-[#1f3fa7] px-5 py-4 text-[1.1rem] font-semibold text-white shadow-[0_12px_28px_rgba(16,45,146,0.26)] transition hover:bg-[#18358f] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Siguiente paso
                  <ArrowRight size={20} />
                </button>
              </section>
            ) : null}

            {paso === 3 ? (
              <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-medium text-slate-500">
                  Revision final
                </p>
                <h2 className="mt-2 text-[1.3rem] font-semibold text-[#102d92]">
                  Confirma los datos de la venta
                </h2>

                {submitError ? (
                  <InlineGuidedError
                    message={getVentasGuidance(submitError)}
                    className="mt-4"
                  />
                ) : null}
                {revisionDeleteAlert ? (
                  <div
                    role="alert"
                    className="mt-4 flex items-start gap-2 rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-left shadow-[0_8px_18px_rgba(180,83,9,0.08)]"
                  >
                    <AlertTriangle
                      size={15}
                      className="mt-0.5 shrink-0 text-amber-600"
                    />
                    <div className="min-w-0">
                      <p className="text-[0.78rem] font-black leading-4 text-amber-900">
                        {revisionDeleteAlert.title}
                      </p>
                      <p className="mt-1 text-[0.7rem] font-semibold leading-4 text-amber-800">
                        {revisionDeleteAlert.detail}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 rounded-[14px] border border-[#dbe1f1] bg-[#f7f8fe] p-3">
                  <p className="text-xs font-medium text-slate-500">Cliente</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {clienteSeleccionado?.nombre ?? 'Sin cliente'}
                  </p>
                  <p className="text-xs text-slate-600">
                    {clienteSeleccionado?.documento ?? 'Selección pendiente'}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Fecha
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDateLabel(fechaVenta)}
                  </p>
                </div>
                {lotesConCantidad.length ? (
                  <div className="mt-4 space-y-2">
                    {(lotesConCantidad.length > 2
                      ? lotesConCantidad.slice(-2)
                      : lotesConCantidad
                    ).map((lote) => (
                      <div
                        key={lote.id}
                        className="rounded-[12px] border border-[#e5e7f2] bg-[#fcfcff] px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900">
                              {lote.codigo}
                            </p>
                            <p className="text-xs text-slate-600">
                              {lote.tipoCafe} — {lote.calidad}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-[#102d92]">
                              {kg(lote.cantidad)} ·{' '}
                              {money(lote.cantidad * lote.precio)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={editarLoteDesdeRevision}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#eef2ff] text-[#102d92]"
                              title="Editar producto"
                              aria-label={`Editar ${lote.codigo}`}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => eliminarLoteDesdeRevision(lote.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#fff0f2] text-[#e24c5a]"
                              title="Quitar producto"
                              aria-label={`Quitar ${lote.codigo}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {lotesConCantidad.length > 2 ? (
                  <button
                    type="button"
                    onClick={() => setMostrarHistorialLotesVenta(true)}
                    className="mt-3 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#d5deee] bg-[#f8fbff] px-4 text-sm font-black text-[#173ea6]"
                  >
                    Ver historial completo
                    <ArrowRight size={15} />
                  </button>
                ) : null}

                {ventaFifoBreakdown.length > 1 ? (
                  <section className="mt-4 rounded-[14px] border border-[#dbe1f1] bg-white p-3">
                    <p className="text-sm font-black text-slate-950">
                      Desglose de sublotes
                    </p>
                    <div className="mt-2 space-y-2">
                      {ventaFifoBreakdown.map((item) => (
                        <div
                          key={`${item.groupId}-${item.subloteId}`}
                          className="rounded-[12px] bg-[#f7f8fe] px-3 py-2"
                        >
                          <p className="text-xs font-black text-[#102d92]">
                            FIFO #{item.fifoPosition} — {item.subloteNombre}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-600">
                            {kg(item.pesoAsignado)} asignados · Entrada:{' '}
                            {formatDateLabel(item.fechaEntrada)}
                          </p>
                          {item.costoBase !== null ? (
                            <p className="mt-0.5 text-[0.68rem] font-semibold text-slate-500">
                              Costo base: {money(item.costoBase)}/kg
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <article className="mt-4 rounded-[16px] border border-[#d6e2ff] bg-[#eef3ff] p-3 text-[#102d92]">
                  <div className="flex items-center justify-between text-sm font-black">
                    <span>Total kg</span>
                    <span>{kg(totalKg)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-lg font-black">
                    <span>Total estimado</span>
                    <span>{money(totalEstimado)}</span>
                  </div>
                </article>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={anterior}
                    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-[#edf1fa] px-4 py-3 text-sm font-semibold text-slate-600"
                  >
                    <ArrowLeft size={16} />
                    Regresar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const errorRevision = validarPasoVenta();
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
                    className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-sm font-semibold text-white ${
                      guardandoVenta || botonConfirmarPresionado
                        ? 'bg-[#7f93cf] cursor-wait'
                        : 'bg-[#102d92]'
                    }`}
                  >
                    {guardandoVenta || botonConfirmarPresionado ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Guardando venta...
                      </>
                    ) : (
                      <>
                        Confirmar venta
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarModalCancelar(true)}
                  disabled={guardandoVenta || botonConfirmarPresionado}
                  className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-[14px] px-4 py-3 text-sm font-black text-slate-500 disabled:opacity-60"
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
          className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center bg-slate-900/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:px-5 sm:py-6"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="venta-draft-title"
            aria-describedby="venta-draft-description"
            className="w-full max-w-[430px] rounded-[24px] bg-white p-5 shadow-[0_28px_70px_rgba(15,23,42,0.28)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.11em] text-[#1f3fa7]">
                  Registro de venta en progreso
                </p>
                <h2
                  id="venta-draft-title"
                  className="mt-1 text-xl font-black text-slate-950"
                >
                  Borrador guardado
                </h2>
              </div>
              <button
                type="button"
                onClick={empezarVentaNuevaDesdeBorrador}
                aria-label="Cerrar borrador guardado"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
              >
                <X size={18} />
              </button>
            </div>
            <p
              id="venta-draft-description"
              className="mt-3 text-sm font-medium leading-6 text-slate-600"
            >
              Encontramos una venta que no fue finalizada. Puedes continuar con
              la información guardada o empezar una nueva venta.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={continuarBorradorVenta}
                className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white"
              >
                Continuar venta
              </button>
              <button
                type="button"
                onClick={empezarVentaNuevaDesdeBorrador}
                className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] bg-[#edf1fa] px-4 text-sm font-black text-slate-700"
              >
                Empezar de nuevo
              </button>
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
                    {lotesConCantidad.length} registros · {kg(totalKg)} · {money(totalEstimado)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarHistorialLotesVenta(false)}
                  aria-label="Cerrar historial de la venta"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                >
                  <X size={18} />
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {lotesConCantidad.map((lote) => (
                <article
                  key={lote.id}
                  className="rounded-[18px] border border-[#e2e8f4] bg-[#fbfcff] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-950">
                        {lote.tipoCafe} — {lote.calidad}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-600">
                        {kg(lote.cantidad)} · {money(lote.cantidad * lote.precio)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        aria-label={`Editar ${lote.codigo}`}
                        onClick={() => {
                          setMostrarHistorialLotesVenta(false);
                          editarLoteDesdeRevision();
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] bg-[#eef4ff] text-[#173ea6]"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Eliminar ${lote.codigo}`}
                        onClick={() => eliminarLoteDesdeRevision(lote.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] bg-[#fff1f3] text-[#d63b4a]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
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
                    onChange={(event) => {
                      setBusquedaClientesModal(event.target.value);
                    }}
                    placeholder="Buscar por nombre, documento o teléfono"
                    className="w-full rounded-[16px] border border-[#dbe2f0] bg-[#f8faff] px-10 py-3 text-[0.95rem] font-medium text-slate-900 outline-none transition focus:border-[#1f3fa7] focus:bg-white focus:ring-4 focus:ring-[#1f3fa7]/10"
                  />
                </div>

                <label className="block text-[0.82rem] font-black uppercase tracking-[0.11em] text-slate-500">
                  Ordenar por
                </label>
                <div className="max-w-[260px]">
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
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {sinClientesRegistrados ? (
                <div className="rounded-[18px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-8 text-center text-sm text-slate-500">
                  <p className="font-bold text-slate-800">
                    Aún no tienes clientes registrados.
                  </p>
                  <p className="mt-1 leading-5">
                    Registra un cliente para poder asociarlo a esta venta.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarModalClientes(false);
                      setClienteMetodo('REGISTRAR');
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
                    className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-[12px] bg-[#1f3fa7] px-4 text-sm font-bold text-white"
                  >
                    {clienteEditando ? 'Editar cliente' : 'Registrar cliente'}
                  </button>
                </div>
              ) : (
                (() => {
                  const termino = norm(busquedaClientesModal.trim());
                  const base = dedupeClientesOptions([...clientes]);

                  const filtrados = termino
                    ? base.filter((c) =>
                        [c.nombre, c.documento, c.detalle, c.telefono ?? ''].some(
                          (v) => norm(v).includes(termino),
                        ),
                      )
                    : base;

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
                      <div className="rounded-[18px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-8 text-center text-sm text-slate-500">
                        <p className="font-bold text-slate-800">
                          No encontramos clientes con ese dato.
                        </p>
                        <p className="mt-1 leading-5">
                          Prueba buscando por nombre o documento.
                        </p>
                      </div>
                    );
                  }

                  return <div className="space-y-2 pb-4">{ordenados.map((c) => (
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
                  ))}</div>;
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
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
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

      {mostrarModalConfirmar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[24px] bg-white p-6 text-center shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
            <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f1ff] text-[#1f3fa7]">
              <ReceiptText size={24} />
            </div>
            <h2 className="mt-5 text-[1.8rem] font-black leading-tight text-slate-950">
              Confirmar venta
            </h2>
            <p className="mt-3 text-base leading-6 text-slate-500">
              Se registrará esta venta y se descontará del inventario.
            </p>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalConfirmar(false);
                  void confirmar();
                }}
                disabled={guardandoVenta || botonConfirmarPresionado}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] bg-[#1f3fa7] px-5 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {guardandoVenta || botonConfirmarPresionado
                  ? 'Guardando venta...'
                  : 'Confirmar venta'}
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalConfirmar(false)}
                disabled={guardandoVenta || botonConfirmarPresionado}
                className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] px-5 text-base font-black text-slate-500 disabled:opacity-70"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-3 text-sm font-black text-[#1f3fa7]"
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={confirmarCancelarVenta}
                className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] bg-rose-50 px-3 text-sm font-black text-rose-700 ring-1 ring-rose-100"
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
          <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.28)] sm:max-h-[min(88dvh,720px)]">
            <header className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-3">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-[#cfd8e6]" />
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[1.35rem] font-semibold leading-tight text-[#111827]">
                    Registrar cliente
                  </h2>
                  <p className="mt-1 text-sm font-medium leading-5 text-slate-500">
                    {clienteEditando
                      ? 'Actualiza los datos del cliente.'
                      : 'Completa los datos básicos para usarlo en esta venta.'}
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
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              <div className="flex flex-col gap-5 pb-6">
                <div className="order-2">
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
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
                  <label className="flex items-center gap-3 rounded-[14px] border border-[#dde4f1] bg-[#f7f9fd] px-4 py-3">
                    <User size={17} className="text-slate-400" />
                    <input
                      type="text"
                      value={clienteForm.nombre}
                      disabled={!clienteForm.tipoDocumento}
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
                      className="w-full bg-transparent text-[0.95rem] text-slate-900 outline-none disabled:cursor-not-allowed disabled:text-slate-400 disabled:placeholder:text-slate-400"
                    />
                  </label>

                  {nombreMaxToast ? (
                    <div
                      role="status"
                      aria-live="polite"
                      className="mt-2 flex items-center gap-2 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"
                    >
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-800"
                        aria-hidden="true"
                      >
                        <span className="text-[0.8rem] font-black">!</span>
                      </span>
                      <span>
                        No puedes ingresar más de {MAX_NOMBRE_CARACTERES} caracteres.
                      </span>
                    </div>
                  ) : null}

                  {clienteFormErrors.nombre ? (
                    <InlineGuidedError
                      message={getVentasGuidance(clienteFormErrors.nombre)}
                      className="mt-2"
                    />
                  ) : null}
                </div>

                <div className="order-1">
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    Tipo de documento
                  </label>
                  <p className="mt-0.5 text-xs font-medium leading-5 text-slate-500">
                    Selecciona si el cliente usa cédula o NIT.
                  </p>
                  <div className="mt-2">
                    <CompactSelect
                      id="cliente-document-type"
                      value={clienteForm.tipoDocumento}
                      options={DOCUMENT_TYPE_OPTIONS}
                      placeholder="Selecciona el tipo de documento"
                      open={clienteDocumentoDropdownOpen}
                      icon={<IdCard size={16} />}
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
                    <InlineGuidedError
                      message={getVentasGuidance(clienteFormErrors.tipoDocumento)}
                      className="mt-2"
                    />
                  ) : null}
                </div>

                <div className="order-3">
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    Número de documento
                  </label>
                  <label className="flex items-center gap-3 rounded-[14px] border border-[#dde4f1] bg-[#f7f9fd] px-4 py-3">
                    <IdCard size={17} className="text-slate-400" />
                    <input
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
                      className="w-full bg-transparent text-[0.95rem] text-slate-900 outline-none disabled:cursor-not-allowed disabled:text-slate-400 disabled:placeholder:text-slate-400"
                    />
                  </label>
                  {clienteFormErrors.documento ? (
                    <InlineGuidedError
                      message={getVentasGuidance(clienteFormErrors.documento)}
                      className="mt-2"
                    />
                  ) : null}
                </div>

                <div className="order-4">
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    Teléfono (opcional)
                  </label>
                  <p className="mb-2 text-xs font-medium leading-5 text-slate-500">
                    Número celular colombiano.
                  </p>
                  <label className="flex items-center gap-3 rounded-[14px] border border-[#dde4f1] bg-[#f7f9fd] px-4 py-3">
                    <Phone size={17} className="text-slate-400" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={12}
                      value={clienteForm.telefono}
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
                      placeholder="300 123 4567"
                      className="w-full bg-transparent text-[0.95rem] text-slate-900 outline-none"
                    />
                  </label>
                  {clienteFormErrors.telefono ? (
                    <InlineGuidedError
                      message={getVentasGuidance(clienteFormErrors.telefono)}
                      className="mt-2"
                    />
                  ) : null}
                </div>

                {clienteFormError ? (
                  <InlineGuidedError
                    message={getVentasGuidance(clienteFormError)}
                    className="order-5"
                  />
                ) : null}
              </div>
            </div>

            <footer className="shrink-0 border-t border-[#eef2f7] bg-[#fbfcff] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={guardarCliente}
                  className="inline-flex min-h-[54px] w-full items-center justify-center rounded-[14px] bg-[#102d92] px-5 py-3.5 text-[0.98rem] font-semibold text-white shadow-[0_14px_30px_rgba(16,45,146,0.20)] transition hover:bg-[#18358f] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {clienteEditando ? 'Guardar cambios' : 'Guardar cliente'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarModal(false);
                    setClienteEditando(null);
                    setClienteFormErrors({});
                    setClienteFormError(null);
                  }}
                  className="inline-flex min-h-[54px] w-full items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-5 py-3.5 text-[0.98rem] font-semibold text-[#334b85] transition hover:bg-[#f4f7ff] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/15"
                >
                  Cancelar
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      {guardandoVenta || botonConfirmarPresionado ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/10 px-4">
          <div className="w-full max-w-[300px] rounded-[18px] bg-white px-5 py-4 text-center shadow-[0_18px_42px_rgba(15,23,42,0.22)]">
            <RefreshCw
              size={28}
              className="mx-auto animate-spin text-[#1f3fa7]"
            />
            <p className="mt-2 text-sm font-black text-slate-900">
              Guardando venta
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Actualizando inventario...
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#dbe4f3]">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[#102d92]" />
            </div>
          </div>
        </div>
      ) : null}

      <AppBottomNav hidden={mostrarModal || paso >= 1} />
    </div>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <RefreshCw size={18} className="animate-spin text-[#102d92]" />
        <p className="text-sm font-semibold text-[#102d92]">{text}</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#d0dbeb]">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-[#04337b]" />
      </div>
    </section>
  );
}

