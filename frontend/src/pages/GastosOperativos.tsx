import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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
  LoaderCircle,
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
import { formatearMonedaInput } from '../utils/formatMoney';

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
const MONTO_MAXIMO_GASTO = 99999999;
const CONCEPTO_MAX_LENGTH = 60;
const DESCRIPCION_MAX_LENGTH = 200;
const CONCEPTO_VALIDO_REGEX = /^[\p{L}\s]+$/u;

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
  return `w-full rounded-[14px] border outline-none transition ${extraClasses} ${
    hasError
      ? 'border-rose-300 bg-rose-50/40 text-rose-950 placeholder:text-rose-300 focus:border-rose-400 focus:ring-1 focus:ring-rose-200'
      : 'border-[#dde4f1] bg-[#f7f9fd] text-slate-900 focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]/20'
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
    const message =
      whatOverride ?? 'Agrega un nombre para identificar el gasto.';
    return {
      what: message,
      why: message,
      how: '',
      action: '',
    };
  }

  if (field === 'monto') {
    const message = whatOverride ?? 'Revisa el monto.';
    return {
      what: message,
      why: message,
      how: '',
      action: '',
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
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = (location.state ?? null) as {
    fromSecado?: boolean;
    returnTo?: string;
  } | null;
  const secadoReturnTo = locationState?.fromSecado
    ? locationState.returnTo
    : null;

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
  const preseleccionRutaAplicadaRef = useRef(false);

  const subloteIdsDesdeRuta = useMemo(() => {
    const multiple = searchParams.get('subloteIds');
    const single = searchParams.get('subloteId');
    const raw = multiple ?? single ?? '';

    return raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }, [searchParams]);

  const vieneDeSecado = searchParams.get('origen') === 'secado';

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

  useEffect(() => {
    if (
      preseleccionRutaAplicadaRef.current ||
      subloteIdsDesdeRuta.length === 0
    ) {
      return;
    }

    preseleccionRutaAplicadaRef.current = true;
    setAplicaA('SUBLOTES');
    setSublotesSeleccionados(subloteIdsDesdeRuta);

    if (vieneDeSecado) {
      setTipoGasto('SECADO');
      setConcepto((current) => current || 'Gasto de secado');
    }
  }, [subloteIdsDesdeRuta, vieneDeSecado]);

  const volverAlOrigen = () => {
    if (secadoReturnTo) {
      navigate(secadoReturnTo, {
        replace: true,
        state: { gastoSecadoRegistrado: false },
      });
      return;
    }

    navigate(-1);
  };

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


  const validarFormulario = (): FormErrors => {
    const errors: FormErrors = {};
    const fechaValidacion = validateBusinessDateRange(fecha);

    const conceptoNormalizado = concepto.trim();
    const lettersCount = (conceptoNormalizado.match(/\p{L}/gu) || []).length;

    if (!conceptoNormalizado) {
      errors.concepto = getFieldGuidance('concepto', {
        whatOverride: 'Escribe el concepto del gasto.',
      });
    } else if (!CONCEPTO_VALIDO_REGEX.test(conceptoNormalizado)) {
      errors.concepto = getFieldGuidance('concepto', {
        whatOverride: 'Solo se permiten letras y espacios.',
      });
    } else if (lettersCount < 3) {
      errors.concepto = getFieldGuidance('concepto', {
        whatOverride: 'El concepto debe ser descriptivo (mínimo 3 letras).',
      });
    }

    if (!montoStr) {
      errors.monto = getFieldGuidance('monto', {
        whatOverride: 'Ingresa el monto del gasto.',
      });
    } else if (Number(montoStr) <= 0) {
      errors.monto = getFieldGuidance('monto', {
        whatOverride: 'El monto debe ser mayor a $0.',
      });
    } else if (Number(montoStr) > MONTO_MAXIMO_GASTO) {
      errors.monto = getFieldGuidance('monto', {
        whatOverride: 'El monto supera el máximo permitido.',
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
    const valor = event.target.value;
    const tieneCaracterInvalido = /[^\d.,\s]/u.test(valor);

    if (tieneCaracterInvalido) {
      setFieldErrors((prev) => ({
        ...prev,
        monto: getFieldGuidance('monto', {
          whatOverride: 'Ingresa solo números.',
        }),
      }));
    }

    const crudo = valor.replace(/\D/g, '');
    if (crudo && Number(crudo) > MONTO_MAXIMO_GASTO) {
      setMontoStr(String(MONTO_MAXIMO_GASTO));
      setFieldErrors((prev) => ({
        ...prev,
        monto: getFieldGuidance('monto', {
          whatOverride: 'El monto supera el máximo permitido.',
        }),
      }));
      return;
    }
    setMontoStr(crudo);
    if (!tieneCaracterInvalido) {
      limpiarErrorCampo('monto');
    }
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
      if (secadoReturnTo) {
        navigate(secadoReturnTo, {
          replace: true,
          state: { gastoSecadoRegistrado: true },
        });
        return;
      }
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-5 pb-24 font-sans text-slate-900">
      <main className="mx-auto max-w-[430px] space-y-5">
        <header className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={volverAlOrigen}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#1D4ED8] shadow-sm"
            aria-label="Volver"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="text-[1.1rem] font-black text-[#121826]">
              Nuevo gasto
            </h1>
          </div>
          <div className="w-11" />
        </header>

        <div className="space-y-4 rounded-[18px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
          <div ref={conceptoSectionRef} className="space-y-1.5">
            <label className="ml-1 text-[0.72rem] font-black text-slate-700">
              Concepto del gasto
            </label>
            <input
              ref={conceptoInputRef}
              type="text"
              placeholder="Ej. Pago de jornaleros - Cosecha Oct"
              maxLength={CONCEPTO_MAX_LENGTH}
              className={getInputClassName(
                Boolean(fieldErrors.concepto),
                'py-3 px-4 text-sm font-semibold',
              )}
              value={concepto}
              aria-invalid={Boolean(fieldErrors.concepto)}
              aria-describedby={undefined}
              onChange={(event) => {
                const soloLetrasYEspacios = event.target.value.replace(
                  /[^\p{L}\s]/gu,
                  '',
                );
                setConcepto(soloLetrasYEspacios.slice(0, CONCEPTO_MAX_LENGTH));
                limpiarErrorCampo('concepto');
              }}
            />
            {fieldErrors.concepto ? (
              <InlineGuidedError
                message={fieldErrors.concepto}
                className="mt-2"
              />
            ) : (
              <div className="flex items-center justify-between px-1">
                <span className="text-[0.62rem] font-semibold text-slate-400">
                  Solo se permiten letras y espacios en el concepto del gasto.
                </span>
                <p className="text-[0.62rem] font-semibold text-slate-400">
                  {concepto.length}/{CONCEPTO_MAX_LENGTH}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="ml-1 text-[0.72rem] font-black text-slate-700">
              Descripción breve
            </label>
            <textarea
              placeholder="Detalles adicionales..."
              rows={2}
              maxLength={DESCRIPCION_MAX_LENGTH}
              className={getInputClassName(
                false,
                'min-h-[80px] resize-none px-4 py-3 text-sm font-semibold',
              )}
              value={descripcion}
              onChange={(event) =>
                setDescripcion(
                  event.target.value.slice(0, DESCRIPCION_MAX_LENGTH),
                )
              }
            />
            <p className="ml-1 text-right text-[0.62rem] font-semibold text-slate-400">
              {descripcion.length}/{DESCRIPCION_MAX_LENGTH}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div ref={montoSectionRef} className="space-y-1.5">
              <label className="ml-1 text-[0.72rem] font-black text-slate-700">
                Monto ($)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[0.78rem] font-bold text-slate-400">
                  $
                </span>
                <input
                  ref={montoInputRef}
                  type="text"
                  placeholder="0.00"
                  className={getInputClassName(
                    Boolean(fieldErrors.monto),
                    'py-3 pl-8 pr-4 text-sm font-semibold',
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
              ) : (
                <p className="ml-1 text-[0.62rem] font-semibold text-slate-400">
                  Max. $99.999.999
                </p>
              )}
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
                    'py-3 appearance-none pl-4 pr-9 text-sm font-semibold',
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
                  size={14}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
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
                    className={`flex min-h-[66px] flex-col items-center justify-center gap-1.5 rounded-[14px] border p-2 transition-colors ${
                      isSelected
                        ? 'border-[#1D4ED8] bg-[#eef2ff] text-[#1D4ED8] shadow-[0_4px_10px_rgba(29,78,216,0.08)]'
                        : 'border-[#dde4f1] bg-[#f7f9fd] text-slate-500 hover:bg-[#f3f6ff]'
                    }`}
                  >
                    <Icon
                      size={16}
                      className={
                        isSelected ? 'text-[#1D4ED8]' : 'text-slate-500'
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
            <div className="flex rounded-[14px] bg-[#f0f4ff] p-1">
              <button
                type="button"
                onClick={() => setEstadoPago('PAGADO')}
                className={`flex-1 rounded-[10px] py-2 text-[0.72rem] font-black transition-all ${
                  estadoPago === 'PAGADO'
                    ? 'bg-white text-[#1D4ED8] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Pagado
              </button>
              <button
                type="button"
                onClick={() => setEstadoPago('PENDIENTE')}
                className={`flex-1 rounded-[10px] py-2 text-[0.72rem] font-black transition-all ${
                  estadoPago === 'PENDIENTE'
                    ? 'bg-white text-[#1D4ED8] shadow-sm'
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
                className={`flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-[14px] border p-2 transition-colors ${
                  aplicaA === 'GENERAL'
                    ? 'border-[#1D4ED8] bg-[#eef2ff] text-[#1D4ED8] shadow-[0_4px_10px_rgba(29,78,216,0.08)]'
                    : 'border-[#dde4f1] bg-[#f7f9fd] text-slate-500 hover:bg-[#f3f6ff]'
                }`}
              >
                <Wallet
                  size={16}
                  className={
                    aplicaA === 'GENERAL' ? 'text-[#1D4ED8]' : 'text-slate-500'
                  }
                />
                <span className="text-[0.58rem] font-black uppercase tracking-normal">
                  Gasto general
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAplicaA('SUBLOTES')}
                className={`flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-[14px] border p-2 transition-colors ${
                  aplicaA === 'SUBLOTES'
                    ? 'border-[#1D4ED8] bg-[#eef2ff] text-[#1D4ED8] shadow-[0_4px_10px_rgba(29,78,216,0.08)]'
                    : 'border-[#dde4f1] bg-[#f7f9fd] text-slate-500 hover:bg-[#f3f6ff]'
                }`}
              >
                <Layers
                  size={16}
                  className={
                    aplicaA === 'SUBLOTES' ? 'text-[#1D4ED8]' : 'text-slate-500'
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
                  <span className="rounded bg-[#f0f4ff] px-2 py-0.5 text-xs font-bold text-[#1D4ED8] animate-in zoom-in">
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
                className={`w-full rounded-[14px] border px-4 py-3 text-left transition ${
                  fieldErrors.sublotes
                    ? 'border border-rose-300 bg-rose-50/40 hover:border-rose-400'
                    : 'border border-[#dde4f1] bg-[#f7f9fd] hover:border-slate-300'
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
                <div className="max-h-[180px] w-full overflow-y-auto rounded-[14px] border border-[#dde4f1] bg-white shadow-sm animate-in fade-in slide-in-from-top-2">
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
                              ? 'border-[#1D4ED8] bg-[#1D4ED8]'
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

        <div className="rounded-[20px] border border-[#e4e9f5] bg-white p-4 shadow-[0_4px_14px_rgba(20,35,85,0.05)]">
          <div className="grid gap-2.5">
            <button
              type="button"
              disabled={saving || botonGuardarPresionado}
              onClick={handleConfirmar}
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#1D4ED8] px-5 py-4 text-[1rem] font-medium text-white shadow-[0_8px_20px_rgba(29,78,216,0.22)] transition hover:bg-[#1e40af] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
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
              onClick={volverAlOrigen}
              className="inline-flex min-h-[46px] w-full items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-[0.95rem] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Regresar
            </button>
          </div>
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
                className="relative overflow-hidden w-full rounded-full bg-[#1D4ED8] py-3 text-[0.85rem] font-semibold text-white shadow-[0_8px_16px_rgba(29,78,216,0.16)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {(saving || botonGuardarPresionado) && (
                  <>
                    <style>{`
                      @keyframes progressLoading {
                        0% { width: 0%; }
                        100% { width: 100%; }
                      }
                    `}</style>
                    <div 
                      className="absolute inset-y-0 left-0 bg-[#1e40af]" 
                      style={{ 
                        animation: 'progressLoading 2s ease-in-out infinite' 
                      }} 
                    />
                  </>
                )}
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {saving || botonGuardarPresionado ? (
                    <>
                      <LoaderCircle size={16} className="animate-spin" />
                      Guardando gasto...
                    </>
                  ) : (
                    'Registrar gasto'
                  )}
                </span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={cerrarModalConfirmar}
                className="w-full rounded-full border border-slate-200 bg-white py-3 text-[0.82rem] font-semibold text-slate-600 transition hover:bg-slate-50"
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
                className="w-full rounded-full bg-[#1D4ED8] py-3 text-[0.85rem] font-semibold text-white transition active:scale-[0.98]"
              >
                Registrar otro gasto
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => navigate('/inicio')}
                className="w-full rounded-full border border-slate-200 bg-white py-3 text-[0.82rem] font-semibold text-slate-600 transition hover:bg-slate-50"
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
                className="w-full rounded-full bg-[#1D4ED8] py-3 text-[0.85rem] font-semibold text-white transition active:scale-[0.98]"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => setShowErrorModal(null)}
                className="w-full rounded-full border border-slate-200 bg-white py-3 text-[0.82rem] font-semibold text-slate-600 transition hover:bg-slate-50"
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
