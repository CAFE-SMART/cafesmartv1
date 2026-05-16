import React, { useMemo, useState } from 'react';
import { dividirLoteSecado, getCalidadInferior } from '../services/secadoDivisionService';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Play,
  Save,
  SunMedium,
} from 'lucide-react';
import {
  createGuidedError,
  InlineGuidedError,
  type GuidedErrorMessage,
} from '../components/forms/GuidedError';
import {
  getSecadoSession,
  saveSecadoResults,
  SecadoValidationError,
} from '../utils/secadoFlow';
import {
  BUSINESS_MIN_DATE_VALUE,
  getTodayLocalDateValue,
  toIsoDateAtUtcNoon,
  validateBusinessDateRange,
} from '../utils/date';
import { crearGasto } from '../services/gastosService';
import { obtenerDeviceId } from '../utils/deviceId';

function kg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

function dateInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function titleCase(value: string) {
  const clean = value.trim().toLowerCase();
  if (!clean) return '';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function QualityDot({ color }: { color: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getSecadoGuidance(message: string): GuidedErrorMessage {
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
      'El peso seco no puede ser mayor que el cafe que entro al secado.',
      'Ajusta los kilos de salida.',
    );
  }

  if (message.includes('salida seca')) {
    return createGuidedError(
      message,
      'Falta registrar la salida.',
      'Necesitamos saber cuantos kilos secos quedaron.',
      'Ingresa al menos un peso de salida.',
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
          <label className="text-xs font-semibold text-gray-500">Porcentaje (%)</label>
          <input type="number" min="0" max="100" value={porcentaje} onChange={e => setPorcentaje(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 mt-1" />
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

export default function SecadoProceso() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const session = sessionId ? getSecadoSession(sessionId) : null;

  const [showDivisionModal, setShowDivisionModal] = useState(false);
  const [divisionData, setDivisionData] = useState<{ peso: number; calidad: string } | null>(null);

  const abrirDivisionCalidad = (peso: number, calidad: string) => {
    setDivisionData({ peso, calidad });
    setShowDivisionModal(true);
  };

  const [step, setStep] = useState<'config' | 'active' | 'finish'>(
    searchParams.get('step') === 'finish' || session?.estado === 'READY'
      ? 'finish'
      : 'config',
  );
  const [startDate, setStartDate] = useState(
    session ? dateInput(session.startedAt) : dateInput(''),
  );
  const [endDate, setEndDate] = useState(getTodayLocalDateValue());
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
  const [expenseAmount, setExpenseAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mostrarConfirmacionMermaCero, setMostrarConfirmacionMermaCero] =
    useState(false);

  const totalEntrada = useMemo(
    () =>
      session
        ? session.sublotes.reduce((sum, sublote) => sum + sublote.pesoActual, 0)
        : 0,
    [session],
  );
  const sourceQuality = keyOf(session?.calidad ?? '');
  const outputQualities = ['BUENO', 'REGULAR', 'MALO'] as const;
  const bueno = outputQualities.includes('BUENO') ? Number(buenoKg) || 0 : 0;
  const regular = outputQualities.includes('REGULAR')
    ? Number(regularKg) || 0
    : 0;
  const malo = outputQualities.includes('MALO') ? Number(maloKg) || 0 : 0;
  const totalSalida = bueno + regular + malo;
  const hasResultadoIngresado =
    buenoKg.trim() !== '' || regularKg.trim() !== '' || maloKg.trim() !== '';
  const merma = hasResultadoIngresado ? Math.max(0, totalEntrada - totalSalida) : 0;
  const mermaPct =
    totalEntrada > 0 ? ((merma / totalEntrada) * 100).toFixed(1) : '0.0';
  const outputFields = [
    {
      quality: 'BUENO' as const,
      label: 'Seco bueno (kg)',
      value: buenoKg,
      setter: setBuenoKg,
    },
    {
      quality: 'REGULAR' as const,
      label: 'Seco regular (kg)',
      value: regularKg,
      setter: setRegularKg,
    },
    {
      quality: 'MALO' as const,
      label: 'Seco malo (kg)',
      value: maloKg,
      setter: setMaloKg,
    },
  ].filter((field) => outputQualities.includes(field.quality));

  const guardarResultadoSecado = () => {
    if (!sessionId || !session) return;

    try {
      saveSecadoResults(sessionId, {
        outputBuenoKg: bueno,
        outputBuenoHumedad: null,
        outputRegularKg: regular,
        outputRegularHumedad: null,
        outputMaloKg: malo,
        outputMaloHumedad: null,
      });
      setMostrarConfirmacionMermaCero(false);
      navigate(`/inventario/secado/${sessionId}/resumen`);
    } catch (err) {
      if (err instanceof SecadoValidationError) {
        setError(err.message);
        return;
      }

      setError('No pudimos finalizar el secado. Intenta nuevamente.');
    }
  };

  const guardarGastoSecado = async () => {
    const monto = Number(expenseAmount.replace(/\D/g, ''));
    const fechaIso = toIsoDateAtUtcNoon(endDate);

    if (!expenseConcept.trim()) {
      setError('Falta el concepto del gasto de secado.');
      return;
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      setError('Ingresa el monto del gasto de secado.');
      return;
    }

    if (!fechaIso) {
      setError('Selecciona una fecha válida para el gasto de secado.');
      return;
    }

    try {
      await crearGasto({
        conceptoGasto: expenseConcept.trim(),
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
    if (!sessionId || !session) return;
    const fechaInicioValidacion = validateBusinessDateRange(startDate);
    const fechaFinValidacion = validateBusinessDateRange(endDate);

    if (!fechaInicioValidacion.isValid) {
      setError(fechaInicioValidacion.message);
      return;
    }

    if (!fechaFinValidacion.isValid) {
      setError(fechaFinValidacion.message);
      return;
    }

    if (totalSalida <= 0) {
      setError('Registra por lo menos una salida seca.');
      return;
    }
    if ([bueno, regular, malo].some((value) => value < 0)) {
      setError('Los pesos de salida no pueden ser negativos.');
      return;
    }
    if (totalSalida > totalEntrada) {
      setError('La salida no puede superar el peso de entrada.');
      return;
    }

    if (round2(totalSalida) === round2(totalEntrada)) {
      setError(null);
      setMostrarConfirmacionMermaCero(true);
      return;
    }

    guardarResultadoSecado();
  };

  const handleBack = () => {
    if (step === 'finish') {
      setStep('active');
      return;
    }

    navigate('/inventario', { state: { preferredTypeKey: 'VERDE' } });
  };
  const fechaSecadoError = error?.includes('fecha') ? error : null;
  const resultadoSecadoError = fechaSecadoError ? null : error;

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f6f6f6] px-4 py-6 text-slate-950">
        <div className="mx-auto w-full max-w-[430px] rounded-[20px] bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-bold">No encontré el secado en proceso.</p>
          <button
            type="button"
            onClick={() =>
              navigate('/inventario', { state: { preferredTypeKey: 'VERDE' } })
            }
            className="mt-4 h-11 rounded-full bg-[#0647d6] px-5 text-xs font-black text-white"
          >
            Volver a inventario
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-slate-950">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#fbfbfb]">
        <header className="relative flex h-12 items-center justify-center px-4">
          <button
            type="button"
            onClick={handleBack}
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
            <section className="relative h-36 overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,#294730,#d7b46a)] p-4 text-white shadow-sm">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_35%,rgba(255,255,255,.22),transparent_24%),linear-gradient(135deg,rgba(6,29,19,.12),rgba(5,18,45,.55))]" />
              <div className="relative flex h-full items-end">
                <p className="text-lg font-black drop-shadow">
                  Configuración de secado
                </p>
              </div>
            </section>

            <section className="rounded-[16px] bg-white p-4 shadow-sm">
              <label className="text-[0.62rem] font-black uppercase tracking-[0.08em] text-slate-500">
                Fecha de inicio de secado
              </label>
              <div className="mt-2 flex h-12 items-center gap-3 rounded-[12px] bg-slate-100 px-3">
                <CalendarDays size={17} className="text-[#0647d6]" />
                <input
                  type="date"
                  value={startDate}
                  min={BUSINESS_MIN_DATE_VALUE}
                  max={getTodayLocalDateValue()}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full bg-transparent text-sm font-black outline-none"
                />
              </div>
              <p className="mt-3 text-[0.68rem] text-slate-400">
                Registra cuándo inició el proceso.
              </p>
            </section>

            <section className="rounded-[16px] bg-white p-4 shadow-sm">
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
              onClick={() => setStep('active')}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0647d6] text-xs font-black text-white shadow-[0_12px_22px_rgba(6,71,214,0.2)]"
            >
              Iniciar proceso <Play size={15} fill="currentColor" />
            </button>
          </main>
        ) : null}

        {step === 'active' ? (
          <main className="flex min-h-[calc(100vh-48px)] flex-col items-center px-5 py-8 text-center">
            <section className="relative h-44 w-full overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#5a783e,#eccb78_52%,#71562f)] p-4 shadow-sm">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_15%,rgba(255,255,255,.75),transparent_18%),linear-gradient(180deg,rgba(255,255,255,.08),rgba(8,24,44,.4))]" />
              <div className="relative flex h-full items-end">
                <span className="inline-flex items-center gap-2 rounded-[12px] bg-white/80 px-3 py-2 text-xs font-black text-slate-700">
                  <SunMedium
                    size={17}
                    className="rounded-full bg-[#0647d6] p-1 text-white"
                  />
                  Proceso Activo
                </span>
              </div>
            </section>

            <div className="mt-8">
              <h2 className="text-2xl font-black leading-tight">
                El secado ha iniciado correctamente
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-500">
                Cuando el proceso finalice, regresa aquí para registrar el
                resultado del secado.
              </p>
            </div>

            <div className="mt-auto w-full pb-4">
              <button
                type="button"
                onClick={() => setStep('finish')}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0647d6] text-xs font-black text-white"
              >
                Finalizar secado <CheckCircle2 size={16} />
              </button>
              <button
                type="button"
                onClick={() => navigate('/inicio')}
                className="mt-4 inline-flex items-center gap-2 text-xs font-black text-[#0647d6]"
              >
                <ArrowLeft size={15} /> Ir a inicio
              </button>
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
                {startDate}
              </div>
              <label className="mt-4 block text-[0.62rem] font-black uppercase text-slate-500">
                Fecha de finalización
              </label>
              <input
                type="date"
                value={endDate}
                min={BUSINESS_MIN_DATE_VALUE}
                max={getTodayLocalDateValue()}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-2 h-11 w-full rounded-[12px] bg-slate-100 px-4 text-sm font-black outline-none"
              />
              {fechaSecadoError ? (
                <InlineGuidedError
                  message={getSecadoGuidance(fechaSecadoError)}
                  className="mt-3"
                />
              ) : null}
            </section>

            <section className="rounded-[16px] bg-white p-4 shadow-sm">
              <h2 className="text-base font-black">Resultado del secado</h2>
              <p className="mt-1 text-[0.68rem] leading-5 text-slate-500">
                Registra la salida para café verde {titleCase(session.calidad)}.
              </p>
              {outputFields.map((field) => (
                <label key={field.quality} className="mt-4 block">
                  <span className="text-[0.62rem] font-black uppercase text-slate-500">
                    {field.label}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={field.value}
                    onChange={(event) => {
                      field.setter(event.target.value);
                      setError(null);
                      setMostrarConfirmacionMermaCero(false);
                    }}
                    className="mt-2 h-12 w-full rounded-[12px] bg-slate-100 px-4 text-center text-lg font-black outline-none focus:ring-1 focus:ring-[#0647d6]"
                    placeholder="0"
                  />
                </label>
              ))}
              {resultadoSecadoError ? (
                <InlineGuidedError
                  message={getSecadoGuidance(resultadoSecadoError)}
                  className="mt-3"
                />
              ) : null}
            </section>

            <section className="overflow-hidden rounded-[16px] bg-white shadow-sm">
              <div className="flex items-center gap-2 bg-[#0647d6] px-4 py-3 text-xs font-black uppercase text-white">
                <Save size={15} />
                Resumen de totales
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
                  <p className="mt-1 text-lg font-black">{kg(totalSalida)}</p>
                </div>
                <div>
                  <p className="text-[0.6rem] font-black uppercase text-slate-400">
                    Merma
                  </p>
                  <p className="mt-1 text-lg font-black text-rose-600">
                    {hasResultadoIngresado ? kg(merma) : '-'}
                  </p>
                  <p className="text-[0.65rem] font-black text-rose-400">
                    {hasResultadoIngresado ? `${mermaPct}%` : ''}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[18px] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#dce8ff] text-[#0647d6]">
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
                  className={`h-9 rounded-full border text-xs font-black ${!withExpense ? 'border-[#0647d6] text-[#0647d6]' : 'border-slate-200 text-slate-400'}`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(true)}
                  className={`h-9 rounded-full text-xs font-black ${withExpense ? 'bg-[#b6c6ff] text-[#0647d6]' : 'bg-slate-100 text-slate-400'}`}
                >
                  Sí
                </button>
              </div>
            </section>

            <button
              type="button"
              onClick={finalizar}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0647d6] text-xs font-black text-white"
            >
              <CheckCircle2 size={16} />
              Finalizar secado
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
                className="flex min-h-[52px] w-full items-center justify-center rounded-[16px] bg-[#102d92] px-5 text-sm font-black text-white"
              >
                Si, registrar asi
              </button>
              <button
                type="button"
                onClick={() => setMostrarConfirmacionMermaCero(false)}
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
          <section className="w-full max-w-[390px] rounded-[22px] bg-white p-5 shadow-[0_28px_70px_rgba(15,23,42,0.28)]">
            <h2 className="text-lg font-black text-slate-950">
              Registrar gasto de secado
            </h2>
            <label className="mt-4 block text-xs font-black text-slate-700">
              Concepto
            </label>
            <input
              type="text"
              value={expenseConcept}
              onChange={(event) => setExpenseConcept(event.target.value)}
              className="mt-2 h-11 w-full rounded-[12px] bg-slate-100 px-4 text-sm font-bold outline-none focus:ring-1 focus:ring-[#0647d6]"
            />
            <label className="mt-4 block text-xs font-black text-slate-700">
              Monto
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={expenseAmount}
              onChange={(event) => setExpenseAmount(event.target.value.replace(/\D/g, ''))}
              placeholder="Ej: 50000"
              className="mt-2 h-11 w-full rounded-[12px] bg-slate-100 px-4 text-sm font-bold outline-none focus:ring-1 focus:ring-[#0647d6]"
            />
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
                className="min-h-[44px] rounded-[14px] bg-[#0647d6] px-3 text-sm font-black text-white"
              >
                Guardar gasto
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export const MERMA_CRITICA_PCT=50

