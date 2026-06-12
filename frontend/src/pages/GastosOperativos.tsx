import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
  MoreHorizontal,
  SunMedium,
  Truck,
  Utensils,
  Wallet,
  X,
} from 'lucide-react';
import { ApiRequestError } from '../services/apiService';
import { AccessibleModal } from '../components/AccessibleModal';
import { CafeSmartErrorState } from '../components/CafeSmartErrorState';
import { InternalLoadingScreen } from '../components/InternalLoadingScreen';
import { DraftRecoveryModal } from '../components/DraftRecoveryModal';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import {
  listarCompras,
  type CompraListadoItem,
} from '../services/comprasService';
import { crearGasto, type CrearGastoPayload } from '../services/gastosService';
import { createOfflineDraft } from '../services/offlineDraftService';
import { addSyncOperation } from '../services/syncQueueService';
import {
  BUSINESS_MIN_DATE_VALUE,
  getTodayLocalDateValue,
  toIsoDateAtUtcNoon,
  validateBusinessDateRange,
} from '../utils/date';
import {
  fieldHelpTextClass,
  fieldInputClass,
  fieldLabelClass,
  fieldTextareaClass,
  primaryButtonClass,
  secondaryButtonClass,
  selectTriggerClass,
} from '../styles/uiClasses';
import { obtenerDeviceId } from '../utils/deviceId';

type TipoGastoValue =
  | 'TRANSPORTE'
  | 'COMIDA'
  | 'SECADO'
  | 'CARGUE'
  | 'DESCARGUE'
  | 'OTROS';
type EstadoPagoValue = 'PAGADO' | 'PENDIENTE';
type AplicaAValue = 'GENERAL' | 'SUBLOTES';
type FieldKey = 'concepto' | 'monto' | 'fecha' | 'sublotes';

type GuidanceMessage = {
  what: string;
  why: string;
  how: string;
  action: string;
};

type FormErrors = Partial<Record<FieldKey, GuidanceMessage>>;

type FloatingNotice = GuidanceMessage & {
  field?: FieldKey;
  primaryLabel: string;
  primaryAction: 'focus-field' | 'retry-save';
};

type GastoDraft = {
  savedAt: number;
  concepto: string;
  descripcion: string;
  montoStr: string;
  fecha: string;
  tipoGasto: TipoGastoValue;
  estadoPago: EstadoPagoValue;
  aplicaA: AplicaAValue;
  sublotesSeleccionados: string[];
};

const GASTO_DRAFT_STORAGE_KEY = 'cafe-smart:gasto-draft:v1';
const GASTO_CONCEPTO_MAX = 60;
const GASTO_DESCRIPCION_MAX = 200;
const GASTO_MONTO_MAX = 100000000;
const GASTO_CONCEPTO_MIN = 4;
const CONCEPTO_GASTO_VALIDO_REGEX = /^[\p{L}0-9\s/.,#-]+$/u;
const CONCEPTO_GASTO_TIENE_LETRA_REGEX = /\p{L}/u;
const CONCEPTO_GASTO_SOLO_NUMEROS_REGEX = /^\d+(?:\s+\d+)*$/;
const CONCEPTO_GASTO_SOLO_REPETIDO_REGEX = /^([\p{L}\d])\1+$/u;
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

function ariaInvalid(active: boolean) {
  return { 'aria-invalid': active ? 'true' : 'false' } as const;
}

const FIELD_ORDER: FieldKey[] = ['concepto', 'monto', 'fecha', 'sublotes'];

const BACKEND_FIELD_MAP: Record<string, FieldKey> = {
  conceptoGasto: 'concepto',
  montoGasto: 'monto',
  fechaGasto: 'fecha',
  subloteIds: 'sublotes',
};

function generarId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeMoneyInput(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 10);
  if (!digits) return '';
  return digits;
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

function formatLongDate(value: string) {
  const date = parseLocalDateValue(value);
  if (!date) return 'Selecciona fecha';
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getInputClassName(hasError: boolean, extraClasses = '') {
  return `${fieldInputClass} ${extraClasses} ${
    hasError
      ? 'border-rose-300 bg-rose-50/60 text-rose-950 placeholder:text-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 dark:border-rose-500 dark:bg-rose-500/15 dark:text-rose-100 dark:placeholder:text-rose-300'
      : ''
  }`;
}

function getFieldGuidance(
  field: FieldKey,
  options: {
    whatOverride?: string;
    hasAvailableSublotes?: boolean;
  } = {},
): GuidanceMessage {
  const { whatOverride, hasAvailableSublotes = true } = options;

  if (field === 'concepto') {
    return {
      what: whatOverride ?? 'Falta el concepto del gasto.',
      why: 'Es obligatorio para identificar el gasto después.',
      how: 'Escribe un concepto descriptivo. Ejemplo: "Transporte lote VB-04".',
      action: 'Describe el gasto para identificarlo después.',
    };
  }

  if (field === 'monto') {
    return {
      what: whatOverride ?? 'El monto del gasto no es válido.',
      why: 'Solo se permiten valores entre $1 y $100.000.000.',
      how: 'Ingresa solo numeros y un monto dentro del límite permitido.',
      action: 'Ingresa un valor válido para continuar.',
    };
  }

  if (field === 'fecha') {
    return {
      what: whatOverride ?? 'Falta la fecha del gasto.',
      why: 'Es obligatoria para registrar el gasto.',
      how: 'Selecciona el dia del gasto.',
      action: 'Elige la fecha del gasto.',
    };
  }

  if (!hasAvailableSublotes) {
    return {
      what:
        whatOverride ?? 'No hay sublotes disponibles para asociar este gasto.',
      why: 'Aún no existen sublotes registrados.',
      how: 'Registra sublotes o cambia a gasto general.',
      action: 'Selecciona "Gasto general" o crea sublotes.',
    };
  }

  return {
    what: whatOverride ?? 'No hay sublotes seleccionados.',
    why: 'Marcaste sublotes pero no elegiste ninguno.',
    how: 'Abre la lista y selecciona al menos uno.',
    action: 'Selecciona al menos un sublote.',
  };
}

function getSaveErrorGuidance(message: string): GuidanceMessage {
  return {
    what: 'No pude guardar el gasto.',
    why: message || 'Ocurrió un problema temporal. Intenta de nuevo.',
    how: 'Revisa tus datos y vuelve a intentarlo.',
    action: 'Toca "Reintentar" para guardar de nuevo.',
  };
}

function getFirstErrorField(errors: FormErrors) {
  return FIELD_ORDER.find((field) => errors[field]) ?? null;
}

function FloatingNoticeCard({
  notice,
  onClose,
  onPrimaryAction,
}: {
  notice: FloatingNotice;
  onClose: () => void;
  onPrimaryAction: () => void;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-20 z-50 px-4"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto w-full max-w-[340px] rounded-[12px] border border-rose-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.14)]">
        <div className="flex items-start gap-2.5 p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertCircle size={15} aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[0.72rem] leading-snug text-slate-700">
              <p className="font-bold">{notice.what}</p>
              <p className="mt-0.5 text-rose-700">{notice.action}</p>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onPrimaryAction}
                className="rounded-full bg-rose-600 px-3 py-1.5 text-[0.68rem] font-bold text-white transition hover:bg-rose-700"
              >
                {notice.primaryLabel}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-[0.68rem] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                Cerrar
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar aviso"
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function GastoDatePicker({
  value,
  open,
  hasError,
  onToggle,
  onClose,
  onChange,
}: {
  value: string;
  open: boolean;
  hasError: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
}) {
  const min = BUSINESS_MIN_DATE_VALUE;
  const max = getTodayLocalDateValue();
  const selectedDate = parseLocalDateValue(value);
  const todayValue = getTodayLocalDateValue();
  const todaySelectable = todayValue >= min && todayValue <= max ? todayValue : max;
  const maxDate = parseLocalDateValue(max) ?? new Date();
  const minDate = parseLocalDateValue(min) ?? new Date(2026, 0, 1);
  const fallbackDate = parseLocalDateValue(todaySelectable) ?? maxDate;
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date((selectedDate ?? fallbackDate).getFullYear(), (selectedDate ?? fallbackDate).getMonth(), 1),
  );

  useEffect(() => {
    if (!open) return;
    const next = parseLocalDateValue(value) ?? fallbackDate;
    setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  }, [max, open, todaySelectable, value]);

  const days = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: firstDay.getDay() }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index + 1);
        return { day: index + 1, value: formatLocalDateValue(date) };
      }),
    ];
  }, [visibleMonth]);

  const previousMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  const canGoPrevious = previousMonth >= new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const canGoNext = nextMonth <= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose();
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`${selectTriggerClass} min-h-[44px] rounded-[12px] text-[0.72rem] ${
          hasError
            ? 'border-rose-300 bg-rose-50/60 hover:border-rose-400 dark:border-rose-500 dark:bg-rose-500/15'
            : ''
        }`}
      >
        <span className="min-w-0 truncate">{formatLongDate(value)}</span>
        <Calendar size={15} className="shrink-0 text-[#102d92] dark:text-blue-200" />
      </button>
      {open ? (
        <div className="fixed left-1/2 top-1/2 z-[120] w-[min(21.5rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-[#d5deee] bg-white p-4 shadow-[0_24px_54px_rgba(15,23,42,0.24)] dark:border-slate-600 dark:bg-slate-900 dark:shadow-[0_24px_54px_rgba(0,0,0,0.46)] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:translate-x-0 sm:translate-y-0">
          <div className="flex items-center justify-between gap-3 pb-3">
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => setVisibleMonth(previousMonth)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#102d92] hover:bg-[#eef4ff] disabled:text-slate-300 dark:text-blue-200 dark:hover:bg-slate-800 dark:disabled:text-slate-600"
              aria-label="Mes anterior"
            >
              <ArrowLeft size={17} />
            </button>
            <p className="rounded-full bg-[#f8faff] px-4 py-2 text-sm font-black text-slate-900 dark:bg-slate-800 dark:text-slate-100">
              {MONTHS_ES[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
            </p>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setVisibleMonth(nextMonth)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#102d92] hover:bg-[#eef4ff] disabled:text-slate-300 dark:text-blue-200 dark:hover:bg-slate-800 dark:disabled:text-slate-600"
              aria-label="Mes siguiente"
            >
              <ArrowRight size={17} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS_ES.map((day) => (
              <span key={day} className="py-1.5 text-center text-[0.7rem] font-black text-slate-500 dark:text-slate-300">
                {day}
              </span>
            ))}
            {days.map((day, index) =>
              day ? (
                <button
                  key={day.value}
                  type="button"
                  disabled={day.value < min || day.value > max}
                  onClick={() => {
                    onChange(day.value);
                    onClose();
                  }}
                  className={`h-11 rounded-full text-sm font-black disabled:text-slate-300 dark:disabled:text-slate-600 ${
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
                <span key={`empty-${index}`} />
              ),
            )}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#edf1f7] pt-3 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                onChange('');
                onClose();
              }}
              className="rounded-full px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(todaySelectable);
                onClose();
              }}
              className="rounded-full bg-[#eef4ff] px-3 py-2 text-xs font-black text-[#102d92] dark:bg-blue-500/20 dark:text-blue-100"
            >
              Hoy
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function GastosOperativos() {
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatus();

  const [concepto, setConcepto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [montoStr, setMontoStr] = useState('');
  const [fecha, setFecha] = useState(getTodayLocalDateValue());
  const [fechaPickerOpen, setFechaPickerOpen] = useState(false);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  const [tipoGasto, setTipoGasto] = useState<TipoGastoValue>('TRANSPORTE');
  const [estadoPago, setEstadoPago] = useState<EstadoPagoValue>('PAGADO');
  const [aplicaA, setAplicaA] = useState<AplicaAValue>('GENERAL');

  const [compras, setCompras] = useState<CompraListadoItem[]>([]);
  const [sublotesSeleccionados, setSublotesSeleccionados] = useState<string[]>(
    [],
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [botonGuardarPresionado, setBotonGuardarPresionado] = useState(false);

  useEffect(() => {
    if (!limitNotice) return undefined;
    const timeout = window.setTimeout(() => setLimitNotice(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [limitNotice]);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [floatingNotice, setFloatingNotice] = useState<FloatingNotice | null>(
    null,
  );

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [offlineDraftSaved, setOfflineDraftSaved] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState<GuidanceMessage | null>(
    null,
  );
  const [showSublotesSelector, setShowSublotesSelector] = useState(false);
  const [draftPending, setDraftPending] = useState<GastoDraft | null>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);

  const conceptoSectionRef = useRef<HTMLDivElement | null>(null);
  const montoSectionRef = useRef<HTMLDivElement | null>(null);
  const fechaSectionRef = useRef<HTMLDivElement | null>(null);
  const sublotesSectionRef = useRef<HTMLDivElement | null>(null);

  const conceptoInputRef = useRef<HTMLInputElement | null>(null);
  const montoInputRef = useRef<HTMLInputElement | null>(null);
  const fechaInputRef = useRef<HTMLDivElement | null>(null);
  const sublotesButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(GASTO_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as GastoDraft;
      if (
        draft &&
        (draft.concepto ||
          draft.descripcion ||
          draft.montoStr ||
          draft.aplicaA === 'SUBLOTES' ||
          draft.sublotesSeleccionados?.length)
      ) {
        setDraftPending(draft);
        setShowDraftModal(true);
      }
    } catch {
      window.localStorage.removeItem(GASTO_DRAFT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (showDraftModal || showSuccessModal) return;
    const draft: GastoDraft = {
      savedAt: Date.now(),
      concepto,
      descripcion,
      montoStr,
      fecha,
      tipoGasto,
      estadoPago,
      aplicaA,
      sublotesSeleccionados,
    };
    const hasProgress =
      concepto.trim() ||
      descripcion.trim() ||
      montoStr ||
      fecha !== getTodayLocalDateValue() ||
      tipoGasto !== 'TRANSPORTE' ||
      estadoPago !== 'PAGADO' ||
      aplicaA !== 'GENERAL' ||
      sublotesSeleccionados.length > 0;

    if (!hasProgress) {
      window.localStorage.removeItem(GASTO_DRAFT_STORAGE_KEY);
      return;
    }

    const timer = window.setTimeout(() => {
      window.localStorage.setItem(GASTO_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    aplicaA,
    concepto,
    descripcion,
    estadoPago,
    fecha,
    montoStr,
    showDraftModal,
    showSuccessModal,
    sublotesSeleccionados,
    tipoGasto,
  ]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await listarCompras();
        setCompras(data);
      } catch (error) {
        console.error('Error al cargar compras (sublotes):', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const todosSublotes = useMemo(() => {
    return compras
      .flatMap((compra) =>
        compra.sublotes.map((sublote) => ({
          ...sublote,
          fechaCompra: compra.fecha,
        })),
      )
      .sort(
        (a, b) =>
          new Date(b.fechaCompra).getTime() - new Date(a.fechaCompra).getTime(),
      );
  }, [compras]);

  useEffect(() => {
    if (aplicaA !== 'SUBLOTES') {
      setShowSublotesSelector(false);
    }
  }, [aplicaA]);

  const limpiarErrorCampo = (field: FieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }

      const next = { ...prev };
      delete next[field];
      return next;
    });

    setFloatingNotice((prev) => (prev?.field === field ? null : prev));
  };

  const enfocarCampo = (field: FieldKey) => {
    if (field === 'sublotes') {
      setShowSublotesSelector(true);
    }

    const sectionMap: Record<FieldKey, HTMLDivElement | null> = {
      concepto: conceptoSectionRef.current,
      monto: montoSectionRef.current,
      fecha: fechaSectionRef.current,
      sublotes: sublotesSectionRef.current,
    };

    const focusMap: Record<FieldKey, HTMLElement | null> = {
      concepto: conceptoInputRef.current,
      monto: montoInputRef.current,
      fecha: fechaInputRef.current,
      sublotes: sublotesButtonRef.current,
    };

    sectionMap[field]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    window.setTimeout(() => {
      focusMap[field]?.focus({ preventScroll: true });
    }, 180);
  };

  const mostrarErrores = (errors: FormErrors) => {
    setFieldErrors(errors);

    const firstField = getFirstErrorField(errors);
    if (!firstField) {
      return;
    }

    const firstFeedback = errors[firstField];
    if (!firstFeedback) {
      return;
    }

    setFloatingNotice({
      ...firstFeedback,
      field: firstField,
      primaryLabel: 'Revisar ahora',
      primaryAction: 'focus-field',
    });

    window.setTimeout(() => {
      enfocarCampo(firstField);
    }, 80);
  };

  const formatearMonedaInput = (valor: string) => {
    const numeros = valor.replace(/\D/g, '');
    if (!numeros) {
      return '';
    }

    return new Intl.NumberFormat('es-CO').format(Number(numeros));
  };

  const validarFormulario = (): FormErrors => {
    const errors: FormErrors = {};
    const fechaValidacion = validateBusinessDateRange(fecha);
    const conceptoNormalizado = concepto.trim();

    if (!conceptoNormalizado) {
      errors.concepto = getFieldGuidance('concepto', {
        whatOverride: 'Describe el gasto para identificarlo después.',
      });
    } else if (conceptoNormalizado.length < GASTO_CONCEPTO_MIN) {
      errors.concepto = getFieldGuidance('concepto', {
        whatOverride: 'El concepto debe tener al menos 4 caracteres.',
      });
    } else if (CONCEPTO_GASTO_SOLO_NUMEROS_REGEX.test(conceptoNormalizado)) {
      errors.concepto = getFieldGuidance('concepto', {
        whatOverride: 'No uses solo números como concepto del gasto.',
      });
    } else if (CONCEPTO_GASTO_SOLO_REPETIDO_REGEX.test(conceptoNormalizado.toLowerCase())) {
      errors.concepto = getFieldGuidance('concepto', {
        whatOverride: 'El concepto debe incluir texto descriptivo.',
      });
    } else if (
      !CONCEPTO_GASTO_VALIDO_REGEX.test(conceptoNormalizado) ||
      !CONCEPTO_GASTO_TIENE_LETRA_REGEX.test(conceptoNormalizado)
    ) {
      errors.concepto = getFieldGuidance('concepto', {
        whatOverride: 'El concepto debe incluir texto descriptivo.',
      });
    }

    const monto = Number(montoStr);
    if (!montoStr) {
      errors.monto = getFieldGuidance('monto', {
        whatOverride: 'Ingresa el monto del gasto.',
      });
    } else if (!Number.isFinite(monto)) {
      errors.monto = getFieldGuidance('monto', {
        whatOverride: 'Ingresa solo números válidos.',
      });
    } else if (monto <= 0) {
      errors.monto = getFieldGuidance('monto', {
        whatOverride: 'El monto debe ser mayor a $0.',
      });
    } else if (monto > GASTO_MONTO_MAX) {
      errors.monto = getFieldGuidance('monto', {
        whatOverride:
          'El monto máximo permitido es $100.000.000.',
      });
    }

    if (!fechaValidacion.isValid) {
      errors.fecha = getFieldGuidance('fecha', {
        whatOverride: fechaValidacion.message ?? undefined,
      });
    }

    if (aplicaA === 'SUBLOTES' && sublotesSeleccionados.length === 0) {
      errors.sublotes = getFieldGuidance('sublotes', {
        hasAvailableSublotes: todosSublotes.length > 0,
      });
    }

    return errors;
  };

  const handleMontoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = sanitizeMoneyInput(event.target.value);
    setMontoStr(next);

    const monto = Number(next);
    if (Number.isFinite(monto) && monto > GASTO_MONTO_MAX) {
      const feedback = getFieldGuidance('monto', {
        whatOverride:
          'El monto máximo permitido es $100.000.000.',
      });
      setFieldErrors((prev) => ({ ...prev, monto: feedback }));
      setFloatingNotice({
        ...feedback,
        field: 'monto',
        primaryLabel: 'Corregir',
        primaryAction: 'focus-field',
      });
      return;
    }

    limpiarErrorCampo('monto');
  };

  const resetForm = () => {
    window.localStorage.removeItem(GASTO_DRAFT_STORAGE_KEY);
    setConcepto('');
    setDescripcion('');
    setMontoStr('');
    setFecha(getTodayLocalDateValue());
    setTipoGasto('TRANSPORTE');
    setEstadoPago('PAGADO');
    setAplicaA('GENERAL');
    setSublotesSeleccionados([]);
    setFieldErrors({});
    setFloatingNotice(null);
    setShowSublotesSelector(false);
    setBotonGuardarPresionado(false);
  };

  const continuarBorradorGasto = () => {
    if (!draftPending) return;
    setConcepto(draftPending.concepto ?? '');
    setDescripcion(draftPending.descripcion ?? '');
    setMontoStr(draftPending.montoStr ?? '');
    setFecha(draftPending.fecha || getTodayLocalDateValue());
    setTipoGasto(draftPending.tipoGasto ?? 'TRANSPORTE');
    setEstadoPago(draftPending.estadoPago ?? 'PAGADO');
    setAplicaA(draftPending.aplicaA ?? 'GENERAL');
    setSublotesSeleccionados(draftPending.sublotesSeleccionados ?? []);
    setShowDraftModal(false);
    setDraftPending(null);
  };

  const empezarGastoNuevo = () => {
    window.localStorage.removeItem(GASTO_DRAFT_STORAGE_KEY);
    setShowDraftModal(false);
    setDraftPending(null);
    resetForm();
  };

  const cerrarModalConfirmar = () => {
    setShowConfirmModal(false);
    setBotonGuardarPresionado(false);
  };

  const toggleSublote = (id: string) => {
    const estabaSeleccionado = sublotesSeleccionados.includes(id);

    setSublotesSeleccionados((prev) =>
      prev.includes(id)
        ? prev.filter((currentId) => currentId !== id)
        : [...prev, id],
    );

    if (!estabaSeleccionado) {
      limpiarErrorCampo('sublotes');
    }
  };

  const handleConfirmar = () => {
    const errors = validarFormulario();

    if (Object.keys(errors).length > 0) {
      mostrarErrores(errors);
      return;
    }

    setFieldErrors({});
    setFloatingNotice(null);
    setShowConfirmModal(true);
  };

  const handleGuardar = async () => {
    const validationErrors = validarFormulario();

    if (Object.keys(validationErrors).length > 0) {
      setShowConfirmModal(false);
      mostrarErrores(validationErrors);
      return;
    }

    const fechaIso = toIsoDateAtUtcNoon(fecha);

    if (!fechaIso) {
      setShowConfirmModal(false);
      mostrarErrores({
        fecha: getFieldGuidance('fecha'),
      });
      return;
    }

    setSaving(true);
    setBotonGuardarPresionado(true);
    setShowConfirmModal(false);

    try {
      const payload: CrearGastoPayload = {
        conceptoGasto: concepto.trim(),
        descripcion: descripcion.trim() || undefined,
        montoGasto: Number(montoStr),
        fechaGasto: fechaIso,
        tipoGasto,
        estadoPago,
        deviceId: await obtenerDeviceId(),
        localId: generarId(),
        asociarASublotes: aplicaA === 'SUBLOTES',
        subloteIds: aplicaA === 'SUBLOTES' ? sublotesSeleccionados : undefined,
      };

      if (isOffline) {
        const clientMutationId = payload.localId ?? generarId();
        addSyncOperation({
          idLocal: clientMutationId,
          clientMutationId,
          deviceId: payload.deviceId ?? (await obtenerDeviceId()),
          modulo: 'GASTO',
          endpoint: '/gastos',
          method: 'POST',
          payload: {
            ...payload,
            localId: clientMutationId,
          },
        });
        await createOfflineDraft('GASTO', {
          ...payload,
          localId: clientMutationId,
          createdAt: new Date().toISOString(),
          formState: {
            concepto,
            descripcion,
            montoStr,
            fecha,
            tipoGasto,
            estadoPago,
            aplicaA,
            sublotesSeleccionados,
          },
        });
        setOfflineDraftSaved(true);
        setShowSuccessModal(true);
        return;
      }

      await crearGasto(payload);
      setOfflineDraftSaved(false);
      window.localStorage.removeItem(GASTO_DRAFT_STORAGE_KEY);
      setFieldErrors({});
      setFloatingNotice(null);
      setShowSuccessModal(true);
    } catch (error) {
      console.error(error);

      if (error instanceof ApiRequestError && error.field) {
        const localField = BACKEND_FIELD_MAP[error.field];

        if (localField) {
          const feedback = getFieldGuidance(localField, {
            whatOverride: error.message,
            hasAvailableSublotes: todosSublotes.length > 0,
          });

          setFieldErrors((prev) => ({
            ...prev,
            [localField]: feedback,
          }));

          setFloatingNotice({
            ...feedback,
            field: localField,
            primaryLabel: 'Corregir ahora',
            primaryAction: 'focus-field',
          });

          window.setTimeout(() => {
            enfocarCampo(localField);
          }, 80);

          return;
        }
      }

      const feedback = getSaveErrorGuidance('');
      setShowErrorModal(feedback);
      setFloatingNotice({
        ...feedback,
        primaryLabel: 'Reintentar',
        primaryAction: 'retry-save',
      });
    } finally {
      setSaving(false);
      setBotonGuardarPresionado(false);
    }
  };

  const handleFloatingNoticeAction = () => {
    if (!floatingNotice) {
      return;
    }

    if (floatingNotice.primaryAction === 'retry-save') {
      void handleGuardar();
      return;
    }

    if (floatingNotice.field) {
      enfocarCampo(floatingNotice.field);
    }
  };

  const tipoOpciones = [
    { value: 'TRANSPORTE', label: 'TRANSPORTE', icon: Truck },
    { value: 'COMIDA', label: 'COMIDA', icon: Utensils },
    { value: 'SECADO', label: 'SECADO', icon: SunMedium },
    { value: 'CARGUE', label: 'CARGUE', icon: Archive },
    { value: 'DESCARGUE', label: 'DESCARGUE', icon: ArchiveRestore },
    { value: 'OTROS', label: 'OTROS', icon: MoreHorizontal },
  ] as const;

  if (showSuccessModal) {
    return (
      <div className="cs-workflow-page min-h-screen bg-[#eef2f6] px-4 py-6 pb-24 text-slate-900">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[430px] items-center">
          <CafeSmartErrorState
            variant="success"
            title={
              offlineDraftSaved
                ? 'Borrador guardado'
                : 'Gasto registrado con éxito'
            }
            message={
              offlineDraftSaved
                ? 'Tu información quedó guardada en este dispositivo. Finaliza el gasto cuando vuelvas a tener conexión.'
                : 'El gasto fue guardado correctamente en el sistema.'
            }
            primaryLabel={offlineDraftSaved ? 'Volver al formulario' : 'Registrar otro gasto'}
            secondaryLabel={offlineDraftSaved ? 'Ir al inicio' : 'Ver gastos'}
            onPrimary={() => {
              setShowSuccessModal(false);
              setOfflineDraftSaved(false);
              resetForm();
            }}
            onSecondary={() => navigate(offlineDraftSaved ? '/inicio' : '/gastos')}
            primaryBusy={saving}
            info={
              offlineDraftSaved
                ? 'Guardado en este dispositivo. Pendiente de conexión para enviarse a la nube.'
                : 'El movimiento quedó disponible en tus gastos operativos.'
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="cs-workflow-page min-h-screen bg-[#eef2f6] px-4 py-3 pb-24 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto max-w-[430px] space-y-3 rounded-[24px] border border-[#dbe2ee] bg-[#fbfbfb] px-3 py-3 shadow-[0_14px_38px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900">
        <div className="relative min-h-[28px]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="absolute left-0 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
            aria-label="Volver"
          >
            <ArrowLeft size={14} className="text-[#102d92]" />
          </button>
          <h1 className="text-center text-[0.78rem] font-black text-black dark:text-slate-100">
            Registro de gastos
          </h1>
        </div>

        <div className="space-y-2.5">
          {limitNotice ? (
            <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[0.66rem] font-black text-amber-800">
              {limitNotice}
            </div>
          ) : null}
          <div ref={conceptoSectionRef} className="space-y-1.5">
            <label htmlFor="gasto-concepto" className={fieldLabelClass}>
              Concepto del gasto
            </label>
            <input
              id="gasto-concepto"
              ref={conceptoInputRef}
              type="text"
              placeholder="Ej. Pago de jornaleros - Cosecha Oct"
              className={getInputClassName(
                Boolean(fieldErrors.concepto),
                'px-3 py-2 text-[0.66rem] font-semibold',
              )}
              value={concepto}
              maxLength={GASTO_CONCEPTO_MAX}
              {...ariaInvalid(Boolean(fieldErrors.concepto))}
              aria-describedby={undefined}
              onChange={(event) => {
                if (event.target.value.length >= GASTO_CONCEPTO_MAX) {
                  setLimitNotice('Llegaste al máximo permitido.');
                }
                setConcepto(event.target.value.slice(0, GASTO_CONCEPTO_MAX));
                limpiarErrorCampo('concepto');
              }}
            />
            <div className={`${fieldHelpTextClass} flex justify-end text-[0.58rem] font-bold`}>
              {concepto.length}/{GASTO_CONCEPTO_MAX}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="gasto-descripcion" className={fieldLabelClass}>
              Descripción breve
            </label>
            <textarea
              id="gasto-descripcion"
              placeholder="Ej: Pago transporte lote octubre"
              rows={2}
              className={`${fieldTextareaClass} max-h-36 min-h-[96px] resize-y overflow-y-auto text-[0.72rem]`}
              value={descripcion}
              maxLength={GASTO_DESCRIPCION_MAX}
              onChange={(event) =>
                {
                  if (event.target.value.length >= GASTO_DESCRIPCION_MAX) {
                    setLimitNotice('Llegaste al máximo permitido.');
                  }
                  setDescripcion(event.target.value.slice(0, GASTO_DESCRIPCION_MAX));
                }
              }
            />
            <div className={`${fieldHelpTextClass} flex justify-end text-[0.58rem] font-bold`}>
              {descripcion.length}/{GASTO_DESCRIPCION_MAX}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div ref={montoSectionRef} className="space-y-1.5">
              <label htmlFor="gasto-monto" className={fieldLabelClass}>
                Monto ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.7rem] font-bold text-slate-400">
                  $
                </span>
                <input
                  id="gasto-monto"
                  ref={montoInputRef}
                  type="text"
                  placeholder="0.00"
                  className={getInputClassName(
                    Boolean(fieldErrors.monto),
                    'pl-6 pr-3 py-2 text-[0.66rem] font-semibold',
                  )}
                  value={formatearMonedaInput(montoStr)}
                  {...ariaInvalid(Boolean(fieldErrors.monto))}
                  aria-describedby={undefined}
                  onChange={handleMontoChange}
                />
              </div>
              <p className={`${fieldHelpTextClass} text-[0.56rem]`}>
                Máx. ${new Intl.NumberFormat('es-CO').format(GASTO_MONTO_MAX)}
              </p>
            </div>

            <div ref={fechaSectionRef} className="space-y-1.5">
              <label htmlFor="gasto-fecha" className={fieldLabelClass}>
                Fecha
              </label>
              <div ref={fechaInputRef} tabIndex={-1}>
                <GastoDatePicker
                  value={fecha}
                  open={fechaPickerOpen}
                  hasError={Boolean(fieldErrors.fecha)}
                  onToggle={() => setFechaPickerOpen((open) => !open)}
                  onClose={() => setFechaPickerOpen(false)}
                  onChange={(nextFecha) => {
                    setFecha(nextFecha);
                    limpiarErrorCampo('fecha');
                  }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className={fieldLabelClass}>
              Tipo de gasto
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {tipoOpciones.map((opcion) => {
                const Icon = opcion.icon;
                const isSelected = tipoGasto === opcion.value;

                return (
                  <button
                    key={opcion.value}
                    type="button"
                    onClick={() => setTipoGasto(opcion.value)}
                    className={`flex min-h-[42px] flex-col items-center justify-center gap-1 rounded-[8px] border p-1.5 transition-colors ${
                      isSelected
                        ? 'border-[#102d92] bg-[#102d92] text-white shadow-[0_8px_16px_rgba(16,45,146,0.22)]'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon
                      size={12}
                      className={isSelected ? 'text-white' : 'text-slate-400'}
                    />
                    <span className="text-[0.42rem] font-black uppercase tracking-normal">
                      {opcion.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className={fieldLabelClass}>
              Estado de pago
            </label>
            <div className="flex rounded-full border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setEstadoPago('PAGADO')}
                className={`flex-1 rounded-full py-1.5 text-[0.58rem] font-bold transition-all ${
                  estadoPago === 'PAGADO'
                    ? 'bg-[#102d92] text-white shadow-[0_6px_14px_rgba(16,45,146,0.2)]'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                Pagado
              </button>
              <button
                type="button"
                onClick={() => setEstadoPago('PENDIENTE')}
                className={`flex-1 rounded-full py-1.5 text-[0.58rem] font-bold transition-all ${
                  estadoPago === 'PENDIENTE'
                    ? 'bg-[#102d92] text-white shadow-[0_6px_14px_rgba(16,45,146,0.2)]'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                Pendiente de pago
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className={fieldLabelClass}>
              A qué aplica este gasto?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAplicaA('GENERAL');
                  limpiarErrorCampo('sublotes');
                }}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-[8px] border p-2 transition-colors ${
                  aplicaA === 'GENERAL'
                    ? 'border-[#102d92] bg-[#102d92] text-white shadow-[0_8px_16px_rgba(16,45,146,0.22)]'
                    : 'border-slate-200 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300'
                }`}
              >
                <Wallet
                  size={12}
                  className={
                    aplicaA === 'GENERAL' ? 'text-white' : 'text-slate-400'
                  }
                />
                <span className="text-[0.44rem] font-black uppercase tracking-normal">
                  Gasto general
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAplicaA('SUBLOTES')}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-[8px] border p-2 transition-colors ${
                  aplicaA === 'SUBLOTES'
                    ? 'border-[#102d92] bg-[#102d92] text-white shadow-[0_8px_16px_rgba(16,45,146,0.22)]'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Layers
                  size={12}
                  className={
                    aplicaA === 'SUBLOTES' ? 'text-white' : 'text-slate-400'
                  }
                />
                <span className="text-[0.44rem] font-black uppercase tracking-normal">
                  Asociar a sublotes
                </span>
              </button>
            </div>
          </div>

          {aplicaA === 'SUBLOTES' ? (
            <div
              ref={sublotesSectionRef}
              className="mt-2 animate-in space-y-2 fade-in slide-in-from-top-2"
            >
              <div className="flex items-center justify-between">
                <label className={fieldLabelClass}>
                  Seleccionar sublotes
                </label>
                {sublotesSeleccionados.length > 0 ? (
                  <span className="rounded bg-[#f0f4ff] px-2 py-0.5 text-xs font-bold text-[#102d92] animate-in zoom-in dark:bg-blue-500/20 dark:text-blue-100">
                    {sublotesSeleccionados.length} seleccionados
                  </span>
                ) : null}
              </div>

              <button
                ref={sublotesButtonRef}
                type="button"
                onClick={() => {
                  limpiarErrorCampo('sublotes');
                  setShowSublotesSelector((prev) => !prev);
                }}
                {...ariaInvalid(Boolean(fieldErrors.sublotes))}
                aria-describedby={undefined}
                className={`${selectTriggerClass} ${
                  fieldErrors.sublotes
                    ? 'border-rose-300 bg-rose-50/60 hover:border-rose-400 dark:border-rose-500 dark:bg-rose-500/15'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`text-[0.62rem] ${
                      sublotesSeleccionados.length > 0
                        ? 'font-semibold text-slate-800 dark:text-slate-100'
                        : 'text-slate-400 dark:text-slate-400'
                    }`}
                  >
                    {sublotesSeleccionados.length > 0
                      ? `${sublotesSeleccionados.length} sublotes seleccionados`
                      : 'Seleccionar...'}
                  </span>
                  {showSublotesSelector ? (
                    <ChevronDown size={18} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={18} className="text-slate-400" />
                  )}
                </div>
              </button>

              <p className={`${fieldHelpTextClass} text-[0.55rem]`}>
                Selecciona los sublotes a los que aplica este gasto.
              </p>

              {showSublotesSelector ? (
                <div className="max-h-[180px] w-full overflow-y-auto rounded-[8px] border border-slate-200 bg-white shadow-sm animate-in fade-in slide-in-from-top-2 dark:border-slate-700 dark:bg-slate-950">
                  {todosSublotes.length === 0 && !loading ? (
                    <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-300">
                      No hay sublotes disponibles en el sistema.
                    </div>
                  ) : null}

                  {todosSublotes.map((sublote) => {
                    const seleccionado = sublotesSeleccionados.includes(
                      sublote.id,
                    );

                    return (
                      <label
                        key={sublote.id}
                        className="flex cursor-pointer items-center gap-3 border-b border-slate-100 p-3 transition-colors last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={seleccionado}
                          onChange={() => toggleSublote(sublote.id)}
                        />
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                            seleccionado
                              ? 'border-[#102d92] bg-[#102d92]'
                              : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
                          }`}
                        >
                          {seleccionado ? (
                            <CheckCircle2 size={14} className="text-white" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold leading-tight text-slate-800 dark:text-slate-100">
                            {sublote.tipoCafe} {sublote.calidad}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-300">
                            Comprado: {sublote.fechaCompra.slice(0, 10)} -{' '}
                            {sublote.pesoActual} kg
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)] gap-2 pt-3">
          <button
            type="button"
            disabled={saving || botonGuardarPresionado}
            onClick={handleConfirmar}
            className={`${primaryButtonClass} min-h-[42px] w-full rounded-[8px] text-[0.68rem]`}
          >
            {saving || botonGuardarPresionado ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              'Guardar gasto'
            )}
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => navigate(-1)}
            className={`${secondaryButtonClass} min-h-[42px] w-full rounded-[8px] text-[0.68rem]`}
          >
            Cancelar
          </button>
        </div>
      </main>

      {showConfirmModal ? (
        <AccessibleModal
          title="Registrar este gasto"
          description="Confirma que deseas guardar este gasto en el sistema."
          onClose={cerrarModalConfirmar}
        >
            <div className="mx-auto mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#eef2ff] text-[#2051e5] dark:bg-blue-500/20 dark:text-blue-100">
              <Info size={16} aria-hidden="true" />
            </div>
            <h2 className="mb-2 text-center text-[0.92rem] font-black text-slate-900 dark:text-slate-100">
              Registrar este gasto?
            </h2>
            <p className="mb-5 text-center text-[0.68rem] leading-5 text-slate-500 dark:text-slate-300">
              Se guardara este gasto en el sistema{' '}
              {aplicaA === 'SUBLOTES'
                ? `asociado a ${sublotesSeleccionados.length} sublotes.`
                : 'como gasto general.'}
            </p>
            <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,0.85fr)] gap-2">
              <button
                type="button"
                disabled={saving || botonGuardarPresionado}
                onClick={() => void handleGuardar()}
                className={`${primaryButtonClass} min-h-[42px] w-full rounded-[8px] text-[0.68rem]`}
              >
                {saving || botonGuardarPresionado
                  ? 'Guardando gasto...'
                  : 'Registrar gasto'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={cerrarModalConfirmar}
                className={`${secondaryButtonClass} min-h-[42px] w-full rounded-[8px] text-[0.68rem]`}
              >
                Cancelar
              </button>
            </div>
        </AccessibleModal>
      ) : null}

      {showDraftModal && draftPending ? (
        <DraftRecoveryModal
          labelledById="gasto-draft-title"
          describedById="gasto-draft-description"
          message="Los datos de los gastis siguen disponibles. Puedes volver a editar o intentar nuevamente."
          primaryLabel="Continuar gasto"
          onPrimary={continuarBorradorGasto}
          onSecondary={empezarGastoNuevo}
          details={[
            { label: 'Tipo de gasto', value: draftPending.tipoGasto ?? 'General' },
            { label: 'Monto', value: draftPending.montoStr || '-' },
          ]}
        />
      ) : null}

      {showErrorModal ? (
        <AccessibleModal
          title="No pudimos registrar el gasto"
          description={`${showErrorModal.what} ${showErrorModal.action}`}
          onClose={() => setShowErrorModal(null)}
        >
            <div className="mx-auto mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-200">
              <AlertCircle size={16} aria-hidden="true" />
            </div>
            <h2 className="mb-2 text-center text-[0.92rem] font-black text-slate-900 dark:text-slate-100">
              No pudimos registrar el gasto
            </h2>
            <p
              className="mb-5 text-center text-[0.68rem] leading-5 text-slate-500 dark:text-slate-300"
              role="alert"
            >
              {showErrorModal.what} {showErrorModal.action}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowErrorModal(null);
                  void handleGuardar();
                }}
                className={`${primaryButtonClass} min-h-[42px] rounded-[12px] text-[0.68rem]`}
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => setShowErrorModal(null)}
                className={`${secondaryButtonClass} min-h-[42px] rounded-[12px] text-[0.62rem]`}
              >
                Cancelar
              </button>
            </div>
        </AccessibleModal>
      ) : null}

      {floatingNotice ? (
        <FloatingNoticeCard
          notice={floatingNotice}
          onClose={() => setFloatingNotice(null)}
          onPrimaryAction={handleFloatingNoticeAction}
        />
      ) : null}

      {saving || botonGuardarPresionado ? (
        <div className="fixed inset-0 z-50">
          <InternalLoadingScreen
            title="Registrando gasto..."
            description="Estamos guardando la información."
            warningText="Esto puede tardar unos segundos."
            securityTitle="Registro seguro"
            securityDescription="Tu gasto operativo se está procesando de forma segura."
          />
        </div>
      ) : null}
    </div>
  );
}
