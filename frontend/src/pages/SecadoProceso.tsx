import React, { useEffect, useMemo, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import type { LoteDetalle } from '../services/lotesService';
import {
  listarGastosPorSublote,
  type GastoItem,
} from '../services/gastosService';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
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
  getSecadoSession,
  saveSecadoResults,
  saveSecadoDraft,
  startSecadoWithWeights,
  SecadoValidationError,
} from '../utils/secadoFlow';
import {
  BUSINESS_MIN_DATE_VALUE,
  getTodayLocalDateValue,
  validateBusinessDateRange,
} from '../utils/date';

function kg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

const MAX_SECADO_OUTPUT_KG = 99999;

function sanitizeDecimalInput(value: string, maxDigits: number) {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const [integer = '', ...decimalParts] = normalized.split('.');
  const digits = `${integer}${decimalParts.join('')}`.slice(0, maxDigits);

  if (!digits) return '';
  if (!normalized.includes('.')) return digits;

  const integerLength = Math.min(integer.length, digits.length);
  const nextInteger = digits.slice(0, integerLength) || '0';
  const nextDecimal = digits.slice(integerLength);

  return nextDecimal ? `${nextInteger}.${nextDecimal}` : `${nextInteger}.`;
}

function clampDecimalInput(value: string, maxDigits: number, maxValue: number) {
  const next = sanitizeDecimalInput(value, maxDigits);
  if (!next || next.endsWith('.')) return next;

  const parsed = Number(next);
  if (!Number.isFinite(parsed)) return '';

  return parsed > maxValue ? String(maxValue) : next;
}

function dateInput(value: string) {
  if (!value.trim()) return getTodayLocalDateValue();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return getTodayLocalDateValue();

  return getTodayLocalDateValue(parsed);
}

function money(value: number) {
  return `$ ${new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(value)}`;
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

function getSecadoGuidance(message: string): GuidedErrorMessage {
  if (message.includes('fecha')) {
    return createGuidedError(
      message,
      'Revisa la fecha del secado.',
      'Solo puedes registrar fechas desde 2026 hasta hoy.',
      'Elige una fecha válida para continuar.',
    );
  }

  if (message.includes('salida no puede superar')) {
    return createGuidedError(
      message,
      'La salida supera la entrada.',
      'El peso seco no puede ser mayor que el café que entró al secado.',
      'Ajusta los kilos de salida.',
    );
  }

  if (message.includes('salida seca')) {
    return createGuidedError(
      message,
      'Falta registrar la salida.',
      'Necesitamos saber cuántos kilos secos quedaron.',
      'Ingresa al menos un peso de salida.',
    );
  }

  return createGuidedError(
    message,
    'Revisa el resultado del secado.',
    'Hay un dato que no podemos guardar así.',
    'Ajusta el peso y vuelve a finalizar.',
  );
}

type PendingSecadoData = {
  detalle: LoteDetalle;
  selectedWeights: Record<string, number>;
};

function isPendingSecadoData(value: unknown): value is PendingSecadoData {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<PendingSecadoData>;
  return Boolean(candidate.detalle && candidate.selectedWeights);
}

export default function SecadoProceso() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();

  const pendingData = isPendingSecadoData(location.state)
    ? location.state
    : null;
  const isNewFlow = !sessionId && pendingData !== null;

  const locationState = location.state as {
    gastoSecadoRegistrado?: boolean;
  } | null;
  const [showExpenseSuccessToast, setShowExpenseSuccessToast] = useState(false);

  useEffect(() => {
    if (locationState?.gastoSecadoRegistrado) {
      setShowExpenseSuccessToast(true);

      // Clear navigation state to avoid showing it on refresh
      navigate(location.pathname + location.search, {
        replace: true,
        state: { ...locationState, gastoSecadoRegistrado: undefined },
      });

      const timer = setTimeout(() => {
        setShowExpenseSuccessToast(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [
    locationState?.gastoSecadoRegistrado,
    location.pathname,
    location.search,
    navigate,
  ]);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    sessionId ?? null,
  );
  const session = activeSessionId ? getSecadoSession(activeSessionId) : null;
  const [step, setStep] = useState<'config' | 'active' | 'finish'>(
    searchParams.get('step') === 'finish' || session?.estado === 'READY'
      ? 'finish'
      : 'config',
  );
  const [startDate, setStartDate] = useState(
    session
      ? dateInput(session.draftStartDate ?? session.startedAt)
      : dateInput(''),
  );
  const [endDate, setEndDate] = useState(
    session?.draftEndDate ?? getTodayLocalDateValue(),
  );
  const [buenoKg, setBuenoKg] = useState(
    (session?.draftBuenoKg ?? session?.outputBuenoKg)
      ? String(session?.draftBuenoKg ?? session?.outputBuenoKg)
      : '',
  );
  const [regularKg, setRegularKg] = useState(
    (session?.draftRegularKg ?? session?.outputRegularKg)
      ? String(session?.draftRegularKg ?? session?.outputRegularKg)
      : '',
  );
  const [maloKg, setMaloKg] = useState(
    (session?.draftMaloKg ?? session?.outputMaloKg)
      ? String(session?.draftMaloKg ?? session?.outputMaloKg)
      : '',
  );
  const [withExpense, setWithExpense] = useState(false);
  const [secadoExpenses, setSecadoExpenses] = useState<GastoItem[]>([]);
  const [loadingSecadoExpenses, setLoadingSecadoExpenses] = useState(false);
  const [showExpenseWarning, setShowExpenseWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarConfirmacionMermaCero, setMostrarConfirmacionMermaCero] =
    useState(false);

  const pendingTotalEntrada = useMemo(() => {
    if (!pendingData) return 0;
    return Object.values(pendingData.selectedWeights).reduce(
      (sum, kg) => sum + (Number.isFinite(kg) && kg > 0 ? kg : 0),
      0,
    );
  }, [pendingData]);

  const pendingCalidad = pendingData?.detalle.lote.calidad ?? '';

  const totalEntrada = useMemo(
    () =>
      session
        ? session.sublotes.reduce((sum, sublote) => sum + sublote.pesoActual, 0)
        : pendingTotalEntrada,
    [pendingTotalEntrada, session],
  );
  const sourceQuality = keyOf(session?.calidad ?? pendingCalidad);
  const outputQualities = ['BUENO', 'REGULAR', 'MALO'] as const;
  const bueno = outputQualities.includes('BUENO')
    ? Number(String(buenoKg).replace(',', '.')) || 0
    : 0;
  const regular = outputQualities.includes('REGULAR')
    ? Number(String(regularKg).replace(',', '.')) || 0
    : 0;
  const malo = outputQualities.includes('MALO')
    ? Number(String(maloKg).replace(',', '.')) || 0
    : 0;
  const totalSalida = bueno + regular + malo;
  const hasSecadoOutput = totalSalida > 0;
  const merma = hasSecadoOutput ? Math.max(0, totalEntrada - totalSalida) : 0;
  const mermaPct =
    hasSecadoOutput && totalEntrada > 0
      ? ((merma / totalEntrada) * 100).toFixed(1)
      : '0.0';
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

  useEffect(() => {
    if (!session || session.sublotes.length === 0) {
      setSecadoExpenses([]);
      return;
    }

    let cancelled = false;

    const cargarGastosSecado = async () => {
      setLoadingSecadoExpenses(true);

      try {
        const resultados = await Promise.all(
          session.sublotes.map((sublote) => listarGastosPorSublote(sublote.id)),
        );

        if (cancelled) return;

        const gastosUnicos = new Map<string, GastoItem>();
        resultados.flat().forEach((gasto) => {
          const isSecadoType = gasto.tipoGasto === 'SECADO';
          const isCreatedAfterStart =
            new Date(gasto.createdAt).getTime() >=
            new Date(session.startedAt).getTime() - 60000;

          if (isSecadoType || isCreatedAfterStart) {
            gastosUnicos.set(gasto.id, gasto);
          }
        });

        const list = [...gastosUnicos.values()];
        setSecadoExpenses(list);
        if (list.length > 0) {
          setWithExpense(true);
        }
      } catch {
        if (!cancelled) {
          setSecadoExpenses([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSecadoExpenses(false);
        }
      }
    };

    void cargarGastosSecado();

    return () => {
      cancelled = true;
    };
  }, [session?.id, session?.startedAt, locationState?.gastoSecadoRegistrado]);

  const totalGastoSecado = useMemo(
    () => secadoExpenses.reduce((sum, gasto) => sum + gasto.montoGasto, 0),
    [secadoExpenses],
  );

  const tieneGastoSecado = secadoExpenses.length > 0;

  const confirmarInicioSecado = () => {
    if (!pendingData) return;

    try {
      const created = startSecadoWithWeights(
        pendingData.detalle,
        pendingData.selectedWeights,
      );
      setActiveSessionId(created.id);
      setError(null);
      setStep('active');

      navigate(`/inventario/secado/${created.id}/finalizar`, { replace: true });
    } catch (err) {
      if (err instanceof SecadoValidationError) {
        setError(err.message);
        return;
      }

      setError(
        err instanceof Error ? err.message : 'No se pudo iniciar el secado.',
      );
    }
  };

  const guardarResultadoSecado = () => {
    if (!activeSessionId || !session) return;

    try {
      saveSecadoResults(activeSessionId, {
        outputBuenoKg: bueno,
        outputBuenoHumedad: null,
        outputRegularKg: regular,
        outputRegularHumedad: null,
        outputMaloKg: malo,
        outputMaloHumedad: null,
      });
      setMostrarConfirmacionMermaCero(false);
      navigate(`/inventario/secado/${activeSessionId}/resumen`);
    } catch (err) {
      if (err instanceof SecadoValidationError) {
        setError(err.message);
        return;
      }

      setError(
        err instanceof Error ? err.message : 'No se pudo finalizar el secado.',
      );
    }
  };

  const finalizar = () => {
    if (!activeSessionId || !session) return;
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

  const registrarGastoSecado = () => {
    if (!session) return;

    const subloteIds = session.sublotes
      .map((sublote) => sublote.id)
      .filter(Boolean);

    const query = new URLSearchParams();
    if (subloteIds.length > 0) {
      query.set('subloteIds', subloteIds.join(','));
    }
    query.set('origen', 'secado');

    navigate(`/gastos/registro?${query.toString()}`, {
      state: {
        fromSecado: true,
        returnTo: `/inventario/secado/${session.id}/finalizar?step=finish`,
      },
    });
  };

  const handleExpenseYes = () => {
    setWithExpense(true);

    if (activeSessionId) {
      saveSecadoDraft(activeSessionId, {
        startDate,
        endDate,
        buenoKg: bueno,
        regularKg: regular,
        maloKg: malo,
      });
    }

    if (tieneGastoSecado) {
      setShowExpenseWarning(true);
      return;
    }

    registrarGastoSecado();
  };

  const handleBack = () => {
    if (step === 'finish') {
      setStep('active');
      return;
    }

    if (isNewFlow && step === 'config') {
      navigate(-1);
      return;
    }

    navigate('/inventario', { state: { preferredTypeKey: 'VERDE' } });
  };
  const fechaSecadoError = error?.includes('fecha') ? error : null;
  const resultadoSecadoError = fechaSecadoError ? null : error;

  if (!session && !isNewFlow) {
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
            className="absolute left-4 inline-flex h-8 w-8 items-center justify-center text-slate-900"
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

        {showExpenseSuccessToast ? (
          <div className="mx-4 mt-3 flex items-center justify-between rounded-[12px] bg-emerald-50 border border-emerald-200 p-3 text-emerald-800 shadow-sm transition-all transform duration-300 ease-out">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold text-emerald-950">
                ¡Gasto de secado registrado exitosamente!
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowExpenseSuccessToast(false)}
              className="text-emerald-500 hover:text-emerald-700 transition"
              aria-label="Cerrar notificación"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

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
              <label className="text-[0.85rem] font-semibold text-slate-800">
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
              <p className="text-[0.85rem] font-semibold text-slate-800">
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

            {error ? (
              <InlineGuidedError
                message={getSecadoGuidance(error)}
                className="mt-2"
              />
            ) : null}

            <button
              type="button"
              onClick={
                isNewFlow ? confirmarInicioSecado : () => setStep('active')
              }
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1D4ED8] text-xs font-black text-white shadow-[0_12px_22px_rgba(29,78,216,0.2)] hover:bg-[#1e40af] transition"
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
                <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-xs font-black text-slate-700">
                  <SunMedium
                    size={17}
                    className="rounded-full bg-[#1D4ED8] p-1 text-white"
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
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1D4ED8] text-xs font-black text-white shadow-[0_12px_22px_rgba(29,78,216,0.2)] hover:bg-[#1e40af] transition"
              >
                Finalizar secado <CheckCircle2 size={16} />
              </button>
              <button
                type="button"
                onClick={() => navigate('/inicio')}
                className="mt-4 inline-flex items-center gap-2 text-xs font-black text-[#1D4ED8] hover:text-[#1e40af] transition"
              >
                <ArrowLeft size={15} /> Ir a inicio
              </button>
            </div>
          </main>
        ) : null}

        {step === 'finish' ? (
          <main className="flex flex-col gap-4 px-4 py-4">
            <section className="rounded-[16px] bg-white p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.85rem] font-semibold text-slate-800">
                    Fecha de inicio
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    readOnly
                    className="mt-2 h-11 w-full rounded-[12px] bg-slate-100 px-3 text-sm font-black outline-none text-slate-700 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[0.85rem] font-semibold text-slate-800">
                    Fecha de finalización
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    min={BUSINESS_MIN_DATE_VALUE}
                    max={getTodayLocalDateValue()}
                    onChange={(event) => {
                      const value = event.target.value;
                      setEndDate(value);
                      if (activeSessionId) {
                        saveSecadoDraft(activeSessionId, { endDate: value });
                      }
                    }}
                    className="mt-2 h-11 w-full rounded-[12px] bg-slate-100 px-3 text-sm font-black outline-none"
                  />
                </div>
              </div>
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
                Ingresa el peso final en seco para cada calidad de café
                obtenido.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {outputFields.map((field) => (
                  <div key={field.quality} className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-800 text-center truncate">
                      {field.label.replace('Seco ', '')}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      maxLength={8}
                      value={field.value}
                      onChange={(event) => {
                        const nextValue = clampDecimalInput(
                          event.target.value,
                          7,
                          MAX_SECADO_OUTPUT_KG,
                        );
                        field.setter(nextValue);
                        setError(null);
                        setMostrarConfirmacionMermaCero(false);
                        if (activeSessionId) {
                          const nextBueno =
                            field.quality === 'BUENO'
                              ? Number(String(nextValue).replace(',', '.')) || 0
                              : bueno;
                          const nextRegular =
                            field.quality === 'REGULAR'
                              ? Number(String(nextValue).replace(',', '.')) || 0
                              : regular;
                          const nextMalo =
                            field.quality === 'MALO'
                              ? Number(String(nextValue).replace(',', '.')) || 0
                              : malo;

                          saveSecadoDraft(activeSessionId, {
                            buenoKg: nextBueno,
                            regularKg: nextRegular,
                            maloKg: nextMalo,
                          });
                        }
                      }}
                      className="mt-2 h-10 w-full rounded-[10px] bg-slate-100 px-2 text-center text-sm font-black outline-none focus:ring-1 focus:ring-[#0647d6]"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
              {!hasSecadoOutput ? (
                <p className="mt-3 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[0.78rem] font-semibold leading-5 text-amber-800">
                  Registra al menos una salida seca en bueno, regular o malo
                  para calcular el resultado.
                </p>
              ) : null}
              {resultadoSecadoError ? (
                <InlineGuidedError
                  message={getSecadoGuidance(resultadoSecadoError)}
                  className="mt-3"
                />
              ) : null}
            </section>

            <section className="overflow-hidden rounded-[16px] bg-white shadow-sm">
              <div className="flex items-center gap-2 bg-[#0647d6] px-4 py-3 text-sm font-semibold text-white">
                <Save size={15} />
                Resumen del secado
              </div>
              <div className="grid grid-cols-3 gap-2 p-4 text-center">
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    Entrada
                  </p>
                  <p className="mt-1 text-lg font-black">{kg(totalEntrada)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">Salida</p>
                  <p className="mt-1 text-lg font-black">
                    {hasSecadoOutput ? kg(totalSalida) : '--'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">Merma</p>
                  {hasSecadoOutput ? (
                    <>
                      <p className="mt-1 text-lg font-black text-rose-600">
                        {kg(merma)}
                      </p>
                      <p className="text-[0.65rem] font-black text-rose-400">
                        {mermaPct}%
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-lg font-black text-slate-400">
                        --
                      </p>
                      <p className="text-[0.65rem] font-semibold text-slate-400">
                        Ingresa la salida
                      </p>
                    </>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[18px] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#dce8ff] text-[#0647d6]">
                  <Save size={16} />
                  {tieneGastoSecado ? (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[0.58rem] font-black text-white shadow-sm ring-2 ring-white">
                      {secadoExpenses.length}
                    </span>
                  ) : null}
                </span>
                <div>
                  <p className="text-sm font-black">
                    ¿Hubo gastos en el secado?
                  </p>
                  <p className="text-[0.68rem] text-slate-500">
                    {loadingSecadoExpenses
                      ? 'Revisando gastos registrados...'
                      : tieneGastoSecado
                        ? `${secadoExpenses.length} gasto${secadoExpenses.length > 1 ? 's' : ''} registrado${secadoExpenses.length > 1 ? 's' : ''}: ${money(totalGastoSecado)}`
                        : 'Registra mano de obra, combustible u otros costos del secado.'}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWithExpense(false)}
                  className={`h-9 rounded-full border text-xs font-black ${!withExpense ? 'border-[#1D4ED8] text-[#1D4ED8]' : 'border-slate-200 text-slate-400'}`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={handleExpenseYes}
                  className={`h-9 rounded-full text-xs font-black ${withExpense ? 'bg-[#dce8ff] text-[#1D4ED8]' : 'bg-slate-100 text-slate-400'}`}
                >
                  Sí
                </button>
              </div>
            </section>

            <button
              type="button"
              onClick={finalizar}
              disabled={!hasSecadoOutput}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1D4ED8] text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300 hover:bg-[#1e40af] transition"
            >
              <CheckCircle2 size={16} />
              Finalizar secado
            </button>
          </main>
        ) : null}
      </div>

      {showExpenseWarning ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-5 py-6 backdrop-blur-sm">
          <section className="w-full max-w-[320px] rounded-[20px] bg-white p-5 text-center shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <AlertTriangle size={20} strokeWidth={2.4} />
            </div>
            <h2 className="mt-3 text-[1rem] font-black text-slate-950">
              Ya hay gasto de secado
            </h2>
            <p className="mt-2 text-[0.76rem] font-semibold leading-5 text-slate-600">
              Este lote ya tiene agregado un costo de secado por{' '}
              <span className="font-black text-slate-900">
                {money(totalGastoSecado)}
              </span>
              . Si agregas otro, se sumará al costo del lote.
            </p>
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowExpenseWarning(false);
                  registrarGastoSecado();
                }}
                className="h-10 rounded-full bg-[#1D4ED8] text-[0.72rem] font-black text-white hover:bg-[#1e40af] transition shadow-[0_4px_12px_rgba(29,78,216,0.16)]"
              >
                Agregar otro gasto
              </button>
              <button
                type="button"
                onClick={() => setShowExpenseWarning(false)}
                className="h-10 rounded-full bg-slate-100 text-[0.72rem] font-black text-slate-600 hover:bg-slate-200 transition"
              >
                Mantener el gasto actual
              </button>
            </div>
          </section>
        </div>
      ) : null}

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
              Normalmente el café pierde peso durante el secado. Estás
              registrando {kg(totalSalida)} como peso final, igual a los{' '}
              {kg(totalEntrada)} de entrada.
            </p>
            <p className="mt-2 text-sm font-semibold leading-5 text-slate-700">
              ¿Estás seguro de que ese es el nuevo peso después del secado?
            </p>
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={guardarResultadoSecado}
                className="flex min-h-[52px] w-full items-center justify-center rounded-full bg-[#1D4ED8] px-5 text-sm font-black text-white hover:bg-[#1e40af] transition shadow-[0_12px_22px_rgba(29,78,216,0.18)]"
              >
                Sí, registrar así
              </button>
              <button
                type="button"
                onClick={() => setMostrarConfirmacionMermaCero(false)}
                className="flex min-h-[48px] w-full items-center justify-center rounded-full bg-slate-100 px-5 text-sm font-black text-[#1D4ED8] hover:bg-slate-200 transition"
              >
                Ajustar peso
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
