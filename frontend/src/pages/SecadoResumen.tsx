import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { finalizeSecado, getSecadoSession } from '../utils/secadoFlow';

function kg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

export default function SecadoResumen() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const session = sessionId ? getSecadoSession(sessionId) : null;
  const sourceQuality = (session?.calidad ?? '').trim().toUpperCase();
  const showBueno = sourceQuality === 'BUENO';
  const showRegular = !showBueno;

  const totalEntrada = useMemo(
    () => (session ? session.sublotes.reduce((sum, sublote) => sum + sublote.pesoActual, 0) : 0),
    [session],
  );
  const totalSalida = (session?.outputBuenoKg ?? 0) + (session?.outputRegularKg ?? 0);

  const finalizar = () => {
    if (!sessionId) return;

    finalizeSecado(sessionId);
    navigate('/inventario', {
      state: { preferredTypeKey: 'SECO', completedSecadoId: sessionId },
      replace: true,
    });
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 text-slate-900">
        <div className="mx-auto w-full max-w-[520px] rounded-[26px] border border-rose-200 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-700">No encontre el resumen de conversion.</p>
          <button
            type="button"
            onClick={() => navigate('/inventario', { state: { preferredTypeKey: 'VERDE' } })}
            className="mt-5 inline-flex rounded-[18px] bg-[#102d92] px-5 py-3 text-sm font-black text-white"
          >
            Volver a inventario
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
            onClick={() => navigate(`/inventario/secado/${session.id}/finalizar`)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#102d92] shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <p className="text-[1.45rem] font-black text-[#111827]">Resumen de Conversion</p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[520px] flex-col gap-5 px-4 py-6">
        <section className="overflow-hidden rounded-[28px] border border-[#d9e2f5] bg-white shadow-sm">
          <div className="h-40 bg-[linear-gradient(135deg,#241708_0%,#5c3b17_55%,#120c06_100%)]" />
          <div className="p-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#e6fbf3] px-3 py-2 text-sm font-black text-[#13865d]">
              <CheckCircle2 size={16} />
              Inventario actualizado correctamente
            </div>
            <h1 className="mt-4 text-[2rem] font-black text-[#111827]">
              {session.loteCodigo} - Verde a Seco
            </h1>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4">
          <article className="rounded-[24px] border border-[#d9e2f5] bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Peso inicial ({session.calidad} verde)
            </p>
            <p className="mt-4 text-[2rem] font-black text-slate-900">{kg(totalEntrada)}</p>
          </article>
          <article className="rounded-[24px] border border-[#d9e2f5] bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Peso final total (seco)
            </p>
            <p className="mt-4 text-[2rem] font-black text-slate-900">{kg(totalSalida)}</p>
          </article>
        </section>

        <article className="rounded-[24px] border border-[#d9e2f5] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Merma total
            </p>
            <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-sm font-black text-[#2155da]">
              -{session.rendimientoPct > 0 ? (100 - session.rendimientoPct).toFixed(0) : 0}%
            </span>
          </div>
          <p className="mt-4 text-[2rem] font-black text-slate-900">{kg(session.mermaKg)}</p>
        </article>

        {showBueno ? (
          <article className="rounded-[24px] border border-[#d9e2f5] bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Peso final bueno (seco)
            </p>
            <p className="mt-4 text-[2rem] font-black text-slate-900">{kg(session.outputBuenoKg)}</p>
          </article>
        ) : null}

        {showRegular ? (
          <article className="rounded-[24px] border border-[#d9e2f5] bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Peso final regular (seco)
            </p>
            <p className="mt-4 text-[2rem] font-black text-slate-900">{kg(session.outputRegularKg)}</p>
          </article>
        ) : null}

        <article className="rounded-[24px] border border-[#d9e2f5] bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[1.6rem] font-black text-[#111827]">Rendimiento de Conversion</p>
              <p className="mt-1 text-sm text-slate-500">Eficiencia del proceso de secado</p>
            </div>
            <p className="text-[2.5rem] font-black text-[#2155da]">{session.rendimientoPct}%</p>
          </div>

          <div className="mt-5 h-4 overflow-hidden rounded-full bg-[#dbe6f7]">
            <div
              className="h-full rounded-full bg-[#2155da]"
              style={{ width: `${Math.min(100, session.rendimientoPct)}%` }}
            />
          </div>

          <p className="mt-5 flex items-start gap-3 text-base leading-8 text-slate-600">
            <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#eef2ff] text-[#102d92]">
              i
            </span>
            La conversion ya quedo registrada y el inventario seco entra con la fecha de finalizacion del secado.
          </p>
        </article>

        <button
          type="button"
          onClick={finalizar}
          className="inline-flex w-full items-center justify-center gap-3 rounded-[22px] bg-[#102d92] px-5 py-4 text-lg font-black text-white shadow-[0_18px_40px_rgba(16,45,146,0.2)]"
        >
          Finalizar y Ver Inventario
        </button>

        <button
          type="button"
          onClick={() => navigate('/inventario', { state: { preferredTypeKey: 'VERDE' } })}
          className="inline-flex w-full items-center justify-center rounded-[22px] border border-slate-200 bg-white px-5 py-4 text-lg font-black text-[#102d92]"
        >
          Iniciar nuevo secado
        </button>
      </main>
    </div>
  );
}
