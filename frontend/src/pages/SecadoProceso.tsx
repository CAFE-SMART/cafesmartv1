import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Info, Save } from 'lucide-react';
import {
  createGuidedError,
  FloatingGuidedNotice,
  InlineGuidedError,
  type GuidedErrorMessage,
} from '../components/forms/GuidedError';
import { formatDateLabel } from '../utils/date';
import { getSecadoSession, saveSecadoResults } from '../utils/secadoFlow';

function kg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

function dateLabel(value: string) {
  return formatDateLabel(value);
}

function getSecadoGuidance(message: string): GuidedErrorMessage {
  if (message.includes('salida seca')) {
    return createGuidedError(
      message,
      'Falta el peso final.',
      'El proceso requiere la cantidad de café seco.',
      'Escribe la salida seca en kilos.',
    );
  }

  if (message.includes('no puede superar')) {
    return createGuidedError(
      message,
      'La salida supera la entrada.',
      'El café seco debe pesar menos que el verde.',
      'Verifica y corrige el peso final.',
    );
  }

  return createGuidedError(
    message,
    'Falta la humedad.',
    'Necesitamos saber qué tan seco quedó el lote.',
    'Ingresa la humedad final en porcentaje.',
  );
}

export default function SecadoProceso() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const session = sessionId ? getSecadoSession(sessionId) : null;
  const sourceQuality = (session?.calidad ?? '').trim().toUpperCase();
  const outputQuality = sourceQuality === 'BUENO' ? 'BUENO' : 'REGULAR';
  const outputLabel =
    outputQuality === 'BUENO' ? 'Cafe Seco - Bueno (kg)' : 'Cafe Seco - Regular (kg)';

  const [buenoKg, setBuenoKg] = useState(
    session && session.outputBuenoKg > 0 ? session.outputBuenoKg.toString() : '',
  );
  const [buenoHumedad, setBuenoHumedad] = useState(
    session && session.outputBuenoHumedad !== null ? session.outputBuenoHumedad.toString() : '',
  );
  const [regularKg, setRegularKg] = useState(
    session && session.outputRegularKg > 0 ? session.outputRegularKg.toString() : '',
  );
  const [regularHumedad, setRegularHumedad] = useState(
    session && session.outputRegularHumedad !== null ? session.outputRegularHumedad.toString() : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [floatingError, setFloatingError] = useState<GuidedErrorMessage | null>(null);
  const [botonRegistrarPresionado, setBotonRegistrarPresionado] = useState(false);

  const totalEntrada = useMemo(
    () => (session ? session.sublotes.reduce((sum, sublote) => sum + sublote.pesoActual, 0) : 0),
    [session],
  );

  const outputKg = outputQuality === 'BUENO' ? Number(buenoKg) || 0 : Number(regularKg) || 0;
  const outputHumedadText = outputQuality === 'BUENO' ? buenoHumedad : regularHumedad;
  const totalSalida = outputKg;
  const mermaKg = Math.max(0, totalEntrada - totalSalida);
  const rendimientoPct =
    totalEntrada > 0 ? Number(((totalSalida / totalEntrada) * 100).toFixed(1)) : 0;

  const continuar = () => {
    if (!sessionId || !session) return;

    const humedad = outputHumedadText.trim() ? Number(outputHumedadText) : null;

    if (outputKg <= 0) {
      const message = 'Registra la salida seca del lote antes de continuar.';
      setError(message);
      setFloatingError(getSecadoGuidance(message));
      return;
    }

    if (totalSalida > totalEntrada) {
      const message = 'La salida no puede superar el peso total que entro a secado.';
      setError(message);
      setFloatingError(getSecadoGuidance(message));
      return;
    }

    if (humedad === null || !Number.isFinite(humedad)) {
      const message = 'Registra la humedad final del lote seco.';
      setError(message);
      setFloatingError(getSecadoGuidance(message));
      return;
    }

    setBotonRegistrarPresionado(true);

    saveSecadoResults(sessionId, {
      outputBuenoKg: outputQuality === 'BUENO' ? outputKg : 0,
      outputBuenoHumedad: outputQuality === 'BUENO' ? humedad : null,
      outputRegularKg: outputQuality === 'REGULAR' ? outputKg : 0,
      outputRegularHumedad: outputQuality === 'REGULAR' ? humedad : null,
    });

    navigate(`/inventario/secado/${sessionId}/resumen`);
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 text-slate-900">
        <div className="mx-auto w-full max-w-[520px] rounded-[26px] border border-rose-200 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-700">No encontre el secado en proceso.</p>
          <button
            type="button"
            onClick={() => navigate('/secado')}
            className="mt-5 inline-flex rounded-[18px] bg-[#102d92] px-5 py-3 text-sm font-black text-white"
          >
            Volver al flujo de secado
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] pb-12 text-slate-900">
      <header className="border-b border-white/80 bg-[rgba(247,245,255,0.92)] px-4 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[520px] items-center gap-3">
<button
            type="button"
            onClick={() => navigate(`/inventario/lote/${session.loteId}/secado`)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#102d92] shadow-sm"
            aria-label="Volver al paso anterior"
          >
            <ArrowLeft size={18} />
          </button>
          <p className="text-[1.45rem] font-black text-[#111827]">Proceso de Secado</p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[520px] flex-col gap-5 px-4 py-6">
        <section className="rounded-[28px] border border-[#d9e2f5] bg-white p-5 shadow-sm">
          <p className="text-lg font-black text-[#102d92]">Informacion del Lote Verde</p>
          <div className="mt-5 rounded-[24px] border border-[#e6e8f3] bg-[#fafbff] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Lote seleccionado
            </p>
            <h1 className="mt-3 text-[1.9rem] font-black text-[#111827]">{session.loteCodigo}</h1>
            <p className="mt-2 text-base text-[#2155da]">Fecha del lote verde: {dateLabel(session.fechaLote)}</p>

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#e6e8f3] pt-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Calidad de origen
                </p>
                <p className="mt-2 text-xl font-black text-slate-900">{session.calidad}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Peso inicial (verde)
                </p>
                <p className="mt-2 text-xl font-black text-slate-900">{kg(totalEntrada)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#d9e2f5] bg-white p-5 shadow-sm">
          <p className="text-lg font-black text-[#102d92]">Resultados del secado</p>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            Este lote viene de verde {session.calidad.toLowerCase()}, por eso la salida seca se
            registra solo para cafe seco {session.calidad.toLowerCase()}.
          </p>

          <div className="mt-5">
            <label className="mb-2 block text-lg font-black text-slate-800">{outputLabel}</label>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
              <input
                type="number"
                min="0"
                step="0.1"
                value={outputQuality === 'BUENO' ? buenoKg : regularKg}
                onChange={(event) =>
                  outputQuality === 'BUENO'
                    ? (setBuenoKg(event.target.value), setError(null), setFloatingError(null))
                    : (setRegularKg(event.target.value), setError(null), setFloatingError(null))
                }
                className="w-full rounded-[20px] border border-[#cfe0ff] bg-white px-5 py-4 text-[2rem] font-black text-slate-900 outline-none focus:border-[#2155da]"
                placeholder="0.00"
              />
              <input
                type="number"
                min="0"
                step="0.1"
                value={outputQuality === 'BUENO' ? buenoHumedad : regularHumedad}
                onChange={(event) =>
                  outputQuality === 'BUENO'
                    ? (setBuenoHumedad(event.target.value), setError(null), setFloatingError(null))
                    : (setRegularHumedad(event.target.value), setError(null), setFloatingError(null))
                }
                className="w-full rounded-[20px] border border-[#cfe0ff] bg-white px-5 py-4 text-xl font-black text-slate-900 outline-none focus:border-[#2155da]"
                placeholder="Humedad"
              />
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-[#d9e2f5] bg-[#f5f7ff] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xl font-black text-slate-800">Resumen del proceso</p>
              <span className="rounded-full bg-[#2155da] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white">
                Calculo automatico
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Total entrada (kg)
                </p>
                <p className="mt-2 text-2xl font-black text-slate-900">{kg(totalEntrada)}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Total salida (kg)
                </p>
                <p className="mt-2 text-2xl font-black text-slate-900">{kg(totalSalida)}</p>
                <p className="mt-1 text-sm font-black text-emerald-600">{rendimientoPct}% rendimiento</p>
              </div>
            </div>

            <div className="mt-5 border-t border-[#d9e2f5] pt-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Merma</p>
              <p className="mt-2 text-[2rem] font-black text-[#2155da]">{kg(mermaKg)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#b7d7ff] bg-[#edf5ff] p-5">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-[#2155da] p-3 text-white">
              <Info size={18} />
            </div>
            <p className="text-base leading-8 text-[#173ea6]">
              Al confirmar, el sistema descuenta este peso del inventario verde y la nueva fecha de
              ingreso a bodega para seco sera la fecha de finalizacion del secado.
            </p>
          </div>
        </section>

        {error ? (
          <InlineGuidedError message={getSecadoGuidance(error)} />
        ) : null}

        <button
          type="button"
          onClick={continuar}
          disabled={botonRegistrarPresionado}
          className="inline-flex w-full items-center justify-center gap-3 rounded-[22px] bg-[#2155da] px-5 py-4 text-lg font-black text-white shadow-[0_18px_40px_rgba(33,85,218,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={20} />
          {botonRegistrarPresionado ? 'Guardando secado...' : 'Registrar secado'}
        </button>
      </main>

      {floatingError ? (
        <FloatingGuidedNotice
          message={floatingError}
          onClose={() => setFloatingError(null)}
        />
      ) : null}
    </div>
  );
}
