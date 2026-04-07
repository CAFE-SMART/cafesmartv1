import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, SunMedium } from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import { formatDateLabel } from '../utils/date';
import { obtenerDetalleLote, type LoteDetalle } from '../services/lotesService';
import {
  applySecadoToDetalle,
  getActiveSecadoSession,
  getActiveSecadoSessionForLot,
  startSecado,
} from '../utils/secadoFlow';

function kg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

function shortDate(value: string) {
  return formatDateLabel(value);
}

export default function SecadoSeleccion() {
  const navigate = useNavigate();
  const { tipoCafeId, calidadId } = useParams<{ tipoCafeId: string; calidadId: string }>();
  const [detalle, setDetalle] = useState<LoteDetalle | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [blockingSessionId, setBlockingSessionId] = useState<string | null>(null);

  const cargar = async () => {
    if (!tipoCafeId || !calidadId) {
      setError('No se encontro el lote verde para secado.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const base = await obtenerDetalleLote(tipoCafeId, calidadId);
      const visual = applySecadoToDetalle(base, tipoCafeId, calidadId);

      if (!visual) {
        throw new Error('No se encontraron sublotes disponibles para este lote.');
      }

      setDetalle(visual);
      setSelectedIds(visual.sublotes.map((sublote) => sublote.id));

      const active = getActiveSecadoSessionForLot(visual.lote.id);
      setActiveSessionId(active?.id ?? null);

      const anyActive = getActiveSecadoSession();
      if (anyActive && anyActive.loteId !== visual.lote.id) {
        setBlockingSessionId(anyActive.id);
      } else {
        setBlockingSessionId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el proceso de secado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, [calidadId, tipoCafeId]);

  const totalSeleccionado = useMemo(() => {
    if (!detalle) return 0;
    return detalle.sublotes
      .filter((sublote) => selectedIds.includes(sublote.id))
      .reduce((sum, sublote) => sum + sublote.pesoActual, 0);
  }, [detalle, selectedIds]);

  const seleccionarTodo = () => {
    if (!detalle) return;

    if (selectedIds.length === detalle.sublotes.length) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(detalle.sublotes.map((sublote) => sublote.id));
  };

  const toggleSublote = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const iniciarSecado = () => {
    if (!detalle || selectedIds.length === 0) return;

    const session = startSecado(detalle, selectedIds);
    navigate('/inventario', {
      state: { preferredTypeKey: 'VERDE', activeSecadoId: session.id },
      replace: true,
    });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] pb-[150px] text-slate-900">
      <header className="border-b border-white/80 bg-[rgba(247,245,255,0.92)] px-4 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/inventario', { state: { preferredTypeKey: 'VERDE' } })}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#102d92] shadow-sm"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-[1.45rem] font-black text-[#102d92]">
                Café Verde - {detalle?.lote.calidad ?? 'Secado'}
              </p>
            </div>
          </div>
          <CloudStatusBadge compact className="max-w-[220px]" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[520px] flex-col gap-5 px-4 py-6">
        <section className="rounded-[28px] border border-[#cdeef1] bg-[#dff8fb] p-6">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#0f6b6d]">
            Estado de bodega
          </p>
          <h1 className="mt-4 text-[2rem] font-black leading-tight text-[#102d92]">
            Procesamiento de secado necesario
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Selecciona los sublotes verdes que salen a secado. El lote queda pausado hasta finalizar el proceso.
          </p>
        </section>

        {activeSessionId ? (
          <section className="rounded-[26px] border border-[#d9e2f5] bg-white p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
              Proceso activo
            </p>
            <p className="mt-3 text-[1.5rem] font-black text-[#102d92]">
              Este lote ya está en proceso de secado.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/inventario/secado/${activeSessionId}/finalizar`)}
              className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-[20px] bg-[#102d92] px-5 py-4 text-base font-black text-white"
            >
              Finalizar secado
            </button>
          </section>
        ) : null}

        {!activeSessionId && blockingSessionId ? (
          <section className="rounded-[26px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-700">
              Secado activo
            </p>
            <p className="mt-3 text-[1.3rem] font-black text-amber-900">
              Ya tienes otro lote en secado. Finalízalo primero para iniciar uno nuevo.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/inventario/secado/${blockingSessionId}/finalizar`)}
              className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-[20px] bg-[#102d92] px-5 py-4 text-base font-black text-white"
            >
              Ir al secado en proceso
            </button>
          </section>
        ) : null}

        {error ? (
          <section className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            {error}
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-[26px] border border-[#dde4f1] bg-white px-5 py-12 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-500">Cargando sublotes...</p>
          </section>
        ) : null}

        {!loading && detalle ? (
          <>
            <section className="rounded-[28px] border border-[#d9e2f5] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                    Inventario disponible
                  </p>
                  <h2 className="mt-2 text-[2rem] font-black leading-tight text-[#102d92]">
                    Sublotes pendientes
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">Calidad: {detalle.lote.calidad}</p>
                </div>
                <button
                  type="button"
                  onClick={seleccionarTodo}
                  className="inline-flex items-center gap-2 rounded-full bg-[#fff0c8] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#8c5a00]"
                >
                  <Check size={14} />
                  {selectedIds.length === detalle.sublotes.length ? 'Quitar todo' : 'Seleccionar todo'}
                </button>
              </div>
            </section>

            <section className="space-y-4">
              {detalle.sublotes.map((sublote) => {
                const checked = selectedIds.includes(sublote.id);

                return (
                  <article
                    key={sublote.id}
                    className="rounded-[28px] border border-[#e6e8f3] bg-[#f7f7ff] p-5 shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      <button
                        type="button"
                        onClick={() => toggleSublote(sublote.id)}
                        className={`mt-1 inline-flex h-10 w-10 items-center justify-center rounded-xl border text-white ${
                          checked ? 'border-[#102d92] bg-[#102d92]' : 'border-slate-200 bg-white text-transparent'
                        }`}
                      >
                        <Check size={18} />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-[1.6rem] font-black leading-none text-[#102d92]">
                            {sublote.etiqueta}
                          </h3>
                          <span className="rounded-full bg-[#fff0c8] px-3 py-1 text-xs font-black uppercase text-[#8c5a00]">
                            {sublote.humedad === null ? 'Pendiente' : 'Atención'}
                          </span>
                          <span className="rounded-[14px] bg-[#86e7e2] px-3 py-2 text-sm font-black text-[#0b565d]">
                            {sublote.humedad === null ? '--' : `${sublote.humedad.toFixed(1)}%`} H
                          </span>
                          <span className="rounded-[14px] bg-[#ffe09a] px-3 py-2 text-sm font-black text-[#8c5a00]">
                            {sublote.diasEnBodega} días
                          </span>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                              Fecha compra
                            </p>
                            <p className="mt-2 text-xl font-black text-slate-900">
                              {shortDate(sublote.fechaIngreso)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                              Peso neto
                            </p>
                            <p className="mt-2 text-xl font-black text-[#102d92]">
                              {kg(sublote.pesoActual)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <section className="rounded-[26px] border border-[#d9ddef] bg-[#f0f1fb] p-5 shadow-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Sublotes seleccionados
                  </p>
                  <p className="mt-3 text-[2rem] font-black text-[#102d92]">{selectedIds.length}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Peso total seleccionado
                  </p>
                  <p className="mt-3 text-[2rem] font-black text-[#102d92]">
                    {kg(totalSeleccionado)}
                  </p>
                </div>
              </div>
            </section>

            <button
              type="button"
              onClick={iniciarSecado}
              disabled={selectedIds.length === 0 || Boolean(activeSessionId) || Boolean(blockingSessionId)}
              className="inline-flex w-full items-center justify-center gap-3 rounded-[22px] bg-[#102d92] px-5 py-4 text-lg font-black text-white shadow-[0_18px_40px_rgba(16,45,146,0.2)] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <SunMedium size={20} />
              Iniciar secado
            </button>
          </>
        ) : null}
      </main>

      <AppBottomNav />
    </div>
  );
}
