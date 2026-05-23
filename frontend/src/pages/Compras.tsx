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
  History,
  IdCard,
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
import { AppFeedbackMessage } from '../components/AppFeedbackMessage';
import { SmartSelect } from '../components/SmartSelect';
import { CafeSmartErrorState } from '../components/CafeSmartErrorState';
import { InternalLoadingScreen } from '../components/InternalLoadingScreen';
import { TransactionSuccessScreen } from '../components/TransactionSuccessScreen';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
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
import { createOfflineDraft } from '../services/offlineDraftService';
import { addSyncOperation } from '../services/syncQueueService';
import {
  guardarConfiguracionBodega,
  obtenerConfiguracionBodega,
} from '../services/bodegaApi';
import {
  crearCompra,
  listarCompras,
  obtenerCatalogosCompra,
  validarCapacidadCompra,
  type CatalogoItem,
  type CatalogosCompra,
  type CompraListadoItem,
  type CreateCompraPayload,
  type EstadoCapacidadCompra,
} from '../services/comprasService';
import {
  actualizarProductor,
  crearProductor,
  listarProductores,
  type ProductorItem,
} from '../services/productoresService';
import { PRECIO_MINIMO_KG } from '../utils/businessRules';
import { fuzzySearch, useDebouncedValue } from '../utils/fuzzySearch';
import {
  formatPhoneNumber,
  normalizeCompanyName,
  normalizeHumanName,
  sanitizeDigits as sanitizePersonDigits,
  type DocumentType,
  validateCompanyName,
  validatePhoneNumber,
} from '../utils/personValidation';
import { sanitizeSearchInput } from '../utils/inputLimits';

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

type BodegaBloqueada = {
  capacidadKg: number;
  inventarioKg: number;
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
    'Para compras rápidas o productores ocasionales no registrados en el sistema.',
  rapido: true,
};
const LIMITE_PRODUCTORES_RECIENTES = 2;
const PRODUCTOR_SORT_OPTIONS: Array<{
  value: ProductorSortMode;
  label: string;
}> = [
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
    return 'Ingresa la cédula sin puntos ni espacios.';
  }

  if (tipoDocumento === 'NIT') {
    return 'Ingresa el NIT sin puntos ni guiones.';
  }

  return 'Primero selecciona cédula o NIT.';
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

function getProductorNameError(value: string, tipoDocumento?: ProductorForm['tipoDocumento']) {
  if (tipoDocumento === 'NIT') {
    const empresa = validateCompanyName(value);
    return empresa.isValid ? null : empresa.message ?? 'Revisa el nombre de la empresa.';
  }

  const nombre = value.trim();

  if (!nombre) {
    return 'Ingresa el nombre del productor.';
  }

  if (/\d/.test(nombre)) {
    return 'El nombre no debe contener números.';
  }

  if (nombre.length < 3 || nombre.split(/\s+/).join('').length < 3) {
    return 'Escribe un nombre más completo.';
  }

  if (nombre.length > 60) {
    return 'El nombre no puede pasar de 60 caracteres.';
  }

  if (/[@$%*=*?¿!¡#_/\\.,()[\]{}]/.test(nombre) || !/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]+$/.test(nombre)) {
    return 'No uses símbolos especiales.';
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
    return 'Ingresa el número de documento.';
  }

  if (/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(documento)) {
    return tipoDocumento === 'NIT'
      ? 'El NIT solo puede contener números.'
      : 'La cédula solo puede contener números.';
  }

  if (/[\s.\-]/.test(documento) || /[^\d]/.test(documento)) {
    return 'El documento contiene caracteres no permitidos.';
  }

  if (tipoDocumento === 'CEDULA' && documento.length < 6) {
    return 'La cédula tiene muy pocos números.';
  }

  if (tipoDocumento === 'CEDULA' && documento.length > 10) {
    return 'La cédula supera la cantidad permitida de dígitos.';
  }

  if (tipoDocumento === 'NIT' && documento.length < 8) {
    return 'El NIT tiene muy pocos números.';
  }

  if (tipoDocumento === 'NIT' && documento.length > 10) {
    return 'El NIT supera la cantidad permitida de dígitos.';
  }

  if (/^(\d)\1+$/.test(documento)) {
    return tipoDocumento === 'NIT'
      ? 'El NIT no puede repetir el mismo número.'
      : 'La cédula no puede repetir el mismo número.';
  }

  return null;
}

function getProductorPhoneError(value: string) {
  const telefono = validatePhoneNumber(value, 'El teléfono', {
    optional: true,
  });

  return telefono.isValid ? null : telefono.message ?? 'Revisa el número celular.';
}

function validateProductorField(
  field: ProductorFormField,
  form: ProductorForm,
) {
  if (field === 'nombre') {
    return getProductorNameError(form.nombre, form.tipoDocumento);
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
    <AppFeedbackMessage
      variant="error"
      description={message}
      className="mt-2"
    />
  );
}

function ProductorGeneralError({ error }: { error: ProductorModalError }) {
  return (
    <AppFeedbackMessage
      variant="error"
      title={error.title}
      description={error.description}
    />
  );
}

function ProductorStepAlert({
  message,
  exiting,
  anchorRef,
}: {
  message: string;
  exiting: boolean;
  anchorRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <AppFeedbackMessage
      ref={anchorRef}
      variant="error"
      title="Elige una opción para continuar."
      description={message}
      aria-live="polite"
      className={`${
        exiting
          ? 'translate-y-1 opacity-0'
          : 'translate-y-0 opacity-100'
      }`}
    />
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
    <AppFeedbackMessage
      variant="warning"
      description={message}
      className={`mt-2 ${
        exiting ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    />
  );
}

function TransientFormAlert({
  message,
  exiting,
  anchorRef,
}: {
  message: GuidedErrorMessage;
  exiting: boolean;
  anchorRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={anchorRef}
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
          'Estamos procesando mucha información. Intenta nuevamente en unos minutos.',
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
          'Ocurrió un problema temporal. Intenta nuevamente en unos minutos.',
      };
    }
  }

  return {
    title: 'No pudimos registrar el productor.',
    description:
      'Ocurrió un problema temporal. Intenta nuevamente en unos minutos.',
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
    return 'Compra rápida';
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
  onDetail,
  onEdit,
}: {
  productor: ProductorOption;
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

function CoffeeTypeDropdown({
  id,
  value,
  options,
  error,
  open,
  disabled,
  onToggle,
  onClose,
  onChange,
}: {
  id: string;
  value: string;
  options: CatalogoItem[];
  error?: boolean;
  open: boolean;
  disabled?: boolean;
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
        onClick={() => {
          if (!disabled) {
            onToggle();
          }
        }}
        disabled={disabled}
        className={`flex min-h-[58px] w-full items-center justify-between gap-3 rounded-[18px] border bg-white px-4 py-3.5 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/15 ${
          disabled
            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
            : error
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
              {selected?.nombre ?? 'Selecciona una opción'}
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
        className={`mt-2 flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-2 rounded-[13px] border bg-[#f8f9ff] px-3 py-2 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition hover:border-[#9fb0d4] hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/10 ${
          open ? 'border-[#102d92] bg-white' : 'border-[#d8e0ee]'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-black leading-none text-[#08256d]">
          {value ? formatLongDateLabel(value) : 'Selecciona una fecha'}
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
          className="absolute left-1/2 right-auto z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[18px] border border-[#d5deee] bg-white p-2 shadow-[0_18px_38px_rgba(15,23,42,0.16)]"
        >
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => setVisibleMonth(previousMonth)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#102d92] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:text-slate-300"
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
                className={`rounded-full px-2.5 py-1 text-xs font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/15 ${
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
                className={`rounded-full px-2.5 py-1 text-xs font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/15 ${
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#102d92] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:text-slate-300"
              aria-label="Mes siguiente"
            >
              <ArrowRight size={17} />
            </button>
          </div>

          {calendarView === 'months' ? (
            <div className="grid grid-cols-3 gap-1.5 px-1 py-1">
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
                      if (!disabled) {
                        setVisibleMonth(new Date(visibleYear, monthIndex, 1));
                        setCalendarView('days');
                      }
                    }}
                    className={`min-h-[36px] rounded-[12px] px-2 text-[0.7rem] font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/15 disabled:cursor-not-allowed disabled:text-slate-300 ${
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
            <div className="grid max-h-44 grid-cols-3 gap-1.5 overflow-y-auto px-1 py-1">
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
                    className={`min-h-[36px] rounded-[12px] px-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/15 ${
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
                  className={`h-8 rounded-full text-xs font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/15 disabled:cursor-not-allowed disabled:text-slate-300 ${
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
const WEEKDAYS_ES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
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

function formatLongDateLabel(value: string) {
  const date = parseLocalDateValue(value);
  if (!date) return '';
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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
    return { valor: 0, error: 'Ingresa solo números.' };
  }

  const numero = parseNumeroCompra(texto, { decimal: true });
  if (!Number.isFinite(numero)) {
    return { valor: 0, error: 'Ingresa solo números.' };
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
    return { valor: 0, error: 'Ingresa solo números.' };
  }

  const numero = parseNumeroCompra(texto);
  if (!Number.isFinite(numero)) {
    return { valor: 0, error: 'Ingresa solo números.' };
  }

  if (numero < PRECIO_MINIMO_KG) {
    return { valor: numero, error: 'El precio por kilo es demasiado bajo.' };
  }

  if (numero > PRECIO_MAXIMO_KG) {
    return {
      valor: numero,
      error: `El precio máximo permitido es ${formatoMoneda(
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

function calcularInventarioCompras(compras: CompraListadoItem[]) {
  return compras.reduce(
    (total, compra) =>
      total +
      compra.sublotes.reduce(
        (subtotal, sublote) => subtotal + Math.max(0, Number(sublote.pesoActual) || 0),
        0,
      ),
    0,
  );
}

function resolverBodegaBloqueada(
  capacidadKg: number | null | undefined,
  compras: CompraListadoItem[],
): BodegaBloqueada | null {
  if (!capacidadKg || !Number.isFinite(capacidadKg) || capacidadKg <= 0) {
    return null;
  }

  const inventarioKg = calcularInventarioCompras(compras);
  return inventarioKg >= capacidadKg ? { capacidadKg, inventarioKg } : null;
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

function getCompraErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return 'Revisa la conexión a internet y vuelve a intentarlo.';
    }

    if (error.status >= 500) {
      return 'Puede ser una falla temporal. Revisa tu conexión e intenta de nuevo.';
    }

    if (error.code === 'COMPRA_CANTIDAD_INVALIDA') {
      return 'La cantidad debe ser mayor a cero.';
    }

    if (error.code === 'COMPRA_CANTIDAD_NO_NUMERICA') {
      return 'Ingresa solo números.';
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
      return 'Selecciona un tipo de café para continuar.';
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
  excludeId?: string,
) {
  const key = clavePersona(nombre, documento);
  return productores.find(
    (productor) =>
      productor.id !== excludeId &&
      clavePersona(productor.nombre, productor.documento) === key,
  );
}

function clave(nombre: string) {
  return nombre.trim().toUpperCase();
}

function formatCatalogName(nombre: string) {
  const normalized = normalizeSearchText(nombre).trim();
  if (normalized === 'verde') return 'Verde';
  if (normalized === 'seco') return 'Seco';
  if (normalized === 'pasilla') return 'Pasilla';
  if (normalized === 'trillado') return 'Trillado';
  if (normalized === 'bueno') return 'Bueno';
  if (normalized === 'regular') return 'Regular';
  if (normalized === 'malo') return 'Malo';
  return nombre
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(^|\s)\S/g, (match) => match.toUpperCase());
}

function normalizeCatalogText(value: string) {
  return normalizeSearchText(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

function dedupeCatalogItems(items: CatalogoItem[]) {
  const usedIds = new Set<string>();
  const usedNames = new Set<string>();

  return items.reduce<CatalogoItem[]>((result, item) => {
    const id = item.id?.trim();
    const nameKey = normalizeCatalogText(item.nombre);
    const duplicate = Boolean(id && usedIds.has(id)) || usedNames.has(nameKey);

    if (duplicate || !nameKey) {
      return result;
    }

    if (id) usedIds.add(id);
    usedNames.add(nameKey);
    result.push({
      ...item,
      nombre: formatCatalogName(item.nombre),
    });
    return result;
  }, []);
}

function ordenarCatalogos(items: CatalogoItem[], ordenBase: string[]) {
  return dedupeCatalogItems(items).sort((a, b) => {
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
      descripcion: 'Seleccione el productor para iniciar el pesaje del café.',
      progreso: 33,
    };
  }
  if (step === 2) {
    return {
      chip: 'Paso 2 de 3',
      titulo: 'Seleccionar café',
      descripcion: 'Completa tipo de café, calidad, peso y precio por kilo.',
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
      'El nombre debe escribirse con letras y sin números.',
      'Completa el nombre para continuar.',
    );
  }

  if (normalizedMessage.includes('telefono')) {
    return createGuidedError(
      message,
      'Revisa el teléfono.',
      'Debe ser un celular colombiano de 10 dígitos que empieza por 3.',
      'Corrige el número o deja el campo vacío.',
    );
  }

  if (
    normalizedMessage.includes('cedula') ||
    normalizedMessage.includes('identificacion') ||
    normalizedMessage.includes('documento') ||
    normalizedMessage.includes('nit')
  ) {
    if (normalizedMessage.includes('ingresa')) {
      return createGuidedError(
        message,
        'Falta el documento.',
        'Ingresa el número de documento.',
        'Escribe solo los dígitos del documento.',
      );
    }

    if (normalizedMessage.includes('solo puede contener números')) {
      return createGuidedError(
        message,
        'Documento inválido.',
        message,
        'Borra letras y deja únicamente números.',
      );
    }

    if (normalizedMessage.includes('caracteres no permitidos')) {
      return createGuidedError(
        message,
        'Documento con formato inválido.',
        'El documento contiene caracteres no permitidos.',
        'Ingresa el documento solo con números.',
      );
    }

    if (normalizedMessage.includes('supera') || normalizedMessage.includes('permitida')) {
      return createGuidedError(
        message,
        'Documento demasiado largo.',
        message,
        'Quita los dígitos sobrantes e intenta de nuevo.',
      );
    }

    if (normalizedMessage.includes('repetir') || normalizedMessage.includes('mismo número')) {
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
      'Revisa el número de documento.',
      'Corrige el dato marcado para continuar.',
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
      'La compra debe tener café.',
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
      'No logramos cargar los tipos de café.',
      'Recarga la aplicación e intenta de nuevo.',
    );
  }

  if (normalizedMessage.includes('tipo de cafe')) {
    return createGuidedError(
      message,
      'Falta el tipo de café.',
      'Selecciona un tipo de café para continuar.',
      'Toca el campo "Tipo de café" y elige una opción.',
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
      'Falta el peso del café.',
      'Escribe la cantidad de café en kilogramos.',
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
      'El peso supera el límite.',
      'La cantidad supera el espacio disponible en bodega.',
      'Ingresa una cantidad menor para continuar.',
    );
  }

  if (normalizedMessage.includes('ingresa solo numeros')) {
    return createGuidedError(
      message,
      'Usa solo números.',
      'El campo no acepta letras ni símbolos.',
      'Borra el carácter incorrecto e intenta nuevamente.',
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
      'Ingresa un precio más realista para el café.',
    );
  }

  if (normalizedMessage.includes('selecciona un productor')) {
    return createGuidedError(
      message,
      'Falta seleccionar el productor.',
      'Debemos saber a quién corresponde la compra.',
      'Selecciona Productor Generico o uno de la lista.',
    );
  }

  return createGuidedError(
    message,
    'Revisa este dato.',
    'Hay información pendiente por completar.',
    'Corrige el campo señalado para continuar.',
  );
}

export default function Compras() {
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatus();
  const savingRef = useRef(false);
  const compraLocalIdRef = useRef<string | null>(null);
  const latestCompraDraftRef = useRef<
    Omit<CompraDraft, 'version' | 'savedAt'> | null
  >(null);
  const productoresSearchRef = useRef<HTMLInputElement | null>(null);
  const productorFeedbackRef = useRef<HTMLDivElement | null>(null);
  const formFeedbackRef = useRef<HTMLDivElement | null>(null);
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
  const [productorDetalle, setProductorDetalle] =
    useState<ProductorOption | null>(null);
  const [productorEditando, setProductorEditando] =
    useState<ProductorOption | null>(null);
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
  const [catalogosError, setCatalogosError] = useState<string | null>(null);
  const [catalogosFeedback, setCatalogosFeedback] = useState<string | null>(
    null,
  );
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
  const [panelBodegaVisible, setPanelBodegaVisible] = useState(true);
  const panelBodegaTimeoutRef = useRef<number | null>(null);
  const mostrarPanelBodega = checkingCapacidadPreview || Boolean(capacidadPrevia?.validada);
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

  useEffect(() => {
    if (panelBodegaTimeoutRef.current) {
      window.clearTimeout(panelBodegaTimeoutRef.current);
      panelBodegaTimeoutRef.current = null;
    }

    if (mostrarPanelBodega && panelBodegaVisible) {
      panelBodegaTimeoutRef.current = window.setTimeout(() => {
        setPanelBodegaVisible(false);
        panelBodegaTimeoutRef.current = null;
      }, 5000);
    }

    return () => {
      if (panelBodegaTimeoutRef.current) {
        window.clearTimeout(panelBodegaTimeoutRef.current);
        panelBodegaTimeoutRef.current = null;
      }
    };
  }, [mostrarPanelBodega, panelBodegaVisible]);
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
  const [productorDocumentoDropdownOpen, setProductorDocumentoDropdownOpen] =
    useState(false);
  const [productorFiltroDropdownOpen, setProductorFiltroDropdownOpen] =
    useState(false);
  const [compraGuardada, setCompraGuardada] =
    useState<CompraGuardadaResumen | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [borradorPendiente, setBorradorPendiente] =
    useState<CompraDraft | null>(null);
  const [mostrarModalBorrador, setMostrarModalBorrador] = useState(false);
  const [comprasRealizadas, setComprasRealizadas] = useState<CompraListadoItem[]>([]);
  const [bodegaBloqueada, setBodegaBloqueada] =
    useState<BodegaBloqueada | null>(null);
  const [mostrarHistorialCompras, setMostrarHistorialCompras] = useState(false);
  const [historialCompraFecha, setHistorialCompraFecha] = useState('');
  const [historialCompraFechaPickerOpen, setHistorialCompraFechaPickerOpen] =
    useState(false);
  const [historialCompraProductor, setHistorialCompraProductor] = useState('TODOS');
  const [historialCompraOrden, setHistorialCompraOrden] = useState<'recent' | 'oldest'>('recent');
  const [mostrarHistorialSublotes, setMostrarHistorialSublotes] =
    useState(false);
  const [botonGuardarProductorPresionado, setBotonGuardarProductorPresionado] =
    useState(false);
  const [productorCreadoToast, setProductorCreadoToast] =
    useState<ProductorOption | null>(null);
  const [productorCreadoToastExiting, setProductorCreadoToastExiting] =
    useState(false);

  const cargarTodo = async () => {
    setLoading(true);
    setError(null);
    setCatalogosError(null);
    setCatalogosFeedback(null);
    setMostrarErrorFormulario(false);
    try {
      const [catalogosData, productoresData, comprasData, bodegaData] = await Promise.all([
        obtenerCatalogosCompra(),
        listarProductores(),
        listarCompras(),
        obtenerConfiguracionBodega(),
      ]);
      setCatalogos(catalogosData);
      setProductores(
        dedupeProductorOptions(productoresData.map(mapProductorToOption)),
      );
      setComprasRealizadas(comprasData);
      setBodegaBloqueada(
        resolverBodegaBloqueada(bodegaData.capacidadKg, comprasData),
      );
      setCatalogosFeedback('Opciones cargadas.');
    } catch (err) {
      console.warn('No se pudo cargar toda la informacion de compras:', err);
      setCatalogosError('No pudimos cargar las opciones.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarTodo();
  }, []);

  useEffect(() => {
    if (!catalogosFeedback) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCatalogosFeedback(null);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [catalogosFeedback]);

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
    () => new Map(tiposCafe.map((item) => [item.id, item.nombre])),
    [tiposCafe],
  );
  const nombreCalidadPorId = useMemo(
    () => new Map(calidades.map((item) => [item.id, item.nombre])),
    [calidades],
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
  const busquedaProductorModalDebounced = useDebouncedValue(busquedaProductorModal);
  const productoresModalFiltrados = useMemo(() => {
    const resultado = fuzzySearch(
      productores,
      busquedaProductorModalDebounced,
      (productor) => [
        productor.nombre,
        productor.documento,
        productor.detalle,
        productor.telefono ?? '',
      ],
    );

    return sortProductores(
      dedupeProductorOptions([...resultado.items]),
      productorSortMode,
    );
  }, [busquedaProductorModalDebounced, productorSortMode, productores]);
  const productoresModalUsaSimilares = useMemo(
    () =>
      fuzzySearch(
        productores,
        busquedaProductorModalDebounced,
        (productor) => [
          productor.nombre,
          productor.documento,
          productor.detalle,
          productor.telefono ?? '',
        ],
      ).isSimilar,
    [busquedaProductorModalDebounced, productores],
  );
  const historialCompraProductores = useMemo(() => {
    const options = new Map<string, string>();
    options.set('TODOS', 'Todos');
    options.set('NO_REGISTRADO', 'Productor no registrado');
    comprasRealizadas.forEach((compra) => {
      const nombre = compra.productorNombre?.trim();
      if (nombre) options.set(nombre, nombre);
    });
    return Array.from(options.entries());
  }, [comprasRealizadas]);
  const comprasHistorialFiltradas = useMemo(() => {
    const sameDate = (value: string) => value.slice(0, 10) === historialCompraFecha;
    return [...comprasRealizadas]
      .filter((compra) => !historialCompraFecha || sameDate(compra.fecha))
      .filter((compra) => {
        if (historialCompraProductor === 'TODOS') return true;
        const isNoRegistrado = !compra.productorNombre || compra.productorNombre === 'Productor General';
        if (historialCompraProductor === 'NO_REGISTRADO') return isNoRegistrado;
        return compra.productorNombre === historialCompraProductor;
      })
      .sort((a, b) =>
        historialCompraOrden === 'oldest'
          ? new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
          : new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      );
  }, [
    comprasRealizadas,
    historialCompraFecha,
    historialCompraOrden,
    historialCompraProductor,
  ]);
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

  const desplazarAlFeedback = (
    ref: React.RefObject<HTMLDivElement | null>,
  ) => {
    window.setTimeout(() => {
      ref.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 80);
  };

  const mostrarErrorPaso = (mensaje: string, targetStep?: Step) => {
    if (targetStep) {
      setStep(targetStep);
    }
    setFormAlertExiting(false);
    setMostrarErrorFormulario(true);
    setError(mensaje);
    desplazarAlFeedback(formFeedbackRef);
  };

  const mostrarErrorProductor = (mensaje: string) => {
    setProductorStepAlert(null);
    window.setTimeout(() => {
      setProductorStepAlert(mensaje);
      desplazarAlFeedback(productorFeedbackRef);
    }, 0);
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
      mostrarErrorPaso('Completa este cafe antes de agregar otro.', 2);
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
    setProductorEditando(null);
    setProductorFormErrors({});
    setProductorFormTouched({});
    setProductorForm(PRODUCTOR_FORM_EMPTY);
    setMostrarModalProductor(true);
  };

  const cerrarModalProductor = () => {
    setMostrarModalProductor(false);
    setProductorForm(PRODUCTOR_FORM_EMPTY);
    setProductorFormError(null);
    setProductorEditando(null);
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
    const nombre = getProductorNameError(
      productorForm.nombre,
      productorForm.tipoDocumento,
    );
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
    const nombre =
      productorForm.tipoDocumento === 'NIT'
        ? normalizeCompanyName(productorForm.nombre)
        : normalizeHumanName(productorForm.nombre);
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
      productorEditando?.id,
    );
    if (productorExistente) {
      setProductorFormErrors((actual) => ({
        ...actual,
        documento: 'Este documento ya está registrado.',
      }));
      setProductorFormTouched((actual) => ({
        ...actual,
        documento: true,
      }));
      setProductorFormError({
        title: 'Este documento ya está registrado.',
        description: 'Busca el registro existente o usa otro número.',
      });
      return;
    }

    setBotonGuardarProductorPresionado(true);

    try {
      const payload = {
        nombre,
        documento,
        tipoDocumento,
        telefono: telefono || undefined,
      };
      const productorGuardado = productorEditando
        ? await actualizarProductor(productorEditando.id, payload)
        : await crearProductor(payload);

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
      setProductorEditando(null);
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
    setFecha(hoyLocal());
    clearCompraDraft();
    setBorradorPendiente(null);
    setMostrarModalBorrador(false);
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
      return 'Aún no hay catálogos disponibles para registrar la compra.';
    }
    for (const [index, sublote] of sublotes.entries()) {
      if (!sublote.tipoCafeId)
        return 'Selecciona un tipo de café para continuar.';
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
    if (bodegaBloqueada) {
      return;
    }
    if (step === 1) {
      if (!productorSelectionMode) {
        mostrarErrorProductor(
          'Selecciona un productor o una forma de registro.',
        );
        return;
      }

      if (!productorSeleccionado) {
        mostrarErrorProductor(
          productorSelectionMode === 'registrar'
            ? 'Registra el productor para poder asociarlo a esta compra.'
            : 'Selecciona un productor de la lista para continuar.',
        );
        return;
      }

      setProductorStepAlert(null);
      setStep(2);
      return;
    }
    if (step === 2) {
      if (loading || checkingCapacidadPreview) {
        mostrarErrorPaso(
          'Estamos validando la información. Intenta de nuevo en un momento.',
          2,
        );
        return;
      }

      if (catalogosError && (tiposCafe.length === 0 || calidades.length === 0)) {
        mostrarErrorPaso(
          'No pudimos continuar. Revisa la información o vuelve a intentarlo.',
          2,
        );
        return;
      }

      const mensajeValidacion = validarSublotes();
      if (mensajeValidacion) {
        mostrarErrorPaso(mensajeValidacion, 2);
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
        // No abrir modal automáticamente, usar capacidad por defecto
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

      if (capacidad.nivel === 'alerta' && !alerta80Mostrada) {
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

  const irAEditarBodega = () => {
    navigate('/ajustes', { state: { openBodega: true } });
  };

  const abrirConfirmacionCompra = async () => {
    setRegistroErrorMensaje(null);
    setError(null);
    setMostrarErrorFormulario(false);

    if (bodegaBloqueada) {
      return;
    }

    if (!productorSeleccionado) {
      mostrarErrorPaso('Selecciona un productor para continuar.', 1);
      return;
    }

    const mensajeValidacion = validarSublotes();
    if (mensajeValidacion) {
      mostrarErrorPaso(mensajeValidacion, 2);
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

    if (bodegaBloqueada) {
      savingRef.current = false;
      setSaving(false);
      return;
    }

    if (!productorSeleccionado) {
      savingRef.current = false;
      setSaving(false);
      mostrarErrorPaso('Selecciona un productor para continuar.', 1);
      return;
    }
    const mensajeValidacion = validarSublotes();
    if (mensajeValidacion) {
      savingRef.current = false;
      setSaving(false);
      mostrarErrorPaso(mensajeValidacion, 2);
      return;
    }

    await esperarPintadoInterfaz();

    try {
      const payload = await construirPayloadCompra();

      if (isOffline) {
        addSyncOperation({
          idLocal: payload.localId,
          clientMutationId: payload.localId,
          deviceId: payload.deviceId,
          modulo: 'COMPRA',
          endpoint: '/compras',
          method: 'POST',
          payload,
        });
        await createOfflineDraft('COMPRA', {
          ...payload,
          idLocal: payload.localId,
          createdAt: new Date().toISOString(),
          formState: {
            step,
            fecha,
            sublotes,
            subloteActivoId,
            productorSeleccionado,
            productorSelectionMode,
          },
        });
        latestCompraDraftRef.current = {
          version: 1,
          savedAt: Date.now(),
          step,
          fecha,
          sublotes,
          subloteActivoId,
          productorSeleccionado,
          productorSelectionMode,
          compraLocalId: payload.localId,
        };
        setMostrarModalConfirmar(false);
        setCatalogosFeedback(
          'Borrador guardado. Tu información quedó guardada en este dispositivo.',
        );
        return;
      }

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
            tipoCafe: nombreTipoCafePorId.get(sublote.tipoCafeId) ?? 'Café',
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

  if (saving) {
    return (
      <InternalLoadingScreen
        title="Guardando compra"
        description="Espera un momento. Estamos registrando la compra."
        warningText="No cierres la aplicación durante el registro."
        securityTitle="Tus datos están protegidos"
        securityDescription="Estamos validando y guardando la compra de forma segura."
      />
    );
  }

  if (compraGuardada) {
    return (
      <TransactionSuccessScreen
        title="Compra registrada con éxito"
        message="La compra fue guardada correctamente en el sistema."
        info="El movimiento quedó disponible en tus registros de compra."
        totalLabel="Total pagado"
        totalValue={formatoMoneda(compraGuardada.totalCompra)}
        primaryLabel="Registrar otra compra"
        onPrimary={iniciarNuevaCompra}
        onHome={() => navigate('/inicio')}
        rows={[
          {
            icon: '1',
            label: 'Productor',
            value: compraGuardada.productorNombre,
          },
          {
            icon: <Warehouse size={16} />,
            label: 'Total kg',
            value: `${Math.round(compraGuardada.totalKg)} kg`,
          },
        ]}
        capacityNotice={
          compraGuardada.capacidad &&
          compraGuardada.capacidad.nivel !== 'normal' ? (
            <AppFeedbackMessage
              variant="warning"
              title={
                compraGuardada.capacidad.validada
                  ? 'Capacidad de bodega validada'
                  : 'Sin validación de capacidad'
              }
              description={compraGuardada.capacidad.mensaje}
              autoClose
              duration={5000}
              fadeDuration={500}
            />
          ) : undefined
        }
      />
    );
  }

  if (registroErrorMensaje) {
    return (
      <CafeSmartErrorState
        fullScreen
        title="No se pudo guardar la compra"
        message={registroErrorMensaje}
        info="Los datos de la compra siguen disponibles. Puedes volver a editar o intentar nuevamente."
        secondaryLabel="Volver a editar"
        onPrimary={() => void guardarCompra()}
        onSecondary={volverDesdeError}
        primaryBusy={saving}
      />
    );
  }

  if (bodegaBloqueada) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-8 text-slate-900">
        <section
          role="alertdialog"
          aria-labelledby="bodega-llena-title"
          aria-describedby="bodega-llena-message"
          className="w-full max-w-[430px] rounded-[28px] border border-[#e5e9f5] bg-white p-5 text-center shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fff7ed] text-[#ea580c]">
            <AlertTriangle size={30} strokeWidth={2.4} aria-hidden="true" />
          </div>
          <h1
            id="bodega-llena-title"
            className="mt-5 text-[1.65rem] font-black leading-tight text-slate-950"
          >
            Tu bodega está llena
          </h1>
          <p
            id="bodega-llena-message"
            className="mx-auto mt-3 max-w-[340px] text-sm font-semibold leading-6 text-slate-500"
          >
            La capacidad de tu bodega llegó al 100%. No puedes realizar más
            compras hasta liberar espacio o ampliar la capacidad.
          </p>
          <div className="mt-5 rounded-[18px] border border-[#dbe7ff] bg-[#f5f9ff] px-4 py-3 text-left">
            <div className="flex items-center justify-between gap-3 text-sm font-bold text-slate-600">
              <span>Capacidad</span>
              <span className="text-slate-950">
                {formatoKg(bodegaBloqueada.capacidadKg)} kg
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-sm font-bold text-slate-600">
              <span>En bodega</span>
              <span className="text-[#102d92]">
                {formatoKg(bodegaBloqueada.inventarioKg)} kg
              </span>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => navigate('/ventas')}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white shadow-[0_14px_28px_rgba(16,45,146,0.22)] transition hover:bg-[#1b3f9d]"
            >
              Ir a vender
            </button>
            <button
              type="button"
              onClick={irAEditarBodega}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] border border-[#cdd8ef] bg-white px-4 text-sm font-black text-[#102d92] transition hover:bg-[#f5f9ff]"
            >
              Editar bodega
            </button>
            <button
              type="button"
              onClick={() => navigate('/inicio')}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Ir a inicio
            </button>
          </div>
        </section>
      </main>
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
            Registro de Compra
          </h1>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between text-[1.05rem] font-medium text-slate-900">
            <span>
              {step === 2
                ? 'Paso 2: Seleccionar café'
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
              Selecciona cómo deseas elegir el productor
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
                      Productores registrados
                    </p>
                    <p className="mt-1 text-sm font-medium leading-5 text-slate-500">
                      Máximo 2 recientes
                    </p>
                  </div>
                  <span
                    className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] px-2 text-sm font-black text-[#1f3fa7] shadow-[0_8px_18px_rgba(31,63,167,0.14)]"
                    aria-label={`${productoresOrdenadosRecientes.length} productores registrados`}
                  >
                    {productoresOrdenadosRecientes.length}
                  </span>
                </div>

                {sinProductoresRegistrados ? (
                  <div className="rounded-[16px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-5 text-center text-sm text-slate-500">
                    <p className="font-bold text-slate-800">
                      Aún no tienes productores registrados.
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

                {!sinProductoresRegistrados && productoresOrdenadosRecientes.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setMostrarModalProductores(true)}
                    className="group flex min-h-[52px] w-full items-center justify-between rounded-[16px] border border-[#dbe2f0] bg-white px-4 py-3 text-left text-sm font-black text-[#1f3fa7] shadow-[0_10px_22px_rgba(15,23,42,0.04)] transition duration-200 hover:border-[#1f3fa7]/40 hover:bg-[#f4f7ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/15"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eef4ff] transition group-hover:bg-white">
                        <Search size={16} />
                      </span>
                      Ver todos →
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
              title="Productor genérico"
              subtitle="Compra rápida sin registrar productor"
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
                            ? 'Compra rápida'
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
                anchorRef={productorFeedbackRef}
              />
            ) : null}

            {error && mostrarErrorFormulario ? (
              <TransientFormAlert
                message={getComprasGuidance(error)}
                exiting={formAlertExiting}
                anchorRef={formFeedbackRef}
              />
            ) : null}

            <button
              type="button"
              onClick={irSiguientePaso}
              disabled={loading}
              aria-disabled={productorSeleccionado ? 'false' : 'true'}
              className="inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[16px] bg-[#1f3fa7] px-5 py-4 text-[1.1rem] font-semibold text-white shadow-[0_12px_28px_rgba(16,45,146,0.26)] transition disabled:cursor-wait disabled:opacity-70"
            >
              {loading ? (
                <>
                  <LoaderCircle size={20} className="animate-spin" />
                  Cargando...
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
                  ? 'Selecciona el tipo de café de este sublote.'
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
              const capacidadOcupacionPorcentaje =
                capacidadPrevia?.validada &&
                typeof capacidadPrevia.porcentajeOcupacion === 'number' &&
                Number.isFinite(capacidadPrevia.porcentajeOcupacion)
                  ? Math.min(100, Math.max(0, capacidadPrevia.porcentajeOcupacion))
                  : porcentajeDisponibleDespues !== null
                    ? Math.min(100, Math.max(0, 100 - porcentajeDisponibleDespues))
                    : null;
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
                      Tipo de café
                    </p>
                    <CoffeeTypeDropdown
                      id={sublote.id}
                      value={sublote.tipoCafeId}
                      options={tiposCafe}
                      error={Boolean(tipoCafeError)}
                      disabled={loading || tiposCafe.length === 0}
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
                    {loading && tiposCafe.length === 0 ? (
                      <div className="mt-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <p className="font-black text-slate-900">Cargando tipos de café...</p>
                        <p className="mt-1 leading-5">Espera un momento mientras cargamos las opciones.</p>
                      </div>
                    ) : catalogosError && tiposCafe.length === 0 ? (
                      <AppFeedbackMessage
                        variant="error"
                        title="No pudimos continuar"
                        description="Revisa la información o vuelve a intentarlo."
                        className="mt-3"
                      >
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void cargarTodo()}
                            disabled={loading}
                            className="inline-flex min-h-[38px] items-center rounded-[12px] bg-[#102d92] px-3 py-2 text-sm font-black text-white transition hover:bg-[#18358f] disabled:cursor-wait disabled:opacity-70"
                          >
                            {loading ? 'Cargando...' : 'Reintentar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate('/inicio')}
                            className="inline-flex min-h-[38px] items-center rounded-[12px] border border-rose-200 bg-white px-3 py-2 text-sm font-black text-rose-800 transition hover:bg-rose-50"
                          >
                            Volver
                          </button>
                        </div>
                      </AppFeedbackMessage>
                    ) : catalogosFeedback ? (
                      <AppFeedbackMessage
                        variant="success"
                        description={catalogosFeedback}
                        className="mt-3"
                      />
                    ) : null}
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
                    {loading && calidades.length === 0 ? (
                      <div className="mt-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <p className="font-black text-slate-900">Cargando calidades...</p>
                        <p className="mt-1 leading-5">Espera un momento mientras cargamos las opciones.</p>
                      </div>
                    ) : catalogosError && calidades.length === 0 ? (
                      <AppFeedbackMessage
                        variant="error"
                        title="No pudimos continuar"
                        description="Revisa la información o vuelve a intentarlo."
                        className="mt-3"
                      >
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void cargarTodo()}
                            disabled={loading}
                            className="inline-flex min-h-[38px] items-center rounded-[12px] bg-[#102d92] px-3 py-2 text-sm font-black text-white transition hover:bg-[#18358f] disabled:cursor-wait disabled:opacity-70"
                          >
                            {loading ? 'Cargando...' : 'Reintentar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate('/inicio')}
                            className="inline-flex min-h-[38px] items-center rounded-[12px] border border-rose-200 bg-white px-3 py-2 text-sm font-black text-rose-800 transition hover:bg-rose-50"
                          >
                            Volver
                          </button>
                        </div>
                      </AppFeedbackMessage>
                    ) : catalogosFeedback ? (
                      <AppFeedbackMessage
                        variant="success"
                        description={catalogosFeedback}
                        className="mt-3"
                      />
                    ) : null}
                    {calidadError ? (
                      <InlineGuidedError
                        message={getComprasGuidance(calidadError)}
                        className="mt-2"
                      />
                    ) : null}
                  </div>

                  <div className="mt-5 rounded-[22px] border border-[#e0e6f2] bg-white p-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                          {mostrarPanelBodega && panelBodegaVisible ? (
                            <div className="pointer-events-auto cafe-mini-bodega absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(280px,calc(100vw-32px))] max-w-full min-w-[240px]">
                              <div
                                className={`relative w-full rounded-[16px] border px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-sm transition-all duration-300 ease-out animate-[cafesmartFeedbackIn_220ms_ease-out_both] ${
                                  capacidadEnExceso
                                    ? 'border-rose-200 bg-rose-50 text-rose-950'
                                    : capacidadCasiLlena
                                      ? 'border-amber-200 bg-amber-50 text-amber-950'
                                      : 'border-sky-200 bg-sky-50 text-sky-950'
                                }`}
                              >
                                <button
                                  type="button"
                                  aria-label="Cerrar panel espacio bodega"
                                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-all hover:bg-white/80 hover:text-slate-800"
                                  onClick={() => setPanelBodegaVisible(false)}
                                >
                                  <X size={14} aria-hidden="true" />
                                </button>

                                {checkingCapacidadPreview ? (
                                  <div className="flex items-start gap-3 pr-8 text-sm font-semibold text-slate-700">
                                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-white/85 text-sky-700" aria-hidden="true">
                                      <LoaderCircle size={18} className="animate-spin" />
                                    </span>
                                    <span className="text-[0.82rem] font-semibold leading-5 text-sky-800">Revisando espacio disponible...</span>
                                  </div>
                                ) : capacidadPrevia?.validada ? (
                                  <div className="space-y-3 pr-8">
                                    <div className="flex flex-col gap-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span
                                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.08em] ${
                                            capacidadEnExceso
                                              ? 'bg-rose-100 text-rose-700'
                                              : capacidadCasiLlena
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-sky-100 text-sky-700'
                                          }`}
                                        >
                                          <Warehouse size={12} aria-hidden="true" />
                                          {capacidadEnExceso ? 'Sin espacio' : capacidadCasiLlena ? 'Casi llena' : 'Disponible'}
                                        </span>
                                      </div>
                                      <span className="text-[0.72rem] font-black uppercase tracking-[0.08em] text-slate-500">Espacio disponible</span>
                                    </div>

                                    {capacidadDisponibleAntes !== null ? (
                                      <p className={`whitespace-nowrap text-[1.2rem] font-black leading-none ${capacidadEnExceso ? 'text-rose-800' : capacidadCasiLlena ? 'text-amber-800' : 'text-sky-800'}`}>
                                        {formatoKg(capacidadDisponibleAntes)} kg libres
                                      </p>
                                    ) : null}

                                    {capacidadOcupacionPorcentaje !== null ? (
                                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                        <div className={`h-full rounded-full ${capacidadEnExceso ? 'bg-rose-500' : capacidadCasiLlena ? 'bg-amber-400' : 'bg-sky-500'}`} style={{ width: `${capacidadOcupacionPorcentaje}%` }} />
                                      </div>
                                    ) : null}

                                    {capacidadRestanteDespues !== null ? (
                                      <div className="flex items-center justify-between gap-2 rounded-[14px] bg-slate-50 px-3 py-2 text-[0.78rem]">
                                        <span className="whitespace-nowrap font-black text-slate-500">Disponible después:</span>
                                        <span className={`whitespace-nowrap font-black leading-tight ${capacidadEnExceso ? 'text-rose-800' : capacidadCasiLlena ? 'text-amber-800' : 'text-sky-700'}`}>{formatoKg(capacidadRestanteDespues)} kg</span>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
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

                      <div className="relative">
                        <label className="block pr-12 text-[0.98rem] font-black text-slate-800">
                          Precio x kg
                        </label>
                        <button
                          type="button"
                          onClick={() => setPanelBodegaVisible(true)}
                          aria-label="Ver espacio disponible de bodega"
                          className={`absolute right-0 top-[-0.2rem] inline-flex h-11 w-11 items-center justify-center rounded-full border bg-white shadow-[0_8px_18px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                            capacidadEnExceso
                              ? 'border-rose-200 text-rose-600 hover:bg-rose-50 focus-visible:ring-rose-500/40'
                              : capacidadCasiLlena
                                ? 'border-amber-200 text-amber-600 hover:bg-amber-50 focus-visible:ring-amber-500/40'
                                : 'border-sky-200 text-sky-700 hover:bg-sky-50 focus-visible:ring-sky-500/40'
                          }`}
                        >
                          <Warehouse size={21} strokeWidth={2.3} aria-hidden="true" />
                        </button>
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
                                  ? `El precio máximo permitido es ${formatoMoneda(
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
              Agregar más café
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
                anchorRef={formFeedbackRef}
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
                disabled={loading || checkingCapacidadPreview}
                aria-disabled={
                  paso2Completo && !errorCapacidadCantidad
                    ? 'false'
                    : 'true'
                }
                className="inline-flex min-h-[54px] min-w-0 items-center justify-center gap-2 rounded-[18px] bg-[#1f3fa7] px-3 py-3 text-[0.95rem] font-black text-white shadow-[0_12px_28px_rgba(16,45,146,0.26)] transition hover:bg-[#18358f] active:scale-[0.99] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/20"
              >
                {loading || checkingCapacidadPreview ? (
                  <>
                    <LoaderCircle size={18} className="shrink-0 animate-spin" />
                    <span className="truncate">Validando...</span>
                  </>
                ) : (
                  <>
                    <span className="truncate">Siguiente paso</span>
                    <ArrowRight size={19} />
                  </>
                )}
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
                    Información principal del registro.
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
                Revisa cada café antes de confirmar. Puedes editar o eliminar
                un producto si lo necesitas.
              </p>
              <div className="mt-3 space-y-3">
                {(sublotes.length > 2 ? sublotes.slice(-2) : sublotes).map((sublote) => {
                  const tipoCafe =
                    nombreTipoCafePorId.get(sublote.tipoCafeId) ?? 'Tipo pendiente';
                  const calidad =
                    nombreCalidadPorId.get(sublote.calidadId) ?? 'Calidad pendiente';
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
                              {tipoCafe} — {calidad}
                            </p>
                            <p className="mt-0.5 text-[1.05rem] font-black leading-tight text-slate-950">
                              {peso.toLocaleString('es-CO', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })}{' '}
                              kg · {formatoMoneda(totalItem)}
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
                          {sublotes.length > 1 ? (
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
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              {sublotes.length > 2 ? (
                <button
                  type="button"
                  onClick={() => setMostrarHistorialSublotes(true)}
                  className="mt-3 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#d5deee] bg-[#f8fbff] px-4 text-sm font-black text-[#173ea6]"
                >
                  Ver historial completo
                  <ArrowRight size={15} />
                </button>
              ) : null}
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
                anchorRef={formFeedbackRef}
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
                    Tienes una compra pendiente. ¿Deseas continuarla o iniciar una nueva?
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[18px] border border-[#dbe5fb] bg-[#f8faff] px-4 py-3 text-sm font-semibold text-[#52657d]">
              <div className="flex items-center justify-between gap-3">
                <span>Último paso</span>
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
                ¿Cancelar compra?
              </h2>
              <p className="mt-3 text-[1.05rem] leading-7 text-slate-500">
                Se perderán los datos ingresados y tendrás que iniciar el
                proceso nuevamente.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMostrarModalCancelar(false)}
                className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-3 py-3 text-sm font-black text-[#1f56dd]"
              >
                Seguir editando
              </button>
              <button
                type="button"
                onClick={confirmarCancelarCompra}
                className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] bg-[#fff1f2] px-3 py-3 text-sm font-black text-[#b12937] ring-1 ring-rose-100"
              >
                Sí, cancelar
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

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMostrarModalConfigurarCapacidad(false)}
                disabled={guardandoCapacidad}
                className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-3 py-3 text-sm font-black text-[#1f56dd] disabled:opacity-60"
              >
                Volver a compra
              </button>
              <button
                type="button"
                onClick={() => void guardarCapacidadDesdeCompra()}
                disabled={guardandoCapacidad}
                className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] bg-[#1f3fa7] px-3 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {guardandoCapacidad ? 'Guardando...' : 'Guardar y validar'}
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
                <span>Capacidad máxima</span>
                <span className="font-semibold text-slate-900">
                  {datosCapacidad.capacidadKg.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  kg
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[0.95rem] text-slate-600">
                <span>Después de la compra</span>
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
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f1ff] text-[#1f3fa7]">
                <AlertTriangle size={24} />
              </div>
              <h2 className="mt-5 text-[1.8rem] font-semibold leading-tight text-slate-900">
                {datosAlerta80.porcentaje >= 90
                  ? 'La bodega está casi llena.'
                  : 'La bodega se está llenando.'}
              </h2>
              <p className="mt-3 text-[1rem] leading-7 text-slate-500">
                Libera espacio antes de comprar más café.
              </p>
            </div>

            <div className="mt-6 rounded-[18px] border border-slate-200 bg-slate-50 p-4 text-left">
              <p className="text-[0.95rem] text-slate-600">Quedarán</p>
              <p className="mt-1 text-[1.8rem] font-semibold text-slate-900">
                {Math.max(0, datosAlerta80.capacidadKg - datosAlerta80.nuevoTotal).toLocaleString('es-CO', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}{' '}
                kg libres
              </p>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalAlerta80(false);
                  setMostrarModalConfirmar(true);
                }}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] bg-[#102d92] px-5 py-3 text-[1.05rem] font-semibold text-white shadow-[0_12px_24px_rgba(16,45,146,0.18)] transition hover:bg-[#1b3f9d]"
              >
                Continuar compra
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarModalAlerta80(false);
                    navigate('/ventas');
                  }}
                  className="inline-flex min-h-[54px] min-w-0 items-center justify-center rounded-[14px] border border-slate-300 bg-white px-3 py-3 text-center text-[0.95rem] font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Ir a ventas
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarModalAlerta80(false);
                    setMostrarModalConfigurarCapacidad(true);
                  }}
                  className="inline-flex min-h-[54px] min-w-0 items-center justify-center rounded-[14px] border border-slate-300 bg-white px-3 py-3 text-center text-[0.95rem] font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Editar bodega
                </button>
              </div>
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
        </div>
      ) : null}

      {mostrarHistorialCompras ? (
        <div
          className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center overflow-y-auto bg-slate-900/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:px-5 sm:py-6"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="compras-history-title"
            className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.28)] sm:max-h-[min(88dvh,720px)]"
          >
            <header className="shrink-0 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2
                    id="compras-history-title"
                    className="text-lg font-black text-slate-950"
                  >
                    Historial completo de la compra
                  </h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {comprasHistorialFiltradas.length} registros
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHistorialCompraFechaPickerOpen(false);
                    setMostrarHistorialCompras(false);
                  }}
                  aria-label="Cerrar historial de compras"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-black text-slate-700">Fecha</span>
                  <PurchaseDatePicker
                      value={historialCompraFecha}
                    min={BUSINESS_MIN_DATE_VALUE}
                      max={getTodayLocalDateValue()}
                    open={historialCompraFechaPickerOpen}
                    onToggle={() =>
                      setHistorialCompraFechaPickerOpen((open) => !open)
                    }
                    onClose={() => setHistorialCompraFechaPickerOpen(false)}
                    onChange={setHistorialCompraFecha}
                  />
                </label>
                {historialCompraFecha ? (
                  <p className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
                    Mostrando registros filtrados por fecha. Usa “Limpiar” para volver a ver todos.
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-black text-slate-700">Productor</span>
                    <SmartSelect
                      value={historialCompraProductor}
                      onChange={(event) => setHistorialCompraProductor(event.target.value)}
                      className="h-[42px]"
                    >
                      {historialCompraProductores.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </SmartSelect>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-black text-slate-700">Ordenar por</span>
                    <SmartSelect
                      value={historialCompraOrden}
                      onChange={(event) => setHistorialCompraOrden(event.target.value as 'recent' | 'oldest')}
                      className="h-[42px]"
                    >
                      <option value="recent">Más recientes</option>
                      <option value="oldest">Más antiguos</option>
                    </SmartSelect>
                  </label>
                </div>
                {(historialCompraFecha ||
                  historialCompraProductor !== 'TODOS' ||
                  historialCompraOrden !== 'recent') ? (
                  <button
                    type="button"
                    onClick={() => {
                      setHistorialCompraFecha('');
                      setHistorialCompraFechaPickerOpen(false);
                      setHistorialCompraProductor('TODOS');
                      setHistorialCompraOrden('recent');
                    }}
                    className="inline-flex min-h-[38px] w-full items-center justify-center rounded-[13px] border border-[#d5deee] bg-white px-3 text-xs font-black text-[#334b85]"
                  >
                    Limpiar filtros
                  </button>
                ) : null}
              </div>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {comprasHistorialFiltradas.length === 0 ? (
                <div className="rounded-[14px] border border-[#e2e8f4] bg-[#fbfcff] px-4 py-6 text-center text-sm font-bold text-slate-500">
                  {comprasRealizadas.length > 0 &&
                  (historialCompraFecha ||
                    historialCompraProductor !== 'TODOS' ||
                    historialCompraOrden !== 'recent')
                    ? 'No hay registros con esos filtros.'
                    : 'Aún no hay compras registradas.'}
                </div>
              ) : null}
              {comprasHistorialFiltradas.map((compra) => (
                <article
                  key={compra.id}
                  className="rounded-[18px] border border-[#e2e8f4] bg-[#fbfcff] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.11em] text-[#52657d]">
                        Compra del {formatoFecha(compra.fecha)}
                      </p>
                      <p className="mt-0.5 text-sm font-black text-slate-950">
                        {compra.totalSublotes} sublotes
                      </p>
                      <p className="mt-1 text-sm font-black text-[#173ea6]">
                        {formatoMoneda(compra.totalCompra)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        aria-label="Editar compra"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] bg-[#eef4ff] text-[#173ea6]"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Eliminar compra"
                        onClick={() =>
                          setComprasRealizadas((actual) =>
                            actual.filter((item) => item.id !== compra.id),
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

      {mostrarHistorialSublotes ? (
        <div
          className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center overflow-y-auto bg-slate-900/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:px-5 sm:py-6"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="sublotes-history-title"
            className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.28)] sm:max-h-[min(88dvh,720px)]"
          >
            <header className="shrink-0 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2
                    id="sublotes-history-title"
                    className="text-lg font-black text-slate-950"
                  >
                    Historial completo de la compra
                  </h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {sublotes.length} registros · {formatTotalKg(resumen.totalKg)} · {formatoMoneda(resumen.totalCompra)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarHistorialSublotes(false)}
                  aria-label="Cerrar historial de la compra"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                >
                  <X size={18} />
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {sublotes.map((sublote) => {
                const tipoCafe =
                  nombreTipoCafePorId.get(sublote.tipoCafeId) ?? 'Tipo pendiente';
                const calidad =
                  nombreCalidadPorId.get(sublote.calidadId) ?? 'Calidad pendiente';
                const peso = leerCantidadCompra(sublote.pesoInicial).valor;
                const totalItem = peso * leerPrecioCompra(sublote.precioKg).valor;
                return (
                  <article
                    key={sublote.id}
                    className="rounded-[18px] border border-[#e2e8f4] bg-[#fbfcff] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-950">
                          {tipoCafe} — {calidad}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-600">
                          {peso.toLocaleString('es-CO', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })}{' '}
                          kg · {formatoMoneda(totalItem)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          aria-label={`Editar ${tipoCafe}`}
                          onClick={() => {
                            setMostrarHistorialSublotes(false);
                            editarSubloteDesdeRevision(sublote.id);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] bg-[#eef4ff] text-[#173ea6]"
                        >
                          <Pencil size={14} />
                        </button>
                        {sublotes.length > 1 ? (
                          <button
                            type="button"
                            aria-label={`Eliminar ${tipoCafe}`}
                            onClick={() => eliminarSubloteDesdeRevision(sublote.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] bg-[#fff1f3] text-[#d63b4a]"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
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
                    maxLength={60}
                    onChange={(event) =>
                      setBusquedaProductorModal(sanitizeSearchInput(event.target.value))
                    }
                    placeholder="Buscar por nombre, cédula o NIT"
                    className="w-full rounded-[16px] border border-[#dbe2f0] bg-[#f8faff] px-10 py-3 text-[0.95rem] font-medium text-slate-900 outline-none transition focus:border-[#1f3fa7] focus:bg-white focus:ring-4 focus:ring-[#1f3fa7]/10"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className="shrink-0 text-[0.82rem] font-black uppercase tracking-[0.11em] text-slate-500">
                    Ordenar por
                  </label>
                  <div className="w-full max-w-[220px]">
                  <CompactSelect
                    id="productor-sort-select"
                    value={productorSortMode}
                    options={PRODUCTOR_SORT_OPTIONS}
                    placeholder="Más recientes"
                    open={productorFiltroDropdownOpen}
                    icon={<History size={16} />}
                    onToggle={() =>
                      setProductorFiltroDropdownOpen((open) => !open)
                    }
                    onClose={() => setProductorFiltroDropdownOpen(false)}
                    onChange={setProductorSortMode}
                  />
                  </div>
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
                  {productoresModalUsaSimilares ? (
                    <p className="rounded-[12px] border border-[#dbeafe] bg-[#eff6ff] px-3 py-2 text-xs font-bold text-[#1d4ed8]">
                      Mostrando resultados similares
                    </p>
                  ) : null}
                  {productoresModalFiltrados.map((productor) => (
                    <ProductorCard
                      key={productor.id}
                      productor={productor}
                      active={productorSeleccionado?.id === productor.id}
                      onSelect={() => seleccionarProductor(productor)}
                      onDetail={() => setProductorDetalle(productor)}
                      onEdit={() => {
                        setProductorEditando(productor);
                        setProductorForm({
                          nombre: productor.nombre,
                          telefono: productor.telefono
                            ? formatPhoneNumber(productor.telefono)
                            : '',
                          documento:
                            productor.documento === 'Documento pendiente'
                              ? ''
                              : productor.documento,
                          tipoDocumento: productor.tipoDocumento ?? 'CEDULA',
                        });
                        setProductorFormErrors({});
                        setProductorFormTouched({});
                        setProductorFormError(null);
                        setMostrarModalProductor(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {productorDetalle ? (
        <div className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center bg-slate-900/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="productor-detalle-title"
            className="w-full max-w-[410px] rounded-[22px] bg-white p-4 shadow-[0_28px_70px_rgba(15,23,42,0.28)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[#1f3fa7]">
                  Productor
                </p>
                <h2 id="productor-detalle-title" className="mt-1 text-lg font-black text-slate-950">
                  {productorDetalle.nombre}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setProductorDetalle(null)}
                aria-label="Cerrar detalle de productor"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm font-semibold text-slate-600">
              <p>Cédula/NIT: <span className="font-black text-slate-900">{getProductorDocumentLabel(productorDetalle)}</span></p>
              <p>Teléfono: <span className="font-black text-slate-900">{productorDetalle.telefono ? formatPhoneNumber(productorDetalle.telefono) : 'No registrado'}</span></p>
              <p>Dirección: <span className="font-black text-slate-900">No disponible</span></p>
              <p>Observaciones: <span className="font-black text-slate-900">No disponible</span></p>
              <p>Ubicación: <span className="font-black text-slate-900">No disponible</span></p>
            </div>
            <button
              type="button"
              onClick={() => {
                const productor = productorDetalle;
                setProductorDetalle(null);
                setProductorEditando(productor);
                setProductorForm({
                  nombre: productor.nombre,
                  telefono: productor.telefono ? formatPhoneNumber(productor.telefono) : '',
                  documento:
                    productor.documento === 'Documento pendiente'
                      ? ''
                      : productor.documento,
                  tipoDocumento: productor.tipoDocumento ?? 'CEDULA',
                });
                setMostrarModalProductor(true);
              }}
              className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white"
            >
              Editar
            </button>
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
                    {productorEditando ? 'Editar productor' : 'Registrar productor'}
                  </h2>
                  <p className="mt-1 text-sm font-medium leading-5 text-slate-500">
                    {productorEditando
                      ? 'Actualiza los datos del productor.'
                      : 'Completa los datos básicos para usarlo en esta compra.'}
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
              <div className="flex flex-col gap-5 pb-6">
                <div className="order-2">
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    {productorForm.tipoDocumento === 'NIT'
                      ? 'Nombre de la empresa'
                      : 'Nombre completo'}
                  </label>
                  <input
                    type="text"
                    value={productorForm.nombre}
                    disabled={!productorForm.tipoDocumento}
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
                        nombre:
                          actual.tipoDocumento === 'NIT'
                            ? event.target.value
                            : event.target.value.replace(/[0-9]/g, ''),
                      }));
                      setProductorFormErrors((actual) => ({
                        ...actual,
                        nombre: undefined,
                      }));
                      setProductorFormError(null);
                    }}
                    placeholder={
                      !productorForm.tipoDocumento
                        ? 'Primero selecciona el tipo de documento'
                        : productorForm.tipoDocumento === 'NIT'
                        ? 'Ej. Café Los Alpes'
                        : 'Ej. Juan Pérez Rodríguez'
                    }
                    className={`w-full rounded-[14px] border px-4 py-3 text-[0.95rem] text-slate-900 outline-none transition-all disabled:cursor-not-allowed disabled:text-slate-400 disabled:placeholder:text-slate-400 focus:border-[#173ea6] focus:bg-white focus:ring-4 focus:ring-[#173ea6]/10 ${
                      productorFormErrors.nombre && productorFormTouched.nombre
                        ? 'border-rose-200 bg-rose-50/40'
                        : 'border-[#dde4f1] bg-[#f7f9fd]'
                    }`}
                  />
                  <ProductorHint>
                    {productorForm.tipoDocumento === 'NIT'
                      ? 'Coloca el nombre legal o comercial de la empresa.'
                      : 'Coloca su nombre y apellidos.'}
                  </ProductorHint>
                  {productorFormErrors.nombre && productorFormTouched.nombre ? (
                    <ProductorFieldError message={productorFormErrors.nombre} />
                  ) : null}
                </div>
                <div className="order-1">
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    Tipo de documento
                  </label>
                  <ProductorHint>
                    Selecciona si el productor usa cédula o NIT.
                  </ProductorHint>
                  <div className="mt-2">
                    <CompactSelect
                      id="productor-document-type"
                      value={productorForm.tipoDocumento}
                      options={DOCUMENT_TYPE_OPTIONS}
                      placeholder="Selecciona el tipo de documento"
                      open={productorDocumentoDropdownOpen}
                      icon={<IdCard size={16} />}
                      onToggle={() =>
                        setProductorDocumentoDropdownOpen((open) => !open)
                      }
                      onClose={() => setProductorDocumentoDropdownOpen(false)}
                      onChange={(value) => {
                        const nextForm = {
                          ...productorForm,
                          tipoDocumento: value,
                          documento: '',
                        };
                        setProductorForm((actual) => ({
                          ...actual,
                          tipoDocumento: value,
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
                    />
                  </div>
                  {productorFormErrors.tipoDocumento &&
                  productorFormTouched.tipoDocumento ? (
                    <ProductorFieldError
                      message={productorFormErrors.tipoDocumento}
                    />
                  ) : null}
                </div>
                <div className="order-3">
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    Número de documento
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={!productorForm.tipoDocumento}
                    onPaste={(event) => {
                      if (!productorForm.tipoDocumento) {
                        event.preventDefault();
                      }
                    }}
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
                    placeholder={
                      productorForm.tipoDocumento
                        ? getProductorDocumentPlaceholder(productorForm.tipoDocumento)
                        : 'Primero selecciona el tipo de documento'
                    }
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
                <div className="order-4">
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    Teléfono (opcional)
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
                  <ProductorHint>Número celular colombiano.</ProductorHint>
                  {productorFormErrors.telefono &&
                  productorFormTouched.telefono ? (
                    <ProductorFieldError message={productorFormErrors.telefono} />
                  ) : null}
                </div>

                {productorFormError ? (
                  <div className="order-5">
                  <ProductorGeneralError error={productorFormError} />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 border-t border-[#eef2f7] bg-[#fbfcff] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={cerrarModalProductor}
                  className="inline-flex min-h-[50px] w-full items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-5 py-3 text-[0.95rem] font-semibold text-[#334b85]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardarProductorLocal}
                  disabled={botonGuardarProductorPresionado}
                  className="inline-flex min-h-[50px] w-full items-center justify-center rounded-[14px] bg-[#102d92] px-5 py-3 text-[0.95rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {botonGuardarProductorPresionado
                    ? 'Guardando...'
                    : productorEditando
                      ? 'Guardar cambios'
                      : 'Guardar productor'}
                </button>
              </div>
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

