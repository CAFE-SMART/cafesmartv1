import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeAlert,
  CalendarDays,
  Check,
  ChevronDown,
  Coffee,
  Frown,
  Leaf,
  LoaderCircle,
  Meh,
  Pencil,
  Plus,
  Search,
  Save,
  ShoppingBag,
  Smile,
  SunMedium,
  Trash2,
  User,
  UserPlus,
  Warehouse,
  X,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import {
  createGuidedError,
  InlineGuidedError,
  type GuidedErrorMessage,
} from '../components/forms/GuidedError';
import {
  BUSINESS_MIN_DATE_VALUE,
  formatDateLabel,
  getTodayLocalDateValue,
  toIsoDateAtUtcNoon,
  validateBusinessDateRange,
} from '../utils/date';
import { obtenerDeviceId } from '../utils/deviceId';
import { ApiRequestError } from '../services/apiService';
import { guardarConfiguracionBodega } from '../services/bodegaApi';
import {
  crearCompra,
  obtenerCatalogosCompra,
  validarCapacidadCompra,
  type CatalogoItem,
  type CatalogosCompra,
  type CreateCompraPayload,
  type EstadoCapacidadCompra,
} from '../services/comprasService';
import {
  crearProductor,
  listarProductores,
  type ProductorItem,
} from '../services/productoresService';
import { PRECIO_MINIMO_KG } from '../utils/businessRules';
import {
  formatPhoneNumber,
  sanitizeDigits as sanitizePersonDigits,
  type DocumentType,
  validatePhoneNumber,
} from '../utils/personValidation';

type Step = 1 | 2 | 3;
type SubloteForm = {
  id: string;
  tipoCafeId: string;
  calidadId: string;
  pesoInicial: string;
  precioKg: string;
};
type CompraGuardadaResumen = {
  fecha: string;
  productorNombre: string;
  productorDocumento: string;
  totalKg: number;
  totalCompra: number;
  capacidad?: EstadoCapacidadCompra;
  sublotes: Array<{
    id: string;
    tipoCafe: string;
    calidad: string;
    pesoInicial: number;
  }>;
};
type ProductorOption = {
  id: string;
  nombre: string;
  documento: string;
  detalle: string;
  telefono?: string;
  tipoDocumento?: DocumentType;
  createdAt?: string;
  rapido?: boolean;
};
type ProductorForm = {
  nombre: string;
  telefono: string;
  documento: string;
  tipoDocumento: DocumentType | '';
};
type CompraDraft = {
  version: 1;
  savedAt: number;
  step: Step;
  fecha: string;
  sublotes: SubloteForm[];
  subloteActivoId: string | null;
  productorSeleccionado: ProductorOption | null;
  productorSelectionMode: ProductorSelectionMode;
  compraLocalId: string | null;
};
type ProductorFormErrors = Partial<Record<keyof ProductorForm, string>>;
type ProductorFormField = keyof ProductorForm;
type ProductorModalError = {
  title: string;
  description: string;
};
type ProductorSelectionMode = 'buscar' | 'generico' | 'registrar' | null;
type ProductorSortMode =
  | 'recent'
  | 'oldest'
  | 'az'
  | 'za'
  | 'doc-asc'
  | 'doc-desc';

const ORDEN_TIPOS = ['VERDE', 'SECO', 'TRILLADO', 'PASILLA'];
const ORDEN_CALIDADES = ['BUENO', 'REGULAR', 'MALO'];
const PRODUCTOR_GENERAL: ProductorOption = {
  id: 'general',
  nombre: 'Productor Generico',
  documento: 'Compra rapida',
  detalle:
    'Para compras rÃ¡pidas o productores ocasionales no registrados en el sistema.',
  rapido: true,
};
const LIMITE_PRODUCTORES_RECIENTES = 4;
const PRODUCTOR_SORT_OPTIONS: Array<{
  value: ProductorSortMode;
  label: string;
}> = [
  { value: 'recent', label: 'MÃ¡s recientes' },
  { value: 'oldest', label: 'MÃ¡s antiguos' },
  { value: 'az', label: 'A-Z' },
  { value: 'za', label: 'Z-A' },
  { value: 'doc-asc', label: 'NÃºmero menor a mayor' },
  { value: 'doc-desc', label: 'NÃºmero mayor a menor' },
];
const PRODUCTOR_FORM_EMPTY: ProductorForm = {
  nombre: '',
  telefono: '',
  documento: '',
  tipoDocumento: '',
};
const COMPRA_DRAFT_STORAGE_KEY = 'cafe-smart:compra-draft:v1';

function ariaPressed(active: boolean) {
  return { 'aria-pressed': active ? 'true' : 'false' } as const;
}

function ariaExpanded(open: boolean) {
  return { 'aria-expanded': open ? 'true' : 'false' } as const;
}

function ariaSelected(active: boolean) {
  return { 'aria-selected': active ? 'true' : 'false' } as const;
}

function generarId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getProductorDocumentHelp(tipoDocumento: ProductorForm['tipoDocumento']) {
  if (tipoDocumento === 'CEDULA') {
    return 'Ingresa la cÃ©dula sin puntos ni espacios.';
  }

  if (tipoDocumento === 'NIT') {
    return 'Ingresa el NIT sin puntos ni guiones.';
  }

  return 'Primero selecciona cÃ©dula o NIT.';
}

function getProductorDocumentPlaceholder(
  tipoDocumento: ProductorForm['tipoDocumento'],
) {
  if (!tipoDocumento) {
    return 'Selecciona el tipo primero';
  }

  if (tipoDocumento === 'NIT') {
    return 'Ej. 900123456';
  }

  return 'Ej. 1234567890';
}

function getProductorNameError(value: string) {
  const nombre = value.trim();

  if (!nombre) {
    return 'Ingresa el nombre del productor.';
  }

  if (/\d/.test(nombre)) {
    return 'El nombre no debe contener nÃºmeros.';
  }

  if (nombre.length < 3 || nombre.split(/\s+/).join('').length < 3) {
    return 'Escribe un nombre mÃ¡s completo.';
  }

  if (!/^[A-Za-zÃÃ‰ÃÃ“ÃšÃœÃ‘Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±\s'.-]+$/.test(nombre)) {
    return 'Usa solo letras y espacios en el nombre.';
  }

  return null;
}

function getProductorDocumentError(
  value: string,
  tipoDocumento: ProductorForm['tipoDocumento'],
) {
  const documento = value.trim();

  if (!tipoDocumento) {
    return null;
  }

  if (!documento) {
    return tipoDocumento === 'NIT'
      ? 'Ingresa el nÃºmero de NIT.'
      : 'Ingresa el nÃºmero de cÃ©dula.';
  }

  if (/[A-Za-zÃÃ‰ÃÃ“ÃšÃœÃ‘Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±]/.test(documento)) {
    return tipoDocumento === 'NIT'
      ? 'El NIT solo puede contener nÃºmeros.'
      : 'La cÃ©dula solo puede contener nÃºmeros.';
  }

  if (/[\s.\-]/.test(documento) || /[^\d]/.test(documento)) {
    return 'No uses puntos, espacios ni guiones.';
  }

  if (tipoDocumento === 'CEDULA' && documento.length < 6) {
    return 'La cÃ©dula tiene muy pocos nÃºmeros.';
  }

  if (tipoDocumento === 'CEDULA' && documento.length > 10) {
    return 'Verifica el nÃºmero de cÃ©dula ingresado.';
  }

  if (tipoDocumento === 'NIT' && documento.length < 8) {
    return 'El NIT tiene muy pocos nÃºmeros.';
  }

  if (tipoDocumento === 'NIT' && documento.length > 10) {
    return 'Verifica el nÃºmero de NIT ingresado.';
  }

  if (/^(\d)\1+$/.test(documento)) {
    return tipoDocumento === 'NIT'
      ? 'Verifica el nÃºmero de NIT ingresado.'
      : 'Verifica el nÃºmero de cÃ©dula ingresado.';
  }

  return null;
}

function getProductorPhoneError(value: string) {
  const telefono = validatePhoneNumber(value, 'El telÃ©fono', {
    optional: true,
  });

  return telefono.isValid ? null : telefono.message ?? 'Revisa el nÃºmero celular.';
}

function validateProductorField(
  field: ProductorFormField,
  form: ProductorForm,
) {
  if (field === 'nombre') {
    return getProductorNameError(form.nombre);
  }

  if (field === 'tipoDocumento') {
    return form.tipoDocumento
      ? null
      : 'Debes seleccionar un tipo de documento.';
  }

  if (field === 'documento') {
    return getProductorDocumentError(form.documento, form.tipoDocumento);
  }

  return getProductorPhoneError(form.telefono);
}

function ProductorHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs font-medium leading-5 text-slate-500">{children}</p>;
}

function ProductorFieldError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mt-2 rounded-[10px] border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold leading-5 text-rose-700"
    >
      {message}
    </p>
  );
}

function ProductorGeneralError({ error }: { error: ProductorModalError }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-[14px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={18}
          className="mt-0.5 shrink-0 text-rose-600"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="font-bold leading-5">{error.title}</p>
          <p className="mt-1 text-[0.82rem] font-medium leading-5 text-rose-700">
            {error.description}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProductorStepAlert({
  message,
  exiting,
}: {
  message: string;
  exiting: boolean;
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-[0_12px_28px_rgba(190,18,60,0.10)] transition-all duration-300 ${
        exiting
          ? 'translate-y-1 opacity-0'
          : 'translate-y-0 opacity-100'
      }`}
    >
      <AlertTriangle
        size={18}
        className="mt-0.5 shrink-0 text-rose-600"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="font-black leading-5">Elige una opciÃ³n para continuar.</p>
        <p className="mt-0.5 font-medium leading-5 text-rose-800">
          {message}
        </p>
      </div>
    </div>
  );
}

function FieldLimitAlert({
  message,
  exiting = false,
}: {
  message: string;
  exiting?: boolean;
}) {
  return (
    <div
      className={`mt-2 flex items-start gap-2.5 rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold leading-5 text-rose-800 shadow-[0_10px_22px_rgba(190,18,60,0.08)] transition-all duration-300 ${
        exiting ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <AlertTriangle
        size={15}
        className="mt-0.5 shrink-0 text-rose-600"
        aria-hidden="true"
      />
      <span className="min-w-0">{message}</span>
    </div>
  );
}

function TransientFormAlert({
  message,
  exiting,
}: {
  message: GuidedErrorMessage;
  exiting: boolean;
}) {
  return (
    <div
      className={`transition-all duration-300 ${
        exiting ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <InlineGuidedError message={message} />
    </div>
  );
}

function getProductorSaveError(error: unknown): ProductorModalError {
  if (error instanceof ApiRequestError) {
    const message = error.message.toLowerCase();
    const code = error.code?.toLowerCase() ?? '';

    if (
      error.status === 0 ||
      code.includes('database_unavailable') ||
      message.includes('conex')
    ) {
      return {
        title: 'No pudimos conectarnos.',
        description: 'Revisa tu internet e intenta nuevamente.',
      };
    }

    if (code.includes('database_busy')) {
      return {
        title: 'No pudimos registrar el productor.',
        description:
          'Estamos procesando mucha informaciÃ³n. Intenta nuevamente en unos minutos.',
      };
    }

    if (
      error.status === 409 ||
      code.includes('duplicado') ||
      message.includes('ya hay un productor') ||
      message.includes('ya existe') ||
      message.includes('registrado con este documento')
    ) {
      return {
        title: 'Este productor ya existe.',
        description: 'Ya hay un productor registrado con este documento.',
      };
    }

    if (error.status === 400 || error.field || error.details) {
      return {
        title: 'Faltan datos por completar.',
        description: 'Verifica los campos marcados e intenta nuevamente.',
      };
    }

    if (error.status >= 500) {
      return {
        title: 'No pudimos registrar el productor.',
        description:
          'OcurriÃ³ un problema temporal. Intenta nuevamente en unos minutos.',
      };
    }
  }

  return {
    title: 'No pudimos registrar el productor.',
    description:
      'OcurriÃ³ un problema temporal. Intenta nuevamente en unos minutos.',
  };
}

function getProductorInitials(nombre: string) {
  const words = nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return words.map((word) => word[0]?.toUpperCase()).join('') || 'P';
}

function getProductorDocumentDigits(productor: ProductorOption) {
  return soloDigitos(productor.documento);
}

function getProductorDocumentTypeLabel(productor: ProductorOption) {
  if (productor.tipoDocumento === 'CEDULA') {
    return 'CC';
  }

  if (productor.tipoDocumento === 'NIT') {
    return 'NIT';
  }

  return 'CC';
}

function getProductorDocumentLabel(productor: ProductorOption) {
  if (productor.rapido) {
    return 'Compra rÃ¡pida';
  }

  return `${getProductorDocumentTypeLabel(productor)}: ${productor.documento}`;
}

function getProductorTime(productor: ProductorOption) {
  const time = productor.createdAt ? new Date(productor.createdAt).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function sortProductores(
  productores: ProductorOption[],
  sortMode: ProductorSortMode,
) {
  return [...productores].sort((a, b) => {
    if (sortMode === 'oldest') {
      return getProductorTime(a) - getProductorTime(b);
    }

    if (sortMode === 'az') {
      return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    }

    if (sortMode === 'za') {
      return b.nombre.localeCompare(a.nombre, 'es', { sensitivity: 'base' });
    }

    if (sortMode === 'doc-asc' || sortMode === 'doc-desc') {
      const aNumber = Number(getProductorDocumentDigits(a)) || 0;
      const bNumber = Number(getProductorDocumentDigits(b)) || 0;
      return sortMode === 'doc-asc' ? aNumber - bNumber : bNumber - aNumber;
    }

    return getProductorTime(b) - getProductorTime(a);
  });
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
      <Check size={14} strokeWidth={3} />
    </span>
  );
}

function getSelectableCardClass(active: boolean, compact = false) {
  return `w-full cursor-pointer rounded-[20px] border text-left transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/15 active:scale-[0.99] ${
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
        <SelectionCheck active={active} />
      </div>
    </button>
  );
}

function ProductorCard({
  productor,
  active,
  onSelect,
}: {
  productor: ProductorOption;
  active: boolean;
  onSelect: () => void;
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
              ? 'bg-[#1f3fa7] text-white'
              : 'bg-[#edf3ff] text-[#1f3fa7]'
          }`}
        >
          {getProductorInitials(productor.nombre)}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-[0.98rem] font-black leading-5 text-slate-900"
            title={productor.nombre}
          >
            {productor.nombre}
          </span>
          <span className="mt-1 block truncate text-xs font-medium leading-4 text-slate-500">
            {getProductorDocumentLabel(productor)}
          </span>
          {productor.telefono ? (
            <span className="mt-0.5 block truncate text-xs font-medium text-slate-400">
              {formatPhoneNumber(productor.telefono)}
            </span>
          ) : null}
        </span>
        <SelectionCheck active={active} />
      </span>
    </button>
  );
}

function CoffeeTypeDropdown({
  id,
  value,
  options,
  error,
  open,
  onToggle,
  onClose,
  onChange,
}: {
  id: string;
  value: string;
  options: CatalogoItem[];
  error?: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.id === value);
  const buttonId = `tipo-cafe-${id}`;
  const listboxId = `tipo-cafe-list-${id}`;

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <button
        id={buttonId}
        type="button"
        aria-haspopup="listbox"
        {...ariaExpanded(open)}
        aria-controls={listboxId}
        onClick={onToggle}
        className={`flex min-h-[58px] w-full items-center justify-between gap-3 rounded-[18px] border bg-white px-4 py-3.5 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/15 ${
          error
            ? 'border-rose-200 bg-rose-50/30'
            : open
              ? 'border-[#1f3fa7] bg-white'
              : 'border-[#dfe5f2] hover:border-[#cbd6ea] hover:bg-[#fbfdff]'
        }`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
              selected ? iconoTipoCafe(selected.nombre).fondo : 'bg-[#eef4ff] text-[#1f3fa7]'
            }`}
          >
            {selected ? iconoTipoCafe(selected.nombre).icono : <Coffee size={18} />}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={`block truncate text-[1rem] leading-5 ${
                selected
                  ? 'font-black text-slate-900'
                  : 'font-semibold text-slate-500'
              }`}
            >
              {selected?.nombre ?? 'Selecciona una opciÃ³n'}
            </span>
          </span>
        </span>
        <ChevronDown
          size={20}
          className={`shrink-0 text-slate-400 transition duration-200 ${
            open ? 'rotate-180 text-[#1f3fa7]' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={buttonId}
          className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-[20px] border border-[#d5deee] bg-white p-2 shadow-[0_22px_48px_rgba(15,23,42,0.16)]"
        >
          {options.map((option) => {
            const active = option.id === value;
            const visual = iconoTipoCafe(option.nombre);
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                {...ariaSelected(active)}
                onClick={() => {
                  onChange(option.id);
                  onClose();
                }}
                className={`flex min-h-[52px] w-full items-center gap-3 rounded-[15px] px-3 py-2.5 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/15 ${
                  active
                    ? 'bg-[#eef4ff] text-[#1f3fa7]'
                    : 'text-slate-800 hover:bg-[#f8faff]'
                }`}
              >
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    active ? 'bg-white text-[#1f3fa7]' : visual.fondo
                  }`}
                >
                  {visual.icono}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    active ? 'font-black' : 'font-bold'
                  }`}
                >
                  {option.nombre}
                </span>
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                    active
                      ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white'
                      : 'border-transparent text-transparent'
                  }`}
                  aria-hidden="true"
                >
                  <Check size={14} strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function PurchaseDatePicker({
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
  const [calendarView, setCalendarView] = useState<'days' | 'months' | 'years'>(
    'days',
  );
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(visibleDate.getFullYear(), visibleDate.getMonth(), 1),
  );

  useEffect(() => {
    if (open) {
      const nextDate = parseLocalDateValue(value) ?? maxDate;
      setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
      setCalendarView('days');
    }
  }, [max, open, value]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      1,
    );
    const daysInMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      0,
    ).getDate();
    const leadingDays = firstDay.getDay();

    return [
      ...Array.from({ length: leadingDays }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const date = new Date(
          visibleMonth.getFullYear(),
          visibleMonth.getMonth(),
          day,
        );
        return {
          day,
          value: formatLocalDateValue(date),
        };
      }),
    ];
  }, [visibleMonth]);

  const visibleYear = visibleMonth.getFullYear();
  const previousMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() - 1,
    1,
  );
  const nextMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    1,
  );
  const canGoPrevious =
    previousMonth >= new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const canGoNext =
    nextMonth <= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  const yearOptions = Array.from(
    { length: maxDate.getFullYear() - minDate.getFullYear() + 1 },
    (_, index) => minDate.getFullYear() + index,
  );

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onClose();
        }
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
        <CalendarDays
          size={20}
          className={`shrink-0 transition ${open ? 'text-[#102d92]' : 'text-slate-500'}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Calendario de fecha de compra"
          className="absolute left-0 right-0 z-30 mt-2 rounded-[22px] border border-[#d5deee] bg-white p-3 shadow-[0_22px_48px_rgba(15,23,42,0.18)]"
        >
          <div className="flex items-center justify-between gap-3 px-1 pb-3">
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => setVisibleMonth(previousMonth)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#102d92] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:text-slate-300"
              aria-label="Mes anterior"
            >
              <ArrowLeft size={17} />
            </button>
            <div className="flex min-w-0 items-center justify-center gap-1 rounded-full bg-[#f8faff] p-1">
              <button
                type="button"
                {...ariaPressed(calendarView === 'months')}
                onClick={() =>
                  setCalendarView((current) =>
                    current === 'months' ? 'days' : 'months',
                  )
                }
                className={`rounded-full px-3 py-1.5 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/15 ${
                  calendarView === 'months'
                    ? 'bg-[#102d92] text-white'
                    : 'text-slate-900 hover:bg-[#eef4ff]'
                }`}
              >
                {MONTHS_ES[visibleMonth.getMonth()]}
              </button>
              <button
                type="button"
                {...ariaPressed(calendarView === 'years')}
                onClick={() =>
                  setCalendarView((current) =>
                    current === 'years' ? 'days' : 'years',
                  )
                }
                className={`rounded-full px-3 py-1.5 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/15 ${
                  calendarView === 'years'
                    ? 'bg-[#102d92] text-white'
                    : 'text-slate-900 hover:bg-[#eef4ff]'
                }`}
              >
                {visibleYear}
              </button>
            </div>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setVisibleMonth(nextMonth)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#102d92] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:text-slate-300"
              aria-label="Mes siguiente"
            >
              <ArrowRight size={17} />
            </button>
          </div>

          {calendarView === 'months' ? (
            <div className="grid grid-cols-3 gap-2 px-1 py-1">
              {MONTHS_ES.map((month, monthIndex) => {
                const candidate = new Date(visibleYear, monthIndex, 1);
                const disabled =
                  candidate <
                    new Date(minDate.getFullYear(), minDate.getMonth(), 1) ||
                  candidate >
                    new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
                const active = monthIndex === visibleMonth.getMonth();
                return (
                  <button
                    key={month}
                    type="button"
                    disabled={disabled}
                    {...ariaPressed(active)}
                    onClick={() => {
                      setVisibleMonth(new Date(visibleYear, monthIndex, 1));
                      setCalendarView('days');
                    }}
                    className={`min-h-[44px] rounded-[14px] px-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/15 disabled:cursor-not-allowed disabled:text-slate-300 ${
                      active
                        ? 'bg-[#102d92] text-white shadow-[0_8px_18px_rgba(16,45,146,0.18)]'
                        : 'text-slate-800 hover:bg-[#f4f7ff]'
                    }`}
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
                      const nextVisibleMonth = Math.min(
                        visibleMonth.getMonth(),
                        year === maxDate.getFullYear()
                          ? maxDate.getMonth()
                          : 11,
                      );
                      setVisibleMonth(new Date(year, nextVisibleMonth, 1));
                      setCalendarView('months');
                    }}
                    className={`min-h-[44px] rounded-[14px] px-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/15 ${
                      active
                        ? 'bg-[#102d92] text-white shadow-[0_8px_18px_rgba(16,45,146,0.18)]'
                        : 'text-slate-800 hover:bg-[#f4f7ff]'
                    }`}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 px-1">
              {WEEKDAYS_ES.map((day) => (
                <span
                  key={day}
                  className="py-1 text-center text-[0.72rem] font-black text-slate-500"
                >
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
                  className={`h-10 rounded-full text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/15 disabled:cursor-not-allowed disabled:text-slate-300 ${
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

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function soloDigitos(value: string) {
  return value.replace(/\D/g, '');
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
const WEEKDAYS_ES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'SÃ¡'];
const PESO_MAXIMO_COMPRA_KG = 99999;
const PRECIO_MAXIMO_KG = 100000;

function parseLocalDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
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

function crearSubloteVacio(): SubloteForm {
  return {
    id: generarId(),
    tipoCafeId: '',
    calidadId: '',
    pesoInicial: '',
    precioKg: '',
  };
}

function isCompraDraftStep(value: unknown): value is Step {
  return value === 1 || value === 2 || value === 3;
}

function normalizeCompraDraft(value: unknown): CompraDraft | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const draft = value as Partial<CompraDraft>;
  const sublotesValidos = Array.isArray(draft.sublotes)
    ? draft.sublotes
        .filter((sublote): sublote is SubloteForm => {
          if (!sublote || typeof sublote !== 'object') return false;
          const item = sublote as Partial<SubloteForm>;
          return (
            typeof item.id === 'string' &&
            typeof item.tipoCafeId === 'string' &&
            typeof item.calidadId === 'string' &&
            typeof item.pesoInicial === 'string' &&
            typeof item.precioKg === 'string'
          );
        })
        .map((sublote) => ({ ...sublote }))
    : [];

  if (!isCompraDraftStep(draft.step) || sublotesValidos.length === 0) {
    return null;
  }

  return {
    version: 1,
    savedAt:
      typeof draft.savedAt === 'number' && Number.isFinite(draft.savedAt)
        ? draft.savedAt
        : Date.now(),
    step: draft.step,
    fecha: typeof draft.fecha === 'string' ? draft.fecha : hoyLocal(),
    sublotes: sublotesValidos,
    subloteActivoId:
      typeof draft.subloteActivoId === 'string' ? draft.subloteActivoId : null,
    productorSeleccionado:
      draft.productorSeleccionado &&
      typeof draft.productorSeleccionado === 'object'
        ? (draft.productorSeleccionado as ProductorOption)
        : null,
    productorSelectionMode:
      draft.productorSelectionMode === 'buscar' ||
      draft.productorSelectionMode === 'generico' ||
      draft.productorSelectionMode === 'registrar'
        ? draft.productorSelectionMode
        : null,
    compraLocalId:
      typeof draft.compraLocalId === 'string' ? draft.compraLocalId : null,
  };
}

function readCompraDraft() {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(COMPRA_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return normalizeCompraDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeCompraDraft(draft: CompraDraft) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(COMPRA_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // El borrador es una mejora de experiencia; si el navegador lo bloquea,
    // el formulario sigue funcionando normalmente.
  }
}

function clearCompraDraft() {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(COMPRA_DRAFT_STORAGE_KEY);
  } catch {
    // Mantener el flujo principal disponible aunque el almacenamiento falle.
  }
}

function hasCompraDraftProgress(draft: Omit<CompraDraft, 'version' | 'savedAt'>) {
  const hasSubloteProgress =
    draft.sublotes.length > 1 ||
    draft.sublotes.some((sublote) =>
      Boolean(
        sublote.tipoCafeId ||
          sublote.calidadId ||
          sublote.pesoInicial ||
          sublote.precioKg,
      ),
    );

  return (
    draft.step !== 1 ||
    draft.fecha !== hoyLocal() ||
    hasSubloteProgress ||
    Boolean(draft.productorSeleccionado) ||
    Boolean(draft.productorSelectionMode)
  );
}

function countDraftSublotesConProgreso(draft: CompraDraft) {
  return draft.sublotes.filter((sublote) =>
    Boolean(
      sublote.tipoCafeId ||
        sublote.calidadId ||
        sublote.pesoInicial ||
        sublote.precioKg,
    ),
  ).length;
}

function hoyLocal() {
  return getTodayLocalDateValue();
}

function formatoFecha(fechaIso: string) {
  return formatDateLabel(fechaIso);
}

function formatoMoneda(valor: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatoKg(valor: number) {
  return valor.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function parseNumeroCompra(
  valor: string,
  options: { decimal?: boolean } = {},
) {
  const texto = valor.trim();
  if (!texto) return NaN;

  if (options.decimal && texto.includes(',')) {
    const [enteroRaw = '', decimalRaw = ''] = texto.split(',');
    const entero = enteroRaw.replace(/\D/g, '') || '0';
    const decimal = decimalRaw.replace(/\D/g, '');
    return Number(`${entero}.${decimal}`);
  }

  const digitos = texto.replace(/\D/g, '');
  return digitos ? Number(digitos) : NaN;
}

function formatNumeroCompraInput(
  valor: string,
  options: { decimal?: boolean; max?: number } = {},
) {
  const texto = valor.replace(/[^\d,.]/g, '');
  if (!texto) return '';

  if (options.decimal && texto.includes(',')) {
    const [enteroRaw = '', decimalRaw = ''] = texto.split(',');
    const entero = enteroRaw.replace(/\D/g, '').slice(0, 6);
    const decimal = decimalRaw.replace(/\D/g, '').slice(0, 2);
    const enteroFormateado = entero
      ? Number(entero).toLocaleString('es-CO')
      : '';
    return `${enteroFormateado},${decimal}`;
  }

  const digitos = texto.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 6);
  if (!digitos) return '';
  const numero = Number(digitos);
  return numero.toLocaleString('es-CO');
}

function buildLimitedNumberInput(
  rawValue: string,
  currentValue: string,
  options: { decimal?: boolean; max: number },
) {
  const attempted = parseNumeroCompra(rawValue.replace(/[^\d,.]/g, ''), {
    decimal: options.decimal,
  });
  const formatted = formatNumeroCompraInput(rawValue, options);
  const limited = Number.isFinite(attempted) && attempted > options.max;

  return {
    value: limited ? currentValue : formatted,
    limited,
  };
}

function leerCantidadCompra(valor: string) {
  const texto = valor.trim();
  if (!texto) {
    return { valor: 0, error: 'Ingresa la cantidad en kilogramos.' };
  }

  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(texto)) {
    return { valor: 0, error: 'Ingresa solo nÃºmeros.' };
  }

  const numero = parseNumeroCompra(texto, { decimal: true });
  if (!Number.isFinite(numero)) {
    return { valor: 0, error: 'Ingresa solo nÃºmeros.' };
  }

  if (numero <= 0) {
    return { valor: numero, error: 'La cantidad debe ser mayor a cero.' };
  }

  if (numero > PESO_MAXIMO_COMPRA_KG) {
    return {
      valor: numero,
      error: `Solo puedes registrar hasta ${formatoKg(
        PESO_MAXIMO_COMPRA_KG,
      )} kg.`,
    };
  }

  return { valor: numero, error: null };
}

function leerPrecioCompra(valor: string) {
  const texto = valor.trim();
  if (!texto) {
    return { valor: 0, error: 'Ingresa el precio por kilo.' };
  }

  if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(texto)) {
    return { valor: 0, error: 'Ingresa solo nÃºmeros.' };
  }

  const numero = parseNumeroCompra(texto);
  if (!Number.isFinite(numero)) {
    return { valor: 0, error: 'Ingresa solo nÃºmeros.' };
  }

  if (numero < PRECIO_MINIMO_KG) {
    return { valor: numero, error: 'El precio por kilo es demasiado bajo.' };
  }

  if (numero > PRECIO_MAXIMO_KG) {
    return {
      valor: numero,
      error: `El precio mÃ¡ximo permitido es ${formatoMoneda(
        PRECIO_MAXIMO_KG,
      )} por kilogramo.`,
    };
  }

  return { valor: numero, error: null };
}

function calcularResumenSublotes(sublotes: SubloteForm[]) {
  const totalKg = sublotes.reduce((acc, sublote) => {
    const peso = leerCantidadCompra(sublote.pesoInicial);
    return acc + (peso.error ? 0 : peso.valor);
  }, 0);
  const totalCompra = sublotes.reduce((acc, sublote) => {
    const peso = leerCantidadCompra(sublote.pesoInicial);
    const precio = leerPrecioCompra(sublote.precioKg);

    if (peso.error || precio.error) {
      return acc;
    }

    return acc + peso.valor * precio.valor;
  }, 0);

  return {
    totalKg,
    totalCompra,
  };
}

function formatTotalKg(valor: number) {
  return `${formatoKg(valor)} kg`;
}

function getCapacidadDisponibleAntes(capacidad: EstadoCapacidadCompra | null) {
  if (!capacidad?.validada) {
    return null;
  }

  if (
    typeof capacidad.disponibleKg === 'number' &&
    Number.isFinite(capacidad.disponibleKg)
  ) {
    return Math.max(0, capacidad.disponibleKg);
  }

  if (
    typeof capacidad.capacidadBodegaKg === 'number' &&
    typeof capacidad.inventarioActualKg === 'number' &&
    Number.isFinite(capacidad.capacidadBodegaKg) &&
    Number.isFinite(capacidad.inventarioActualKg)
  ) {
    return Math.max(0, capacidad.capacidadBodegaKg - capacidad.inventarioActualKg);
  }

  return null;
}

function getCapacidadRestanteDespues(capacidad: EstadoCapacidadCompra | null) {
  if (
    !capacidad?.validada ||
    typeof capacidad.capacidadRestanteKg !== 'number' ||
    !Number.isFinite(capacidad.capacidadRestanteKg)
  ) {
    return null;
  }

  return Math.max(0, capacidad.capacidadRestanteKg);
}

function getPorcentajeDisponible(capacidad: EstadoCapacidadCompra | null) {
  if (
    !capacidad?.validada ||
    typeof capacidad.capacidadBodegaKg !== 'number' ||
    capacidad.capacidadBodegaKg <= 0
  ) {
    return null;
  }

  const restante = getCapacidadRestanteDespues(capacidad);
  if (restante === null) {
    return null;
  }

  return (restante / capacidad.capacidadBodegaKg) * 100;
}

function estiloCapacidad(capacidad?: EstadoCapacidadCompra) {
  if (!capacidad || capacidad.nivel === 'normal') {
    return {
      contenedor: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]',
      icono: 'bg-[#dbeafe] text-[#1d4ed8]',
    };
  }

  if (capacidad.nivel === 'exceso') {
    return {
      contenedor: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]',
      icono: 'bg-[#ffedd5] text-[#ea580c]',
    };
  }

  if (capacidad.nivel === 'alerta') {
    return {
      contenedor: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
      icono: 'bg-[#fef3c7] text-[#d97706]',
    };
  }

  return {
    contenedor: 'border-[#e5e7eb] bg-[#f8fafc] text-slate-700',
    icono: 'bg-[#e2e8f0] text-slate-600',
  };
}

function getCompraErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return 'Revisa la conexiÃ³n a internet y vuelve a intentarlo.';
    }

    if (error.status >= 500) {
      return 'Puede ser una falla temporal. Revisa tu conexiÃ³n e intenta de nuevo.';
    }

    if (error.code === 'COMPRA_CANTIDAD_INVALIDA') {
      return 'La cantidad debe ser mayor a cero.';
    }

    if (error.code === 'COMPRA_CANTIDAD_NO_NUMERICA') {
      return 'Ingresa solo nÃºmeros.';
    }

    if (error.code === 'COMPRA_CANTIDAD_DEMASIADO_ALTA') {
      return 'Revisa la cantidad ingresada. Parece demasiado alta.';
    }

    if (error.code === 'COMPRA_CAPACIDAD_INSUFICIENTE') {
      return 'No hay espacio suficiente en la bodega.';
    }

    if (error.code === 'COMPRA_PRECIO_INVALIDO') {
      return 'El precio por kilo es demasiado bajo.';
    }

    if (error.code === 'COMPRA_TIPO_CAFE_INVALIDO') {
      return 'Selecciona un tipo de cafÃ© para continuar.';
    }

    if (error.code === 'COMPRA_CALIDAD_INVALIDA') {
      return 'La calidad seleccionada no es valida.';
    }
  }

  return 'No pudimos guardar la compra. Revisa los datos e intenta nuevamente.';
}

function esperarPintadoInterfaz() {
  return new Promise<void>((resolve) => {
    if (
      typeof window === 'undefined' ||
      typeof window.requestAnimationFrame !== 'function'
    ) {
      resolve();
      return;
    }

    window.requestAnimationFrame(() => resolve());
  });
}

function mapProductorToOption(productor: ProductorItem): ProductorOption {
  return {
    id: productor.id,
    nombre: productor.nombre,
    documento: productor.documento?.trim() || 'Documento pendiente',
    detalle: productor.telefono?.trim() || 'Productor registrado en sistema',
    telefono: productor.telefono ?? undefined,
    tipoDocumento: productor.tipoDocumento ?? 'CEDULA',
    createdAt: productor.createdAt,
  };
}

function clavePersona(nombre: string, documento: string) {
  const documentoNormalizado = soloDigitos(documento);
  return documentoNormalizado
    ? `documento:${documentoNormalizado}`
    : `nombre:${normalizeSearchText(nombre.trim())}`;
}

function dedupeProductorOptions(productores: ProductorOption[]) {
  const vistos = new Set<string>();

  return productores.filter((productor) => {
    const key = clavePersona(productor.nombre, productor.documento);

    if (vistos.has(key)) {
      return false;
    }

    vistos.add(key);
    return true;
  });
}

function findProductorExistente(
  productores: ProductorOption[],
  nombre: string,
  documento: string,
) {
  const key = clavePersona(nombre, documento);
  return productores.find(
    (productor) => clavePersona(productor.nombre, productor.documento) === key,
  );
}

function clave(nombre: string) {
  return nombre.trim().toUpperCase();
}

function ordenarCatalogos(items: CatalogoItem[], ordenBase: string[]) {
  return [...items].sort((a, b) => {
    const indexA = ordenBase.indexOf(clave(a.nombre));
    const indexB = ordenBase.indexOf(clave(b.nombre));
    if (indexA !== -1 || indexB !== -1) {
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    }
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

function iconoTipoCafe(nombre: string) {
  const tipo = clave(nombre);
  if (tipo === 'VERDE') {
    return {
      icono: <Leaf size={18} />,
      fondo: 'bg-[#eff9f1] text-[#185d31]',
      borde: 'border-[#d4efde]',
      texto: 'text-[#1f7f46]',
    };
  }
  if (tipo === 'SECO') {
    return {
      icono: <SunMedium size={18} />,
      fondo: 'bg-[#fff4e9] text-[#9d4a12]',
      borde: 'border-[#f8dfc7]',
      texto: 'text-[#9d4a12]',
    };
  }
  if (tipo === 'PASILLA') {
    return {
      icono: <BadgeAlert size={18} />,
      fondo: 'bg-[#fff0f4] text-[#a31d3e]',
      borde: 'border-[#ffd4e1]',
      texto: 'text-[#a31d3e]',
    };
  }
  return {
    icono: <Coffee size={18} />,
    fondo: 'bg-[#eef2ff] text-[#102d92]',
    borde: 'border-[#d9e4ff]',
    texto: 'text-[#102d92]',
  };
}

function visualCalidad(nombre: string) {
  const calidad = clave(nombre);
  if (calidad === 'BUENO') {
    return {
      icono: <Smile size={16} />,
      fondo: 'bg-[#ecf4ff] text-[#173ea6]',
      borde: 'border-[#d5e1ff]',
      texto: 'text-[#173ea6]',
    };
  }
  if (calidad === 'REGULAR') {
    return {
      icono: <Meh size={16} />,
      fondo: 'bg-[#fff6e7] text-[#8f5f08]',
      borde: 'border-[#f3ddb3]',
      texto: 'text-[#8f5f08]',
    };
  }
  return {
    icono: <Frown size={16} />,
    fondo: 'bg-[#fff0f4] text-[#a31d3e]',
    borde: 'border-[#ffd5e1]',
    texto: 'text-[#a31d3e]',
  };
}

function datosPaso(step: Step) {
  if (step === 1) {
    return {
      chip: 'Paso 1 de 3',
      titulo: 'Productor',
      descripcion: 'Seleccione el productor para iniciar el pesaje del cafÃ©.',
      progreso: 33,
    };
  }
  if (step === 2) {
    return {
      chip: 'Paso 2 de 3',
      titulo: 'Seleccionar cafÃ©',
      descripcion: 'Completa tipo de cafÃ©, calidad, peso y precio por kilo.',
      progreso: 66,
    };
  }
  return {
    chip: 'Paso 3 de 3',
    titulo: 'Finalizar Registro',
    descripcion: 'Confirma el resumen antes de registrar la compra.',
    progreso: 100,
  };
}

function getComprasGuidance(message: string): GuidedErrorMessage {
  const normalizedMessage = normalizeSearchText(message);

  if (normalizedMessage.includes('nombre')) {
    return createGuidedError(
      message,
      'Nombre incompleto.',
      'El nombre debe escribirse con letras y sin nÃºmeros.',
      'Completa el nombre para continuar.',
    );
  }

  if (normalizedMessage.includes('telefono')) {
    return createGuidedError(
      message,
      'Revisa el telÃ©fono.',
      'Debe ser un celular colombiano de 10 dÃ­gitos que empieza por 3.',
      'Corrige el nÃºmero o deja el campo vacÃ­o.',
    );
  }

  if (
    normalizedMessage.includes('cedula') ||
    normalizedMessage.includes('identificacion') ||
    normalizedMessage.includes('documento') ||
    normalizedMessage.includes('nit')
  ) {
    return createGuidedError(
      message,
      'Documento incompleto.',
      'Selecciona cÃ©dula o NIT y escribe solo nÃºmeros, sin puntos ni guiones.',
      'Ajusta el documento para continuar.',
    );
  }

  if (normalizedMessage.includes('fecha')) {
    return createGuidedError(
      message,
      'Revisa la fecha.',
      'Solo puedes registrar compras desde 2026 hasta hoy.',
      'Elige una fecha valida para continuar.',
    );
  }

  if (normalizedMessage.includes('nombre del productor')) {
    return createGuidedError(
      message,
      'Falta identificar al productor.',
      'Necesitamos el nombre para registrar la compra.',
      'Toca la casilla y escribe al menos su nombre.',
    );
  }

  if (normalizedMessage.includes('al menos un producto')) {
    return createGuidedError(
      message,
      'No hay productos.',
      'La compra debe tener cafÃ©.',
      'Agrega un producto para continuar.',
    );
  }

  if (normalizedMessage.includes('completa este cafe')) {
    return createGuidedError(
      message,
      'Producto incompleto.',
      'Antes de agregar otro cafe, termina los datos actuales.',
      'Completa tipo, calidad, peso y precio.',
    );
  }

  if (normalizedMessage.includes('catalogos disponibles')) {
    return createGuidedError(
      message,
      'Faltan datos base en tu celular.',
      'No logramos cargar los tipos de cafÃ©.',
      'Recarga la aplicaciÃ³n e intenta de nuevo.',
    );
  }

  if (normalizedMessage.includes('tipo de cafe')) {
    return createGuidedError(
      message,
      'Falta el tipo de cafÃ©.',
      'Selecciona un tipo de cafÃ© para continuar.',
      'Toca el campo "Tipo de cafÃ©" y elige una opciÃ³n.',
    );
  }

  if (normalizedMessage.includes('calidad')) {
    return createGuidedError(
      message,
      'Falta la calidad.',
      'Saber la calidad ayuda a validar el precio.',
      'Toca las caritas para seleccionar la calidad.',
    );
  }

  if (
    normalizedMessage.includes('cantidad en kilogramos') ||
    normalizedMessage.includes('peso del cafe') ||
    normalizedMessage.includes('peso exacto')
  ) {
    return createGuidedError(
      message,
      'Falta el peso del cafÃ©.',
      'Escribe la cantidad de cafÃ© en kilogramos.',
      'Toca "Peso (kg)" e ingresa el peso.',
    );
  }

  if (
    normalizedMessage.includes('cantidad debe ser mayor') ||
    normalizedMessage.includes('peso valido')
  ) {
    return createGuidedError(
      message,
      'Revisa el peso.',
      'El peso debe ser mayor a cero.',
      'Ingresa una cantidad realista en kilogramos.',
    );
  }

  if (
    normalizedMessage.includes('peso es demasiado alto') ||
    normalizedMessage.includes('peso ingresado es demasiado alto') ||
    normalizedMessage.includes('cantidad supera') ||
    normalizedMessage.includes('solo puedes registrar hasta') ||
    normalizedMessage.includes('espacio disponible') ||
    normalizedMessage.includes('capacidad disponible')
  ) {
    return createGuidedError(
      message,
      'El peso supera el lÃ­mite.',
      'La cantidad supera el espacio disponible en bodega.',
      'Ingresa una cantidad menor para continuar.',
    );
  }

  if (normalizedMessage.includes('ingresa solo numeros')) {
    return createGuidedError(
      message,
      'Usa solo nÃºmeros.',
      'El campo no acepta letras ni sÃ­mbolos.',
      'Borra el carÃ¡cter incorrecto e intenta nuevamente.',
    );
  }

  if (normalizedMessage.includes('ingresa el precio por kilo')) {
    return createGuidedError(
      message,
      'Falta el precio por kilo.',
      'Ingresa el precio por kilogramo.',
      'Toca "Precio x kg" y escribe el valor.',
    );
  }

  if (
    normalizedMessage.includes('precio por kilo es demasiado bajo') ||
    normalizedMessage.includes('minimo')
  ) {
    return createGuidedError(
      message,
      'Precio demasiado bajo.',
      'El precio por kilo es demasiado bajo.',
      'Ingresa un valor desde $1.000 por kg.',
    );
  }

  if (
    normalizedMessage.includes('precio por kilo es demasiado alto') ||
    normalizedMessage.includes('valor ingresado supera') ||
    normalizedMessage.includes('precio maximo permitido') ||
    normalizedMessage.includes('precio por kilogramo ingresado') ||
    normalizedMessage.includes('precio mas realista')
  ) {
    return createGuidedError(
      message,
      'Precio demasiado alto.',
      'Verifica el precio por kilogramo ingresado.',
      'Ingresa un precio mÃ¡s realista para el cafÃ©.',
    );
  }

  if (normalizedMessage.includes('selecciona un productor')) {
    return createGuidedError(
      message,
      'Falta seleccionar el productor.',
      'Debemos saber a quiÃ©n corresponde la compra.',
      'Selecciona Productor Generico o uno de la lista.',
    );
  }

  return createGuidedError(
    message,
    'Revisa este dato.',
    'Hay informaciÃ³n pendiente por completar.',
    'Corrige el campo seÃ±alado para continuar.',
  );
}

export default function Compras() {
 // Gestion de Credito
 const [creditoInfo, setCreditoInfo] = useState<{disponible: number, usado: number}|null>(null)
 useEffect(()=>{
 const orgId = localStorage.getItem("orgId")
 if(orgId) fetch(`/api/organizations/${orgId}/credito`).then(r=>r.json()).then(d=>setCreditoInfo(d)).catch(()=>{})
 },[])

  const navigate = useNavigate();
  const savingRef = useRef(false);
  const compraLocalIdRef = useRef<string | null>(null);
  const latestCompraDraftRef = useRef<
    Omit<CompraDraft, 'version' | 'savedAt'> | null
  >(null);
  const productoresSearchRef = useRef<HTMLInputElement | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosCompra>({
    tiposCafe: [],
    calidades: [],
  });
  const [fecha, setFecha] = useState(hoyLocal());
  const [sublotes, setSublotes] = useState<SubloteForm[]>([
    crearSubloteVacio(),
  ]);
  const [subloteInputWarnings, setSubloteInputWarnings] = useState<
    Record<string, Partial<Record<'pesoInicial' | 'precioKg', string>>>
  >({});
  const [subloteInputWarningsExiting, setSubloteInputWarningsExiting] =
    useState(false);
  const [subloteActivoId, setSubloteActivoId] = useState<string | null>(null);
  const [pesoFocusedSubloteId, setPesoFocusedSubloteId] = useState<string | null>(
    null,
  );
  const [productorSeleccionado, setProductorSeleccionado] =
    useState<ProductorOption | null>(null);
  const [productorSelectionMode, setProductorSelectionMode] =
    useState<ProductorSelectionMode>(null);
  const [productorStepAlert, setProductorStepAlert] = useState<string | null>(
    null,
  );
  const [productorStepAlertExiting, setProductorStepAlertExiting] =
    useState(false);
  const [productores, setProductores] = useState<ProductorOption[]>([]);
  const [mostrarModalProductores, setMostrarModalProductores] = useState(false);
  const [busquedaProductorModal, setBusquedaProductorModal] = useState('');
  const [productorSortMode, setProductorSortMode] =
    useState<ProductorSortMode>('recent');
  const [mostrarModalProductor, setMostrarModalProductor] = useState(false);
  const [productorForm, setProductorForm] = useState<ProductorForm>({
    nombre: '',
    telefono: '',
    documento: '',
    tipoDocumento: '',
  });
  const [productorFormErrors, setProductorFormErrors] =
    useState<ProductorFormErrors>({});
  const [productorFormTouched, setProductorFormTouched] =
    useState<Partial<Record<ProductorFormField, boolean>>>({});
  const [productorFormError, setProductorFormError] = useState<ProductorModalError | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingConfirmacion, setCheckingConfirmacion] = useState(false);
  const [checkingCapacidadPreview, setCheckingCapacidadPreview] =
    useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarErrorFormulario, setMostrarErrorFormulario] = useState(false);
  const [formAlertExiting, setFormAlertExiting] = useState(false);
  const [capacidadPrevia, setCapacidadPrevia] =
    useState<EstadoCapacidadCompra | null>(null);
  const [mostrarModalCancelar, setMostrarModalCancelar] = useState(false);
  const [mostrarModalConfirmar, setMostrarModalConfirmar] = useState(false);
  const [mostrarModalCapacidad, setMostrarModalCapacidad] = useState(false);
  const [mostrarModalAlerta80, setMostrarModalAlerta80] = useState(false);
  const [mostrarModalConfigurarCapacidad, setMostrarModalConfigurarCapacidad] =
    useState(false);
  const [nombreBodegaNueva, setNombreBodegaNueva] =
    useState('Bodega principal');
  const [capacidadNuevaKg, setCapacidadNuevaKg] = useState('');
  const [capacidadNuevaError, setCapacidadNuevaError] = useState<string | null>(
    null,
  );
  const [guardandoCapacidad, setGuardandoCapacidad] = useState(false);
  const [alerta80Mostrada, setAlerta80Mostrada] = useState(false);
  const [registroErrorMensaje, setRegistroErrorMensaje] = useState<
    string | null
  >(null);
  const [datosCapacidad, setDatosCapacidad] = useState<{
    capacidadKg: number;
    inventarioActual: number;
    nuevoTotal: number;
  } | null>(null);
  const [errorCapacidadCantidad, setErrorCapacidadCantidad] =
    useState<GuidedErrorMessage | null>(null);
  const [datosAlerta80, setDatosAlerta80] = useState<{
    capacidadKg: number;
    inventarioActual: number;
    nuevoTotal: number;
    porcentaje: number;
  } | null>(null);

  const [step, setStep] = useState<Step>(1);
  const [tipoCafeDropdownOpenId, setTipoCafeDropdownOpenId] = useState<
    string | null
  >(null);
  const [compraGuardada, setCompraGuardada] =
    useState<CompraGuardadaResumen | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [borradorPendiente, setBorradorPendiente] =
    useState<CompraDraft | null>(null);
  const [mostrarModalBorrador, setMostrarModalBorrador] = useState(false);
  const [botonGuardarProductorPresionado, setBotonGuardarProductorPresionado] =
    useState(false);
  const [productorCreadoToast, setProductorCreadoToast] =
    useState<ProductorOption | null>(null);
  const [productorCreadoToastExiting, setProductorCreadoToastExiting] =
    useState(false);

  const cargarTodo = async () => {
    setLoading(true);
    setError(null);
    setMostrarErrorFormulario(false);
    try {
      const [catalogosData, productoresData] = await Promise.all([
        obtenerCatalogosCompra(),
        listarProductores(),
      ]);
      setCatalogos(catalogosData);
      setProductores(
        dedupeProductorOptions(productoresData.map(mapProductorToOption)),
      );
    } catch (err) {
      console.warn('No se pudo cargar toda la informacion de compras:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarTodo();
  }, []);

  useEffect(() => {
    const draft = readCompraDraft();
    if (draft && hasCompraDraftProgress(draft)) {
      setBorradorPendiente(draft);
      setMostrarModalBorrador(true);
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!productorCreadoToast) {
      return;
    }

    setProductorCreadoToastExiting(false);

    const fadeTimer = window.setTimeout(() => {
      setProductorCreadoToastExiting(true);
    }, 3000);
    const clearTimer = window.setTimeout(() => {
      setProductorCreadoToast(null);
      setProductorCreadoToastExiting(false);
    }, 3400);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [productorCreadoToast]);

  useEffect(() => {
    if (!mostrarModalProductores) {
      return;
    }

    const timer = window.setTimeout(() => {
      productoresSearchRef.current?.focus();
    }, 80);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMostrarModalProductores(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mostrarModalProductores]);

  useEffect(() => {
    if (!productorStepAlert) {
      return;
    }

    setProductorStepAlertExiting(false);

    const fadeTimer = window.setTimeout(() => {
      setProductorStepAlertExiting(true);
    }, 3600);
    const clearTimer = window.setTimeout(() => {
      setProductorStepAlert(null);
      setProductorStepAlertExiting(false);
    }, 4000);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [productorStepAlert]);

  useEffect(() => {
    if (Object.keys(subloteInputWarnings).length === 0) {
      return;
    }

    setSubloteInputWarningsExiting(false);

    const fadeTimer = window.setTimeout(() => {
      setSubloteInputWarningsExiting(true);
    }, 3800);
    const clearTimer = window.setTimeout(() => {
      setSubloteInputWarnings({});
      setSubloteInputWarningsExiting(false);
    }, 4200);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [subloteInputWarnings]);

  useEffect(() => {
    if (!mostrarErrorFormulario || !error) {
      return;
    }

    setFormAlertExiting(false);

    const fadeTimer = window.setTimeout(() => {
      setFormAlertExiting(true);
    }, 4800);
    const clearTimer = window.setTimeout(() => {
      setMostrarErrorFormulario(false);
      setFormAlertExiting(false);
    }, 5200);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [error, mostrarErrorFormulario]);

  useEffect(() => {
    if (
      !draftReady ||
      mostrarModalBorrador ||
      compraGuardada ||
      saving ||
      checkingConfirmacion
    ) {
      return;
    }

    const baseDraft: Omit<CompraDraft, 'version' | 'savedAt'> = {
      step,
      fecha,
      sublotes,
      subloteActivoId,
      productorSeleccionado,
      productorSelectionMode,
      compraLocalId: compraLocalIdRef.current,
    };
    latestCompraDraftRef.current = baseDraft;

    if (!hasCompraDraftProgress(baseDraft)) {
      latestCompraDraftRef.current = null;
      clearCompraDraft();
      return;
    }

    const timer = window.setTimeout(() => {
      writeCompraDraft({
        version: 1,
        savedAt: Date.now(),
        ...baseDraft,
      });
    }, 550);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    checkingConfirmacion,
    compraGuardada,
    draftReady,
    fecha,
    mostrarModalBorrador,
    productorSeleccionado,
    productorSelectionMode,
    saving,
    step,
    subloteActivoId,
    sublotes,
  ]);

  useEffect(() => {
    const guardarUltimoBorrador = () => {
      const draft = latestCompraDraftRef.current;
      if (!draft || !hasCompraDraftProgress(draft)) {
        return;
      }

      writeCompraDraft({
        version: 1,
        savedAt: Date.now(),
        ...draft,
      });
    };

    window.addEventListener('beforeunload', guardarUltimoBorrador);

    return () => {
      guardarUltimoBorrador();
      window.removeEventListener('beforeunload', guardarUltimoBorrador);
    };
  }, []);

  const tiposCafe = useMemo(
    () => ordenarCatalogos(catalogos.tiposCafe, ORDEN_TIPOS),
    [catalogos.tiposCafe],
  );
  const calidades = useMemo(
    () => ordenarCatalogos(catalogos.calidades, ORDEN_CALIDADES),
    [catalogos.calidades],
  );
  const nombreTipoCafePorId = useMemo(
    () => new Map(catalogos.tiposCafe.map((item) => [item.id, item.nombre])),
    [catalogos.tiposCafe],
  );
  const nombreCalidadPorId = useMemo(
    () => new Map(catalogos.calidades.map((item) => [item.id, item.nombre])),
    [catalogos.calidades],
  );
  const resumen = useMemo(() => calcularResumenSublotes(sublotes), [sublotes]);
  const fechaCompraValidacion = useMemo(
    () => validateBusinessDateRange(fecha),
    [fecha],
  );
  const paso2Completo = useMemo(() => {
    if (!fechaCompraValidacion.isValid) {
      return false;
    }

    return sublotes.every((sublote) => {
      const peso = leerCantidadCompra(sublote.pesoInicial);
      const precio = leerPrecioCompra(sublote.precioKg);
      return (
        Boolean(sublote.tipoCafeId) &&
        Boolean(sublote.calidadId) &&
        !peso.error &&
        !precio.error
      );
    });
  }, [fechaCompraValidacion.isValid, sublotes]);
  const puedeRegistrarCompra =
    Boolean(productorSeleccionado) &&
    paso2Completo &&
    sublotes.length > 0 &&
    catalogos.tiposCafe.length > 0 &&
    catalogos.calidades.length > 0 &&
    !errorCapacidadCantidad &&
    !saving &&
    !checkingConfirmacion &&
    !loading;
  const productoresOrdenadosRecientes = useMemo(
    () => sortProductores(dedupeProductorOptions([...productores]), 'recent'),
    [productores],
  );
  const productoresRecientes = useMemo(
    () => productoresOrdenadosRecientes.slice(0, LIMITE_PRODUCTORES_RECIENTES),
    [productoresOrdenadosRecientes],
  );
  const productoresModalFiltrados = useMemo(() => {
    const termino = normalizeSearchText(busquedaProductorModal.trim());
    const base = termino
      ? productores.filter((productor) =>
          [
            productor.nombre,
            productor.documento,
            productor.detalle,
            productor.telefono ?? '',
          ].some((valor) => normalizeSearchText(valor).includes(termino)),
        )
      : productores;

    return sortProductores(dedupeProductorOptions([...base]), productorSortMode);
  }, [busquedaProductorModal, productorSortMode, productores]);
  const sinProductoresRegistrados = productores.length === 0;
  const subloteActual =
    sublotes.find((sublote) => sublote.id === subloteActivoId) ??
    sublotes[sublotes.length - 1] ??
    null;
  const sublotesVisibles = subloteActual ? [subloteActual] : [];
  const resumenSubloteVisible = useMemo(
    () => calcularResumenSublotes(sublotesVisibles),
    [sublotesVisibles],
  );
  const sublotesGuardados = Math.max(0, sublotes.length - 1);
  const pasoActual = datosPaso(step);

  const volverPasoAnterior = () => {
    if (step > 1) {
      irPasoAnterior();
      return;
    }

    navigate('/inicio');
  };

  const invalidarValidacionCapacidad = () => {
    setCapacidadPrevia(null);
    setAlerta80Mostrada(false);
    setDatosAlerta80(null);
    setDatosCapacidad(null);
    setErrorCapacidadCantidad(null);
    setCapacidadNuevaError(null);
  };

  const restaurarBorradorCompra = (draft: CompraDraft) => {
    compraLocalIdRef.current = draft.compraLocalId ?? generarId();
    setFecha(draft.fecha || hoyLocal());
    setSublotes(draft.sublotes.length > 0 ? draft.sublotes : [crearSubloteVacio()]);
    setSubloteActivoId(draft.subloteActivoId);
    setProductorSeleccionado(draft.productorSeleccionado);
    setProductorSelectionMode(draft.productorSelectionMode);
    setProductorStepAlert(null);
    setBusquedaProductorModal('');
    setMostrarModalProductores(false);
    setMostrarModalProductor(false);
    setError(null);
    setMostrarErrorFormulario(false);
    setRegistroErrorMensaje(null);
    setMostrarModalCancelar(false);
    setMostrarModalConfirmar(false);
    setMostrarModalCapacidad(false);
    setMostrarModalAlerta80(false);
    setMostrarModalConfigurarCapacidad(false);
    invalidarValidacionCapacidad();
    setStep(draft.step);
  };

  const continuarBorradorCompra = () => {
    if (borradorPendiente) {
      restaurarBorradorCompra(borradorPendiente);
    }
    setMostrarModalBorrador(false);
    setBorradorPendiente(null);
  };

  const empezarCompraSinBorrador = () => {
    clearCompraDraft();
    setMostrarModalBorrador(false);
    setBorradorPendiente(null);
    resetFormulario({ clearDraft: true });
  };

  const actualizarSublote = (
    id: string,
    campo: keyof Omit<SubloteForm, 'id'>,
    valor: string,
  ) => {
    setMostrarErrorFormulario(false);
    setError(null);
    setSubloteInputWarnings((actual) => ({
      ...actual,
      [id]: {
        ...actual[id],
        [campo]: undefined,
      },
    }));
    invalidarValidacionCapacidad();
    setSublotes((actual) =>
      actual.map((sublote) =>
        sublote.id === id ? { ...sublote, [campo]: valor } : sublote,
      ),
    );
  };

  const actualizarSubloteConAviso = (
    id: string,
    campo: 'pesoInicial' | 'precioKg',
    valor: string,
    warning?: string,
  ) => {
    setMostrarErrorFormulario(false);
    setError(null);
    setSubloteInputWarnings((actual) => ({
      ...actual,
      [id]: {
        ...actual[id],
        [campo]: warning,
      },
    }));
    invalidarValidacionCapacidad();
    setSublotes((actual) =>
      actual.map((sublote) =>
        sublote.id === id ? { ...sublote, [campo]: valor } : sublote,
      ),
    );
  };

  const agregarSublote = () => {
    const actual = sublotes[sublotes.length - 1];
    if (!actual) return;

    if (
      !actual.tipoCafeId ||
      !actual.calidadId ||
      Boolean(leerCantidadCompra(actual.pesoInicial).error) ||
      Boolean(leerPrecioCompra(actual.precioKg).error)
    ) {
      setMostrarErrorFormulario(true);
      setError('Completa este cafe antes de agregar otro.');
      return;
    }

    const nuevoSublote = crearSubloteVacio();
    setError(null);
    setMostrarErrorFormulario(false);
    invalidarValidacionCapacidad();
    setSubloteActivoId(nuevoSublote.id);
    setSublotes((items) => [...items, nuevoSublote]);
  };

  const abrirModalProductor = () => {
    setError(null);
    setProductorFormError(null);
    setProductorFormErrors({});
    setProductorFormTouched({});
    setProductorForm(PRODUCTOR_FORM_EMPTY);
    setMostrarModalProductor(true);
  };

  const cerrarModalProductor = () => {
    setMostrarModalProductor(false);
    setProductorForm(PRODUCTOR_FORM_EMPTY);
    setProductorFormError(null);
    setProductorFormErrors({});
    setProductorFormTouched({});
  };

  const seleccionarProductor = (productor: ProductorOption) => {
    if (productorSeleccionado?.id === productor.id) {
      setProductorSeleccionado(null);
      setProductorStepAlert(null);
      setBusquedaProductorModal('');
      setMostrarModalProductores(false);
      setError(null);
      setMostrarErrorFormulario(false);
      return;
    }

    setProductorSeleccionado(productor);
    setProductorSelectionMode(productor.rapido ? 'generico' : 'buscar');
    setProductorStepAlert(null);
    setBusquedaProductorModal('');
    setMostrarModalProductores(false);
    setError(null);
    setMostrarErrorFormulario(false);
  };

  const refrescarProductores = async () => {
    try {
      const productoresData = await listarProductores();
      setProductores(
        dedupeProductorOptions(productoresData.map(mapProductorToOption)),
      );
    } catch {
      // No interrumpe el flujo si falla la recarga del autocomplete.
    }
  };

  const alternarModoProductor = (mode: Exclude<ProductorSelectionMode, null>) => {
    const nextMode = productorSelectionMode === mode ? null : mode;

    setProductorSelectionMode(nextMode);
    setProductorStepAlert(null);
    setError(null);
    setMostrarErrorFormulario(false);

    if (nextMode !== 'buscar' && productorSeleccionado?.id !== PRODUCTOR_GENERAL.id) {
      setProductorSeleccionado(null);
    }

    if (nextMode !== 'generico' && productorSeleccionado?.id === PRODUCTOR_GENERAL.id) {
      setProductorSeleccionado(null);
    }

    if (nextMode === 'buscar') {
      void refrescarProductores();
    }

    if (nextMode === 'generico') {
      setProductorSeleccionado(PRODUCTOR_GENERAL);
    }
  };

  const seleccionarBusqueda = () => {
    alternarModoProductor('buscar');
  };

  const seleccionarGenerico = () => {
    alternarModoProductor('generico');
  };

  const seleccionarRegistroProductor = () => {
    setProductorSelectionMode('registrar');
    setProductorSeleccionado(null);
    setProductorStepAlert(null);
    setError(null);
    setMostrarErrorFormulario(false);
    abrirModalProductor();
  };

  const validarProductorForm = () => {
    const errores: ProductorFormErrors = {};
    const nombre = getProductorNameError(productorForm.nombre);
    const tipoDocumento = validateProductorField(
      'tipoDocumento',
      productorForm,
    );
    const documento = productorForm.tipoDocumento
      ? getProductorDocumentError(
          productorForm.documento,
          productorForm.tipoDocumento,
        )
      : null;
    const telefono = getProductorPhoneError(productorForm.telefono);

    if (nombre) errores.nombre = nombre;
    if (tipoDocumento) errores.tipoDocumento = tipoDocumento;
    if (documento) errores.documento = documento;
    if (telefono) errores.telefono = telefono;

    return errores;
  };

  const guardarProductorLocal = async () => {
    const nombre = productorForm.nombre.trim();
    const tipoDocumento = productorForm.tipoDocumento || 'CEDULA';
    const documento = sanitizePersonDigits(productorForm.documento, 10);
    const telefono = sanitizePersonDigits(productorForm.telefono);
    const errores = validarProductorForm();

    setProductorFormTouched({
      nombre: true,
      tipoDocumento: true,
      documento: true,
      telefono: true,
    });
    setProductorFormErrors(errores);
    setProductorFormError(null);

    if (Object.keys(errores).length > 0) {
      setProductorFormError({
        title: 'Faltan datos por completar.',
        description: 'Verifica los campos marcados e intenta nuevamente.',
      });
      return;
    }

    const productorExistente = findProductorExistente(
      productores,
      nombre,
      documento,
    );
    if (productorExistente) {
      setProductorFormError({
        title: 'Este productor ya existe.',
        description: 'Ya hay un productor registrado con este documento.',
      });
      return;
    }

    setBotonGuardarProductorPresionado(true);

    try {
      const productorGuardado = await crearProductor({
        nombre,
        documento,
        tipoDocumento,
        telefono: telefono || undefined,
      });

      const productorBase = mapProductorToOption(productorGuardado);

      setProductores((actual) =>
        dedupeProductorOptions([
          productorBase,
          ...actual.filter((productor) => productor.id !== productorBase.id),
        ]),
      );
      setProductorSeleccionado(productorBase);
      setProductorSelectionMode('buscar');
      setProductorStepAlert(null);
      setBusquedaProductorModal('');
      setMostrarModalProductor(false);
      setProductorForm(PRODUCTOR_FORM_EMPTY);
      setProductorFormErrors({});
      setProductorFormTouched({});
      setProductorFormError(null);
      setProductorCreadoToast(productorBase);
      setError(null);
      setMostrarErrorFormulario(false);
    } catch (err) {
      setProductorFormError(getProductorSaveError(err));
    } finally {
      setBotonGuardarProductorPresionado(false);
    }
  };

  const resetFormulario = (options: { clearDraft?: boolean } = {}) => {
    latestCompraDraftRef.current = null;
    if (options.clearDraft !== false) {
      clearCompraDraft();
    }
    savingRef.current = false;
    compraLocalIdRef.current = null;
    setFecha(hoyLocal());
    setSublotes([crearSubloteVacio()]);
    setSubloteInputWarnings({});
    setSubloteInputWarningsExiting(false);
    setSubloteActivoId(null);
    setProductorSeleccionado(null);
    setProductorSelectionMode(null);
    setProductorStepAlert(null);
    setBusquedaProductorModal('');
    setMostrarModalProductores(false);
    setProductorFormError(null);
    setProductorFormErrors({});
    setProductorFormTouched({});
    setProductorCreadoToast(null);
    setProductorCreadoToastExiting(false);
    setRegistroErrorMensaje(null);
    setMostrarModalCancelar(false);
    setMostrarModalConfirmar(false);
    setCheckingConfirmacion(false);
    setCheckingCapacidadPreview(false);
    setMostrarModalAlerta80(false);
    setMostrarModalConfigurarCapacidad(false);
    setNombreBodegaNueva('Bodega principal');
    setCapacidadNuevaKg('');
    setCapacidadNuevaError(null);
    setGuardandoCapacidad(false);
    setAlerta80Mostrada(false);
    setDatosAlerta80(null);
    setStep(1);
    setError(null);
    setMostrarErrorFormulario(false);
    setCapacidadPrevia(null);
  };

  const iniciarNuevaCompra = () => {
    setCompraGuardada(null);
    resetFormulario();
  };

  const eliminarSubloteDesdeRevision = (id: string) => {
    if (sublotes.length === 1) {
      setMostrarErrorFormulario(true);
      setError(
        'Debe quedar al menos un producto antes de finalizar la compra.',
      );
      return;
    }

    setSublotes((actual) => actual.filter((sublote) => sublote.id !== id));
    setSubloteInputWarnings((actual) => {
      const { [id]: _removed, ...rest } = actual;
      return rest;
    });
    invalidarValidacionCapacidad();
    if (subloteActivoId === id) {
      setSubloteActivoId(null);
    }
    setError(null);
    setMostrarErrorFormulario(false);
  };

  const editarSubloteDesdeRevision = (id: string) => {
    setSubloteActivoId(id);
    setError(null);
    setMostrarErrorFormulario(false);
    setStep(2);
  };

  const validarSublotes = () => {
    if (!fechaCompraValidacion.isValid) {
      return fechaCompraValidacion.message ?? 'Selecciona la fecha de compra.';
    }

    if (catalogos.tiposCafe.length === 0 || catalogos.calidades.length === 0) {
      return 'Aun no hay catalogos disponibles para registrar la compra.';
    }
    for (const [index, sublote] of sublotes.entries()) {
      if (!sublote.tipoCafeId)
        return 'Selecciona un tipo de cafÃ© para continuar.';
      if (!sublote.calidadId)
        return `Selecciona la calidad del sublote ${index + 1}.`;
      const cantidad = leerCantidadCompra(sublote.pesoInicial);
      if (cantidad.error) {
        return cantidad.error;
      }
      const precio = leerPrecioCompra(sublote.precioKg);
      if (precio.error) {
        return precio.error;
      }
    }

    const capacidadDisponible = getCapacidadDisponibleAntes(capacidadPrevia);
    if (
      capacidadPrevia?.validada &&
      typeof capacidadDisponible === 'number' &&
      Number.isFinite(capacidadDisponible) &&
      resumen.totalKg > Math.max(0, capacidadDisponible)
    ) {
      return `Tienes espacio disponible para ${formatoKg(
        Math.max(0, capacidadDisponible),
      )} kg.`;
    }

    return null;
  };

  const irSiguientePaso = () => {
    setError(null);
    setMostrarErrorFormulario(false);
    setFormAlertExiting(false);
    if (step === 1) {
      if (!productorSelectionMode) {
        setProductorStepAlert(null);
        window.setTimeout(() => {
          setProductorStepAlert(
            'Selecciona un productor o una forma de registro.',
          );
        }, 0);
        return;
      }

      if (!productorSeleccionado) {
        setProductorStepAlert(null);
        window.setTimeout(() => {
          setProductorStepAlert(
            productorSelectionMode === 'registrar'
              ? 'Registra el productor para poder asociarlo a esta compra.'
              : 'Selecciona un productor de la lista para continuar.',
          );
        }, 0);
        return;
      }

      setProductorStepAlert(null);
      setStep(2);
      return;
    }
    if (step === 2) {
      const mensajeValidacion = validarSublotes();
      if (mensajeValidacion) {
        setMostrarErrorFormulario(true);
        setError(mensajeValidacion);
        return;
      }
      setStep(3);
    }
  };

  const irPasoAnterior = () => {
    setError(null);
    setMostrarErrorFormulario(false);
    setStep((actual) => Math.max(1, actual - 1) as Step);
  };

  const construirPayloadCompra = async (): Promise<CreateCompraPayload> => {
    const compraLocalId = compraLocalIdRef.current ?? generarId();
    compraLocalIdRef.current = compraLocalId;
    const deviceId = await obtenerDeviceId();
    const fechaActual = fecha.trim() || hoyLocal();
    setFecha(fechaActual);
    const fechaNormalizada = toIsoDateAtUtcNoon(fechaActual);

    const payload: CreateCompraPayload = {
      ...(fechaNormalizada ? { fecha: fechaNormalizada } : {}),
      deviceId,
      localId: compraLocalId,
      sublotes: sublotes.map((sublote) => ({
        tipoCafeId: sublote.tipoCafeId,
        calidadId: sublote.calidadId,
        pesoInicial: leerCantidadCompra(sublote.pesoInicial).valor,
        precioKg: leerPrecioCompra(sublote.precioKg).valor,
        deviceId,
        localId: sublote.id,
      })),
    };

    if (productorSeleccionado && !productorSeleccionado.rapido) {
      payload.productorId = productorSeleccionado.id;
    }

    return payload;
  };

  useEffect(() => {
    if (step !== 2 || !fechaCompraValidacion.isValid) {
      return;
    }

    const sublotesListos = sublotes.every((sublote) => {
      const peso = leerCantidadCompra(sublote.pesoInicial);
      const precio = leerPrecioCompra(sublote.precioKg);
      return (
        Boolean(sublote.tipoCafeId) &&
        Boolean(sublote.calidadId) &&
        !peso.error &&
        !precio.error
      );
    });

    if (!sublotesListos) {
      setCapacidadPrevia(null);
      setErrorCapacidadCantidad(null);
      return;
    }

    let cancelado = false;
    setCheckingCapacidadPreview(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const deviceId = await obtenerDeviceId();
          const fechaActual = fecha.trim() || hoyLocal();
          const fechaNormalizada = toIsoDateAtUtcNoon(fechaActual);
          const payload: CreateCompraPayload = {
            ...(fechaNormalizada ? { fecha: fechaNormalizada } : {}),
            deviceId,
            localId: compraLocalIdRef.current ?? generarId(),
            sublotes: sublotes.map((sublote) => ({
              tipoCafeId: sublote.tipoCafeId,
              calidadId: sublote.calidadId,
              pesoInicial: leerCantidadCompra(sublote.pesoInicial).valor,
              precioKg: leerPrecioCompra(sublote.precioKg).valor,
              deviceId,
              localId: sublote.id,
            })),
          };

          if (productorSeleccionado && !productorSeleccionado.rapido) {
            payload.productorId = productorSeleccionado.id;
          }

          const capacidad = await validarCapacidadCompra(payload);
          if (cancelado) return;

          setCapacidadPrevia(capacidad);

          if (capacidad.validada && capacidad.nivel === 'exceso') {
            const disponible = getCapacidadDisponibleAntes(capacidad) ?? 0;
            setErrorCapacidadCantidad(
              createGuidedError(
                'La bodega no tiene espacio suficiente para esa cantidad.',
                `Solo tienes espacio para ${formatoKg(disponible)} kg.`,
                'Reduce la cantidad para continuar.',
                'Ajusta la cantidad.',
              ),
            );
          } else {
            setErrorCapacidadCantidad(null);
          }
        } catch {
          if (!cancelado) {
            setCapacidadPrevia(null);
            setErrorCapacidadCantidad(null);
          }
        } finally {
          if (!cancelado) {
            setCheckingCapacidadPreview(false);
          }
        }
      })();
    }, 650);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
      setCheckingCapacidadPreview(false);
    };
  }, [
    fecha,
    fechaCompraValidacion.isValid,
    productorSeleccionado,
    step,
    sublotes,
  ]);

  const validarCapacidadBodega = async (): Promise<boolean> => {
    try {
      const payload = await construirPayloadCompra();
      const capacidad = await validarCapacidadCompra(payload);
      setCapacidadPrevia(capacidad);

      if (capacidad.nivel === 'requiere_configuracion') {
        // No abrir modal automÃ¡ticamente, usar capacidad por defecto
        return false;
      }

      if (!capacidad.validada) {
        return true;
      }

      const capacidadKg = capacidad.capacidadBodegaKg ?? 0;
      const inventarioActual = capacidad.inventarioActualKg ?? 0;
      const nuevoTotal =
        capacidad.capacidadUsadaKg ?? inventarioActual + resumen.totalKg;

      if (capacidad.nivel === 'exceso') {
        const disponible = Math.max(0, capacidadKg - inventarioActual);
        setErrorCapacidadCantidad(
          createGuidedError(
            'No hay espacio suficiente.',
            `Disponible: ${formatoKg(disponible)} kg. Intentas registrar: ${formatoKg(resumen.totalKg)} kg.`,
            'Ajusta la cantidad para continuar.',
            'Reduce la cantidad.',
          ),
        );
        setDatosCapacidad({
          capacidadKg,
          inventarioActual,
          nuevoTotal,
        });
        return false;
      }

      if (capacidad.nivel === 'alerta' && !alerta80Mostrada)
 } else if (capacidad.nivel === 'excedida') {
   // Alerta 100%: Mostrar cantidad excedente
   const excedente = Math.max(0, resumen.totalKg - capacidad.disponibleKg)
   setDatosAlerta100({
     porcentaje: Math.round((inventarioActual + resumen.totalKg) / capacidad.capacidadBodegaKg * 100),
     capacidadKg: capacidad.capacidadBodegaKg,
     inventarioActual: inventarioActual,
     nuevoTotal: inventarioActual + resumen.totalKg,
     excedente: excedente
   })
   setMostrarModalAlerta100(true)
   setAlerta100Mostrada(true) {
        setDatosAlerta80({
          capacidadKg,
          inventarioActual,
          nuevoTotal,
          porcentaje: Math.round(capacidad.porcentajeOcupacion ?? 0),
        });
        setMostrarModalAlerta80(true);
        setAlerta80Mostrada(true);
        return false;
      }

      return true;
    } catch (error) {
      console.error('No se pudo validar capacidad:', error);

      if (
        error instanceof ApiRequestError &&
        (error.status === 401 || error.status === 403)
      ) {
        setRegistroErrorMensaje(error.message);
        return false;
      }

      const mensajeValidacion = 'No se pudo validar la capacidad de la bodega';

      setCapacidadPrevia({
        validada: false,
        nivel: 'sin_validacion',
        mensaje: mensajeValidacion,
      });
      setMostrarModalCapacidad(false);
      return true;
    }
  };

  const guardarCapacidadDesdeCompra = async () => {
    const nombreBodega = nombreBodegaNueva.trim();
    const capacidad = Number(capacidadNuevaKg);
    setCapacidadNuevaError(null);

    if (!nombreBodega) {
      setCapacidadNuevaError('Ingresa el nombre de la bodega.');
      return;
    }

    if (!Number.isFinite(capacidad) || capacidad <= 0) {
      setCapacidadNuevaError('Ingresa la capacidad total de la bodega en kg.');
      return;
    }

    setGuardandoCapacidad(true);

    try {
      await guardarConfiguracionBodega({
        nombreBodega,
        capacidadKg: capacidad,
      });

      setMostrarModalConfigurarCapacidad(false);
      setNombreBodegaNueva('Bodega principal');
      setCapacidadNuevaKg('');
      setCapacidadPrevia(null);
      setAlerta80Mostrada(false);
      await abrirConfirmacionCompra();
    } catch (error) {
      setCapacidadNuevaError(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar la capacidad de bodega.',
      );
    } finally {
      setGuardandoCapacidad(false);
    }
  };

  const abrirConfirmacionCompra = async () => {
    setRegistroErrorMensaje(null);
    setError(null);
    setMostrarErrorFormulario(false);

    if (!productorSeleccionado) {
      setMostrarErrorFormulario(true);
      setError('Selecciona un productor para continuar.');
      setStep(1);
      return;
    }

    const mensajeValidacion = validarSublotes();
    if (mensajeValidacion) {
      setMostrarErrorFormulario(true);
      setError(mensajeValidacion);
      return;
    }

    setCheckingConfirmacion(true);
    try {
      const puedeContinuar = await validarCapacidadBodega();
      if (puedeContinuar) {
        setMostrarModalConfirmar(true);
      }
    } finally {
      setCheckingConfirmacion(false);
    }
  };

  const guardarCompra = async () => {
    if (savingRef.current) {
      return;
    }

    savingRef.current = true;
    setRegistroErrorMensaje(null);
    setSaving(true);
    setError(null);
    setMostrarErrorFormulario(false);

    if (!productorSeleccionado) {
      savingRef.current = false;
      setSaving(false);
      setMostrarErrorFormulario(true);
      setError('Selecciona un productor para continuar.');
      setStep(1);
      return;
    }
    const mensajeValidacion = validarSublotes();
    if (mensajeValidacion) {
      savingRef.current = false;
      setSaving(false);
      setMostrarErrorFormulario(true);
      setError(mensajeValidacion);
      return;
    }

    await esperarPintadoInterfaz();

    try {
      const payload = await construirPayloadCompra();
      const respuesta = await crearCompra(payload);
      setCompraGuardada({
        fecha: respuesta.compra.fecha,
        productorNombre: productorSeleccionado.nombre,
        productorDocumento: productorSeleccionado.documento,
        totalKg: resumen.totalKg,
        totalCompra: Number(respuesta.compra.totalCompra),
        capacidad: respuesta.capacidad ?? capacidadPrevia ?? undefined,
        sublotes: sublotes.map((sublote) => {
          const peso = leerCantidadCompra(sublote.pesoInicial).valor;
          return {
            id: sublote.id,
            tipoCafe: nombreTipoCafePorId.get(sublote.tipoCafeId) ?? 'CafÃ©',
            calidad: nombreCalidadPorId.get(sublote.calidadId) ?? 'Calidad',
            pesoInicial: peso,
          };
        }),
      });
      latestCompraDraftRef.current = null;
      clearCompraDraft();
      setMostrarModalConfirmar(false);
    } catch (err) {
      const mensaje = getCompraErrorMessage(err);
      if (
        err instanceof ApiRequestError &&
        err.code === 'COMPRA_CAPACIDAD_INSUFICIENTE'
      ) {
        const details = err.details as
          | { disponibleKg?: number; cantidadIntentadaKg?: number }
          | null;
        setErrorCapacidadCantidad(
          createGuidedError(
            'No hay espacio suficiente.',
            `Disponible: ${formatoKg(details?.disponibleKg ?? 0)} kg. Intentas registrar: ${formatoKg(details?.cantidadIntentadaKg ?? resumen.totalKg)} kg.`,
            'Ajusta la cantidad para continuar.',
            'Reduce la cantidad.',
          ),
        );
      }
      setRegistroErrorMensaje(mensaje);
      setError(null);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const cerrarModalConfirmar = () => {
    setMostrarModalConfirmar(false);
  };

  const confirmarCancelarCompra = () => {
    resetFormulario();
    navigate('/inicio');
  };

  const volverDesdeError = () => {
    setRegistroErrorMensaje(null);
    setStep(3);
  };

  if (compraGuardada) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f3f5fb_100%)] px-4 py-5 text-slate-900">
        <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-[430px] items-center">
          <div className="cafesmart-success-modal relative w-full overflow-hidden rounded-[28px] border border-white/80 bg-white px-5 pb-5 pt-4 shadow-[0_22px_60px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/[0.03]">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="absolute right-3.5 top-3.5 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 shadow-[0_8px_22px_rgba(15,23,42,0.08)] transition duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300/60"
              aria-label="Cerrar y volver al inicio"
            >
              <X size={20} />
            </button>

            <div className="pt-9 text-center">
              <div className="relative mx-auto flex h-[94px] w-[94px] items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-100/80 blur-[1px]" />
                <div className="cafesmart-success-halo absolute h-[86px] w-[86px] rounded-full border border-emerald-200 bg-emerald-50/80" />
                <div className="cafesmart-success-check relative flex h-[62px] w-[62px] items-center justify-center rounded-full bg-[#18a66b] text-white shadow-[0_16px_34px_rgba(24,166,107,0.28),inset_0_1px_0_rgba(255,255,255,0.3)]">
                  <Check size={30} strokeWidth={3.2} />
                </div>
              </div>

              <h1 className="mt-5 text-[1.95rem] font-black leading-tight tracking-normal text-slate-950">
                Compra registrada
              </h1>
              <p className="mt-2 text-[1rem] font-semibold leading-6 text-slate-600">
                La compra se guardÃ³ correctamente.
              </p>
            </div>

            <section className="mt-6 rounded-[22px] border border-slate-200/80 bg-[#fbfcff] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
              <p className="text-center text-[0.72rem] font-black uppercase tracking-[0.14em] text-slate-600">
                Resumen de compra
              </p>
              <div className="mt-4 divide-y divide-slate-200/70 rounded-[16px] border border-slate-200/70 bg-white px-4">
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-[0.9rem] font-bold text-slate-600">
                    Productor
                  </span>
                  <span className="min-w-0 truncate text-right text-[0.98rem] font-bold text-slate-900">
                    {compraGuardada.productorNombre}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-[0.9rem] font-bold text-slate-600">
                    Total kg
                  </span>
                  <span className="text-right text-[0.98rem] font-bold text-slate-900">
                    {Math.round(compraGuardada.totalKg)} kg
                  </span>
                </div>
              </div>

              <div className="mt-3 rounded-[18px] border border-[#d8e3f7] bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-4 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                <span className="text-[0.7rem] font-black uppercase tracking-[0.16em] text-[#38557f]">
                  Total pagado
                </span>
                <p className="mt-1 break-words text-[clamp(1.65rem,7vw,2.05rem)] font-black leading-tight text-[#173a8a]">
                  {formatoMoneda(compraGuardada.totalCompra)}
                </p>
              </div>

              {compraGuardada.capacidad &&
              compraGuardada.capacidad.nivel !== 'normal' ? (
                <div
                  className={`mt-3 rounded-[16px] border px-3.5 py-3 ${estiloCapacidad(compraGuardada.capacidad).contenedor}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${estiloCapacidad(compraGuardada.capacidad).icono}`}
                    >
                      <AlertTriangle size={16} />
                    </span>
                    <div>
                      <p className="text-[0.86rem] font-bold">
                        {compraGuardada.capacidad.validada
                          ? 'Capacidad de bodega validada'
                          : 'Sin validaciÃ³n de capacidad'}
                      </p>
                      <p className="mt-1 text-[0.8rem] font-medium leading-5">
                        {compraGuardada.capacidad.mensaje}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={iniciarNuevaCompra}
                className="inline-flex min-h-[48px] min-w-0 items-center justify-center rounded-[14px] bg-[#143f96] px-3 py-3 text-center text-[0.9rem] font-black leading-tight text-white shadow-[0_12px_26px_rgba(20,63,150,0.22)] transition duration-200 hover:bg-[#10357f] hover:shadow-[0_16px_30px_rgba(20,63,150,0.26)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#143f96]/20"
              >
                Registrar nueva compra
              </button>
              <button
                type="button"
                onClick={() => navigate('/inventario')}
                className="inline-flex min-h-[48px] min-w-0 items-center justify-center rounded-[14px] border border-slate-300 bg-white px-3 py-3 text-center text-[0.9rem] font-black leading-tight text-slate-800 shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition duration-200 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300/60"
              >
                Ir a inventario
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (registroErrorMensaje) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 text-slate-900">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[420px] items-center">
          <div className="w-full rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
            <div className="text-center">
              <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#fff0f2] text-[#e24c5a]">
                <AlertTriangle size={24} strokeWidth={2.8} />
              </div>
              <h1 className="mt-5 text-[1.45rem] font-semibold text-slate-900">
                Problema temporal
              </h1>
              <p className="mt-3 text-[0.98rem] leading-6 text-slate-500">
                OcurriÃ³ un problema al guardar la compra. Revisa tu conexiÃ³n a internet e intenta nuevamente.
              </p>
              <p className="mt-2 text-[0.88rem] font-medium text-slate-400">
                Tus datos siguen seguros.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void guardarCompra()}
                disabled={saving}
                className="inline-flex flex-1 min-w-[120px] min-h-[54px] items-center justify-center gap-3 rounded-[14px] bg-[#1f3fa7] px-5 py-3 text-[1.05rem] font-semibold text-white shadow-[0_14px_30px_rgba(16,45,146,0.2)] transition hover:bg-[#18358f] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Reintentando...' : 'Reintentar'}
              </button>
              <button
                type="button"
                onClick={volverDesdeError}
                className="inline-flex flex-1 min-w-[120px] min-h-[54px] items-center justify-center gap-3 rounded-[14px] border border-[#d5deee] bg-white px-5 py-3 text-[1.05rem] font-semibold text-[#334b85] transition hover:bg-[#f4f7ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/15"
              >
                Volver a editar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 pb-[180px] text-slate-900">
      <header className="mx-auto w-full max-w-[430px] px-4 py-4 pt-6">
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={volverPasoAnterior}
            className="absolute left-0 inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-900 transition hover:bg-white/70 hover:opacity-75"
            aria-label={step > 1 ? 'Volver al paso anterior' : 'Salir a inicio'}
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-[1.35rem] font-semibold text-slate-900">
            Nueva Compra
          </h1>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between text-[1.05rem] font-medium text-slate-900">
            <span>
              {step === 2
                ? 'Paso 2: Seleccionar cafÃ©'
                : `Paso ${step}: ${pasoActual.titulo}`}
            </span>
            <span>{step} de 3</span>
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
          {step === 1 ? (
            <p className="mt-3 text-[0.98rem] text-slate-500">
              Selecciona cÃ³mo deseas elegir el productor
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-5 py-2">
        {step === 1 ? (
          <section className="flex flex-col gap-4">
            <SelectableOptionCard
              active={productorSelectionMode === 'buscar'}
              icon={<Search size={20} />}
              title="Buscar productor"
              subtitle="Selecciona un productor registrado"
              onClick={seleccionarBusqueda}
            />

            {productorSelectionMode === 'buscar' ? (
              <div className="space-y-4 rounded-[24px] border border-[#e3e9f5] bg-[#fbfcff] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-[1.05rem] font-black leading-6 text-slate-950">
                      Productores recientes
                    </p>
                    <p className="mt-1 text-sm font-medium leading-5 text-slate-500">
                      Ãšltimos productores registrados
                    </p>
                  </div>
                  <span
                    className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] px-2 text-sm font-black text-[#1f3fa7] shadow-[0_8px_18px_rgba(31,63,167,0.14)]"
                    aria-label={`${productoresRecientes.length} productores recientes`}
                  >
                    {productoresRecientes.length}
                  </span>
                </div>

                {sinProductoresRegistrados ? (
                  <div className="rounded-[16px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-5 text-center text-sm text-slate-500">
                    <p className="font-bold text-slate-800">
                      AÃºn no tienes productores registrados.
                    </p>
                    <p className="mt-1 leading-5">
                      Registra un productor para poder asociarlo a esta compra.
                    </p>
                    <button
                      type="button"
                      onClick={abrirModalProductor}
                      className="mt-3 inline-flex min-h-[40px] items-center justify-center rounded-[12px] bg-[#1f3fa7] px-4 text-sm font-bold text-white"
                    >
                      Registrar productor
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2">
                    {productoresRecientes.map((productor) => (
                      <ProductorCard
                        key={productor.id}
                        productor={productor}
                        active={productorSeleccionado?.id === productor.id}
                        onSelect={() => seleccionarProductor(productor)}
                      />
                    ))}
                  </div>
                )}

                {!sinProductoresRegistrados ? (
                  <button
                    type="button"
                    onClick={() => setMostrarModalProductores(true)}
                    className="group flex min-h-[52px] w-full items-center justify-between rounded-[16px] border border-[#dbe2f0] bg-white px-4 py-3 text-left text-sm font-black text-[#1f3fa7] shadow-[0_10px_22px_rgba(15,23,42,0.04)] transition duration-200 hover:border-[#1f3fa7]/40 hover:bg-[#f4f7ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/15"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eef4ff] transition group-hover:bg-white">
                        <Search size={16} />
                      </span>
                      Ver lista completa de productores
                    </span>
                    <ArrowRight
                      size={17}
                      className="transition group-hover:translate-x-0.5"
                    />
                  </button>
                ) : null}
              </div>
            ) : null}

            <SelectableOptionCard
              active={productorSelectionMode === 'generico'}
              icon={<User size={20} />}
              title="Productor genÃ©rico"
              subtitle="Compra rÃ¡pida sin registrar productor"
              onClick={seleccionarGenerico}
            />

            <SelectableOptionCard
              active={productorSelectionMode === 'registrar'}
              icon={<UserPlus size={20} />}
              title="Registrar productor"
              subtitle="Crear un nuevo productor"
              onClick={seleccionarRegistroProductor}
            />

            {productorSeleccionado ? (
              <article className="mt-2 rounded-[18px] border border-[#d9e4ff] bg-[#f7faff] px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.78rem] font-black uppercase tracking-[0.08em] text-[#1f3fa7]">
                      Productor seleccionado
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1f3fa7] text-xs font-black text-white">
                        {getProductorInitials(productorSeleccionado.nombre)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[1rem] font-bold text-slate-900">
                          {productorSeleccionado.nombre}
                        </p>
                        <p className="truncate text-[0.86rem] font-medium text-slate-500">
                          {productorSeleccionado.rapido
                            ? 'Compra rÃ¡pida'
                            : getProductorDocumentLabel(productorSeleccionado)}
                        </p>
                      </div>
                    </div>
                  </div>
                  {!productorSeleccionado.rapido ? (
                    <button
                      type="button"
                      onClick={() => setMostrarModalProductores(true)}
                      className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#1f3fa7] shadow-sm"
                    >
                      Cambiar productor
                    </button>
                  ) : null}
                </div>
              </article>
            ) : null}

            {productorStepAlert ? (
              <ProductorStepAlert
                message={productorStepAlert}
                exiting={productorStepAlertExiting}
              />
            ) : null}

            {error && mostrarErrorFormulario ? (
              <TransientFormAlert
                message={getComprasGuidance(error)}
                exiting={formAlertExiting}
              />
            ) : null}

            <button
              type="button"
              onClick={irSiguientePaso}
              className="inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[16px] bg-[#1f3fa7] px-5 py-4 text-[1.1rem] font-semibold text-white shadow-[0_12px_28px_rgba(16,45,146,0.26)]"
            >
              Siguiente paso
              <ArrowRight size={20} />
            </button>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4">
            {sublotesGuardados > 0 ? (
              <div className="rounded-[18px] border border-[#d6e2ff] bg-[#eef3ff] px-4 py-3 text-sm font-semibold text-[#102d92]">
                {sublotesGuardados} cafe{sublotesGuardados === 1 ? '' : 's'}{' '}
                agregado{sublotesGuardados === 1 ? '' : 's'} a esta compra.
              </div>
            ) : null}

            {sublotesVisibles.map((sublote) => {
              const mostrarErroresSublote =
                mostrarErrorFormulario && step === 2;
              const pesoValidacion = leerCantidadCompra(sublote.pesoInicial);
              const precioValidacion = leerPrecioCompra(sublote.precioKg);
              const fechaError =
                mostrarErroresSublote && !fechaCompraValidacion.isValid
                  ? fechaCompraValidacion.message
                  : null;
              const tipoCafeError =
                mostrarErroresSublote && !sublote.tipoCafeId
                  ? 'Selecciona el tipo de cafÃ© de este sublote.'
                  : null;
              const calidadError =
                mostrarErroresSublote && !sublote.calidadId
                  ? 'Selecciona la calidad de este sublote.'
                  : null;
              const pesoError = mostrarErroresSublote
                ? pesoValidacion.error
                : null;
              const precioError = mostrarErroresSublote
                ? precioValidacion.error
                : null;
              const capacidadDisponible =
                getCapacidadDisponibleAntes(capacidadPrevia) ??
                PESO_MAXIMO_COMPRA_KG;
              const pesoMaximoPermitido = Math.min(
                PESO_MAXIMO_COMPRA_KG,
                Math.max(0, capacidadDisponible),
              );
              const capacidadDisponibleAntes =
                getCapacidadDisponibleAntes(capacidadPrevia);
              const capacidadRestanteDespues =
                getCapacidadRestanteDespues(capacidadPrevia);
              const porcentajeDisponibleDespues =
                getPorcentajeDisponible(capacidadPrevia);
              const capacidadCasiLlena =
                capacidadPrevia?.validada &&
                capacidadPrevia.nivel !== 'exceso' &&
                porcentajeDisponibleDespues !== null &&
                porcentajeDisponibleDespues < 10;
              const capacidadEnExceso = capacidadPrevia?.nivel === 'exceso';
              const mostrarPanelBodega =
                pesoFocusedSubloteId === sublote.id &&
                (checkingCapacidadPreview || Boolean(capacidadPrevia?.validada));
              const pesoWarning =
                subloteInputWarnings[sublote.id]?.pesoInicial ?? null;
              const precioWarning =
                subloteInputWarnings[sublote.id]?.precioKg ?? null;

              return (
                <article
                  key={sublote.id}
                  className="rounded-[26px] border border-[#dfe5f2] bg-[#f6f7ff] p-5 shadow-sm"
                >
                  <div className="rounded-[20px] border border-[#d8e0ee] bg-white px-4 py-4">
                    <p className="text-[0.92rem] font-black tracking-[0.03em] text-slate-700">
                      Fecha de compra
                    </p>
                    <PurchaseDatePicker
                      value={fecha}
                      min={BUSINESS_MIN_DATE_VALUE}
                      max={hoyLocal()}
                      open={tipoCafeDropdownOpenId === 'fecha-compra'}
                      onToggle={() =>
                        setTipoCafeDropdownOpenId((actual) =>
                          actual === 'fecha-compra' ? null : 'fecha-compra',
                        )
                      }
                      onClose={() =>
                        setTipoCafeDropdownOpenId((actual) =>
                          actual === 'fecha-compra' ? null : actual,
                        )
                      }
                      onChange={(nextFecha) => {
                        setFecha(nextFecha);
                        invalidarValidacionCapacidad();
                      }}
                    />
                    {fechaError ? (
                      <InlineGuidedError
                        message={getComprasGuidance(fechaError)}
                        className="mt-2"
                      />
                    ) : null}
                  </div>

                  <div className="mt-5">
                    <p className="mb-2.5 text-[0.98rem] font-black text-slate-800">
                      Tipo de cafÃ©
                    </p>
                    <CoffeeTypeDropdown
                      id={sublote.id}
                      value={sublote.tipoCafeId}
                      options={tiposCafe}
                      error={Boolean(tipoCafeError)}
                      open={tipoCafeDropdownOpenId === sublote.id}
                      onToggle={() =>
                        setTipoCafeDropdownOpenId((actual) =>
                          actual === sublote.id ? null : sublote.id,
                        )
                      }
                      onClose={() =>
                        setTipoCafeDropdownOpenId((actual) =>
                          actual === sublote.id ? null : actual,
                        )
                      }
                      onChange={(value) => {
                        actualizarSublote(sublote.id, 'tipoCafeId', value);
                      }}
                    />
                    {tipoCafeError ? (
                      <InlineGuidedError
                        message={getComprasGuidance(tipoCafeError)}
                        className="mt-2"
                      />
                    ) : null}
                  </div>

                  <div className="mt-5">
                    <p className="mb-2.5 text-[0.98rem] font-black text-slate-800">
                      Calidad
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {calidades.map((calidad) => {
                        const activo = sublote.calidadId === calidad.id;
                        const visual = visualCalidad(calidad.nombre);
                        return (
                          <button
                            key={calidad.id}
                            type="button"
                            onClick={() =>
                              actualizarSublote(
                                sublote.id,
                                'calidadId',
                                calidad.id,
                              )
                            }
                            className={`rounded-[18px] border px-2 py-3 text-sm font-semibold transition ${
                              activo
                                ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white shadow-[0_8px_20px_rgba(16,45,146,0.18)]'
                                : `${visual.borde} bg-white/95 text-slate-800 hover:bg-white hover:shadow-sm`
                            }`}
                          >
                            <span className="flex flex-col items-center gap-1.5">
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                                  activo
                                    ? 'bg-white/20 text-white'
                                    : visual.fondo
                                }`}
                              >
                                {visual.icono}
                              </span>
                              <span
                                className={`text-[11px] font-black ${activo ? 'text-white' : 'text-slate-800'}`}
                              >
                                {calidad.nombre}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {calidadError ? (
                      <InlineGuidedError
                        message={getComprasGuidance(calidadError)}
                        className="mt-2"
                      />
                    ) : null}
                  </div>

                  <div className="mt-5 rounded-[22px] border border-[#e0e6f2] bg-white p-5">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-[0.98rem] font-black text-slate-800">
                          Peso (kg)
                        </label>
                        <p className="mt-1 text-[0.76rem] font-semibold leading-4 text-slate-500">
                          Usa coma para los decimales.
                        </p>
                        <div className="relative mt-2.5">
                          <input
                            aria-label="Peso inicial del sublote"
                            type="text"
                            inputMode="decimal"
                            value={sublote.pesoInicial}
                            onFocus={() => setPesoFocusedSubloteId(sublote.id)}
                            onBlur={() => setPesoFocusedSubloteId(null)}
                            onChange={(event) => {
                              const next = buildLimitedNumberInput(
                                event.target.value,
                                sublote.pesoInicial,
                                {
                                  decimal: true,
                                  max: pesoMaximoPermitido,
                                },
                              );
                              actualizarSubloteConAviso(
                                sublote.id,
                                'pesoInicial',
                                next.value,
                                next.limited
                                  ? `Solo puedes registrar hasta ${formatoKg(
                                      pesoMaximoPermitido,
                                    )} kg.`
                                  : undefined,
                              );
                            }}
                            className="h-[64px] w-full min-w-0 overflow-hidden rounded-[18px] border border-[#d8e0ee] bg-[#fbfcff] px-3 text-[1.18rem] font-black leading-none text-slate-950 outline-none transition focus:border-[#102d92] focus:bg-white focus:ring-4 focus:ring-[#102d92]/10 min-[390px]:px-4 min-[390px]:text-[1.35rem] sm:text-[1.6rem]"
                          />
                          {!sublote.pesoInicial ? (
                            <span
                              className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-baseline gap-1 min-[390px]:left-4 min-[390px]:gap-1.5"
                              aria-hidden="true"
                            >
                              <span className="text-[1.18rem] font-black leading-none text-slate-500 min-[390px]:text-[1.35rem] sm:text-[1.6rem]">
                                Ej.
                              </span>
                              <span className="text-[1.18rem] font-black leading-none text-slate-500 min-[390px]:text-[1.35rem] sm:text-[1.6rem]">
                                25,5
                              </span>
                            </span>
                          ) : null}
                          {mostrarPanelBodega ? (
                            <div className="pointer-events-none absolute left-0 top-[calc(100%+0.55rem)] z-40 w-[min(21.5rem,calc(100vw-2.5rem))] animate-[cafesmartFadeScale_220ms_ease-out_both]">
                              {checkingCapacidadPreview ? (
                                <div className="flex items-center gap-3 rounded-[20px] border border-[#dbe5fb] bg-white px-3.5 py-3 text-[0.84rem] font-bold leading-5 text-[#40516d] shadow-[0_18px_42px_rgba(15,23,42,0.16)] ring-1 ring-slate-900/[0.03] backdrop-blur">
                                  <span
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#f1f5ff] text-[#1f3fa7]"
                                    aria-hidden="true"
                                  >
                                    <LoaderCircle
                                      size={17}
                                      className="animate-spin"
                                    />
                                  </span>
                                  Revisando espacio disponible...
                                </div>
                              ) : capacidadPrevia?.validada ? (
                                <div
                                  className={`rounded-[22px] border px-3.5 py-3.5 shadow-[0_20px_48px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.03] backdrop-blur ${
                                    capacidadEnExceso
                                      ? 'border-rose-200 bg-white text-rose-950'
                                      : capacidadCasiLlena
                                        ? 'border-amber-200 bg-white text-amber-950'
                                        : 'border-[#dbe5fb] bg-white/95 text-slate-900'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-2.5">
                                      <span
                                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] shadow-sm ${
                                          capacidadEnExceso
                                            ? 'bg-rose-50 text-rose-700'
                                            : capacidadCasiLlena
                                              ? 'bg-amber-50 text-amber-700'
                                              : 'bg-[#eef4ff] text-[#1f3fa7]'
                                        }`}
                                        aria-hidden="true"
                                      >
                                        <Warehouse size={18} />
                                      </span>
                                      <p className="truncate text-[0.8rem] font-black text-slate-700">
                                        Espacio disponible
                                      </p>
                                    </div>
                                    {capacidadEnExceso || capacidadCasiLlena ? (
                                        <span
                                          className={`shrink-0 rounded-full px-2.5 py-1 text-[0.66rem] font-black uppercase tracking-[0.08em] ${
                                            capacidadEnExceso
                                              ? 'bg-rose-100 text-rose-700'
                                              : 'bg-amber-100 text-amber-700'
                                          }`}
                                        >
                                          {capacidadEnExceso
                                            ? 'Sin espacio'
                                            : 'Casi llena'}
                                        </span>
                                      ) : null}
                                  </div>

                                  {capacidadDisponibleAntes !== null ? (
                                    <p
                                      className={`mt-2 whitespace-nowrap text-[clamp(1.45rem,6vw,1.78rem)] font-black leading-tight ${
                                        capacidadEnExceso
                                          ? 'text-rose-800'
                                          : capacidadCasiLlena
                                            ? 'text-amber-800'
                                            : 'text-[#173a8a]'
                                      }`}
                                    >
                                      {formatoKg(capacidadDisponibleAntes)} kg libres
                                    </p>
                                  ) : null}

                                  {capacidadRestanteDespues !== null ? (
                                    <div className="mt-2 flex items-center justify-between gap-3 rounded-[14px] bg-slate-50 px-3 py-2">
                                      <span className="text-[0.74rem] font-black text-slate-500">
                                        DespuÃ©s de esta compra
                                      </span>
                                      <span
                                        className={`whitespace-nowrap text-[0.95rem] font-black leading-tight ${
                                          capacidadEnExceso
                                            ? 'text-rose-800'
                                            : capacidadCasiLlena
                                              ? 'text-amber-800'
                                              : 'text-emerald-700'
                                        }`}
                                      >
                                        {formatoKg(capacidadRestanteDespues)} kg
                                      </span>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {pesoWarning ? (
                          <FieldLimitAlert
                            message={pesoWarning}
                            exiting={subloteInputWarningsExiting}
                          />
                        ) : pesoError ? (
                          <InlineGuidedError
                            message={getComprasGuidance(pesoError)}
                            className="mt-2"
                          />
                        ) : null}
                        {errorCapacidadCantidad ? (
                          <InlineGuidedError
                            message={errorCapacidadCantidad}
                            className="mt-2"
                          />
                        ) : null}
                      </div>

                      <div>
                        <label className="block text-[0.98rem] font-black text-slate-800">
                          Precio x kg
                        </label>
                        <p className="mt-1 text-[0.76rem] font-semibold leading-4 text-slate-500">
                          No escribas puntos.
                        </p>
                        <div className="relative mt-2.5 flex h-[64px] min-w-0 items-center overflow-hidden rounded-[18px] border border-[#d8e0ee] bg-[#fbfcff] px-2.5 transition focus-within:border-[#102d92] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#102d92]/10 min-[390px]:px-3 sm:px-3.5">
                          <span className="mr-1 shrink-0 text-[1.1rem] font-black leading-none text-slate-700 min-[390px]:text-[1.2rem] sm:mr-1.5 sm:text-[1.45rem]">
                            $
                          </span>
                          {!sublote.precioKg ? (
                            <span
                              className="pointer-events-none absolute left-[1.95rem] top-1/2 flex -translate-y-1/2 items-baseline gap-1 min-[390px]:left-[2.2rem] sm:left-[2.75rem]"
                              aria-hidden="true"
                            >
                              <span className="text-[1rem] font-black leading-none text-slate-500 min-[390px]:text-[1.14rem] sm:text-[1.45rem]">
                                Ej.
                              </span>
                              <span className="text-[1rem] font-black leading-none text-slate-500 min-[390px]:text-[1.14rem] sm:text-[1.45rem]">
                                14.000
                              </span>
                            </span>
                          ) : null}
                          <input
                            aria-label="Precio por kilo del sublote"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={sublote.precioKg}
                            onChange={(event) => {
                              const next = buildLimitedNumberInput(
                                event.target.value,
                                sublote.precioKg,
                                {
                                  max: PRECIO_MAXIMO_KG,
                                },
                              );
                              actualizarSubloteConAviso(
                                sublote.id,
                                'precioKg',
                                next.value,
                                next.limited
                                  ? `El precio mÃ¡ximo permitido es ${formatoMoneda(
                                      PRECIO_MAXIMO_KG,
                                    )} por kilogramo.`
                                  : undefined,
                              );
                            }}
                            className="relative z-10 min-w-0 flex-1 overflow-hidden bg-transparent text-[1.18rem] font-black leading-none text-slate-950 outline-none min-[390px]:text-[1.35rem] sm:text-[1.6rem]"
                          />
                        </div>
                        {precioWarning ? (
                          <FieldLimitAlert
                            message={precioWarning}
                            exiting={subloteInputWarningsExiting}
                          />
                        ) : precioError ? (
                          <InlineGuidedError
                            message={getComprasGuidance(precioError)}
                            className="mt-2"
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            <button
              type="button"
              onClick={agregarSublote}
              className="inline-flex min-h-[58px] w-full items-center justify-center gap-3 rounded-[22px] border-2 border-dashed border-[#8fa2cf] bg-white px-5 py-4 text-sm font-black text-[#102d92] shadow-sm transition hover:border-[#1f3fa7] hover:bg-[#f4f7ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/15"
            >
              <Plus size={20} />
              Agregar mÃ¡s cafÃ©
            </button>

            <article className="rounded-[24px] border border-[#c8d6f5] bg-[#eef3ff] p-5 text-[#102d92] shadow-sm">
              <p className="text-sm font-black text-[#334b85]">
                Resumen de peso
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-[#c8d6f5] pt-5 min-[520px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="min-w-0">
                  <p className="text-sm font-black text-[#334b85]">Total kg:</p>
                  <p
                    className="mt-2 min-w-0 break-words text-[clamp(1.25rem,6vw,1.9rem)] font-black leading-tight text-[#08256d]"
                    title={formatTotalKg(resumenSubloteVisible.totalKg)}
                  >
                    {formatTotalKg(resumenSubloteVisible.totalKg)}
                  </p>
                </div>
                <div className="min-w-0 min-[520px]:text-right">
                  <p className="text-sm font-black text-[#334b85]">
                    Total estimado:
                  </p>
                  <p
                    className="mt-2 min-w-0 break-words text-[clamp(1.25rem,6vw,1.9rem)] font-black leading-tight text-[#08256d]"
                    title={formatoMoneda(resumenSubloteVisible.totalCompra)}
                  >
                    {formatoMoneda(resumenSubloteVisible.totalCompra)}
                  </p>
                </div>
              </div>
            </article>

            {error && mostrarErrorFormulario ? (
              <TransientFormAlert
                message={getComprasGuidance(error)}
                exiting={formAlertExiting}
              />
            ) : null}

            <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3">
              <button
                type="button"
                onClick={irPasoAnterior}
                className="inline-flex min-h-[54px] min-w-0 items-center justify-center gap-2 rounded-[18px] border border-[#cbd6ea] bg-white px-3 py-3 text-[0.9rem] font-black text-[#334b85] shadow-sm transition hover:border-[#9fb0d4] hover:bg-[#f4f7ff] hover:text-[#102d92] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/15"
              >
                <ArrowLeft size={18} />
                <span className="truncate">Paso anterior</span>
              </button>
              <button
                type="button"
                onClick={irSiguientePaso}
                className="inline-flex min-h-[54px] min-w-0 items-center justify-center gap-2 rounded-[18px] bg-[#1f3fa7] px-3 py-3 text-[0.95rem] font-black text-white shadow-[0_12px_28px_rgba(16,45,146,0.26)] transition hover:bg-[#18358f] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/20"
              >
                <span className="truncate">Siguiente paso</span>
                <ArrowRight size={19} />
              </button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-5">
            <article className="rounded-[26px] border border-[#e3e9f5] bg-white px-5 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[#eef4ff] text-[#173ea6]"
                  aria-hidden="true"
                >
                  <CalendarDays size={17} />
                </span>
                <div>
                  <p className="text-[0.75rem] font-black uppercase tracking-[0.12em] text-[#52657d]">
                    Datos de la compra
                  </p>
                  <p className="mt-0.5 text-[0.82rem] font-semibold text-slate-500">
                    InformaciÃ³n principal del registro.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <div>
                  <p className="text-[0.74rem] font-black uppercase tracking-[0.1em] text-slate-500">
                    Productor
                  </p>
                  <p className="mt-1 break-words text-[1.05rem] font-black leading-tight text-slate-950">
                    {productorSeleccionado?.nombre ?? 'Sin productor'}
                  </p>
                </div>
                <div>
                  <p className="text-[0.74rem] font-black uppercase tracking-[0.1em] text-slate-500">
                    Fecha
                  </p>
                  <p className="mt-1 text-[1.02rem] font-bold leading-tight text-slate-800">
                    {formatoFecha(fecha)}
                  </p>
                </div>
              </div>
            </article>

            <section>
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="flex min-w-0 items-center gap-2">
                  <ShoppingBag size={15} className="shrink-0 text-[#173ea6]" />
                  <h2 className="truncate text-[0.86rem] font-black uppercase tracking-[0.11em] text-[#40516d]">
                    Historial de la compra
                  </h2>
                </div>
                <span className="shrink-0 rounded-full bg-[#edf3ff] px-2.5 py-1 text-[0.68rem] font-black text-[#173ea6]">
                  {sublotes.length}
                </span>
              </div>
              <p className="mt-1 px-1 text-[0.86rem] font-semibold leading-5 text-slate-500">
                Revisa cada cafÃ© antes de confirmar. Puedes editar o eliminar
                un producto si lo necesitas.
              </p>
              <div className="mt-3 space-y-3">
                {sublotes.map((sublote) => {
                  const tipoCafe =
                    nombreTipoCafePorId.get(sublote.tipoCafeId) ?? 'CafÃ©';
                  const calidad =
                    nombreCalidadPorId.get(sublote.calidadId) ?? 'Calidad';
                  const peso = leerCantidadCompra(sublote.pesoInicial).valor;
                  const totalItem = peso * leerPrecioCompra(sublote.precioKg).valor;
                  const visual = iconoTipoCafe(tipoCafe);

                  return (
                    <article
                      key={sublote.id}
                      className="rounded-[22px] border border-[#e2e8f4] bg-white px-4 py-3.5 shadow-[0_10px_28px_rgba(15,23,42,0.045)] transition hover:border-[#cfdaf0] hover:shadow-[0_14px_34px_rgba(15,23,42,0.07)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className={`shrink-0 rounded-[15px] p-2.5 ${visual.fondo}`}>
                            {visual.icono}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[0.68rem] font-black uppercase tracking-[0.11em] text-[#52657d]">
                              {tipoCafe}
                            </p>
                            <p className="mt-0.5 text-[1.05rem] font-black leading-tight text-slate-950">
                              Calidad: {calidad}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.78rem] font-bold text-slate-700">
                                {peso.toLocaleString('es-CO', {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                kg
                              </span>
                              <span className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-[0.78rem] font-black text-[#173ea6]">
                                {formatoMoneda(totalItem)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              editarSubloteDesdeRevision(sublote.id)
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] bg-[#eef4ff] text-[#173ea6] transition hover:bg-[#dfe8ff] active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/15"
                            title="Editar producto"
                            aria-label={`Editar ${tipoCafe}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              eliminarSubloteDesdeRevision(sublote.id)
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] bg-[#fff1f3] text-[#d63b4a] transition hover:bg-[#ffe4e8] active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200"
                            title="Eliminar producto"
                            aria-label={`Eliminar ${tipoCafe}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <article className="rounded-[26px] border border-[#dbe5fb] bg-white p-4 shadow-[0_16px_38px_rgba(15,23,42,0.06)]">
              <div className="mb-3 flex items-center gap-2 px-1">
                <BadgeAlert size={15} className="text-[#173ea6]" />
                <p className="text-[0.82rem] font-black uppercase tracking-[0.11em] text-[#40516d]">
                  Resumen financiero
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="min-w-0 rounded-[18px] bg-[#f7f9ff] px-3 py-3">
                  <span
                    className="block min-w-0 break-words text-[clamp(1.15rem,5vw,1.55rem)] font-black leading-tight text-[#173a8a]"
                    title={formatTotalKg(resumen.totalKg)}
                  >
                    {formatTotalKg(resumen.totalKg)}
                  </span>
                  <span className="mt-1 block text-[0.72rem] font-black uppercase tracking-[0.08em] text-slate-500">
                    Total almacenado
                  </span>
                </div>

                <div className="min-w-0 rounded-[18px] bg-[#eef4ff] px-3 py-3">
                  <span
                    className="block min-w-0 break-words text-[clamp(1.15rem,5vw,1.55rem)] font-black leading-tight text-[#08256d]"
                    title={formatoMoneda(resumen.totalCompra)}
                  >
                    {formatoMoneda(resumen.totalCompra)}
                  </span>
                  <span className="mt-1 block text-[0.72rem] font-black uppercase tracking-[0.08em] text-[#52657d]">
                    Total a pagar
                  </span>
                </div>
              </div>
            </article>

            {error && mostrarErrorFormulario ? (
              <TransientFormAlert
                message={getComprasGuidance(error)}
                exiting={formAlertExiting}
              />
            ) : null}

            <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)] gap-2.5">
              <button
                type="button"
                onClick={() => void abrirConfirmacionCompra()}
                disabled={saving || checkingConfirmacion || loading}
                className="inline-flex min-h-[52px] min-w-0 items-center justify-center gap-2 rounded-[16px] bg-[#102d92] px-3 py-3 text-center text-[0.92rem] font-black leading-tight text-white shadow-[0_14px_30px_rgba(16,45,146,0.22)] transition hover:bg-[#18358f] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkingConfirmacion ? (
                  <LoaderCircle size={18} className="shrink-0 animate-spin" />
                ) : (
                  <Save size={18} className="shrink-0" />
                )}
                <span className="min-w-0">
                  {checkingConfirmacion
                    ? 'Revisando...'
                    : 'Registrar compra'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalCancelar(true)}
                className="inline-flex min-h-[52px] min-w-0 items-center justify-center rounded-[16px] border border-slate-300 bg-white px-3 py-3 text-center text-[0.92rem] font-black leading-tight text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950 active:scale-[0.99]"
              >
                Cancelar
              </button>
            </div>
          </section>
        ) : null}
      </main>

      {mostrarModalBorrador && borradorPendiente ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="compra-draft-title"
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
                  id="compra-draft-title"
                  className="mt-1 text-[1.45rem] font-black leading-tight text-slate-950"
                >
                  Registro en progreso
                </h2>
                <p className="mt-2 text-[0.98rem] font-semibold leading-6 text-slate-700">
                  Encontramos una compra que no fue finalizada. Puedes continuar
                  con la informaciÃ³n guardada o empezar una nueva compra.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[18px] border border-[#dbe5fb] bg-[#f8faff] px-4 py-3 text-sm font-semibold text-[#52657d]">
              <div className="flex items-center justify-between gap-3">
                <span>Ãšltimo paso</span>
                <span className="font-black text-[#102d92]">
                  Paso {borradorPendiente.step} de 3
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#dbe5fb] pt-2">
                <span>Productos agregados</span>
                <span className="font-black text-slate-800">
                  {countDraftSublotesConProgreso(borradorPendiente)}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={continuarBorradorCompra}
                className="inline-flex flex-1 min-w-[150px] min-h-[54px] items-center justify-center rounded-[16px] bg-[#102d92] px-5 py-3 text-[0.98rem] font-black text-white shadow-[0_16px_34px_rgba(16,45,146,0.22)] transition hover:bg-[#18358f] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/20"
              >
                Continuar registro
              </button>
              <button
                type="button"
                onClick={empezarCompraSinBorrador}
                className="inline-flex flex-1 min-w-[150px] min-h-[52px] items-center justify-center rounded-[16px] border border-[#d5deee] bg-white px-5 py-3 text-[0.96rem] font-black text-[#334b85] transition hover:bg-[#f4f7ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/15"
              >
                Empezar de nuevo
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {mostrarModalCancelar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
            <div className="mt-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ffecef] text-[#b12937]">
                <AlertTriangle size={24} />
              </div>
              <h2 className="mt-5 text-[2rem] font-semibold leading-tight text-slate-900">
                Â¿Cancelar compra?
              </h2>
              <p className="mt-3 text-[1.05rem] leading-7 text-slate-500">
                Se perderÃ¡n los datos ingresados y tendrÃ¡s que iniciar el
                proceso nuevamente.
              </p>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={confirmarCancelarCompra}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] bg-[#ffe1e5] px-5 py-3 text-[1.15rem] font-semibold text-[#b12937]"
              >
                SÃ­, cancelar
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalCancelar(false)}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] px-5 py-3 text-[1.15rem] font-semibold text-[#1f56dd]"
              >
                Seguir editando
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModalConfigurarCapacidad ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
            <div className="mt-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eef3ff] text-[#1f3fa7]">
                <Warehouse size={24} />
              </div>
              <h2 className="mt-5 text-[1.65rem] font-semibold leading-tight text-slate-900">
                Registra la capacidad de la bodega
              </h2>
              <p className="mt-3 text-[1rem] leading-7 text-slate-500">
                Necesitamos la capacidad total para validar esta compra. También
                puedes cambiarla luego en Ajustes.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-[0.86rem] font-semibold text-slate-700">
                  Nombre de la bodega
                </label>
                <input
                  type="text"
                  value={nombreBodegaNueva}
                  onChange={(event) => {
                    setNombreBodegaNueva(event.target.value);
                    setCapacidadNuevaError(null);
                  }}
                  className="mt-2 w-full rounded-[16px] border border-[#dde4f1] bg-[#f8faff] px-4 py-4 text-[1.05rem] font-semibold text-slate-900 outline-none focus:border-[#1f3fa7]"
                  placeholder="Ej. Bodega principal"
                />
              </div>

              <div>
                <label className="block text-[0.86rem] font-semibold text-slate-700">
                  Capacidad total (kg)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={capacidadNuevaKg}
                  onChange={(event) => {
                    setCapacidadNuevaKg(event.target.value);
                    setCapacidadNuevaError(null);
                  }}
                  className="mt-2 w-full rounded-[16px] border border-[#dde4f1] bg-[#f8faff] px-4 py-4 text-[1.2rem] font-semibold text-slate-900 outline-none focus:border-[#1f3fa7]"
                  placeholder="Ej. 6000"
                />
              </div>

              {capacidadNuevaError ? (
                <p className="mt-2 text-sm font-semibold text-rose-600">
                  {capacidadNuevaError}
                </p>
              ) : null}
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => void guardarCapacidadDesdeCompra()}
                disabled={guardandoCapacidad}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] bg-[#1f3fa7] px-5 py-3 text-[1.08rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {guardandoCapacidad ? 'Guardando...' : 'Guardar y validar'}
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalConfigurarCapacidad(false)}
                disabled={guardandoCapacidad}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] px-5 py-3 text-[1.05rem] font-semibold text-[#1f56dd]"
              >
                Volver a la compra
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModalCapacidad && datosCapacidad ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
            <div className="mt-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff7ed] text-[#ea580c]">
                <AlertTriangle size={24} />
              </div>
              <h2 className="mt-5 text-[1.8rem] font-semibold leading-tight text-slate-900">
                Capacidad superada
              </h2>
              <p className="mt-3 text-[1rem] leading-7 text-slate-500">
                Esta compra supera la capacidad registrada de tu bodega. Puedes
                revisar los datos o continuar bajo tu criterio.
              </p>
            </div>

            <div className="mt-5 rounded-[16px] border border-[#fed7aa] bg-[#fff7ed] p-4">
              <div className="flex items-center justify-between gap-3 text-[0.95rem] text-slate-600">
                <span>Capacidad mÃ¡xima</span>
                <span className="font-semibold text-slate-900">
                  {datosCapacidad.capacidadKg.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  kg
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[0.95rem] text-slate-600">
                <span>DespuÃ©s de la compra</span>
                <span className="font-semibold text-[#ea580c]">
                  {datosCapacidad.nuevoTotal.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  kg
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalCapacidad(false);
                  setMostrarModalConfirmar(true);
                }}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] bg-[#ea580c] px-5 py-3 text-[1.15rem] font-semibold text-white"
              >
                Continuar
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalCapacidad(false)}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] px-5 py-3 text-[1.05rem] font-semibold text-[#c2410c]"
              >
                Revisar compra
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModalAlerta80 && datosAlerta80 ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
            <div className="mt-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff7ed] text-[#ea580c]">
                <AlertTriangle size={24} />
              </div>
              <h2 className="mt-5 text-[1.8rem] font-semibold leading-tight text-slate-900">
                Bodega en nivel de alerta
              </h2>
              <p className="mt-3 text-[1rem] leading-7 text-slate-500">
                La compra dejará la bodega al {datosAlerta80.porcentaje}% de su
                capacidad.
              </p>
              <p className="mt-2 text-[0.95rem] leading-6 text-slate-600">
                Se recomienda vender parte del inventario para
                evitar problemas de almacenamiento.
              </p>
            </div>

            <div className="mt-5 rounded-[16px] border border-[#fed7aa] bg-[#fff7ed] p-4">
              <div className="flex items-center justify-between gap-3 text-[0.95rem] text-slate-600">
                <span>Capacidad total</span>
                <span className="font-semibold text-slate-900">
                  {datosAlerta80.capacidadKg.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  kg
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[0.95rem] text-slate-600">
                <span>Antes de la compra</span>
                <span className="font-semibold text-slate-900">
                  {datosAlerta80.inventarioActual.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  kg
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[0.95rem] text-slate-600">
                <span>Después de la compra</span>
                <span className="font-semibold text-[#ea580c]">
                  {datosAlerta80.nuevoTotal.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  kg
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalAlerta80(false);
                  setMostrarModalConfirmar(true);
                }}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] bg-[#ea580c] px-5 py-3 text-[1.15rem] font-semibold text-white"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModalConfirmar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
            <div className="mt-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f1ff] text-[#1f3fa7]">
                <Check size={24} />
              </div>
              <h2 className="mt-5 text-[1.72rem] font-semibold leading-tight text-slate-900">
                ¿Registrar compra?
              </h2>
              <p className="mt-3 text-[1rem] font-medium leading-6 text-slate-600">
                Verifica la información antes de continuar.
              </p>
            </div>

            <div className="mt-5 rounded-[16px] border border-[#e2e8f4] bg-[#f8faff] p-4">
              <div className="flex items-center justify-between gap-3 text-[0.95rem] font-medium text-slate-600">
                <span>Productor</span>
                <span className="font-semibold text-slate-900">
                  {productorSeleccionado?.nombre ?? '-'}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[0.95rem] font-medium text-slate-600">
                <span>Total kg</span>
                <span className="font-semibold text-slate-900">
                  {resumen.totalKg.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  kg
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-1 border-t border-[#e1e7f3] pt-3 text-[0.95rem] font-medium text-slate-600 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between min-[420px]:gap-3">
                <span>Total a pagar</span>
                <span
                  className="min-w-0 break-words text-[clamp(1.08rem,4.6vw,1.28rem)] font-black leading-tight text-[#1f3fa7] min-[420px]:text-right"
                  title={formatoMoneda(resumen.totalCompra)}
                >
                  {formatoMoneda(resumen.totalCompra)}
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)] gap-2.5">
              <button
                type="button"
                onClick={() => void guardarCompra()}
                disabled={!puedeRegistrarCompra || saving}
                className="inline-flex min-h-[52px] min-w-0 items-center justify-center gap-2 rounded-[14px] bg-[#1f3fa7] px-3 py-3 text-center text-[0.95rem] font-black leading-tight text-white shadow-[0_14px_30px_rgba(16,45,146,0.2)] transition hover:bg-[#18358f] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80"
              >
                {saving ? (
                  <>
                    <LoaderCircle size={18} className="shrink-0 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  'Confirmar compra'
                )}
              </button>
              <button
                type="button"
                onClick={cerrarModalConfirmar}
                disabled={saving}
                className="inline-flex min-h-[52px] min-w-0 items-center justify-center rounded-[14px] border border-slate-300 bg-white px-3 py-3 text-center text-[0.95rem] font-black leading-tight text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
          {saving ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10 px-4">
              <div className="rounded-[18px] bg-white px-5 py-4 text-center shadow-[0_18px_42px_rgba(15,23,42,0.22)]">
                <LoaderCircle
                  size={28}
                  className="mx-auto animate-spin text-[#1f3fa7]"
                />
                <p className="mt-2 text-sm font-black text-slate-900">
                  Guardando compra
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Espera un momento...
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {mostrarModalProductores ? (
        <div
          className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center overflow-y-auto bg-slate-900/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:px-5 sm:py-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setMostrarModalProductores(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="productores-registrados-title"
            aria-describedby="productores-registrados-description"
            className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.28)] sm:max-h-[min(88dvh,720px)]"
          >
            <header className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2
                    id="productores-registrados-title"
                    className="text-[1.25rem] font-black leading-tight text-slate-900"
                  >
                    Productores registrados
                  </h2>
                  <p
                    id="productores-registrados-description"
                    className="mt-1 text-sm font-medium leading-5 text-slate-500"
                  >
                    Busca y selecciona un productor para esta compra.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarModalProductores(false)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                  aria-label="Cerrar productores registrados"
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
                    ref={productoresSearchRef}
                    type="text"
                    value={busquedaProductorModal}
                    onChange={(event) =>
                      setBusquedaProductorModal(event.target.value)
                    }
                    placeholder="Buscar por nombre, cÃ©dula o NIT"
                    className="w-full rounded-[16px] border border-[#dbe2f0] bg-[#f8faff] px-10 py-3 text-[0.95rem] font-medium text-slate-900 outline-none transition focus:border-[#1f3fa7] focus:bg-white focus:ring-4 focus:ring-[#1f3fa7]/10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {PRODUCTOR_SORT_OPTIONS.map((option) => {
                    const active = productorSortMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setProductorSortMode(option.value)}
                        {...ariaPressed(active)}
                        className={`min-h-[40px] rounded-[12px] border px-2.5 py-2 text-xs font-black leading-4 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/15 ${
                          active
                            ? 'border-[#1f3fa7] bg-[#eef4ff] text-[#1f3fa7]'
                            : 'border-[#e0e6f2] bg-white text-slate-500 hover:border-[#cbd6ea] hover:bg-[#f8faff]'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {sinProductoresRegistrados ? (
                <div className="rounded-[18px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-8 text-center text-sm text-slate-500">
                  <p className="font-bold text-slate-800">
                    Aún no tienes productores registrados.
                  </p>
                  <p className="mt-1 leading-5">
                    Registra un productor para poder asociarlo a esta compra.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarModalProductores(false);
                      abrirModalProductor();
                    }}
                    className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-[12px] bg-[#1f3fa7] px-4 text-sm font-bold text-white"
                  >
                    Registrar productor
                  </button>
                </div>
              ) : productoresModalFiltrados.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-8 text-center text-sm text-slate-500">
                  <p className="font-bold text-slate-800">
                    No encontramos productores con ese dato.
                  </p>
                  <p className="mt-1 leading-5">
                    Prueba buscando por nombre, cédula o NIT.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pb-4">
                  {productoresModalFiltrados.map((productor) => (
                    <ProductorCard
                      key={productor.id}
                      productor={productor}
                      active={productorSeleccionado?.id === productor.id}
                      onSelect={() => seleccionarProductor(productor)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {mostrarModalProductor ? (
        <div className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center overflow-y-auto bg-slate-900/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:px-5 sm:py-6">
          <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.28)] sm:max-h-[min(88dvh,720px)]">
            <div className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-3">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-[#cfd8e6]" />
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[1.35rem] font-semibold leading-tight text-[#111827]">
                    Registrar Productor
                  </h2>
                  <p className="mt-1 text-sm font-medium leading-5 text-slate-500">
                    Completa los datos bÃ¡sicos para usarlo en esta compra.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cerrarModalProductor}
                  aria-label="Cerrar registro de productor"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              <div className="space-y-5 pb-6">
                <div>
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={productorForm.nombre}
                    onBlur={() => {
                      const nextForm = productorForm;
                      const message = validateProductorField('nombre', nextForm);
                      setProductorFormTouched((actual) => ({
                        ...actual,
                        nombre: true,
                      }));
                      setProductorFormErrors((actual) => ({
                        ...actual,
                        nombre: message ?? undefined,
                      }));
                    }}
                    onChange={(event) => {
                      setProductorForm((actual) => ({
                        ...actual,
                        nombre: event.target.value,
                      }));
                      setProductorFormErrors((actual) => ({
                        ...actual,
                        nombre: undefined,
                      }));
                      setProductorFormError(null);
                    }}
                    placeholder="Ej. Juan PÃ©rez RodrÃ­guez"
                    className={`w-full rounded-[14px] border px-4 py-3 text-[0.95rem] text-slate-900 outline-none transition-all focus:border-[#173ea6] focus:bg-white focus:ring-4 focus:ring-[#173ea6]/10 ${
                      productorFormErrors.nombre && productorFormTouched.nombre
                        ? 'border-rose-200 bg-rose-50/40'
                        : 'border-[#dde4f1] bg-[#f7f9fd]'
                    }`}
                  />
                  <ProductorHint>
                    Coloca su nombre y apellidos o el nombre de la empresa.
                  </ProductorHint>
                  {productorFormErrors.nombre && productorFormTouched.nombre ? (
                    <ProductorFieldError message={productorFormErrors.nombre} />
                  ) : null}
                </div>
                <div>
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    Tipo de documento
                  </label>
                  <ProductorHint>
                    Selecciona si el productor usa cédula o NIT.
                  </ProductorHint>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {[
                      { value: 'CEDULA', label: 'CÃ©dula' },
                      { value: 'NIT', label: 'NIT' },
                    ].map((item) => {
                      const active = productorForm.tipoDocumento === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            const nextForm = {
                              ...productorForm,
                              tipoDocumento: item.value as DocumentType,
                              documento: '',
                            };
                            setProductorForm((actual) => ({
                              ...actual,
                              tipoDocumento: item.value as DocumentType,
                              documento: '',
                            }));
                            setProductorFormTouched((actual) => ({
                              ...actual,
                              tipoDocumento: true,
                              documento: false,
                            }));
                            setProductorFormErrors((actual) => ({
                              ...actual,
                              tipoDocumento:
                                validateProductorField('tipoDocumento', nextForm) ??
                                undefined,
                              documento: undefined,
                            }));
                            setProductorFormError(null);
                          }}
                          className={`rounded-[14px] border px-3 py-3 text-sm font-black ${
                            active
                              ? 'border-[#102d92] bg-[#eef3ff] text-[#102d92]'
                              : 'border-[#dde4f1] bg-white text-slate-600'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                  {productorFormErrors.tipoDocumento &&
                  productorFormTouched.tipoDocumento ? (
                    <ProductorFieldError
                      message={productorFormErrors.tipoDocumento}
                    />
                  ) : null}
                </div>
                <div>
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    NÃºmero de documento
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={!productorForm.tipoDocumento}
                    maxLength={14}
                    value={productorForm.documento}
                    onBlur={() => {
                      const hasDocumentType = Boolean(productorForm.tipoDocumento);
                      const message = hasDocumentType
                        ? validateProductorField('documento', productorForm)
                        : null;
                      setProductorFormTouched((actual) => ({
                        ...actual,
                        documento: hasDocumentType,
                        tipoDocumento: true,
                      }));
                      setProductorFormErrors((actual) => ({
                        ...actual,
                        documento: message ?? undefined,
                        tipoDocumento:
                          validateProductorField(
                            'tipoDocumento',
                            productorForm,
                          ) ?? undefined,
                      }));
                    }}
                    onChange={(event) => {
                      setProductorForm((actual) => ({
                        ...actual,
                        documento: event.target.value,
                      }));
                      setProductorFormErrors((actual) => ({
                        ...actual,
                        documento: undefined,
                      }));
                      setProductorFormError(null);
                    }}
                    placeholder={getProductorDocumentPlaceholder(
                      productorForm.tipoDocumento,
                    )}
                    className={`w-full rounded-[14px] border px-4 py-3 text-[0.95rem] outline-none transition-all disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:placeholder:text-slate-400 ${
                      productorFormErrors.documento &&
                      productorFormTouched.documento
                        ? 'border-rose-200 bg-rose-50/40'
                        : 'border-[#dde4f1] bg-[#f7f9fd] text-slate-900 focus:border-[#173ea6] focus:bg-white focus:ring-4 focus:ring-[#173ea6]/10'
                    }`}
                  />
                  <ProductorHint>
                    {getProductorDocumentHelp(productorForm.tipoDocumento)}
                  </ProductorHint>
                  {productorFormErrors.documento &&
                  productorFormTouched.documento ? (
                    <ProductorFieldError message={productorFormErrors.documento} />
                  ) : null}
                </div>
                <div>
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    TelÃ©fono (opcional)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={12}
                    value={productorForm.telefono}
                    onBlur={() => {
                      const message = validateProductorField(
                        'telefono',
                        productorForm,
                      );
                      setProductorFormTouched((actual) => ({
                        ...actual,
                        telefono: true,
                      }));
                      setProductorFormErrors((actual) => ({
                        ...actual,
                        telefono: message ?? undefined,
                      }));
                    }}
                    onChange={(event) => {
                      setProductorForm((actual) => ({
                        ...actual,
                        telefono: formatPhoneNumber(event.target.value),
                      }));
                      setProductorFormErrors((actual) => ({
                        ...actual,
                        telefono: undefined,
                      }));
                      setProductorFormError(null);
                    }}
                    placeholder="Ej. 300 123 4567"
                    className={`w-full rounded-[14px] border px-4 py-3 text-[0.95rem] text-slate-900 outline-none transition-all focus:border-[#173ea6] focus:bg-white focus:ring-4 focus:ring-[#173ea6]/10 ${
                      productorFormErrors.telefono && productorFormTouched.telefono
                        ? 'border-rose-200 bg-rose-50/40'
                        : 'border-[#dde4f1] bg-[#f7f9fd]'
                    }`}
                  />
                  <ProductorHint>NÃºmero celular colombiano opcional.</ProductorHint>
                  {productorFormErrors.telefono &&
                  productorFormTouched.telefono ? (
                    <ProductorFieldError message={productorFormErrors.telefono} />
                  ) : null}
                </div>

                {productorFormError ? (
                  <ProductorGeneralError error={productorFormError} />
                ) : null}
              </div>
            </div>

            <div className="shrink-0 border-t border-[#eef2f7] bg-[#fbfcff] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              <button
                type="button"
                onClick={guardarProductorLocal}
                disabled={botonGuardarProductorPresionado}
                className="inline-flex w-full items-center justify-center rounded-[14px] bg-[#102d92] px-5 py-3.5 text-[0.95rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {botonGuardarProductorPresionado
                  ? 'Guardando productor...'
                  : 'Guardar Productor'}
              </button>
              <button
                type="button"
                onClick={cerrarModalProductor}
                className="mt-3 inline-flex w-full items-center justify-center px-5 py-2 text-[0.9rem] font-semibold text-slate-500"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {productorCreadoToast ? (
        <div
          role="status"
          aria-live="polite"
          className={`fixed inset-x-0 bottom-6 z-40 px-4 transition-all duration-300 ${
            productorCreadoToastExiting
              ? 'translate-y-2 opacity-0'
              : 'translate-y-0 opacity-100'
          }`}
        >
          <div className="mx-auto flex w-full max-w-[430px] items-center justify-between gap-3 rounded-[18px] border border-[#d9e2f5] bg-white px-4 py-3 text-sm text-slate-700 shadow-[0_18px_46px_rgba(15,23,42,0.18)]">
            <div className="min-w-0">
              <p className="font-bold text-slate-900">Productor creado</p>
              <p className="truncate text-xs text-slate-500">
                {productorCreadoToast.nombre}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                seleccionarProductor(productorCreadoToast);
                setProductorCreadoToast(null);
              }}
              className="shrink-0 rounded-full bg-[#eef2ff] px-3 py-2 text-xs font-bold text-[#102d92] transition hover:bg-[#dfe7ff]"
            >
              Usar este
            </button>
          </div>
        </div>
      ) : null}

      <AppBottomNav
        hidden={mostrarModalProductor || mostrarModalProductores || step >= 1}
      />
    </div>
  );
}

`n// Alerta 100% capacidad with editable kg`nconst MOSTRAR_MODAL_ALERTA100 = true;`nconst calcularExcedente = (totalKg: number, disponible: number) => Math.max(0, totalKg - disponible);`nconst manejarAjusteKg = (nuevoValor: string, onAceptar: (valor: number) => void) => { const val = parseFloat(nuevoValor); if (!isNaN(val) && val > 0) onAceptar(val); };`n
const MOSTRAR_MODAL_ALERTA100=true;
const calcularExcedente=(t:number,d:number)=>Math.max(0,t-d);
