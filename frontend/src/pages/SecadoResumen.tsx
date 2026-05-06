import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Home } from 'lucide-react';
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
  const [session, setSession] = useState(() => (sessionId ? getSecadoSession(sessionId) : null));

  useEffect(() => {
    if (!sessionId) return;
    const finalized = finalizeSecado(sessionId);
    setSession(finalized);
  }, [sessionId]);

  const totalEntrada = useMemo(
    () => (session ? session.sublotes.reduce((sum, sublote) => sum + sublote.pesoActual, 0) : 0),
    [session],
  );
  const totalSalida =
    (session?.outputBuenoKg ?? 0) + (session?.outputRegularKg ?? 0) + (session?.outputMaloKg ?? 0);

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f6f6f6] px-4 py-6 text-slate-950">
        <div className="mx-auto w-full max-w-[430px] rounded-[20px] bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-bold">No encontre el resumen de secado.</p>
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
      <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col items-center bg-[#fbfbfb] px-4 py-6 text-center">
        <div className="mt-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#dff7ee]">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#12bf84] text-white">
            <Check size={16} strokeWidth={3} />
          </span>
        </div>

        <h1 className="mt-4 text-[1rem] font-black">Secado registrado</h1>
        <p className="mt-1 text-[0.68rem] text-slate-500">Proceso guardado.</p>

        <section className="mt-5 w-full rounded-[12px] bg-white p-4 text-left shadow-sm">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.08em] text-slate-500">
            Resumen del secado
          </p>
          <div className="mt-4 space-y-3 text-[0.72rem]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Lote</span>
              <span className="font-black">{session.loteCodigo}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Entrada</span>
              <span className="font-black">{kg(totalEntrada)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Salida seca</span>
              <span className="font-black">{kg(totalSalida)}</span>
            </div>
            <div className="rounded-[10px] bg-slate-50 px-3 py-3">
              <div className="flex items-center justify-between text-xs font-black uppercase">
                <span>Total en inventario seco</span>
                <span className="text-[0.9rem] text-[#0647d6]">{kg(totalSalida)}</span>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-auto w-full pb-4">
          <button
            type="button"
            onClick={() => navigate('/inventario', { state: { preferredTypeKey: 'VERDE' } })}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-[#0647d6] text-[0.68rem] font-black text-white"
          >
            <Home size={16} />
            Registrar nuevo secado
          </button>
          <button
            type="button"
            onClick={() => navigate('/inventario', { state: { preferredTypeKey: 'SECO', completedSecadoId: session.id } })}
            className="mt-2 h-10 w-full rounded-[8px] bg-slate-100 text-[0.68rem] font-black text-[#0647d6]"
          >
            Ir a inventario
          </button>
        </div>
      </main>
    </div>
  );
}
