import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckCircle2, Play, Save, SunMedium } from 'lucide-react';
import { getSecadoSession, saveSecadoResults } from '../utils/secadoFlow';

function kg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

function dateInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
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

export default function SecadoProceso() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const session = sessionId ? getSecadoSession(sessionId) : null;
  const [step, setStep] = useState<'config' | 'active' | 'finish'>(
    searchParams.get('step') === 'finish' || session?.estado === 'READY' ? 'finish' : 'config',
  );
  const [startDate, setStartDate] = useState(session ? dateInput(session.startedAt) : dateInput(''));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [buenoKg, setBuenoKg] = useState(session?.outputBuenoKg ? String(session.outputBuenoKg) : '');
  const [regularKg, setRegularKg] = useState(session?.outputRegularKg ? String(session.outputRegularKg) : '');
  const [maloKg, setMaloKg] = useState(session?.outputMaloKg ? String(session.outputMaloKg) : '');
  const [withExpense, setWithExpense] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalEntrada = useMemo(
    () => (session ? session.sublotes.reduce((sum, sublote) => sum + sublote.pesoActual, 0) : 0),
    [session],
  );
  const sourceQuality = keyOf(session?.calidad ?? '');
  const visibleQualities = (['BUENO', 'REGULAR', 'MALO'] as const).filter(
    (quality) => !sourceQuality || sourceQuality === quality,
  );
  const showAllOutputs = visibleQualities.length === 0;
  const outputQualities = showAllOutputs ? (['BUENO', 'REGULAR', 'MALO'] as const) : visibleQualities;
  const bueno = outputQualities.includes('BUENO') ? Number(buenoKg) || 0 : 0;
  const regular = outputQualities.includes('REGULAR') ? Number(regularKg) || 0 : 0;
  const malo = outputQualities.includes('MALO') ? Number(maloKg) || 0 : 0;
  const totalSalida = bueno + regular + malo;
  const merma = Math.max(0, totalEntrada - totalSalida);
  const mermaPct = totalEntrada > 0 ? ((merma / totalEntrada) * 100).toFixed(1) : '0.0';
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

  const finalizar = () => {
    if (!sessionId || !session) return;
    if (totalSalida <= 0) {
      setError('Registra por lo menos una salida seca.');
      return;
    }
    if (totalSalida > totalEntrada) {
      setError('La salida no puede superar el peso de entrada.');
      return;
    }

    saveSecadoResults(sessionId, {
      outputBuenoKg: bueno,
      outputBuenoHumedad: null,
      outputRegularKg: regular,
      outputRegularHumedad: null,
      outputMaloKg: malo,
      outputMaloHumedad: null,
    });
    navigate(`/inventario/secado/${sessionId}/resumen`);
  };

  const handleBack = () => {
    if (step === 'finish') {
      setStep('active');
      return;
    }

    navigate('/inventario', { state: { preferredTypeKey: 'VERDE' } });
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f6f6f6] px-4 py-6 text-slate-950">
        <div className="mx-auto w-full max-w-[430px] rounded-[20px] bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-bold">No encontré el secado en proceso.</p>
          <button
            type="button"
            onClick={() => navigate('/inventario', { state: { preferredTypeKey: 'VERDE' } })}
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
            {step === 'config' ? 'Fecha de inicio' : step === 'active' ? 'Secado en proceso' : 'Finalizar el secado'}
          </h1>
        </header>

        {step === 'config' ? (
          <main className="flex flex-col gap-4 px-4 py-4">
            <section className="relative h-36 overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,#294730,#d7b46a)] p-4 text-white shadow-sm">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_35%,rgba(255,255,255,.22),transparent_24%),linear-gradient(135deg,rgba(6,29,19,.12),rgba(5,18,45,.55))]" />
              <div className="relative flex h-full items-end">
                <p className="text-lg font-black drop-shadow">Configuración de secado</p>
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
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full bg-transparent text-sm font-black outline-none"
                />
              </div>
              <p className="mt-3 text-[0.68rem] text-slate-400">Registra cuándo inició el proceso.</p>
            </section>

            <section className="rounded-[16px] bg-white p-4 shadow-sm">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.08em] text-slate-500">
                Resumen del secado
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Total a secar</span>
                <span className="text-lg font-black text-[#0647d6]">{kg(totalEntrada)}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[0.65rem] font-black">
                <span><QualityDot color="bg-emerald-500" /> Bueno<br />{sourceQuality === 'BUENO' ? kg(totalEntrada) : '0 kg'}</span>
                <span><QualityDot color="bg-amber-400" /> Regular<br />{sourceQuality === 'REGULAR' ? kg(totalEntrada) : '0 kg'}</span>
                <span><QualityDot color="bg-rose-500" /> Malo<br />{sourceQuality === 'MALO' ? kg(totalEntrada) : '0 kg'}</span>
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
                  <SunMedium size={17} className="rounded-full bg-[#0647d6] p-1 text-white" />
                  Proceso Activo
                </span>
              </div>
            </section>

            <div className="mt-8">
              <h2 className="text-2xl font-black leading-tight">El secado ha iniciado correctamente</h2>
              <p className="mt-4 text-sm leading-6 text-slate-500">
                Cuando el proceso finalice, regresa aquí para registrar el resultado del secado.
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
              <label className="text-[0.62rem] font-black uppercase text-slate-500">Fecha de inicio</label>
              <div className="mt-2 h-11 rounded-[12px] bg-slate-100 px-4 py-3 text-sm font-black">{startDate}</div>
              <label className="mt-4 block text-[0.62rem] font-black uppercase text-slate-500">Fecha de finalización</label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-2 h-11 w-full rounded-[12px] bg-slate-100 px-4 text-sm font-black outline-none"
              />
            </section>

            <section className="rounded-[16px] bg-white p-4 shadow-sm">
              <h2 className="text-base font-black">Resultado del secado</h2>
              <p className="mt-1 text-[0.68rem] leading-5 text-slate-500">
                Registra la salida para café verde {titleCase(session.calidad)}.
              </p>
              {outputFields.map((field) => (
                <label key={field.quality} className="mt-4 block">
                  <span className="text-[0.62rem] font-black uppercase text-slate-500">{field.label}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={field.value}
                    onChange={(event) => {
                      field.setter(event.target.value);
                      setError(null);
                    }}
                    className="mt-2 h-12 w-full rounded-[12px] bg-slate-100 px-4 text-center text-lg font-black outline-none focus:ring-1 focus:ring-[#0647d6]"
                    placeholder="0"
                  />
                </label>
              ))}
            </section>

            <section className="overflow-hidden rounded-[16px] bg-white shadow-sm">
              <div className="flex items-center gap-2 bg-[#0647d6] px-4 py-3 text-xs font-black uppercase text-white">
                <Save size={15} />
                Resumen de totales
              </div>
              <div className="grid grid-cols-3 gap-2 p-4 text-center">
                <div>
                  <p className="text-[0.6rem] font-black uppercase text-slate-400">Entrada</p>
                  <p className="mt-1 text-lg font-black">{kg(totalEntrada)}</p>
                </div>
                <div>
                  <p className="text-[0.6rem] font-black uppercase text-slate-400">Salida</p>
                  <p className="mt-1 text-lg font-black">{kg(totalSalida)}</p>
                </div>
                <div>
                  <p className="text-[0.6rem] font-black uppercase text-slate-400">Merma</p>
                  <p className="mt-1 text-lg font-black text-rose-600">{kg(merma)}</p>
                  <p className="text-[0.65rem] font-black text-rose-400">{mermaPct}%</p>
                </div>
              </div>
            </section>

            <section className="rounded-[18px] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#dce8ff] text-[#0647d6]">
                  <Save size={16} />
                </span>
                <div>
                  <p className="text-sm font-black">Hubo gastos en el secado?</p>
                  <p className="text-[0.68rem] text-slate-500">Mano de obra, combustible, etc.</p>
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
                  onClick={() => setWithExpense(true)}
                  className={`h-9 rounded-full text-xs font-black ${withExpense ? 'bg-[#b6c6ff] text-[#0647d6]' : 'bg-slate-100 text-slate-400'}`}
                >
                  Sí
                </button>
              </div>
            </section>

            {error ? <p className="text-center text-xs font-bold text-rose-600">{error}</p> : null}

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
    </div>
  );
}
