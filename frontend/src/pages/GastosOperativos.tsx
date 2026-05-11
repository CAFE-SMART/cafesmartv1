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
} from 'lucide-react';
import { InlineGuidedError } from '../components/forms/GuidedError';
import { ApiRequestError } from '../services/apiService';
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
import { formatCoffeeLabel, formatDisplayLabel } from '../utils/uiMessages';

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
  return `w-full rounded-[8px] border bg-white outline-none transition ${extraClasses} ${
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
    why: message || 'Hubo un problema interno. Intenta de nuevo.',
    how: 'Revisa tus datos y vuelve a intentarlo.',
    action: 'Toca "Reintentar" para guardar de nuevo.',
  };
}

function getFirstErrorField(errors: FormErrors) {
  return FIELD_ORDER.find((field) => errors[field]) ?? null;
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

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState<GuidanceMessage | null>(
    null,
  );
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
    setConcepto('');
    setDescripcion('');
    setMontoStr('');
    setFecha(getTodayLocalDateValue());
    setTipoGasto('TRANSPORTE');
    setEstadoPago('PAGADO');
    setAplicaA('GENERAL');
    setSublotesSeleccionados([]);
    setFieldErrors({});
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

          window.setTimeout(() => {
            enfocarCampo(localField);
          }, 80);

          return;
        }
      }

      const feedback = getSaveErrorGuidance(
        error instanceof Error ? error.message : '',
      );
      setShowErrorModal(feedback);
    } finally {
      setSaving(false);
      setBotonGuardarPresionado(false);
    }
  };

  const tipoOpciones = [
    { value: 'TRANSPORTE', label: 'Transporte', icon: Truck },
    { value: 'COMIDA', label: 'Comida', icon: Utensils },
    { value: 'SECADO', label: 'Secado', icon: SunMedium },
    { value: 'CARGUE', label: 'Cargue', icon: Archive },
    { value: 'DESCARGUE', label: 'Descargue', icon: ArchiveRestore },
    { value: 'OTROS', label: 'Otros', icon: MoreHorizontal },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f8f6f6] px-4 py-5 pb-24 font-sans text-slate-900">
      <main className="mx-auto max-w-[430px] space-y-4">
        <div className="relative min-h-[32px]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="absolute left-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition hover:bg-white"
            aria-label="Volver"
          >
            <ArrowLeft size={18} className="text-[#334155]" />
          </button>
          <h1 className="text-center text-[0.95rem] font-black text-[#111827]">
            Registro de Gastos
          </h1>
        </div>

        <div className="space-y-4">
          <div ref={conceptoSectionRef} className="space-y-1.5">
            <label className="ml-1 text-[0.72rem] font-black text-slate-700">
              Concepto del gasto
            </label>
            <input
              ref={conceptoInputRef}
              type="text"
              placeholder="Ej. Pago de jornaleros - Cosecha Oct"
              className={getInputClassName(
                Boolean(fieldErrors.concepto),
                'h-10 px-3 text-sm font-semibold',
              )}
              value={concepto}
              aria-invalid={Boolean(fieldErrors.concepto)}
              aria-describedby={undefined}
              onChange={(event) => {
                setConcepto(event.target.value);
                limpiarErrorCampo('concepto');
              }}
            />
            {fieldErrors.concepto ? (
              <InlineGuidedError
                message={fieldErrors.concepto}
                className="mt-2"
              />
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="ml-1 text-[0.72rem] font-black text-slate-700">
              Descripción breve
            </label>
            <textarea
              placeholder="Detalles adicionales..."
              rows={2}
              className={getInputClassName(
                false,
                'min-h-[68px] resize-none px-3 py-3 text-sm font-semibold',
              )}
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div ref={montoSectionRef} className="space-y-1.5">
              <label className="ml-1 text-[0.72rem] font-black text-slate-700">
                Monto ($)
              </label>
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
                    'h-10 pl-6 pr-3 text-sm font-semibold',
                  )}
                  value={formatearMonedaInput(montoStr)}
                  aria-invalid={Boolean(fieldErrors.monto)}
                  aria-describedby={undefined}
                  onChange={handleMontoChange}
                />
              </div>
              {fieldErrors.monto ? (
                <InlineGuidedError
                  message={fieldErrors.monto}
                  className="mt-2"
                />
              ) : null}
            </div>

            <div ref={fechaSectionRef} className="space-y-1.5">
              <label className="ml-1 text-[0.72rem] font-black text-slate-700">
                Fecha
              </label>
              <div className="relative">
                <input
                  ref={fechaInputRef}
                  type="date"
                  min={BUSINESS_MIN_DATE_VALUE}
                  max={getTodayLocalDateValue()}
                  className={getInputClassName(
                    Boolean(fieldErrors.fecha),
                    'h-10 appearance-none pl-3 pr-7 text-sm font-semibold',
                  )}
                  value={fecha}
                  aria-invalid={Boolean(fieldErrors.fecha)}
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
              {fieldErrors.fecha ? (
                <InlineGuidedError
                  message={fieldErrors.fecha}
                  className="mt-2"
                />
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-[0.72rem] font-black text-slate-700">
              Tipo de gasto
            </label>
            <div className="grid grid-cols-3 gap-2">
              {tipoOpciones.map((opcion) => {
                const Icon = opcion.icon;
                const isSelected = tipoGasto === opcion.value;

                return (
                  <button
                    key={opcion.value}
                    type="button"
                    onClick={() => setTipoGasto(opcion.value)}
                    className={`flex min-h-[62px] flex-col items-center justify-center gap-1.5 rounded-[8px] border p-2 transition-colors ${
                      isSelected
                        ? 'border-[#1f62ff] bg-[#eef4ff] text-[#1f62ff] shadow-[0_6px_14px_rgba(31,98,255,0.12)]'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Icon
                      size={16}
                      className={
                        isSelected ? 'text-[#1f62ff]' : 'text-slate-500'
                      }
                    />
                    <span className="text-[0.58rem] font-black uppercase tracking-normal">
                      {opcion.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-[0.72rem] font-black text-slate-700">
              Estado de pago
            </label>
            <div className="flex rounded-[8px] bg-[#e8eef6] p-1">
              <button
                type="button"
                onClick={() => setEstadoPago('PAGADO')}
                className={`flex-1 rounded-[6px] py-2 text-[0.72rem] font-black transition-all ${
                  estadoPago === 'PAGADO'
                    ? 'bg-white text-[#1f62ff] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Pagado
              </button>
              <button
                type="button"
                onClick={() => setEstadoPago('PENDIENTE')}
                className={`flex-1 rounded-[6px] py-2 text-[0.72rem] font-black transition-all ${
                  estadoPago === 'PENDIENTE'
                    ? 'bg-white text-[#1f62ff] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Pendiente
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-[0.72rem] font-black text-slate-700">
              A qué aplica este gasto?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAplicaA('GENERAL');
                  limpiarErrorCampo('sublotes');
                }}
                className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[8px] border p-2 transition-colors ${
                  aplicaA === 'GENERAL'
                    ? 'border-[#1f62ff] bg-[#eef4ff] text-[#1f62ff] shadow-[0_6px_14px_rgba(31,98,255,0.12)]'
                    : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                <Wallet
                  size={16}
                  className={
                    aplicaA === 'GENERAL' ? 'text-[#1f62ff]' : 'text-slate-500'
                  }
                />
                <span className="text-[0.58rem] font-black uppercase tracking-normal">
                  Gasto general
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAplicaA('SUBLOTES')}
                className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[8px] border p-2 transition-colors ${
                  aplicaA === 'SUBLOTES'
                    ? 'border-[#1f62ff] bg-[#eef4ff] text-[#1f62ff] shadow-[0_6px_14px_rgba(31,98,255,0.12)]'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Layers
                  size={16}
                  className={
                    aplicaA === 'SUBLOTES'
                      ? 'text-[#1f62ff]'
                      : 'text-slate-500'
                  }
                />
                <span className="text-[0.58rem] font-black uppercase tracking-normal">
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
                <label className="ml-1 text-[0.72rem] font-black text-slate-700">
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
                aria-invalid={Boolean(fieldErrors.sublotes)}
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
                            {formatCoffeeLabel(sublote.tipoCafe)}{' '}
                            {formatDisplayLabel(sublote.calidad)}
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
              {fieldErrors.sublotes ? (
                <InlineGuidedError
                  message={fieldErrors.sublotes}
                  className="mt-2"
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-3 pt-3">
          <button
            type="button"
            disabled={saving || botonGuardarPresionado}
            onClick={handleConfirmar}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#2f67eb] px-4 text-[0.95rem] font-black text-white shadow-[0_10px_22px_rgba(47,103,235,0.25)] transition active:scale-[0.98] hover:bg-[#2557d6] disabled:cursor-not-allowed disabled:opacity-70"
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
            className="w-full rounded-[8px] bg-transparent py-2.5 text-[0.9rem] font-bold text-slate-500 transition hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancelar
          </button>
        </div>
      </main>

      {showConfirmModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4 backdrop-blur-[2px] animate-in fade-in">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[260px] overflow-y-auto rounded-[16px] bg-white p-5 text-center shadow-2xl animate-in zoom-in-95">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#eef4ff] text-[#2051e5]">
              <Info size={16} />
            </div>
            <h3 className="mb-2 text-[0.95rem] font-black text-slate-900">
              Registrar este gasto?
            </h3>
            <p className="mb-5 text-[0.68rem] font-semibold leading-5 text-slate-500">
              Se guardará este gasto en el sistema.
            </p>
            <div className="space-y-2">
              <button
                type="button"
                disabled={saving || botonGuardarPresionado}
                onClick={() => void handleGuardar()}
                className="w-full rounded-[8px] bg-[#2051e5] py-2.5 text-[0.68rem] font-black text-white shadow-[0_8px_16px_rgba(32,81,229,0.24)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
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
          </div>
        </div>
      ) : null}

      {showSuccessModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4 backdrop-blur-[2px] animate-in fade-in">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[260px] overflow-y-auto rounded-[16px] bg-white p-5 text-center shadow-2xl animate-in zoom-in-95">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={16} />
            </div>
            <h3 className="mb-2 text-[0.88rem] font-black text-slate-900">
              Gasto registrado con éxito
            </h3>
            <p className="mb-5 text-[0.66rem] font-semibold leading-5 text-slate-500">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4 backdrop-blur-[2px] animate-in fade-in">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[260px] overflow-y-auto rounded-[16px] bg-white p-5 text-center shadow-2xl animate-in zoom-in-95">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] bg-rose-100 text-rose-600">
              <AlertCircle size={16} />
            </div>
            <h3 className="mb-2 text-[0.92rem] font-black text-slate-900">
              Error al registrar
            </h3>
            <p className="mb-5 text-[0.68rem] font-semibold leading-5 text-slate-500">
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

    </div>
  );
}
