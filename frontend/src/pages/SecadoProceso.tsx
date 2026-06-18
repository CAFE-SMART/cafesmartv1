import React, { useMemo, useState } from 'react';
import { dividirLoteSecado, getCalidadInferior } from '../services/secadoDivisionService';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Play,
  Save,
  SunMedium,
  X,
} from 'lucide-react';
import {
  createGuidedError,
  InlineGuidedError,
  type GuidedErrorMessage,
} from '../components/forms/GuidedError';
import {
  getSecadoSelectedKg,
  getSecadoSession,
  saveSecadoResults,
  SecadoValidationError,
  startSecadoProcess,
} from '../utils/secadoFlow';
import {
  BUSINESS_MIN_DATE_VALUE,
  getTodayLocalDateValue,
  toIsoDateAtUtcNoon,
  validateBusinessDateRange,
} from '../utils/date';
import { crearGasto } from '../services/gastosService';
import { obtenerDeviceId } from '../utils/deviceId';
import { CafeSmartProcessingScreen } from '../components/CafeSmartProcessingScreen';
import { CafeSmartErrorState } from '../components/CafeSmartErrorState';
import { CafeSmartDatePicker } from '../components/common/CafeSmartDatePicker';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

function kg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

function dateInput(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.slice(0, 10);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    return getTodayLocalDateValue();

  return formatLocalDateValue(date);
}

function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function QualityDot({ color }: { color: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
  if (!date) return value;
  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getSecadoGuidance(message: string): GuidedErrorMessage {
  if (message.includes('Registra el resultado del secado')) {
    return createGuidedError(
      message,
      'Registra el resultado del secado.',
      'Ingresa al menos un peso en Bueno, Regular o Malo para continuar.',
      'Completa un resultado para poder finalizar.',
    );
  }

  if (
    message.includes('Debes registrar al menos un resultado') ||
    message.includes('resultado de secado')
  ) {
    return createGuidedError(
      'Debes registrar al menos un resultado de secado.',
      'Ingresa cuánto café quedó en Bueno, Regular o Malo.',
      'Completa un resultado para poder finalizar.',
      'Ingresa cuánto café quedó en Bueno, Regular o Malo.',
    );
  }

  if (message.includes('resultado supera el peso disponible')) {
    return createGuidedError(
      'El resultado supera el peso disponible del secado.',
      'La suma de Bueno, Regular y Malo no puede pasar el peso de entrada.',
      'Ajusta los kilos antes de continuar.',
      'Ajusta los kilos antes de continuar.',
    );
  }

  if (message.includes('peso seco supera')) {
    return createGuidedError(
      message,
      'El peso seco supera el peso inicial.',
      'Revisa los valores antes de continuar.',
      'La suma de Bueno, Regular y Malo no puede pasar la entrada húmeda.',
    );
  }

  if (message.includes('peso válido') || message.includes('negativos')) {
    return createGuidedError(
      message,
      'Ingresa un peso válido.',
      'Usa solo números mayores o iguales a cero.',
      'Revisa los valores antes de continuar.',
    );
  }

  if (message.includes('fecha')) {
    return createGuidedError(
      message,
      'Revisa la fecha del secado.',
      'Solo puedes registrar fechas desde 2026 hasta hoy.',
      'Elige una fecha valida para continuar.',
    );
  }

  if (message.includes('salida no puede superar')) {
    return createGuidedError(
      message,
      'La salida supera la entrada.',
      'El peso seco no puede ser mayor que el entro al secado.',
      'Ajusta los kilos de salida.',
    );
  }

  if (message.includes('salida seca')) {
    return createGuidedError(
      message,
      'Registra el resultado del secado.',
      'Ingresa al menos un peso en Bueno, Regular o Malo para continuar.',
      'Completa un resultado para poder finalizar.',
    );
  }

  return createGuidedError(
    message,
    'Revisa el resultado del secado.',
    'Hay un dato que no podemos guardar asi.',
    'Ajusta el peso y vuelve a finalizar.',
  );
}


const DivisionCalidadModal = ({ peso, calidad, onClose, onConfirm }: { peso: number; calidad: string; onClose: () => void; onConfirm: (pesoMismo: number, pesoInferior: number) => void }) => {
  const [porcentaje, setPorcentaje] = useState(10);
  const resultado = dividirLoteSecado(peso, calidad, porcentaje);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-4 m-4 max-w-sm w-full">
        <h3 className="font-bold text-lg mb-3">Dividir por Calidad</h3>
        <p className="text-sm text-gray-600 mb-3">Ingrese el porcentaje de cafe con calidad inferior</p>
        <div className="mb-3">
          <label htmlFor="division-calidad-porcentaje" className="text-xs font-semibold text-gray-500">Porcentaje (%)</label>
          <input id="division-calidad-porcentaje" type="number" min="0" max="100" value={porcentaje} onChange={e => setPorcentaje(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 mt-1" />
        </div>
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="flex justify-between text-sm"><span>Cantidad misma calidad:</span><span className="font-bold">{resultado.pesoMismaCalidad.toFixed(1)} KG</span></div>
          <div className="flex justify-between text-sm mt-1"><span>Cantidad inferior ({resultado.calidadInferior}):</span><span className="font-bold text-orange-600">{resultado.pesoCalidadInferior.toFixed(1)} KG</span></div>
          <div className="flex justify-between text-sm mt-1"><span>Merma:</span><span className="font-bold text-red-600">{resultado.mermaTotal.toFixed(1)} KG</span></div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg">Cancelar</button>
          <button onClick={() => onConfirm(resultado.pesoMismaCalidad, resultado.pesoCalidadInferior)} className="flex-1 py-2 bg-green-600 text-white rounded-lg">Confirmar</button>
        </div>
      </div>
    </div>
  );
};

const MAX_SECADO_OUTPUT_KG = 100000;
const MAX_SECADO_EXPENSE_COP = 20000000;
const SECADO_DRAFT_STORAGE_KEY = 'cafe-smart:secado-draft:v1';
const SECADO_SELECTION_DRAFT_PREFIX = 'cafe-smart:secado-seleccion-draft:v1';
const SECADO_RETURN_PATHS = new Set([
  '/inventario',
  '/ajustes',
  '/compras',
  '/ventas',
  '/inicio',
]);

function getSecadoReturnPath(from?: string) {
  if (!from) return '/inicio';
  const normalized = from.split('?')[0]?.replace(/\/$/, '') || from;
  return SECADO_RETURN_PATHS.has(normalized) ? normalized : '/inicio';
}

function clearSecadoDrafts() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SECADO_DRAFT_STORAGE_KEY);
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(SECADO_SELECTION_DRAFT_PREFIX)) {
      window.localStorage.removeItem(key);
    }
  }
}

function sanitizeKgInput(value: string, max: number) {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const [integer = '', ...decimalParts] = normalized.split('.');
  const decimal = decimalParts.join('').slice(0, 2);
  const limitedInteger = integer.replace(/^0+(?=\d)/, '').slice(0, 7);
  const next = decimalParts.length > 0 ? `${limitedInteger || '0'}.${decimal}` : limitedInteger;
  const numeric = Number(next);
  if (Number.isFinite(numeric) && numeric > max) return String(max);
  return next;
}

function formatMoneyInput(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return '';
  const numeric = Number(digits);
  if (!Number.isFinite(numeric)) return '';
  return new Intl.NumberFormat('es-CO').format(numeric);
}

export default function SecadoProceso() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOffline } = useNetworkStatus();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const session = sessionId ? getSecadoSession(sessionId) : null;
  const originPath = getSecadoReturnPath(
    (location.state as { from?: string } | null)?.from,
  );

  const [showDivisionModal, setShowDivisionModal] = useState(false);
  const [divisionData, setDivisionData] = useState<{ peso: number; calidad: string } | null>(null);

  const abrirDivisionCalidad = (peso: number, calidad: string) => {
    setDivisionData({ peso, calidad });
    setShowDivisionModal(true);
  };

  const [step, setStep] = useState<'config' | 'active' | 'finish'>(() => {
    if (searchParams.get('step') === 'finish' || session?.estado === 'READY') {
      return 'finish';
    }
    if (session?.estado === 'IN_PROCESS') {
      return 'active';
    }
    return 'config';
  });
  const [startDate, setStartDate] = useState(
    session ? dateInput(session.startedAt) : dateInput(''),
  );
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDate, setEndDate] = useState(getTodayLocalDateValue());
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  const [buenoKg, setBuenoKg] = useState(
    session?.outputBuenoKg ? String(session.outputBuenoKg) : '',
  );
  const [regularKg, setRegularKg] = useState(
    session?.outputRegularKg ? String(session.outputRegularKg) : '',
  );
  const [maloKg, setMaloKg] = useState(
    session?.outputMaloKg ? String(session.outputMaloKg) : '',
  );
  const [withExpense, setWithExpense] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseConcept, setExpenseConcept] = useState('Gasto de secado');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(getTodayLocalDateValue());
  const [expenseDatePickerOpen, setExpenseDatePickerOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [outputNotice, setOutputNotice] = useState<string | null>(null);
  const [mostrarConfirmacionMermaCero, setMostrarConfirmacionMermaCero] =
    useState(false);
  const [registrandoSecado, setRegistrandoSecado] = useState(false);
  const [startFeedback, setStartFeedback] = useState<'success' | 'error' | null>(
    null,
  );

  const totalEntrada = useMemo(
    () =>
      session
        ? session.sublotes.reduce(
            (sum, sublote) => sum + getSecadoSelectedKg(sublote),
            0,
          )
        : 0,
    [session],
  );
  const fechaInicioReal = session ? dateInput(session.startedAt) : startDate;
  const maxSalidaPermitida = Math.min(totalEntrada, MAX_SECADO_OUTPUT_KG);
  const sourceQuality = keyOf(session?.calidad ?? '');
  const outputEntries = [buenoKg, regularKg, maloKg].map((raw) => {
    const clean = raw.trim();
    const value = clean === '' ? 0 : Number(clean);
    return {
      clean,
      value: Number.isFinite(value) ? value : 0,
      invalid: clean !== '' && (!Number.isFinite(value) || value < 0),
    };
  });
  const relevantOutputEntries = outputEntries;
  const [buenoEntry, regularEntry, maloEntry] = outputEntries;
  const bueno = buenoEntry.value;
  const regular = regularEntry.value;
  const malo = maloEntry.value;
  const totalSalida = bueno + regular + malo;
  const hasResultadoIngresado =
    buenoKg.trim() !== '' || regularKg.trim() !== '' || maloKg.trim() !== '';
  const merma = hasResultadoIngresado ? Math.max(0, totalEntrada - totalSalida) : 0;
  const mermaPct =
    totalEntrada > 0 ? ((merma / totalEntrada) * 100).toFixed(1) : '0.0';
  const expenseAmountValue = Number(expenseAmount.replace(/\D/g, ''));
  const expenseAmountExceedsMax =
    Number.isFinite(expenseAmountValue) &&
    expenseAmountValue > MAX_SECADO_EXPENSE_COP;
  const expenseAmountError = expenseAmountExceedsMax
    ? `El monto supera el máximo permitido de $${new Intl.NumberFormat('es-CO').format(MAX_SECADO_EXPENSE_COP)}.`
    : null;
  const outputFields = [
    {
      quality: 'BUENO' as const,
      label: 'Bueno',
      value: buenoKg,
      setter: setBuenoKg,
    },
    {
      quality: 'REGULAR' as const,
      label: 'Regular',
      value: regularKg,
      setter: setRegularKg,
    },
    {
      quality: 'MALO' as const,
      label: 'Malo',
      value: maloKg,
      setter: setMaloKg,
    },
  ];

  const getOtherOutputsTotal = (quality: 'BUENO' | 'REGULAR' | 'MALO') => {
    if (quality === 'BUENO') return regular + malo;
    if (quality === 'REGULAR') return bueno + malo;
    return bueno + regular;
  };

  const updateOutputWeight = (
    quality: 'BUENO' | 'REGULAR' | 'MALO',
    rawValue: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    const otherTotal = getOtherOutputsTotal(quality);
    const remaining = Math.max(0, round2(totalEntrada - otherTotal));
    const next = sanitizeKgInput(rawValue, remaining);
    const attempted = Number(rawValue.replace(',', '.').replace(/[^\d.]/g, ''));

    if (Number.isFinite(attempted) && attempted > remaining) {
      setOutputNotice(
        `La salida no puede superar la entrada. Ya registraste ${kg(
          otherTotal + Number(next || 0),
        )} de ${kg(totalEntrada)} disponibles.`,
      );
    } else {
      setOutputNotice(null);
    }

    setter(next);
    setError(null);
    setMostrarConfirmacionMermaCero(false);
  };

  const updateExpenseAmount = (rawValue: string) => {
    const digits = rawValue.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    if (!digits) {
      setExpenseAmount('');
      return;
    }

    const nextAmount = Number(digits);
    if (!Number.isFinite(nextAmount) || nextAmount > MAX_SECADO_EXPENSE_COP) {
      return;
    }

    setExpenseAmount(formatMoneyInput(digits));
  };

  const guardarResultadoSecado = () => {
    if (!sessionId || !session || registrandoSecado) return;

    try {
      setRegistrandoSecado(true);
      setMostrarConfirmacionMermaCero(false);
      saveSecadoResults(sessionId, {
        outputBuenoKg: bueno,
        outputBuenoHumedad: null,
        outputRegularKg: regular,
        outputRegularHumedad: null,
        outputMaloKg: malo,
        outputMaloHumedad: null,
        completedAt: endDate,
      });
      window.setTimeout(() => {
        navigate(`/inventario/secado/${sessionId}/resumen`);
      }, 650);
    } catch (err) {
      setRegistrandoSecado(false);
      if (err instanceof SecadoValidationError) {
        setError(err.message);
        return;
      }

      setError('No pudimos finalizar el secado. Intenta nuevamente.');
    }
  };

  const guardarGastoSecado = async () => {
    const monto = Number(expenseAmount.replace(/\D/g, ''));
    const fechaIso = toIsoDateAtUtcNoon(expenseDate || endDate);

    if (!expenseConcept.trim()) {
      setError('Falta el concepto del gasto de secado.');
      return;
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      setError('Ingresa un valor válido para continuar.');
      return;
    }

    if (monto > MAX_SECADO_EXPENSE_COP) {
      setError(`El monto supera el máximo permitido de $${new Intl.NumberFormat('es-CO').format(MAX_SECADO_EXPENSE_COP)}.`);
      return;
    }

    if (!fechaIso) {
      setError('Selecciona una fecha válida para el gasto de secado.');
      return;
    }

    try {
      await crearGasto({
        conceptoGasto: expenseConcept.trim(),
        descripcion: expenseDescription.trim() || undefined,
        montoGasto: monto,
        fechaGasto: fechaIso,
        tipoGasto: 'SECADO',
        estadoPago: 'PAGADO',
        deviceId: await obtenerDeviceId(),
        localId: `${sessionId}-secado-gasto-${Date.now()}`,
        asociarASublotes: false,
      });
      setWithExpense(true);
      setShowExpenseModal(false);
      setError(null);
    } catch {
      setError('No pudimos guardar el gasto de secado. Revisa el monto e intenta nuevamente.');
    }
  };

  const finalizar = () => {
    if (registrandoSecado) return;
    if (!sessionId || !session) return;
    const fechaInicioValidacion = validateBusinessDateRange(fechaInicioReal);
    const fechaFinValidacion = validateBusinessDateRange(endDate);

    if (!fechaInicioValidacion.isValid) {
      setError(fechaInicioValidacion.message);
      return;
    }

    if (!fechaFinValidacion.isValid) {
      setError(fechaFinValidacion.message);
      return;
    }

    const fechaInicio = parseLocalDateValue(fechaInicioReal);
    const fechaFin = parseLocalDateValue(endDate);
    if (!fechaInicio || !fechaFin) {
      setError('Selecciona fechas válidas para continuar.');
      return;
    }
    if (fechaFin < fechaInicio) {
      setError('La fecha de finalización no puede ser anterior a la fecha de inicio.');
      return;
    }

    if (!hasResultadoIngresado) {
      setError('Debes registrar al menos un resultado de secado.');
      return;
    }

    if (relevantOutputEntries.some((entry) => entry.invalid)) {
      setError('Ingresa un peso válido.');
      return;
    }
    if (relevantOutputEntries.some((entry) => entry.value > maxSalidaPermitida)) {
      setError('El resultado supera el peso disponible del secado.');
      return;
    }
    if (round2(totalSalida) <= 0) {
      setError('Debes registrar al menos un resultado de secado.');
      return;
    }
    if (round2(totalSalida) > round2(totalEntrada)) {
      setError('El resultado supera el peso disponible del secado.');
      return;
    }

    if (round2(totalSalida) === round2(totalEntrada)) {
      setError(null);
      setMostrarConfirmacionMermaCero(true);
      return;
    }

    guardarResultadoSecado();
  };

  const volverABorrador = () => {
    navigate('/inventario/secado/inicio', {
      state: { from: originPath, restoreSecadoDraft: true },
    });
  };

  const iniciarProceso = () => {
    if (!sessionId || registrandoSecado) return;

    const fechaInicioValidacion = validateBusinessDateRange(startDate);
    if (!fechaInicioValidacion.isValid) {
      setError(fechaInicioValidacion.message);
      return;
    }

    try {
      const startedAt = toIsoDateAtUtcNoon(startDate) ?? new Date().toISOString();
      startSecadoProcess(sessionId, startedAt);
      clearSecadoDrafts();
      setError(null);
      setStep('active');
      setStartFeedback('success');
    } catch {
      setStartFeedback('error');
      setError(null);
    }
  };

  const handleBack = () => {
    if (step === 'finish') {
      setStep('active');
      return;
    }

    if (step === 'config') {
      volverABorrador();
      return;
    }

    navigate(
      originPath,
      originPath === '/inventario'
        ? { state: { preferredTypeKey: 'VERDE' } }
        : undefined,
    );
  };
  const fechaSecadoError = error?.includes('fecha') ? error : null;
  const resultadoSecadoError = fechaSecadoError ? null : error;

  if (!session) {
    return (
      <div className="cs-workflow-page min-h-screen bg-[#f6f6f6] px-4 py-6 text-slate-950">
        <div className="mx-auto w-full max-w-[430px] rounded-[20px] bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-bold">No encontré el secado en proceso.</p>
          <button
            type="button"
            onClick={() =>
              navigate(
                originPath,
                originPath === '/inventario'
                  ? { state: { preferredTypeKey: 'VERDE' } }
                  : undefined,
              )
            }
            className="mt-4 h-11 rounded-full bg-[#0647d6] px-5 text-xs font-black text-white"
          >
            Volver a inventario
          </button>
        </div>
      </div>
    );
  }

  if (startFeedback === 'success') {
    return (
      <CafeSmartErrorState
        variant="success"
        title="Secado iniciado correctamente"
        message="Los sublotes fueron enviados al proceso de secado correctamente."
        info="El inventario verde se actualizó y el proceso quedó listo para finalizar cuando corresponda."
        primaryLabel="Ver secados activos"
        secondaryLabel="Ir a inventario"
        onPrimary={() =>
          navigate('/inventario/secados', { state: { from: originPath } })
        }
        onSecondary={() =>
          navigate('/inventario', { state: { preferredTypeKey: 'VERDE' } })
        }
        fullScreen
      />
    );
  }

  if (startFeedback === 'error') {
    return (
      <CafeSmartErrorState
        variant="error"
        title="No pudimos iniciar el secado"
        message="Ocurrió un problema al iniciar el proceso. Verifica tu conexión e intenta nuevamente."
        info="El borrador sigue guardado y el inventario no fue descontado."
        primaryLabel="Reintentar"
        secondaryLabel="Volver"
        onPrimary={iniciarProceso}
        onSecondary={() => {
          setStartFeedback(null);
          volverABorrador();
        }}
        fullScreen
      />
    );
  }

  return (
    <div className="cs-workflow-page min-h-screen bg-[#f6f8ff] text-slate-950">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#fbfdff]">
        <header className="relative flex h-12 items-center justify-center px-4">
          <button
            type="button"
            onClick={handleBack}
            disabled={registrandoSecado}
            className="absolute left-4 inline-flex h-8 w-8 items-center justify-center text-[#1f4fd8]"
            aria-label="Volver"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-sm font-extrabold">
            {step === 'config'
              ? 'Fecha de inicio'
              : step === 'active'
                ? 'Secado en proceso'
                : 'Finalizar el secado'}
          </h1>
        </header>

        {step === 'config' ? (
          <main className="flex flex-col gap-4 px-4 py-4">
            <section className="rounded-[20px] border border-[#dbe7ff] bg-[linear-gradient(135deg,#eef5ff_0%,#ffffff_100%)] p-4 shadow-[0_10px_26px_rgba(47,99,216,0.08)]">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#dbe8ff] text-[#102d92]">
                  <SunMedium size={18} />
                </span>
                <p className="text-lg font-black text-[#0f235c]">
                  Configuración de secado
                </p>
              </div>
            </section>

            <section className="rounded-[16px] border border-[#dbe7ff] bg-white p-4 shadow-[0_8px_22px_rgba(47,99,216,0.06)]">
              <label className="text-[0.62rem] font-black uppercase tracking-[0.08em] text-slate-500">
                Fecha de inicio de secado
              </label>
              <CafeSmartDatePicker
                value={startDate}
                minDate={BUSINESS_MIN_DATE_VALUE}
                maxDate={getTodayLocalDateValue()}
                label="Fecha de inicio de secado"
                dialogLabel="Calendario de fecha de inicio de secado"
                open={startDatePickerOpen}
                onToggle={() => setStartDatePickerOpen((open) => !open)}
                onClose={() => setStartDatePickerOpen(false)}
                onChange={(value) => {
                  setStartDate(value || getTodayLocalDateValue());
                  setError(null);
                }}
              />
              <p className="mt-3 text-[0.68rem] text-slate-400">
                Registra cuándo inició el proceso.
              </p>
              {error ? (
                <InlineGuidedError
                  message={getSecadoGuidance(error)}
                  className="mt-3"
                />
              ) : null}
            </section>

            <section className="rounded-[16px] border border-[#dbe7ff] bg-white p-4 shadow-[0_8px_22px_rgba(47,99,216,0.06)]">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.08em] text-slate-500">
                Resumen del secado
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Total a secar
                </span>
                <span className="text-lg font-black text-[#0647d6]">
                  {kg(totalEntrada)}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[0.65rem] font-black">
                <span>
                  <QualityDot color="bg-emerald-500" /> Bueno
                  <br />
                  {sourceQuality === 'BUENO' ? kg(totalEntrada) : '0 kg'}
                </span>
                <span>
                  <QualityDot color="bg-amber-400" /> Regular
                  <br />
                  {sourceQuality === 'REGULAR' ? kg(totalEntrada) : '0 kg'}
                </span>
                <span>
                  <QualityDot color="bg-rose-500" /> Malo
                  <br />
                  {sourceQuality === 'MALO' ? kg(totalEntrada) : '0 kg'}
                </span>
              </div>
            </section>

            <button
              type="button"
              onClick={iniciarProceso}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#102d92] text-xs font-black text-white shadow-[0_14px_28px_rgba(16,45,146,0.22)] transition hover:bg-[#18358f]"
            >
              {isOffline ? 'Guardar proceso pendiente' : 'Iniciar proceso'} <Play size={15} fill="currentColor" />
            </button>
          </main>
        ) : null}

        {step === 'active' ? (
          <main className="flex min-h-[calc(100vh-48px)] flex-col items-center px-5 py-6 text-center">
            <section className="w-full overflow-hidden rounded-[22px] border border-[#dbe7ff] bg-[linear-gradient(135deg,#eef5ff_0%,#ffffff_100%)] p-5 shadow-[0_14px_34px_rgba(47,99,216,0.1)]">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 rounded-[12px] bg-white px-3 py-2 text-xs font-black text-[#102d92] shadow-sm">
                  <SunMedium
                    size={17}
                    className="rounded-full bg-[#dbe8ff] p-1 text-[#102d92]"
                  />
                  Proceso Activo
                </span>
                <span className="inline-flex min-w-[72px] max-w-[44vw] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-white px-3.5 py-2 text-center text-[0.78rem] font-black leading-none text-[#08256d] shadow-sm ring-1 ring-[#c7d8ff]">
                  {kg(totalEntrada)}
                </span>
              </div>

              <div className="mt-8">
                <h2 className="text-2xl font-black leading-tight text-[#0f235c]">
                El secado ha iniciado correctamente
                </h2>
                <p className="mt-4 text-sm leading-6 text-slate-500">
                Cuando el proceso finalice, regresa aquí para registrar el
                resultado del secado.
                </p>
              </div>
            </section>

            <div className="mt-auto w-full pb-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStep('finish')}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#102d92] px-3 text-xs font-black text-white shadow-[0_14px_28px_rgba(16,45,146,0.22)] transition hover:bg-[#18358f]"
                >
                  {isOffline ? 'Guardar secado pendiente' : 'Finalizar secado'} <CheckCircle2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => navigate(originPath)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#c7d8ff] bg-white px-3 text-xs font-black text-[#102d92] transition hover:bg-[#f4f7ff]"
                >
                  <ArrowLeft size={15} /> Salir
                </button>
              </div>
              <p className="mt-2 text-center text-[0.68rem] font-semibold text-slate-500">
                Regresarás al módulo desde donde iniciaste.
              </p>
            </div>
          </main>
        ) : null}

        {step === 'finish' ? (
          <main className="flex flex-col gap-4 px-4 py-4">
            <section className="rounded-[16px] bg-white p-4 shadow-sm">
              <label className="text-[0.62rem] font-black uppercase text-slate-500">
                Fecha de inicio
              </label>
              <div className="mt-2 h-11 rounded-[12px] bg-slate-100 px-4 py-3 text-sm font-black">
                {formatLongDateLabel(fechaInicioReal)}
              </div>
              <label className="mt-4 block text-[0.62rem] font-black uppercase text-slate-500">
                Fecha de finalización
              </label>
              <CafeSmartDatePicker
                value={endDate}
                minDate={fechaInicioReal}
                maxDate={getTodayLocalDateValue()}
                label="Fecha de finalización"
                dialogLabel="Calendario de fecha de finalización"
                open={endDatePickerOpen}
                onToggle={() => setEndDatePickerOpen((open) => !open)}
                onClose={() => setEndDatePickerOpen(false)}
                onChange={(value) => {
                  if (value && value < fechaInicioReal) {
                    setError('La fecha de finalización no puede ser anterior al inicio del secado.');
                    return;
                  }
                  setEndDate(value || getTodayLocalDateValue());
                  setError(null);
                }}
              />
              {fechaSecadoError ? (
                <InlineGuidedError
                  message={getSecadoGuidance(fechaSecadoError)}
                  className="mt-3"
                />
              ) : null}
            </section>

            <section className="rounded-[18px] border border-[#dbe7ff] bg-white p-4 shadow-[0_10px_24px_rgba(47,99,216,0.06)]">
              <h2 className="text-base font-black text-[#0f235c]">Resultado del secado</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Ingresa el peso final en seco para cada calidad de café obtenido.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 max-[360px]:grid-cols-2">
                {outputFields.map((field) => (
                <label key={field.quality} className="block min-w-0">
                  <span className="text-[0.62rem] font-black uppercase text-slate-500">
                    {field.label} (kg)
                  </span>
                  <input
                    type="number"
                    aria-label={`Peso de salida para ${field.label}`}
                    title={`Peso de salida para ${field.label}`}
                    min="0"
                    max={Math.max(0, totalEntrada - getOtherOutputsTotal(field.quality))}
                    step="0.1"
                    value={field.value}
                    onChange={(event) => {
                      updateOutputWeight(field.quality, event.target.value, field.setter);
                    }}
                    onPaste={(event) => {
                      event.preventDefault();
                      updateOutputWeight(
                        field.quality,
                        event.clipboardData.getData('text'),
                        field.setter,
                      );
                    }}
                    className="mt-2 h-11 w-full rounded-[12px] border border-slate-200 bg-slate-50 px-3 text-center text-base font-black text-[#0f235c] outline-none transition focus:border-[#102d92] focus:bg-white focus:ring-4 focus:ring-[#102d92]/10"
                    placeholder="0"
                  />
                </label>
                ))}
              </div>
              {!hasResultadoIngresado ? (
                <div className="mt-4 rounded-[16px] border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-black leading-5 text-amber-800">
                  Registra al menos una salida seca en bueno, regular o malo para calcular el resultado.
                </div>
              ) : null}
              {outputNotice ? (
                <div className="mt-3 rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
                  {outputNotice}
                </div>
              ) : null}
              {resultadoSecadoError ? (
                <InlineGuidedError
                  message={getSecadoGuidance(resultadoSecadoError)}
                  className="mt-3"
                />
              ) : null}
            </section>

            <section className="overflow-hidden rounded-[18px] border border-[#dbe7ff] bg-white shadow-[0_10px_24px_rgba(47,99,216,0.06)]">
              <div className="flex items-center gap-2 bg-[#102d92] px-4 py-3 text-xs font-black uppercase text-white">
                <Save size={15} />
                Resumen del secado
              </div>
              <div className="grid grid-cols-3 gap-2 p-4 text-center">
                <div>
                  <p className="text-[0.6rem] font-black uppercase text-slate-400">
                    Entrada
                  </p>
                  <p className="mt-1 text-lg font-black">{kg(totalEntrada)}</p>
                </div>
                <div>
                  <p className="text-[0.6rem] font-black uppercase text-slate-400">
                    Salida
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {hasResultadoIngresado ? kg(totalSalida) : '--'}
                  </p>
                </div>
                <div>
                  <p className="text-[0.6rem] font-black uppercase text-slate-400">
                    Merma
                  </p>
                  <p className="mt-1 text-lg font-black text-rose-600">
                    {hasResultadoIngresado ? kg(merma) : '--'}
                  </p>
                  <p className="text-[0.65rem] font-black text-rose-400">
                    {hasResultadoIngresado ? `${mermaPct}%` : 'Ingresa la salida'}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[18px] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                  <Save size={16} />
                </span>
                <div>
                  <p className="text-sm font-black">
                    Hubo gastos en el secado?
                  </p>
                  <p className="text-[0.68rem] text-slate-500">
                    Mano de obra, combustible, etc.
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWithExpense(false)}
                  className={`h-9 rounded-full border px-4 text-xs font-black transition ${!withExpense ? 'border-slate-300 bg-white text-slate-900' : 'border-slate-200 bg-slate-100 text-slate-700'}`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWithExpense(true);
                    setExpenseConcept((current) => current || 'Gasto de secado');
                    setExpenseDate(endDate || getTodayLocalDateValue());
                    setShowExpenseModal(true);
                  }}
                  className={`h-9 rounded-full border px-4 text-xs font-black transition ${withExpense ? 'border-slate-300 bg-slate-100 text-slate-900' : 'border-slate-200 bg-slate-100 text-slate-700'}`}
                >
                  Sí
                </button>
              </div>
            </section>

              <button
                type="button"
                onClick={finalizar}
                disabled={registrandoSecado}
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0647d6] text-xs font-black text-white"
              >
              <CheckCircle2 size={16} />
              {isOffline ? 'Guardar secado pendiente' : 'Finalizar secado'}
            </button>
          </main>
        ) : null}
      </div>

      {mostrarConfirmacionMermaCero ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-5 py-6 backdrop-blur-sm">
          <section className="w-full max-w-[430px] rounded-[24px] bg-white p-6 text-center shadow-[0_28px_70px_rgba(15,23,42,0.28)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <AlertTriangle size={24} strokeWidth={2.5} />
            </div>
            <h2 className="mt-4 text-[1.35rem] font-black leading-tight text-slate-950">
              El peso de salida es igual al de entrada
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Normalmente el cafe pierde peso durante el secado. Estas
              registrando {kg(totalSalida)} como peso final, igual a los{' '}
              {kg(totalEntrada)} de entrada.
            </p>
            <p className="mt-2 text-sm font-semibold leading-5 text-slate-700">
              Estas seguro de que ese es el nuevo peso despues del secado?
            </p>
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={guardarResultadoSecado}
                disabled={registrandoSecado}
                className="flex min-h-[52px] w-full items-center justify-center rounded-[16px] bg-[#102d92] px-5 text-sm font-black text-white"
              >
                Si, registrar asi
              </button>
              <button
                type="button"
                onClick={() => setMostrarConfirmacionMermaCero(false)}
                disabled={registrandoSecado}
                className="flex min-h-[48px] w-full items-center justify-center rounded-[16px] bg-slate-100 px-5 text-sm font-black text-[#102d92]"
              >
                Ajustar peso
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showExpenseModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-5 py-6 backdrop-blur-sm">
          <section className="max-h-[calc(100dvh-2rem)] w-full max-w-[410px] overflow-y-auto rounded-[24px] bg-white p-5 shadow-[0_28px_70px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  Registro de Gastos
                </h2>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  Registra el gasto asociado a este secado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                aria-label="Cerrar registro de gastos"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            <label htmlFor="secado-expense-concept" className="mt-4 block text-xs font-black text-slate-700">
              Concepto del gasto
            </label>
            <input
              id="secado-expense-concept"
              type="text"
              aria-label="Concepto del gasto de secado"
              title="Concepto del gasto de secado"
              value={expenseConcept}
              onChange={(event) => setExpenseConcept(event.target.value)}
              className="mt-2 h-11 w-full rounded-[12px] bg-slate-100 px-4 text-sm font-bold outline-none focus:ring-1 focus:ring-[#0647d6]"
            />
            <label htmlFor="secado-expense-description" className="mt-4 block text-xs font-black text-slate-700">
              Descripción breve
            </label>
            <textarea
              id="secado-expense-description"
              value={expenseDescription}
              onChange={(event) => setExpenseDescription(event.target.value)}
              rows={2}
              className="mt-2 w-full resize-none rounded-[12px] bg-slate-100 px-4 py-3 text-sm font-bold outline-none focus:ring-1 focus:ring-[#0647d6]"
              placeholder="Ej: Mano de obra, combustible o transporte"
            />
            <label className="mt-4 block text-xs font-black text-slate-700">
              Monto ($)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={expenseAmount}
              onChange={(event) => updateExpenseAmount(event.target.value)}
              placeholder="Ej: 50000"
              {...(expenseAmountError
                ? ({
                    'aria-invalid': 'true',
                    'aria-describedby': 'secado-expense-amount-error',
                  } as const)
                : ({ 'aria-invalid': 'false' } as const))}
              className="mt-2 h-11 w-full min-w-0 rounded-[12px] bg-slate-100 px-4 text-sm font-bold outline-none focus:ring-1 focus:ring-[#0647d6]"
            />
            <p className="mt-1 text-[0.68rem] font-semibold text-slate-500">
              Máximo permitido: ${new Intl.NumberFormat('es-CO').format(MAX_SECADO_EXPENSE_COP)}
            </p>
            {expenseAmountError ? (
              <p
                id="secado-expense-amount-error"
                role="alert"
                className="mt-2 rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black leading-5 text-rose-700"
              >
                {expenseAmountError}
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <CafeSmartDatePicker
                  value={expenseDate}
                  minDate={fechaInicioReal}
                  maxDate={getTodayLocalDateValue()}
                  label="Fecha"
                  dialogLabel="Calendario de fecha del gasto de secado"
                  open={expenseDatePickerOpen}
                  onToggle={() => setExpenseDatePickerOpen((open) => !open)}
                  onClose={() => setExpenseDatePickerOpen(false)}
                  onChange={(value) => setExpenseDate(value || endDate)}
                  clearable={false}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700">
                  Tipo de gasto
                </label>
                <div className="mt-2 flex min-h-[46px] items-center rounded-[14px] border border-[#dbe7ff] bg-[#eef4ff] px-4 text-sm font-black text-[#102d92]">
                  Secado
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="min-h-[44px] rounded-[14px] border border-slate-200 bg-white px-3 text-sm font-black text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void guardarGastoSecado()}
                disabled={expenseAmountExceedsMax}
                className="min-h-[44px] rounded-[14px] bg-[#0647d6] px-3 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                Guardar gasto
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {registrandoSecado ? (
        <div className="fixed inset-0 z-[100]">
          <CafeSmartProcessingScreen
            variant="drying"
            title="Procesando secado..."
            subtitle="Estamos registrando el resultado del secado."
            helperText="Esto puede tardar unos segundos."
            trustTitle="Tu información está segura"
            trustText="El inventario se actualizará cuando termine el proceso."
          />
        </div>
      ) : null}
    </div>
  );
}

export const MERMA_CRITICA_PCT=50
