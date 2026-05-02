import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Check, ChevronRight, Scale, X } from 'lucide-react';
import { obtenerDetalleLote, type LoteDetalle, type SubloteDetalle } from '../services/lotesService';
import {
  applySecadoToDetalle,
  getActiveSecadoSessions,
  startSecadoWithWeights,
  type SecadoSession,
} from '../utils/secadoFlow';

function kg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

function qualityKey(value: string) {
  return value.trim().toUpperCase();
}

function qualityTone(value: string) {
  const key = qualityKey(value);
  if (key === 'BUENO') return 'bg-emerald-500';
  if (key === 'REGULAR') return 'bg-amber-400';
  return 'bg-rose-500';
}

function daysSince(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

export default function SecadoSeleccion() {
  const navigate = useNavigate();
  const { tipoCafeId, calidadId } = useParams<{ tipoCafeId: string; calidadId: string }>();
  const [detalle, setDetalle] = useState<LoteDetalle | null>(null);
  const [selectedWeights, setSelectedWeights] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<SubloteDetalle | null>(null);
  const [draftWeight, setDraftWeight] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<SecadoSession[]>([]);

  useEffect(() => {
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

        if (!visual) throw new Error('No se encontraron sublotes disponibles para este lote.');

        setDetalle(visual);
        setSelectedWeights({});
        setActiveSessions(getActiveSecadoSessions());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo abrir el proceso de secado.');
      } finally {
        setLoading(false);
      }
    };

    void cargar();
  }, [calidadId, tipoCafeId]);

  const selectedIds = useMemo(
    () => Object.keys(selectedWeights).filter((id) => (selectedWeights[id] ?? 0) > 0),
    [selectedWeights],
  );

  const totalSeleccionado = useMemo(
    () => selectedIds.reduce((sum, id) => sum + (selectedWeights[id] ?? 0), 0),
    [selectedIds, selectedWeights],
  );

  const activeSubloteIds = useMemo(
    () => new Set(activeSessions.flatMap((session) => session.sublotes.map((sublote) => sublote.id))),
    [activeSessions],
  );

  const availableSublotes = useMemo(
    () => (detalle?.sublotes ?? []).filter((sublote) => !activeSubloteIds.has(sublote.id)),
    [activeSubloteIds, detalle?.sublotes],
  );

  const latestActiveSession = useMemo(
    () =>
      [...activeSessions].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )[0] ?? null,
    [activeSessions],
  );

  const grouped = useMemo(() => {
    const groups = ['BUENO', 'REGULAR', 'MALO'];
    return groups.map((quality) => ({
      quality,
      items: availableSublotes.filter((sublote) => qualityKey(sublote.calidad) === quality),
    }));
  }, [availableSublotes]);

  const toggleSublote = (sublote: SubloteDetalle) => {
    if (activeSubloteIds.has(sublote.id)) return;

    setSelectedWeights((current) => {
      if ((current[sublote.id] ?? 0) > 0) {
        const next = { ...current };
        delete next[sublote.id];
        return next;
      }

      return { ...current, [sublote.id]: sublote.pesoActual };
    });
  };

  const openAdjust = (sublote: SubloteDetalle) => {
    if (activeSubloteIds.has(sublote.id)) return;
    setEditing(sublote);
    setDraftWeight(String(selectedWeights[sublote.id] || sublote.pesoActual));
  };

  const confirmAdjust = () => {
    if (!editing) return;
    const value = Math.max(0, Math.min(editing.pesoActual, Number(draftWeight) || 0));
    setSelectedWeights((current) => ({ ...current, [editing.id]: value }));
    setEditing(null);
  };

  const iniciarSecado = () => {
    if (!detalle || selectedIds.length === 0) return;
    const session = startSecadoWithWeights(detalle, selectedWeights);
    navigate(`/inventario/secado/${session.id}/finalizar`);
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-[340px] flex-col bg-[#fbfbfb]">
        <header className="relative flex h-12 items-center justify-center border-b border-slate-100 px-4">
          <button
            type="button"
            onClick={() => navigate('/inventario', { state: { preferredTypeKey: 'VERDE' } })}
            className="absolute left-4 inline-flex h-8 w-8 items-center justify-center text-[#1f4fd8]"
            aria-label="Volver"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-sm font-extrabold">Iniciar secado</h1>
        </header>

        <main className="flex flex-1 flex-col gap-4 px-4 py-4 pb-28">
          <section>
            <h2 className="text-[1.05rem] font-black leading-tight">Selecciona los sublotes de cafe verde</h2>
            <p className="mt-2 text-[0.72rem] leading-5 text-slate-500">
              Selecciona los sublotes que vas a secar. Al seleccionar uno, se enviara completo
              todo su peso. Si solo quieres secar una parte, puedes ajustar la cantidad.
            </p>
          </section>

          {latestActiveSession ? (
            <section className="rounded-[16px] border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900">
              Tienes un secado activo desde hace {daysSince(latestActiveSession.startedAt)} dias. Puedes revisarlo sin perder lo que ya guardaste.
              <button
                type="button"
                onClick={() => navigate(`/inventario/secado/${latestActiveSession.id}/finalizar`)}
                className="mt-3 w-full rounded-[14px] bg-[#1747d4] py-3 text-xs font-black text-white"
              >
                Revisar secado activo
              </button>
            </section>
          ) : null}

          {error ? (
            <section className="rounded-[16px] border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
              {error}
            </section>
          ) : null}

          {loading ? (
            <section className="rounded-[18px] bg-white p-6 text-center text-sm font-bold text-slate-500 shadow-sm">
              Cargando sublotes...
            </section>
          ) : null}

          {!loading && detalle && availableSublotes.length === 0 ? (
            <section className="rounded-[16px] border border-slate-200 bg-white p-4 text-center text-xs font-semibold leading-5 text-slate-500 shadow-sm">
              No hay sublotes disponibles para iniciar otro secado. Los sublotes de este lote ya estan en proceso o no tienen peso disponible.
            </section>
          ) : null}

          {!loading && detalle && availableSublotes.length > 0 ? (
            <section className="space-y-4">
              {grouped.map(({ quality, items }) =>
                items.length > 0 ? (
                  <div key={quality} className="space-y-2">
                    <p className="flex items-center gap-2 text-[0.64rem] font-black uppercase tracking-[0.08em] text-slate-500">
                      <span className={`h-2 w-2 rounded-full ${qualityTone(quality)}`} />
                      Calidad: {quality.toLowerCase()}
                    </p>
                    {items.map((sublote) => {
                      const selected = (selectedWeights[sublote.id] ?? 0) > 0;
                      const selectedKg = selectedWeights[sublote.id] ?? sublote.pesoActual;

                      return (
                        <article
                          key={sublote.id}
                          className={`rounded-[18px] border bg-white p-3 shadow-sm ${
                            selected ? 'border-[#1455ff] ring-1 ring-[#1455ff]' : 'border-slate-100'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => toggleSublote(sublote)}
                              className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                selected ? 'border-[#1455ff] bg-[#1455ff] text-white' : 'border-slate-300 bg-white text-transparent'
                              }`}
                              aria-label="Seleccionar sublote"
                            >
                              <Check size={13} strokeWidth={3} />
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-black">{sublote.etiqueta}</p>
                                <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-slate-500">
                                  <CalendarDays size={11} />
                                  Hace {sublote.diasEnBodega}d
                                </span>
                              </div>
                              <p className="mt-1 text-[0.72rem] font-bold text-slate-500">
                                {kg(selected ? selectedKg : sublote.pesoActual)}
                                {selected && selectedKg < sublote.pesoActual ? ' seleccionados' : ''}
                              </p>
                              {selected ? (
                                <button
                                  type="button"
                                  onClick={() => openAdjust(sublote)}
                                  className="mt-2 text-[0.68rem] font-black text-[#1f4fd8]"
                                >
                                  Ajustar cantidad
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : null,
              )}
            </section>
          ) : null}
        </main>

        <footer className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[340px] bg-[#fbfbfb] px-4 pb-4">
          <div className="flex items-center justify-between rounded-t-[2px] bg-[#0647d6] px-4 py-2 text-white">
            <span className="text-[0.62rem] font-black uppercase tracking-[0.12em]">Total seleccionado</span>
            <span className="inline-flex items-center gap-2 text-sm font-black">
              {kg(totalSeleccionado)}
              <Scale size={16} />
            </span>
          </div>
          <button
            type="button"
            onClick={iniciarSecado}
            disabled={selectedIds.length === 0}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0647d6] text-xs font-black uppercase tracking-[0.05em] text-white shadow-[0_12px_22px_rgba(6,71,214,0.2)] disabled:bg-slate-300"
          >
            Continuar <ChevronRight size={16} />
          </button>
        </footer>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 px-5 backdrop-blur-[2px]">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[340px] overflow-y-auto rounded-[14px] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black">Ajustar cantidad</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 flex items-start justify-between rounded-[14px] bg-slate-50 p-3">
              <div>
                <p className="text-[0.58rem] font-black uppercase text-slate-400">Sublote</p>
                <p className="mt-1 text-sm font-black">{editing.etiqueta}</p>
              </div>
              <div className="text-right">
                <p className="text-[0.58rem] font-black uppercase text-slate-400">Disponible</p>
                <p className="mt-1 text-sm font-black text-[#0647d6]">{kg(editing.pesoActual)}</p>
              </div>
            </div>
            <label className="mt-4 block text-xs font-black text-slate-700">Cantidad a secar (kg)</label>
            <input
              type="number"
              min="0"
              max={editing.pesoActual}
              step="0.1"
              value={draftWeight}
              onChange={(event) => setDraftWeight(event.target.value)}
              className="mt-2 h-11 w-full rounded-[12px] border border-slate-200 px-4 text-sm font-bold outline-none focus:border-[#0647d6]"
              placeholder="Ej: 50"
            />
            <p className="mt-2 text-[0.68rem] text-slate-400">Debe ser menor o igual a {kg(editing.pesoActual)}.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setEditing(null)} className="h-11 rounded-full text-xs font-bold text-slate-500">
                Cancelar
              </button>
              <button type="button" onClick={confirmAdjust} className="h-11 rounded-full bg-[#0647d6] text-xs font-black text-white">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
