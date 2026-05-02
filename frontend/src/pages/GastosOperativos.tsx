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
import { listarCompras, type CompraListadoItem } from '../services/comprasService';
import { crearGasto, type CrearGastoPayload } from '../services/gastosService';
import { getTodayLocalDateValue, toIsoDateAtUtcNoon } from '../utils/date';
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

const FIELD_ORDER: FieldKey[] = ['concepto', 'monto', 'fecha', 'sublotes'];

const BACKEND_FIELD_MAP: Record<string, FieldKey> = {
  conceptoGasto: 'concepto',
  montoGasto: 'monto',
  fechaGasto: 'fecha',
  subloteIds: 'sublotes',
};

function generarId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
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
      what: whatOverride ?? 'No hay sublotes disponibles para asociar este gasto.',
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
    why: message || 'Surgió un problema interno. Intenta de nuevo.',
    how: 'Revisa tus datos y vuelve a intentarlo.',
    action: 'Toca "Reintentar" para guardar de nuevo.',
  };
}

function getFirstErrorField(errors: FormErrors) {
  return FIELD_ORDER.find((field) => errors[field]) ?? null;
}

function InlineFieldError({ id, feedback }: { id: string; feedback: GuidanceMessage }) {
  return (
    <div
      id={id}
      role="alert"
      className="rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-2 text-[0.66rem] text-rose-800 shadow-sm"
    >
      <div className="flex items-start gap-2">
        <AlertCircle size={13} className="mt-0.5 shrink-0 text-rose-600" />
        <div className="leading-snug">
          <p className="font-bold">{feedback.what}</p>
          <p className="mt-0.5 text-rose-700">{feedback.action}</p>
        </div>
      </div>
    </div>
  );
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
    <div className="fixed inset-x-0 bottom-20 z-50 px-4">
      <div className="mx-auto w-full max-w-[340px] rounded-[12px] border border-rose-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.14)]">
        <div className="flex items-start gap-2.5 p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertCircle size={15} />
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
  const [sublotesSeleccionados, setSublotesSeleccionados] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [botonGuardarPresionado, setBotonGuardarPresionado] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [floatingNotice, setFloatingNotice] = useState<FloatingNotice | null>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState<GuidanceMessage | null>(null);
  const [showSublotesSelector, setShowSublotesSelector] = useState(false);

  const conceptoSectionRef = useRef<HTMLDivElement | null>(null);
  const montoSectionRef = useRef<HTMLDivElement | null>(null);
  const fechaSectionRef = useRef<HTMLDivElement | null>(null);
  const sublotesSectionRef = useRef<HTMLDivElement | null>(null);

  const conceptoInputRef = useRef<HTMLInputElement | null>(null);
  const montoInputRef = useRef<HTMLInputElement | null>(null);
  const fechaInputRef = useRef<HTMLInputElement | null>(null);
  const sublotesButtonRef = useRef<HTMLButtonElement | null>(null);

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
      .sort((a, b) => new Date(b.fechaCompra).getTime() - new Date(a.fechaCompra).getTime());
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

    if (!concepto.trim()) {
      errors.concepto = getFieldGuidance('concepto');
    }

    if (!montoStr || Number(montoStr) <= 0) {
      errors.monto = getFieldGuidance('monto');
    }

    if (!fecha) {
      errors.fecha = getFieldGuidance('fecha');
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

  const cerrarModalConfirmar = () => {
    setShowConfirmModal(false);
    setBotonGuardarPresionado(false);
  };

  const toggleSublote = (id: string) => {
    const estabaSeleccionado = sublotesSeleccionados.includes(id);

    setSublotesSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((currentId) => currentId !== id) : [...prev, id],
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

      const feedback = getSaveErrorGuidance(error instanceof Error ? error.message : '');
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
      <main className="mx-auto max-w-[340px] space-y-3 rounded-[24px] border border-[#dbe2ee] bg-[#fbfbfb] px-3 py-3 shadow-[0_14px_38px_rgba(15,23,42,0.06)]">
        <div className="relative min-h-[28px]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="absolute left-0 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition hover:bg-slate-100"
            aria-label="Volver"
          >
            <ArrowLeft size={14} className="text-[#102d92]" />
          </button>
          <h1 className="text-center text-[0.78rem] font-black text-black">Registro de Gastos</h1>
        </div>

        <div className="space-y-2.5">
          <div ref={conceptoSectionRef} className="space-y-1.5">
            <label className="ml-1 text-[0.62rem] font-black text-slate-700">Concepto del gasto</label>
            <input
              ref={conceptoInputRef}
              type="text"
              placeholder="Ej. Pago de jornaleros - Cosecha Oct"
              className={getInputClassName(Boolean(fieldErrors.concepto), 'px-3 py-2 text-[0.66rem] font-semibold')}
              value={concepto}
              aria-invalid={Boolean(fieldErrors.concepto)}
              aria-describedby={fieldErrors.concepto ? 'gasto-concepto-error' : undefined}
              onChange={(event) => {
                setConcepto(event.target.value);
                limpiarErrorCampo('concepto');
              }}
            />
            {fieldErrors.concepto ? (
              <InlineFieldError id="gasto-concepto-error" feedback={fieldErrors.concepto} />
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="ml-1 text-[0.62rem] font-black text-slate-700">Descripcion breve</label>
            <textarea
              placeholder="Detalles adicionales..."
              rows={2}
              className={getInputClassName(false, 'resize-none px-3 py-2 text-[0.66rem] font-semibold')}
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div ref={montoSectionRef} className="space-y-1.5">
              <label className="ml-1 text-[0.62rem] font-black text-slate-700">Monto ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.7rem] font-bold text-slate-400">
                  $
                </span>
                <input
                  ref={montoInputRef}
                  type="text"
                  placeholder="0.00"
                  className={getInputClassName(
                    Boolean(fieldErrors.monto),
                    'pl-6 pr-3 py-2 text-[0.66rem] font-semibold',
                  )}
                  value={formatearMonedaInput(montoStr)}
                  aria-invalid={Boolean(fieldErrors.monto)}
                  aria-describedby={fieldErrors.monto ? 'gasto-monto-error' : undefined}
                  onChange={handleMontoChange}
                />
              </div>
              {fieldErrors.monto ? (
                <InlineFieldError id="gasto-monto-error" feedback={fieldErrors.monto} />
              ) : null}
            </div>

            <div ref={fechaSectionRef} className="space-y-1.5">
              <label className="ml-1 text-[0.62rem] font-black text-slate-700">Fecha</label>
              <div className="relative">
                <input
                  ref={fechaInputRef}
                  type="date"
                  className={getInputClassName(
                    Boolean(fieldErrors.fecha),
                    'appearance-none pl-3 pr-7 py-2 text-[0.66rem] font-semibold',
                  )}
                  value={fecha}
                  aria-invalid={Boolean(fieldErrors.fecha)}
                  aria-describedby={fieldErrors.fecha ? 'gasto-fecha-error' : undefined}
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
              {fieldErrors.fecha ? (
                <InlineFieldError id="gasto-fecha-error" feedback={fieldErrors.fecha} />
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-[0.62rem] font-black text-slate-700">Tipo de gasto</label>
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
                        ? 'border-[#102d92] bg-[#f0f4ff] text-[#102d92]'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Icon
                      size={12}
                      className={isSelected ? 'text-[#102d92]' : 'text-slate-400'}
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
            <label className="ml-1 text-[0.62rem] font-black text-slate-700">Estado del pago</label>
            <div className="flex rounded-full bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setEstadoPago('PAGADO')}
                className={`flex-1 rounded-full py-1.5 text-[0.58rem] font-bold transition-all ${
                  estadoPago === 'PAGADO'
                    ? 'bg-white text-[#102d92] shadow'
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
                    ? 'bg-white text-[#102d92] shadow'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Pendiente
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-[0.62rem] font-black text-slate-700">A que aplica este gasto?</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAplicaA('GENERAL');
                  limpiarErrorCampo('sublotes');
                }}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-[8px] border p-2 transition-colors ${
                  aplicaA === 'GENERAL'
                    ? 'border-[#102d92] bg-[#f0f4ff] text-[#102d92]'
                    : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                <Wallet
                  size={12}
                  className={aplicaA === 'GENERAL' ? 'text-[#102d92]' : 'text-slate-400'}
                />
                <span className="text-[0.44rem] font-black uppercase tracking-normal">
                  Gasto General
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAplicaA('SUBLOTES')}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-[8px] border p-2 transition-colors ${
                  aplicaA === 'SUBLOTES'
                    ? 'border-[#102d92] bg-[#f0f4ff] text-[#102d92]'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Layers
                  size={12}
                  className={aplicaA === 'SUBLOTES' ? 'text-[#102d92]' : 'text-slate-400'}
                />
                <span className="text-[0.44rem] font-black uppercase tracking-normal">
                  Asociar a Sublotes
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
                <label className="ml-1 text-[0.62rem] font-black text-slate-700">Seleccionar sublotes</label>
                {sublotesSeleccionados.length > 0 ? (
                  <span className="rounded bg-[#f0f4ff] px-2 py-0.5 text-xs font-bold text-[#102d92] animate-in zoom-in">
                    {sublotesSeleccionados.length} seleccionados
                  </span>
                ) : null}
              </div>

              <button
                ref={sublotesButtonRef}
                type="button"
                onClick={() => setShowSublotesSelector((prev) => !prev)}
                aria-invalid={Boolean(fieldErrors.sublotes)}
                aria-describedby={fieldErrors.sublotes ? 'gasto-sublotes-error' : undefined}
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

              {fieldErrors.sublotes ? (
                <InlineFieldError id="gasto-sublotes-error" feedback={fieldErrors.sublotes} />
              ) : null}

              {showSublotesSelector ? (
                <div className="max-h-[180px] w-full overflow-y-auto rounded-[8px] border border-slate-200 bg-white shadow-sm animate-in fade-in slide-in-from-top-2">
                  {todosSublotes.length === 0 && !loading ? (
                    <div className="p-4 text-center text-sm text-slate-500">
                      No hay sublotes disponibles en el sistema.
                    </div>
                  ) : null}

                  {todosSublotes.map((sublote) => {
                    const seleccionado = sublotesSeleccionados.includes(sublote.id);

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
                          {seleccionado ? <CheckCircle2 size={14} className="text-white" /> : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold leading-tight text-slate-800">
                            {sublote.tipoCafe} {sublote.calidad}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Comprado: {sublote.fechaCompra.slice(0, 10)} - {sublote.pesoActual} kg
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[340px] overflow-y-auto rounded-[14px] bg-white p-5 shadow-2xl animate-in zoom-in-95">
            <div className="mx-auto mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#eef2ff] text-[#2051e5]">
              <Info size={16} />
            </div>
            <h3 className="mb-2 text-center text-[0.92rem] font-black text-slate-900">
              Registrar este gasto?
            </h3>
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
                {saving || botonGuardarPresionado ? 'Guardando gasto...' : 'Registrar gasto'}
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
          </div>
        </div>
      ) : null}

      {showSuccessModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[340px] overflow-y-auto rounded-[14px] bg-white p-5 shadow-2xl animate-in zoom-in-95">
            <div className="mx-auto mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={16} />
            </div>
            <h3 className="mb-2 text-center text-[0.92rem] font-black text-slate-900">
              Gasto registrado con exito
            </h3>
            <p className="mb-5 text-center text-[0.68rem] leading-5 text-slate-500">
              El gasto fue guardado correctamente en el sistema.
            </p>
            <div className="space-y-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setShowSuccessModal(false);
                  resetForm();
                }}
                className="w-full rounded-[8px] bg-[#2051e5] py-2.5 text-[0.68rem] font-black text-white transition active:scale-[0.98]"
              >
                Registrar otro gasto
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => navigate('/inicio')}
                className="w-full rounded-[8px] bg-transparent py-2.5 text-[0.62rem] font-bold text-slate-500 transition hover:text-slate-800"
              >
                Ir a inicio
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showErrorModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[340px] overflow-y-auto rounded-[14px] bg-white p-5 shadow-2xl animate-in zoom-in-95">
            <div className="mx-auto mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertCircle size={16} />
            </div>
            <h3 className="mb-2 text-center text-[0.92rem] font-black text-slate-900">
              Error al registrar
            </h3>
            <p className="mb-5 text-center text-[0.68rem] leading-5 text-slate-500">
              No se pudo guardar el gasto. Intenta de nuevo.
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setShowErrorModal(null);
                  void handleGuardar();
                }}
                className="w-full rounded-[8px] bg-[#2051e5] py-2.5 text-[0.68rem] font-black text-white transition active:scale-[0.98]"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => setShowErrorModal(null)}
                className="w-full rounded-[8px] bg-transparent py-2.5 text-[0.62rem] font-bold text-slate-500 transition hover:text-slate-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
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
