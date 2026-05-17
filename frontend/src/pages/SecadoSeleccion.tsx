import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Scale,
  X,
} from 'lucide-react';
import {
  obtenerDetalleLote,
  type LoteDetalle,
  type SubloteDetalle,
} from '../services/lotesService';
import {
  applySecadoToDetalle,
  getActiveSecadoSessions,
  startSecadoWithWeights,
  SecadoValidationError,
  type SecadoSession,
} from '../utils/secadoFlow';

const SECADO_SELECTION_DRAFT_PREFIX = 'cafe-smart:secado-seleccion-draft:v1';

function getSecadoDraftKey(tipoCafeId?: string, calidadId?: string) {
  return `${SECADO_SELECTION_DRAFT_PREFIX}:${tipoCafeId ?? 'na'}:${calidadId ?? 'na'}`;
}

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
  const now = new Date();
  const currentDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const targetDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  return Math.max(0, Math.floor((currentDay - targetDay) / 86400000));
}

function formatDaysLabel(fechaIngreso: string) {
  const days = daysSince(fechaIngreso);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Hace 1d';
  return `Hace ${days}d`;
}

function sanitizeSecadoWeightInput(value: string, max: number) {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const [integer = '', ...decimalParts] = normalized.split('.');
  const decimal = decimalParts.join('').slice(0, 1);
  const next =
    decimalParts.length > 0
      ? `${integer.slice(0, 6) || '0'}.${decimal}`
      : integer.slice(0, 6);
  const numeric = Number(next);
  if (Number.isFinite(numeric) && numeric > max) {
    return String(max);
  }
  return next;
}

export default function SecadoSeleccion() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tipoCafeId, calidadId } = useParams<{
    tipoCafeId: string;
    calidadId: string;
  }>();
  const originPath =
    (location.state as { from?: string } | null)?.from === '/ajustes'
      ? '/ajustes'
      : '/inventario';
  const [detalle, setDetalle] = useState<LoteDetalle | null>(null);
  const [selectedWeights, setSelectedWeights] = useState<
    Record<string, number>
  >({});
  const [editing, setEditing] = useState<SubloteDetalle | null>(null);
  const [draftWeight, setDraftWeight] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<SecadoSession[]>([]);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [adjustNotice, setAdjustNotice] = useState<string | null>(null);

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

        if (!visual)
          throw new Error(
            'No se encontraron sublotes disponibles para este lote.',
          );

        setDetalle(visual);
        const draftRaw = window.localStorage.getItem(
          getSecadoDraftKey(tipoCafeId, calidadId),
        );
        if (draftRaw) {
          const draft = JSON.parse(draftRaw) as {
            selectedWeights?: Record<string, number>;
          };
          setSelectedWeights(draft.selectedWeights ?? {});
          if (Object.keys(draft.selectedWeights ?? {}).length > 0) {
            setShowDraftModal(true);
          }
        } else {
          setSelectedWeights({});
        }
        setActiveSessions(getActiveSecadoSessions());
      } catch (err) {
        setError('No pudimos abrir el proceso de secado. Intenta nuevamente.');
      } finally {
        setLoading(false);
      }
    };

    void cargar();
  }, [calidadId, tipoCafeId]);

  useEffect(() => {
    const hasProgress = Object.values(selectedWeights).some((value) => value > 0);
    const draftKey = getSecadoDraftKey(tipoCafeId, calidadId);

    if (!hasProgress || showDraftModal) {
      if (!hasProgress) window.localStorage.removeItem(draftKey);
      return;
    }

    const timer = window.setTimeout(() => {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({ savedAt: Date.now(), selectedWeights }),
      );
    }, 350);

    return () => window.clearTimeout(timer);
  }, [calidadId, selectedWeights, showDraftModal, tipoCafeId]);

  const selectedIds = useMemo(
    () =>
      Object.keys(selectedWeights).filter(
        (id) => (selectedWeights[id] ?? 0) > 0,
      ),
    [selectedWeights],
  );

  const totalSeleccionado = useMemo(
    () => selectedIds.reduce((sum, id) => sum + (selectedWeights[id] ?? 0), 0),
    [selectedIds, selectedWeights],
  );

  const activeWeightBySubloteId = useMemo(() => {
    const weights = new Map<string, number>();
    for (const session of activeSessions) {
      for (const sublote of session.sublotes) {
        weights.set(
          sublote.id,
          (weights.get(sublote.id) ?? 0) + sublote.pesoActual,
        );
      }
    }
    return weights;
  }, [activeSessions]);

  const availableSublotes = useMemo(
    () =>
      (detalle?.sublotes ?? [])
        .map((sublote) => ({
          ...sublote,
          pesoActual: Math.max(
            0,
            Number(
              (
                sublote.pesoActual -
                (activeWeightBySubloteId.get(sublote.id) ?? 0)
              ).toFixed(1),
            ),
          ),
        }))
        .filter((sublote) => sublote.pesoActual > 0),
    [activeWeightBySubloteId, detalle?.sublotes],
  );

  const currentLotActiveSessions = useMemo(() => {
    if (!detalle) return [];
    const currentSubloteIds = new Set(
      detalle.sublotes.map((sublote) => sublote.id),
    );
    return activeSessions.filter(
      (session) =>
        session.loteId === detalle.lote.id &&
        session.sublotes.some((sublote) => currentSubloteIds.has(sublote.id)),
    );
  }, [activeSessions, detalle]);

  const latestActiveSession = useMemo(
    () =>
      [...currentLotActiveSessions].sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )[0] ?? null,
    [currentLotActiveSessions],
  );

  const grouped = useMemo(() => {
    const groups = ['BUENO', 'REGULAR', 'MALO'];
    return groups.map((quality) => ({
      quality,
      items: availableSublotes.filter(
        (sublote) => qualityKey(sublote.calidad) === quality,
      ),
    }));
  }, [availableSublotes]);

  const toggleSublote = (sublote: SubloteDetalle) => {
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
    setEditing(sublote);
    setDraftWeight(String(selectedWeights[sublote.id] || sublote.pesoActual));
  };

  const confirmAdjust = () => {
    if (!editing) return;
    const value = Number(draftWeight);
    if (!Number.isFinite(value) || value <= 0) {
      setError('La cantidad de entrada del secado debe ser mayor a 0.');
      return;
    }

    if (value > editing.pesoActual) {
      setError('La cantidad a secar no puede superar el peso disponible.');
      return;
    }

    setSelectedWeights((current) => ({ ...current, [editing.id]: value }));
    setEditing(null);
    setError(null);
  };

  const iniciarSecado = () => {
    if (!detalle || selectedIds.length === 0) return;
    const availableDetail = {
      ...detalle,
      sublotes: availableSublotes,
    };
    try {
      const session = startSecadoWithWeights(availableDetail, selectedWeights);
      window.localStorage.removeItem(getSecadoDraftKey(tipoCafeId, calidadId));
      navigate(`/inventario/secado/${session.id}/finalizar`, {
        state: { from: originPath },
      });
    } catch (err) {
      if (err instanceof SecadoValidationError) {
        setError(err.message);
        return;
      }

      setError('No pudimos iniciar el secado. Intenta nuevamente.');
    }
  };

  const updateDraftWeight = (rawValue: string) => {
    if (!editing) return;
    const next = sanitizeSecadoWeightInput(rawValue, editing.pesoActual);
    const attempted = Number(rawValue.replace(',', '.').replace(/[^\d.]/g, ''));
    if (Number.isFinite(attempted) && attempted > editing.pesoActual) {
      setAdjustNotice(
        `La cantidad no puede superar ${kg(editing.pesoActual)}. Ajusta los kilos antes de continuar.`,
      );
    } else {
      setAdjustNotice(null);
    }
    setDraftWeight(next);
  };

  const volverSinIniciar = () => {
    if (selectedIds.length > 0) {
      setShowExitModal(true);
      return;
    }

    navigate(
      originPath,
      originPath === '/inventario'
        ? { state: { preferredTypeKey: 'VERDE' } }
        : undefined,
    );
  };

  const salirSinGuardar = () => {
    window.localStorage.removeItem(getSecadoDraftKey(tipoCafeId, calidadId));
    setSelectedWeights({});
    setShowExitModal(false);
    navigate(
      originPath,
      originPath === '/inventario'
        ? { state: { preferredTypeKey: 'VERDE' } }
        : undefined,
    );
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-[#fbfbfb]">
        <header className="relative flex h-12 items-center justify-center border-b border-slate-100 px-4">
          <button
            type="button"
            onClick={volverSinIniciar}
            className="absolute left-4 inline-flex h-8 w-8 items-center justify-center text-[#1f4fd8]"
            aria-label="Volver"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-sm font-extrabold">Iniciar secado</h1>
        </header>

        <main className="flex flex-1 flex-col gap-4 px-4 py-4 pb-5">
          <section>
            <h2 className="text-[1.05rem] font-black leading-tight">
              Selecciona los sublotes de café verde
            </h2>
            <p className="mt-2 text-[0.72rem] leading-5 text-slate-500">
              Selecciona los sublotes que vas a secar. Puedes enviar todo el
              peso o tocar Ajustar cantidad para secar solo una parte.
            </p>
          </section>

          {latestActiveSession ? (
            <section className="rounded-[16px] border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900">
              Tienes un secado activo de este lote. Puedes revisarlo sin perder
              lo que ya guardaste.
              <button
                type="button"
                onClick={() =>
                  navigate('/inventario/secados', { state: { from: originPath } })
                }
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
              No hay sublotes disponibles para iniciar otro secado. Los sublotes
              de este lote ya están en proceso o no tienen peso disponible.
            </section>
          ) : null}

          {!loading && detalle && availableSublotes.length > 0 ? (
            <section className="space-y-4">
              {grouped.map(({ quality, items }) =>
                items.length > 0 ? (
                  <div key={quality} className="space-y-2">
                    <p className="flex items-center gap-2 text-[0.64rem] font-black uppercase tracking-[0.08em] text-slate-500">
                      <span
                        className={`h-2 w-2 rounded-full ${qualityTone(quality)}`}
                      />
                      Calidad: {quality.toLowerCase()}
                    </p>
                    {items.map((sublote) => {
                      const selected = (selectedWeights[sublote.id] ?? 0) > 0;
                      const selectedKg =
                        selectedWeights[sublote.id] ?? sublote.pesoActual;

                      return (
                        <article
                          key={sublote.id}
                          className={`rounded-[18px] border bg-white p-3 shadow-sm ${
                            selected
                              ? 'border-[#1455ff] ring-1 ring-[#1455ff]'
                              : 'border-slate-100'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => toggleSublote(sublote)}
                              className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                selected
                                  ? 'border-[#1455ff] bg-[#1455ff] text-white'
                                  : 'border-slate-300 bg-white text-transparent'
                              }`}
                              aria-label="Seleccionar sublote"
                            >
                              <Check size={13} strokeWidth={3} />
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-black">
                                  {sublote.etiqueta}
                                </p>
                                <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-slate-500">
                                  <CalendarDays size={11} />
                                  {formatDaysLabel(sublote.fechaIngreso)}
                                </span>
                              </div>
                              <p className="mt-1 text-[0.72rem] font-bold text-slate-500">
                                {kg(selected ? selectedKg : sublote.pesoActual)}
                                {selected && selectedKg < sublote.pesoActual
                                  ? ' seleccionados'
                                  : ''}
                              </p>
                              <button
                                type="button"
                                onClick={() => openAdjust(sublote)}
                                className="mt-2 inline-flex h-8 items-center rounded-[10px] bg-[#eef4ff] px-3 text-[0.68rem] font-black text-[#1f4fd8]"
                              >
                                Ajustar cantidad
                              </button>
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

        <footer className="sticky bottom-0 z-20 mx-auto w-full max-w-[430px] bg-[#fbfbfb] px-4 pb-4 pt-2 shadow-[0_-10px_24px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between rounded-t-[2px] bg-[#0647d6] px-4 py-2 text-white">
            <span className="text-[0.62rem] font-black uppercase tracking-[0.12em]">
              Total seleccionado
            </span>
            <span className="inline-flex items-center gap-2 text-sm font-black">
              {kg(totalSeleccionado)}
              <Scale size={16} />
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowStartConfirm(true)}
            disabled={selectedIds.length === 0}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0647d6] text-xs font-black uppercase tracking-[0.05em] text-white shadow-[0_12px_22px_rgba(6,71,214,0.2)] disabled:bg-slate-300"
          >
            Iniciar secado <ChevronRight size={16} />
          </button>
        </footer>
      </div>

      {showExitModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-5 backdrop-blur-[2px]">
          <section className="w-full max-w-[390px] rounded-[20px] bg-white p-5 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <AlertTriangle size={22} />
            </div>
            <h2 className="mt-4 text-lg font-black text-slate-950">
              ¿Salir del proceso?
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              El secado aún no ha sido iniciado.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="min-h-[44px] rounded-[14px] bg-[#0647d6] px-3 text-sm font-black text-white"
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={salirSinGuardar}
                className="min-h-[44px] rounded-[14px] border border-slate-200 bg-white px-3 text-sm font-black text-slate-600"
              >
                Salir sin guardar
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showStartConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-5 backdrop-blur-[2px]">
          <section className="w-full max-w-[390px] rounded-[20px] bg-white p-5 text-center shadow-2xl">
            <h2 className="text-lg font-black text-slate-950">
              Confirmar inicio de secado
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              Se iniciará el secado con {kg(totalSeleccionado)} seleccionados.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowStartConfirm(false)}
                className="min-h-[44px] rounded-[14px] border border-slate-200 bg-white px-3 text-sm font-black text-slate-600"
              >
                Revisar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowStartConfirm(false);
                  iniciarSecado();
                }}
                className="min-h-[44px] rounded-[14px] bg-[#0647d6] px-3 text-sm font-black text-white"
              >
                Iniciar secado
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showDraftModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-5 backdrop-blur-[2px]">
          <section className="w-full max-w-[390px] rounded-[20px] bg-white p-5 text-center shadow-2xl">
            <h2 className="text-lg font-black text-slate-950">
              Borrador de secado encontrado
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              Puedes continuar el proceso o empezar de nuevo.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowDraftModal(false)}
                className="min-h-[44px] rounded-[14px] bg-[#0647d6] px-3 text-sm font-black text-white"
              >
                Continuar
              </button>
              <button
                type="button"
                onClick={() => {
                  window.localStorage.removeItem(
                    getSecadoDraftKey(tipoCafeId, calidadId),
                  );
                  setSelectedWeights({});
                  setShowDraftModal(false);
                }}
                className="min-h-[44px] rounded-[14px] border border-slate-200 bg-white px-3 text-sm font-black text-slate-600"
              >
                Empezar de nuevo
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 px-5 backdrop-blur-[2px]">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[430px] overflow-y-auto rounded-[14px] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black">Ajustar cantidad</h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-slate-400"
                aria-label="Cerrar ajuste de cantidad"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 flex items-start justify-between rounded-[14px] bg-slate-50 p-3">
              <div>
                <p className="text-[0.58rem] font-black uppercase text-slate-400">
                  Sublote
                </p>
                <p className="mt-1 text-sm font-black">{editing.etiqueta}</p>
              </div>
              <div className="text-right">
                <p className="text-[0.58rem] font-black uppercase text-slate-400">
                  Disponible
                </p>
                <p className="mt-1 text-sm font-black text-[#0647d6]">
                  {kg(editing.pesoActual)}
                </p>
              </div>
            </div>
            <label className="mt-4 block text-xs font-black text-slate-700">
              Cantidad a secar (kg)
            </label>
            <input
              type="number"
              min="0"
              max={editing.pesoActual}
              step="0.1"
              value={draftWeight}
              onChange={(event) => updateDraftWeight(event.target.value)}
              onPaste={(event) => {
                event.preventDefault();
                updateDraftWeight(event.clipboardData.getData('text'));
              }}
              className="mt-2 h-11 w-full rounded-[12px] border border-slate-200 px-4 text-sm font-bold outline-none focus:border-[#0647d6]"
              placeholder="Ej: 50"
            />
            {adjustNotice ? (
              <div className="mt-2 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
                {adjustNotice}
              </div>
            ) : null}
            <p className="mt-2 text-[0.68rem] text-slate-400">
              Debe ser menor o igual a {kg(editing.pesoActual)}.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-11 rounded-full text-xs font-bold text-slate-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmAdjust}
                className="h-11 rounded-full bg-[#0647d6] text-xs font-black text-white"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
