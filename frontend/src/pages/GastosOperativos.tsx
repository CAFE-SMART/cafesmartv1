import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
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
import {
  listarCompras,
  type CompraListadoItem,
} from '../services/comprasService';
import { crearGasto, type CrearGastoPayload } from '../services/gastosService';
import {
  BUSINESS_MIN_DATE_VALUE,
  getTodayLocalDateValue,
  toIsoDateAtUtcNoon,
  validateBusinessDateRange,
} from '../utils/date';
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

function getInputClassName(hasError: boolean, extraClasses = '') {
  return `w-full rounded-[8px] border bg-white outline-none transition shadow-sm ${extraClasses} ${
    hasError
      ? 'border-rose-300 bg-rose-50/60 text-rose-950 placeholder:text-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
      : 'border-slate-200 focus:border-[#102d92] focus:ring-1 focus:ring-[#102d92]/20'
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
      why: 'Es obligatorio para identificar el gasto.',
      how: 'Escribe un concepto corto. Ejemplo: "Transporte de secado".',
      action: 'Completa el concepto del gasto.',
    };
  }

  if (field === 'monto') {
    return {
      what: whatOverride ?? 'El monto del gasto no es valido.',
      why: 'Solo se permiten valores mayores a cero.',
      how: 'Ingresa solo numeros y un monto mayor a 0.',
      action: 'Escribe un monto mayor a $0.',
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
      why: 'Aun no existen sublotes registrados.',
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

export default function GastosOperativos() {
  const navigate = useNavigate();

  const [concepto, setConcepto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [montoStr, setMontoStr] = useState('');
  const [fecha, setFecha] = useState(getTodayLocalDateValue());
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
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [floatingNotice, setFloatingNotice] = useState<FloatingNotice | null>(
    null,
  );

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
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
  const fechaInputRef = useRef<HTMLInputElement | null>(null);
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

    if (!concepto.trim()) {
      errors.concepto = getFieldGuidance('concepto');
    }

    if (!montoStr || Number(montoStr) <= 0) {
      errors.monto = getFieldGuidance('monto');
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
    const crudo = event.target.value.replace(/\D/g, '');
    setMontoStr(crudo);
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

      await crearGasto(payload);
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

  return (
    <div className="min-h-screen bg-[#eef2f6] px-4 py-3 pb-24 font-sans text-slate-900">
      <main className="mx-auto max-w-[430px] space-y-3 rounded-[24px] border border-[#dbe2ee] bg-[#fbfbfb] px-3 py-3 shadow-[0_14px_38px_rgba(15,23,42,0.06)]">
        <div className="relative min-h-[28px]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="absolute left-0 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition hover:bg-slate-100"
            aria-label="Volver"
          >
            <ArrowLeft size={14} className="text-[#102d92]" />
          </button>
          <h1 className="text-center text-[0.78rem] font-black text-black">
            Registro de gastos
          </h1>
        </div>

        <div className="space-y-2.5">
          <div ref={conceptoSectionRef} className="space-y-1.5">
            <label htmlFor="gasto-concepto" className="ml-1 text-[0.62rem] font-black text-slate-700">
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
              {...ariaInvalid(Boolean(fieldErrors.concepto))}
              aria-describedby={undefined}
              onChange={(event) => {
                setConcepto(event.target.value);
                limpiarErrorCampo('concepto');
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="gasto-descripcion" className="ml-1 text-[0.62rem] font-black text-slate-700">
              Descripción breve
            </label>
            <textarea
              id="gasto-descripcion"
              placeholder="Ej: Pago transporte lote octubre"
              rows={2}
              className={getInputClassName(
                false,
                'resize-none px-3 py-2 text-[0.66rem] font-semibold',
              )}
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div ref={montoSectionRef} className="space-y-1.5">
              <label htmlFor="gasto-monto" className="ml-1 text-[0.62rem] font-black text-slate-700">
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
            </div>

            <div ref={fechaSectionRef} className="space-y-1.5">
              <label htmlFor="gasto-fecha" className="ml-1 text-[0.62rem] font-black text-slate-700">
                Fecha
              </label>
              <div className="relative">
                <input
                  id="gasto-fecha"
                  ref={fechaInputRef}
                  type="date"
                  min={BUSINESS_MIN_DATE_VALUE}
                  max={getTodayLocalDateValue()}
                  className={getInputClassName(
                    Boolean(fieldErrors.fecha),
                    'appearance-none pl-3 pr-7 py-2 text-[0.66rem] font-semibold',
                  )}
                  value={fecha}
                  {...ariaInvalid(Boolean(fieldErrors.fecha))}
                  aria-describedby={undefined}
                  onChange={(event) => {
                    setFecha(event.target.value);
                    limpiarErrorCampo('fecha');
                  }}
                />
                <Calendar
                  size={13}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-[0.62rem] font-black text-slate-700">
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
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
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
            <label className="ml-1 text-[0.62rem] font-black text-slate-700">
              Estado de pago
            </label>
            <div className="flex rounded-full bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setEstadoPago('PAGADO')}
                className={`flex-1 rounded-full py-1.5 text-[0.58rem] font-bold transition-all ${
                  estadoPago === 'PAGADO'
                    ? 'bg-[#102d92] text-white shadow-[0_6px_14px_rgba(16,45,146,0.2)]'
                    : 'text-slate-500 hover:text-slate-700'
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
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Pendiente de pago
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-[0.62rem] font-black text-slate-700">
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
                    : 'border-slate-200 bg-white text-slate-500'
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
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
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
                <label className="ml-1 text-[0.62rem] font-black text-slate-700">
                  Seleccionar sublotes
                </label>
                {sublotesSeleccionados.length > 0 ? (
                  <span className="rounded bg-[#f0f4ff] px-2 py-0.5 text-xs font-bold text-[#102d92] animate-in zoom-in">
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
                className={`w-full rounded-[8px] px-3 py-2.5 text-left shadow-sm transition ${
                  fieldErrors.sublotes
                    ? 'border border-rose-300 bg-rose-50/60 hover:border-rose-400'
                    : 'border border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`text-[0.62rem] ${
                      sublotesSeleccionados.length > 0
                        ? 'font-semibold text-slate-800'
                        : 'text-slate-400'
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

              <p className="ml-1 text-[0.55rem] text-slate-500">
                Selecciona los sublotes a los que aplica este gasto.
              </p>

              {showSublotesSelector ? (
                <div className="max-h-[180px] w-full overflow-y-auto rounded-[8px] border border-slate-200 bg-white shadow-sm animate-in fade-in slide-in-from-top-2">
                  {todosSublotes.length === 0 && !loading ? (
                    <div className="p-4 text-center text-sm text-slate-500">
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
                        className="flex cursor-pointer items-center gap-3 border-b border-slate-100 p-3 transition-colors last:border-b-0 hover:bg-slate-50"
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
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {seleccionado ? (
                            <CheckCircle2 size={14} className="text-white" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold leading-tight text-slate-800">
                            {sublote.tipoCafe} {sublote.calidad}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
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

        <div className="space-y-3 pt-3">
          <button
            type="button"
            disabled={saving || botonGuardarPresionado}
            onClick={handleConfirmar}
            className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#2051e5] px-4 text-[0.68rem] font-black text-white shadow-[0_8px_18px_rgba(32,81,229,0.26)] transition active:scale-[0.98] hover:bg-[#102d92] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving || botonGuardarPresionado ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              'Guardar Gasto'
            )}
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => navigate(-1)}
            className="w-full rounded-[8px] bg-transparent py-2.5 text-[0.62rem] font-bold text-slate-500 transition hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
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
            <div className="mx-auto mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#eef2ff] text-[#2051e5]">
              <Info size={16} aria-hidden="true" />
            </div>
            <h2 className="mb-2 text-center text-[0.92rem] font-black text-slate-900">
              Registrar este gasto?
            </h2>
            <p className="mb-5 text-center text-[0.68rem] leading-5 text-slate-500">
              Se guardara este gasto en el sistema{' '}
              {aplicaA === 'SUBLOTES'
                ? `asociado a ${sublotesSeleccionados.length} sublotes.`
                : 'como gasto general.'}
            </p>
            <div className="space-y-2">
              <button
                type="button"
                disabled={saving || botonGuardarPresionado}
                onClick={() => void handleGuardar()}
                className="w-full rounded-[8px] bg-[#2051e5] py-2.5 text-[0.68rem] font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving || botonGuardarPresionado
                  ? 'Guardando gasto...'
                  : 'Registrar gasto'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={cerrarModalConfirmar}
                className="w-full rounded-[8px] border border-slate-200 bg-white py-2.5 text-[0.62rem] font-bold text-slate-600 transition"
              >
                Cancelar
              </button>
            </div>
        </AccessibleModal>
      ) : null}

      {showDraftModal && draftPending ? (
        <AccessibleModal
          title="Borrador guardado"
          description="Encontramos un registro sin finalizar. Puedes continuar o empezar de nuevo."
          onClose={empezarGastoNuevo}
        >
          <h2 className="text-center text-lg font-black text-slate-950">
            Borrador guardado
          </h2>
          <p className="mx-auto mt-2 max-w-[300px] text-center text-sm font-semibold leading-6 text-slate-600">
            Encontramos un registro sin finalizar. Puedes continuar o empezar de nuevo.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={continuarBorradorGasto}
              className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-[#102d92] px-4 text-sm font-black text-white"
            >
              Continuar
            </button>
            <button
              type="button"
              onClick={empezarGastoNuevo}
              className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#334b85]"
            >
              Empezar de nuevo
            </button>
          </div>
        </AccessibleModal>
      ) : null}

      {showSuccessModal ? (
        <AccessibleModal
          title="Gasto registrado con exito"
          description="El gasto fue guardado correctamente en el sistema."
          onClose={() => setShowSuccessModal(false)}
          className="border-0 bg-transparent p-0 shadow-none"
        >
          <CafeSmartErrorState
            variant="success"
            title="Gasto registrado con éxito"
            message="El gasto fue guardado correctamente en el sistema."
            primaryLabel="Registrar otro gasto"
            secondaryLabel="Ver gastos"
            onPrimary={() => {
              setShowSuccessModal(false);
              resetForm();
            }}
            onSecondary={() => navigate('/gastos')}
            primaryBusy={saving}
            info="El movimiento quedó disponible en tus gastos operativos."
          />
        </AccessibleModal>
      ) : null}

      {showErrorModal ? (
        <AccessibleModal
          title="No pudimos registrar el gasto"
          description={`${showErrorModal.what} ${showErrorModal.action}`}
          onClose={() => setShowErrorModal(null)}
        >
            <div className="mx-auto mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertCircle size={16} aria-hidden="true" />
            </div>
            <h2 className="mb-2 text-center text-[0.92rem] font-black text-slate-900">
              No pudimos registrar el gasto
            </h2>
            <p
              className="mb-5 text-center text-[0.68rem] leading-5 text-slate-500"
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
                className="min-h-[42px] rounded-[12px] bg-[#2051e5] px-3 py-2.5 text-[0.68rem] font-black text-white shadow-[0_10px_22px_rgba(32,81,229,0.18)] transition hover:bg-[#1d45c5] active:scale-[0.98]"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => setShowErrorModal(null)}
                className="min-h-[42px] rounded-[12px] border border-[#d5deee] bg-white px-3 py-2.5 text-[0.62rem] font-bold text-slate-600 transition hover:border-[#93c5fd] hover:bg-[#f8fbff] hover:text-[#1e3a8a] active:scale-[0.98]"
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
    </div>
  );
}
