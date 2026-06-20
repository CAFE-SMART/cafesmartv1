import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
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
import { getOfflineCache, saveOfflineCache } from '../services/offlineCacheService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import {
  applySecadoToDetalle,
  createSecadoDraftWithWeights,
  getActiveSecadoSessions,
  mergeSecadoSessions,
  SecadoValidationError,
  type SecadoSession,
} from '../utils/secadoFlow';
import { getActiveSecado } from '../services/secadoService';
import {
  formatCoffeeFullName,
  formatSubloteVisualCode,
} from '../utils/coffeeCodes';

const SECADO_SELECTION_DRAFT_PREFIX = 'cafe-smart:secado-seleccion-draft:v1';
const SECADO_GREEN_SUBLOTES_CACHE_KEY = 'secado_green_sublotes';

function secadoDetalleCacheKey(tipoCafeId: string, calidadId: string) {
  return `${SECADO_GREEN_SUBLOTES_CACHE_KEY}:${tipoCafeId}:${calidadId}`;
}

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

function buildDefaultSelectedWeights(sublotes: SubloteDetalle[]) {
  return sublotes.reduce<Record<string, number>>((weights, sublote) => {
    const available = Math.max(0, Number(sublote.pesoActual.toFixed(1)));
    if (available > 0) {
      weights[sublote.id] = available;
    }
    return weights;
  }, {});
}

export default function SecadoSeleccion() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOffline } = useNetworkStatus();
  const { tipoCafeId, calidadId } = useParams<{
    tipoCafeId: string;
    calidadId: string;
  }>();
  const rawOriginPath = (location.state as { from?: string } | null)?.from;
  const originPath =
    rawOriginPath &&
    ['/inventario', '/ajustes', '/compras', '/ventas', '/inicio'].includes(
      rawOriginPath,
    )
      ? rawOriginPath
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
        if (!isOffline) {
          try {
            mergeSecadoSessions(await getActiveSecado());
          } catch {
            // Conserva las sesiones locales si falla la consulta secundaria.
          }
        }

        const cacheKey = secadoDetalleCacheKey(tipoCafeId, calidadId);
        const base = isOffline
          ? await getOfflineCache<LoteDetalle>(cacheKey)
          : await obtenerDetalleLote(tipoCafeId, calidadId);

        if (!base) {
          throw new Error('No hay sublotes guardados para secado.');
        }

        if (!isOffline) {
          void saveOfflineCache(cacheKey, base);
        }

        const visual = applySecadoToDetalle(base, tipoCafeId, calidadId);

        if (!visual)
          throw new Error(
            'No se encontraron sublotes disponibles para este lote.',
          );

        const sessions = getActiveSecadoSessions();
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
          setSelectedWeights(buildDefaultSelectedWeights(visual.sublotes));
        }
        setActiveSessions(sessions);
      } catch (err) {
        setError(
          isOffline
            ? 'No hay sublotes guardados. Conéctate a internet una vez para cargar los sublotes verdes disponibles antes de iniciar secado sin conexión.'
            : 'No pudimos abrir el proceso de secado. Intenta nuevamente.',
        );
      } finally {
        setLoading(false);
      }
    };

    void cargar();
  }, [calidadId, isOffline, tipoCafeId]);

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
  const availableSublotes = useMemo(
    () =>
      (detalle?.sublotes ?? []).filter((sublote) => sublote.pesoActual > 0),
    [detalle?.sublotes],
  );

  const todosSeleccionados = useMemo(
    () =>
      availableSublotes.length > 0 &&
      availableSublotes.every((sublote) => (selectedWeights[sublote.id] ?? 0) > 0),
    [availableSublotes, selectedWeights],
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
      const session = createSecadoDraftWithWeights(availableDetail, selectedWeights);
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

  const seleccionarTodo = () => {
    setSelectedWeights((current) => {
      const next = { ...current };
      availableSublotes.forEach((sublote) => {
        next[sublote.id] =
          current[sublote.id] && current[sublote.id] > 0
            ? current[sublote.id]
            : sublote.pesoActual;
      });
      return next;
    });
  };

  const limpiarSeleccion = () => {
    setSelectedWeights({});
  };

  const updateSubloteWeight = (sublote: SubloteDetalle, rawValue: string) => {
    const next = sanitizeSecadoWeightInput(rawValue, sublote.pesoActual);
    const value = Number(next);
    setSelectedWeights((current) => {
      if (!Number.isFinite(value) || value <= 0) {
        const updated = { ...current };
        delete updated[sublote.id];
        return updated;
      }
      return { ...current, [sublote.id]: value };
    });
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
    <div className="cs-workflow-page min-h-screen bg-[#f6f6f6] text-slate-950">
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
              Todos los sublotes disponibles inician seleccionados. Ajusta el
              peso directamente si vas a secar solo una parte.
            </p>
            {!loading && availableSublotes.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={seleccionarTodo}
                  disabled={todosSeleccionados}
                  className="inline-flex min-h-[38px] items-center justify-center rounded-[12px] border border-[#cfd8ea] bg-white px-3 text-[0.68rem] font-black text-[#1747d4] shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {todosSeleccionados ? 'Todos seleccionados' : 'Seleccionar todo'}
                </button>
                <button
                  type="button"
                  onClick={limpiarSeleccion}
                  disabled={selectedIds.length === 0}
                  className="inline-flex min-h-[38px] items-center justify-center rounded-[12px] border border-[#cfd8ea] bg-white px-3 text-[0.68rem] font-black text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Limpiar selección
                </button>
              </div>
            ) : null}
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
                    {items.map((sublote, index) => {
                      const selected = (selectedWeights[sublote.id] ?? 0) > 0;
                      const selectedKg =
                        selectedWeights[sublote.id] ?? sublote.pesoActual;
                      const visualCode = formatSubloteVisualCode(sublote, index);
                      const fullName = formatCoffeeFullName(sublote);

                      return (
                        <article
                          key={sublote.id}
                          className={`rounded-[14px] border px-3 py-3 ${
                            selected
                              ? 'border-slate-300 bg-slate-50'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => toggleSublote(sublote)}
                              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-transparent ${
                                selected
                                  ? 'border-emerald-400 bg-emerald-400 text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                              aria-label={`Seleccionar ${visualCode} ${fullName}`}
                            >
                              <Check size={14} strokeWidth={3} />
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p
                                    className="truncate text-sm font-black text-slate-900"
                                    title={`${visualCode} · ${fullName}`}
                                  >
                                    {visualCode}
                                  </p>
                                  <p className="mt-0.5 truncate text-[0.64rem] font-black text-[#5570a8]">
                                    {fullName}
                                  </p>
                                </div>
                                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  {formatDaysLabel(sublote.fechaIngreso)}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.72rem] text-slate-600">
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                                  {kg(sublote.pesoActual)}
                                </span>
                                {sublote.humedad != null ? (
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                                    Humedad {sublote.humedad.toFixed(1)}%
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <label className="flex-1 rounded-[14px] border border-slate-200 bg-white px-2 py-2 text-right text-sm font-black text-slate-900 focus-within:border-slate-400">
                              <input
                                type="number"
                                min="0"
                                max={sublote.pesoActual}
                                step="0.1"
                                value={selected ? selectedKg : ''}
                                onChange={(event) =>
                                  updateSubloteWeight(sublote, event.target.value)
                                }
                                onClick={(event) => event.stopPropagation()}
                                onFocus={() => {
                                  if (!selected) {
                                    setSelectedWeights((current) => ({
                                      ...current,
                                      [sublote.id]: sublote.pesoActual,
                                    }));
                                  }
                                }}
                                className="w-full bg-transparent text-right text-sm font-black text-slate-900 outline-none"
                                aria-label={`Kilos a secar de ${visualCode} ${fullName}`}
                                placeholder="0"
                              />
                              <span className="shrink-0 text-slate-500">kg</span>
                            </label>
                          </div>

                          {selected && selectedKg < sublote.pesoActual ? (
                            <p className="mt-2 text-[0.7rem] text-slate-500">
                              Disponible: {kg(sublote.pesoActual)}
                            </p>
                          ) : null}
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
              Total seleccionado · {selectedIds.length} sublote
              {selectedIds.length === 1 ? '' : 's'}
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
            {isOffline ? 'Guardar secado pendiente' : 'Iniciar secado'} <ChevronRight size={16} />
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
                  setSelectedWeights(
                    buildDefaultSelectedWeights(availableSublotes),
                  );
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
