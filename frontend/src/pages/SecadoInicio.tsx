import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Check,
  ClipboardList,
  Scale,
  SunMedium,
} from 'lucide-react';
import { RefreshButton } from '../components/RefreshButton';
import { AppBottomNav } from '../components/AppBottomNav';
import { DraftRecoveryModal } from '../components/DraftRecoveryModal';
import { EmptyState } from '../components/EmptyState';
import {
  obtenerDetalleLote,
  obtenerLotes,
  type LoteDetalle,
  type LoteResumen,
  type SubloteDetalle,
} from '../services/lotesService';
import {
  applySecadoToDetalle,
  applySecadoToLots,
  cancelSecadoSession,
  loadSecadoSessions,
  SecadoValidationError,
  startSecadoWithWeights,
  type SecadoSession,
} from '../utils/secadoFlow';

type SecadoView = 'start' | 'pending';
type SecadoQualityFilter = 'BUENO' | 'REGULAR' | 'MALO';
type SecadoDraft = {
  selectedId: string | null;
  qualityFilter: SecadoQualityFilter;
  selectedWeights: Record<string, number>;
  savedAt: number;
};

const SECADO_DRAFT_STORAGE_KEY = 'cafe-smart:secado-draft:v1';

const QUALITY_OPTIONS: Array<{ value: SecadoQualityFilter; label: string }> = [
  { value: 'BUENO', label: 'Bueno' },
  { value: 'REGULAR', label: 'Regular' },
  { value: 'MALO', label: 'Malo' },
];

function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function formatKg(value: number) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function kg(value: number) {
  return `${formatKg(value)} kg`;
}

function titleCase(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function isQualityMatch(value: string, quality: SecadoQualityFilter) {
  const key = keyOf(value);
  if (quality === 'MALO') return key === 'MALO';
  return key === quality;
}

function formatHumidity(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function daysSince(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const now = new Date();
  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.max(0, Math.floor((currentDay - targetDay) / 86400000));
}

function formatDaysLabel(value: string) {
  const days = daysSince(value);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Hace 1d';
  return `Hace ${days}d`;
}

function totalSecadoKg(session: SecadoSession) {
  return session.sublotes.reduce((sum, sublote) => sum + sublote.pesoActual, 0);
}

function estadoLabel(session: SecadoSession) {
  return session.estado === 'READY'
    ? 'Secado pendiente'
    : 'En proceso de secado';
}

function readSecadoDraft(): SecadoDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SECADO_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<SecadoDraft>;
    if (
      draft.qualityFilter !== 'BUENO' &&
      draft.qualityFilter !== 'REGULAR' &&
      draft.qualityFilter !== 'MALO'
    ) {
      return null;
    }
    if (!draft.selectedWeights || typeof draft.selectedWeights !== 'object') {
      return null;
    }
    const selectedWeights = Object.fromEntries(
      Object.entries(draft.selectedWeights).filter(
        ([, value]) => Number.isFinite(value) && value > 0,
      ),
    ) as Record<string, number>;
    if (Object.keys(selectedWeights).length === 0) return null;
    return {
      selectedId: typeof draft.selectedId === 'string' ? draft.selectedId : null,
      qualityFilter: draft.qualityFilter,
      selectedWeights,
      savedAt:
        typeof draft.savedAt === 'number' && Number.isFinite(draft.savedAt)
          ? draft.savedAt
          : Date.now(),
    };
  } catch {
    return null;
  }
}

function writeSecadoDraft(draft: SecadoDraft) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SECADO_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // El borrador no debe bloquear la selección de secado.
  }
}

function clearSecadoDraft() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SECADO_DRAFT_STORAGE_KEY);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export default function SecadoInicio() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as {
    secadoView?: SecadoView;
    from?: string;
  } | null;
  const initialView = locationState?.secadoView;
  const originPath = locationState?.from === '/ajustes' ? '/ajustes' : '/inventario';
  const [view, setView] = useState<SecadoView>(
    initialView === 'pending' ? 'pending' : 'start',
  );
  const [lotes, setLotes] = useState<LoteResumen[]>([]);
  const [pendingSessions, setPendingSessions] = useState<SecadoSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qualityFilter, setQualityFilter] = useState<SecadoQualityFilter>('BUENO');
  const [detalle, setDetalle] = useState<LoteDetalle | null>(null);
  const [selectedWeights, setSelectedWeights] = useState<Record<string, number>>({});
  const [draftReady, setDraftReady] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<SecadoDraft | null>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftWeightsToRestore, setDraftWeightsToRestore] =
    useState<SecadoDraft | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SecadoSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarPendientes = () => {
    const pendientes = loadSecadoSessions()
      .filter((session) => session.estado !== 'COMPLETED')
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

    setPendingSessions(pendientes);
  };

  const cargar = async () => {
    setLoading(true);
    setError(null);
    const sessions = loadSecadoSessions();
    const pendientes = sessions
      .filter((session) => session.estado !== 'COMPLETED')
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    const pendingLotIds = new Set(pendientes.map((session) => session.loteId));
    setPendingSessions(pendientes);

    try {
      const data = await obtenerLotes();
      const lotesVisuales = applySecadoToLots(data);
      const verdesDisponibles = lotesVisuales.filter(
        (lote) =>
          keyOf(lote.tipoCafe) === 'VERDE' &&
          lote.pesoActual > 0 &&
          !pendingLotIds.has(lote.id),
      );
      setLotes(verdesDisponibles);
      setSelectedId((current) => {
        if (current && verdesDisponibles.some((lote) => lote.id === current)) {
          return current;
        }
        return (
          verdesDisponibles.find((lote) => isQualityMatch(lote.calidad, 'BUENO'))
            ?.id ??
          verdesDisponibles[0]?.id ??
          null
        );
      });
    } catch (err) {
      setError('No pudimos cargar el flujo de secado. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  useEffect(() => {
    const draft = readSecadoDraft();
    if (draft) {
      setPendingDraft(draft);
      setShowDraftModal(true);
    }
    setDraftReady(true);
  }, []);

  const loteSeleccionado = useMemo(
    () => lotes.find((lote) => lote.id === selectedId) ?? null,
    [lotes, selectedId],
  );

  useEffect(() => {
    if (view !== 'start') return;
    const preferred = draftWeightsToRestore?.selectedId
      ? lotes.find(
          (lote) =>
            lote.id === draftWeightsToRestore.selectedId &&
            isQualityMatch(lote.calidad, qualityFilter),
        )
      : null;
    const next =
      preferred ??
      lotes.find((lote) => isQualityMatch(lote.calidad, qualityFilter));
    setSelectedId(next?.id ?? null);
    if (!next) {
      setDetalle(null);
      setSelectedWeights({});
    }
  }, [draftWeightsToRestore?.selectedId, lotes, qualityFilter, view]);

  useEffect(() => {
    if (!loteSeleccionado || view !== 'start') return;

    let cancelled = false;
    setDetailLoading(true);
    setError(null);

    void (async () => {
      try {
        const base = await obtenerDetalleLote(
          loteSeleccionado.tipoCafeId,
          loteSeleccionado.calidadId,
        );
        const visual = applySecadoToDetalle(
          base,
          loteSeleccionado.tipoCafeId,
          loteSeleccionado.calidadId,
        );
        if (cancelled) return;
        setDetalle(visual);
        const defaultWeights = Object.fromEntries(
          (visual?.sublotes ?? [])
            .filter((sublote) => sublote.pesoActual > 0)
            .map((sublote) => [sublote.id, sublote.pesoActual]),
        );
        const restoredWeights =
          draftWeightsToRestore?.selectedId === loteSeleccionado.id
            ? Object.fromEntries(
                Object.entries(draftWeightsToRestore.selectedWeights).filter(
                  ([id, weight]) =>
                    (visual?.sublotes ?? []).some(
                      (sublote) =>
                        sublote.id === id &&
                        weight > 0 &&
                        weight <= sublote.pesoActual,
                    ),
                ),
              )
            : null;
        setSelectedWeights(
          restoredWeights && Object.keys(restoredWeights).length > 0
            ? (restoredWeights as Record<string, number>)
            : defaultWeights,
        );
        setDraftWeightsToRestore(null);
      } catch {
        if (!cancelled) {
          setDetalle(null);
          setSelectedWeights({});
          setError('No pudimos cargar la información. Verifica tu conexión o vuelve a intentarlo.');
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draftWeightsToRestore, loteSeleccionado, view]);

  const availableSublotes = useMemo(
    () =>
      (detalle?.sublotes ?? []).filter(
        (sublote) =>
          sublote.pesoActual > 0 &&
          isQualityMatch(sublote.calidad, qualityFilter),
      ),
    [detalle, qualityFilter],
  );

  const grouped = useMemo(() => {
    return [
      {
        quality: qualityFilter,
        items: availableSublotes,
      },
    ];
  }, [availableSublotes, qualityFilter]);

  const selectedIds = useMemo(
    () =>
      availableSublotes
        .filter((sublote) => (selectedWeights[sublote.id] ?? 0) > 0)
        .map((sublote) => sublote.id),
    [availableSublotes, selectedWeights],
  );

  const totalSeleccionado = useMemo(
    () => selectedIds.reduce((sum, id) => sum + (selectedWeights[id] ?? 0), 0),
    [selectedIds, selectedWeights],
  );

  const selectedVisibleSublotes = useMemo(
    () =>
      availableSublotes.filter((sublote) =>
        selectedIds.includes(sublote.id),
      ),
    [availableSublotes, selectedIds],
  );

  const todosSeleccionados =
    availableSublotes.length > 0 &&
    availableSublotes.every((sublote) => (selectedWeights[sublote.id] ?? 0) > 0);

  useEffect(() => {
    if (!draftReady || showDraftModal || view !== 'start') return;
    if (selectedIds.length === 0 || totalSeleccionado <= 0) {
      clearSecadoDraft();
      return;
    }

    writeSecadoDraft({
      selectedId,
      qualityFilter,
      selectedWeights: Object.fromEntries(
        Object.entries(selectedWeights).filter(([, value]) => value > 0),
      ),
      savedAt: Date.now(),
    });
  }, [
    draftReady,
    qualityFilter,
    selectedId,
    selectedIds.length,
    selectedWeights,
    showDraftModal,
    totalSeleccionado,
    view,
  ]);

  const volver = () => {
    navigate(
      originPath,
      originPath === '/inventario'
        ? { state: { preferredTypeKey: 'VERDE' } }
        : undefined,
    );
  };

  const seleccionarTodo = () => {
    setSelectedWeights(
      Object.fromEntries(
        availableSublotes.map((sublote) => [sublote.id, sublote.pesoActual]),
      ),
    );
    setError(null);
  };

  const limpiarSeleccion = () => {
    setSelectedWeights({});
    setError(null);
  };

  const continuarBorradorSecado = () => {
    if (!pendingDraft) return;
    setQualityFilter(pendingDraft.qualityFilter);
    setDraftWeightsToRestore(pendingDraft);
    setShowDraftModal(false);
    setPendingDraft(null);
    setView('start');
  };

  const empezarSecadoSinBorrador = () => {
    clearSecadoDraft();
    setShowDraftModal(false);
    setPendingDraft(null);
    setDraftWeightsToRestore(null);
    setSelectedWeights({});
    setError(null);
  };

  const confirmarCancelarSecado = () => {
    if (!cancelTarget) return;
    cancelSecadoSession(cancelTarget.id);
    setCancelTarget(null);
    cargarPendientes();
    void cargar();
  };

  const toggleSublote = (sublote: SubloteDetalle) => {
    setSelectedWeights((current) => {
      if ((current[sublote.id] ?? 0) > 0) {
        const next = { ...current };
        delete next[sublote.id];
        return next;
      }
      return { ...current, [sublote.id]: sublote.pesoActual };
    });
    setError(null);
  };

  const updateSubloteWeight = (sublote: SubloteDetalle, rawValue: string) => {
    const normalized = rawValue.replace(',', '.');
    if (!/^\d{0,5}(?:\.\d{0,1})?$/.test(normalized)) {
      setError('Ingresa un valor numérico válido.');
      return;
    }
    if (!normalized) {
      setSelectedWeights((current) => {
        const next = { ...current };
        delete next[sublote.id];
        return next;
      });
      setError(null);
      return;
    }
    const value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Ingresa un valor numérico válido.');
      return;
    }
    if (value > sublote.pesoActual) {
      setError(`El peso seleccionado no puede superar ${kg(sublote.pesoActual)}.`);
      return;
    }
    setSelectedWeights((current) => ({ ...current, [sublote.id]: value }));
    setError(null);
  };

  const iniciarSecado = () => {
    if (!detalle || selectedIds.length === 0) return;
    const selectedQualities = new Set(
      selectedVisibleSublotes.map((sublote) => keyOf(sublote.calidad)),
    );
    if (selectedQualities.size > 1) {
      setError(
        'Operación inválida: No se pueden mezclar diferentes calidades de café en un mismo proceso de secado. Procesa los lotes por separado.',
      );
      return;
    }
    const visibleWeights = Object.fromEntries(
      selectedVisibleSublotes.map((sublote) => [
        sublote.id,
        selectedWeights[sublote.id] ?? 0,
      ]),
    );
    try {
      const session = startSecadoWithWeights(
        { ...detalle, sublotes: selectedVisibleSublotes },
        visibleWeights,
      );
      clearSecadoDraft();
      navigate(`/inventario/secado/${session.id}/finalizar`, {
        state: { from: originPath },
      });
    } catch (err) {
      setError(
        err instanceof SecadoValidationError
          ? err.message
          : 'No pudimos iniciar el secado. Intenta nuevamente.',
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] px-4 py-4 pb-[136px] text-slate-900">
      <div className="mx-auto flex w-full max-w-[430px] flex-col gap-3">
        <header className="rounded-[18px] border border-slate-100 bg-white px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={volver}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
              aria-label="Volver"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-black text-slate-950">
                Proceso de secado
              </h1>
              <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500">
                Revisa secados activos o inicia un nuevo proceso.
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-[14px] bg-[#eaf2ff] p-1">
            <button
              type="button"
              onClick={() => {
                cargarPendientes();
                setView('pending');
              }}
              className={`inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[11px] px-2 text-[0.68rem] font-black transition ${
                view === 'pending'
                  ? 'bg-white text-[#102d92] shadow-sm'
                  : 'text-[#5570a8]'
              }`}
            >
              <ClipboardList size={15} />
              Activos
            </button>
            <button
              type="button"
              onClick={() => setView('start')}
              disabled={loading}
              className={`inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[11px] px-2 text-[0.68rem] font-black transition ${
                view === 'start'
                  ? 'bg-white text-[#102d92] shadow-sm'
                  : 'text-[#5570a8]'
              }`}
            >
              <SunMedium size={15} />
              {loading ? 'Cargando...' : 'Iniciar secado'}
            </button>
          </div>
        </header>

        {view === 'pending' ? (
          <section className="rounded-[18px] border border-[#dbe7ff] bg-white p-3.5 shadow-[0_8px_24px_rgba(47,99,216,0.07)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5570a8]">
                  Secados pendientes
                </p>
                <h2 className="mt-2 text-[1.2rem] font-black text-[#0f235c]">
                  Lotes por finalizar
                </h2>
              </div>
              <RefreshButton
                onClick={cargarPendientes}
                aria-label="Actualizar pendientes"
                iconOnly
              />
            </div>

            <div className="mt-4 space-y-3">
              {pendingSessions.length > 0 ? (
                pendingSessions.map((session) => (
                  <article
                    key={session.id}
                    className="rounded-[14px] border border-[#cfe0ff] bg-[#f8fbff] p-3 shadow-[0_8px_20px_rgba(47,99,216,0.08)]"
                  >
                    <div className="flex items-start gap-3">
                        <span className="inline-flex rounded-xl bg-[#eaf2ff] p-2 text-[#2f63d8]">
                        <SunMedium size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-black text-[#0f235c]">
                          {session.loteCodigo}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#2f63d8]">
                          {estadoLabel(session)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                          <span>{formatKg(totalSecadoKg(session))} kg</span>
                          <span>
                            {session.sublotes.length} sublote
                            {session.sublotes.length === 1 ? '' : 's'}
                          </span>
                          <span>{session.calidad}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/inventario/secado/${session.id}/finalizar`, {
                          state: { from: originPath },
                        })
                      }
                          className="mt-3 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#102d92] px-4 text-sm font-black text-white shadow-[0_12px_24px_rgba(16,45,146,0.18)] transition hover:bg-[#18358f]"
                    >
                      Finalizar secado
                      <ArrowRight size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCancelTarget(session)}
                      className="mt-2 inline-flex min-h-[40px] w-full items-center justify-center rounded-[12px] border border-[#cdd8ef] bg-white px-4 text-sm font-black text-[#334b85] transition hover:bg-[#f4f7ff]"
                    >
                      Cancelar secado
                    </button>
                  </article>
                ))
              ) : (
                <EmptyState
                  icon={ClipboardList}
                  title="No hay secados pendientes"
                  description="Cuando inicies un secado, aparecerá aquí hasta finalizarlo."
                  actionLabel="Iniciar secado"
                  onAction={() => setView('start')}
                />
              )}
            </div>
          </section>
        ) : null}

        {view === 'start' ? (
          <>
            <section className="rounded-[18px] border border-slate-100 bg-white p-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
              <h2 className="text-base font-black leading-tight text-slate-950">
                Selecciona los sublotes de café verde
              </h2>
              <p className="mt-1.5 text-[0.72rem] font-semibold leading-5 text-slate-500">
                Los sublotes disponibles inician seleccionados. Ajusta el
                peso directamente si vas a secar solo una parte.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={seleccionarTodo}
                  disabled={todosSeleccionados || availableSublotes.length === 0}
                  className="inline-flex min-h-[34px] items-center justify-center rounded-[10px] border border-slate-200 bg-white px-2 text-[0.66rem] font-black text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Seleccionar todo
                </button>
                <button
                  type="button"
                  onClick={limpiarSeleccion}
                  disabled={selectedIds.length === 0}
                  className="inline-flex min-h-[34px] items-center justify-center rounded-[10px] border border-slate-200 bg-white px-2 text-[0.66rem] font-black text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Limpiar
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-[13px] border border-[#dbe7ff] bg-[#f5f9ff] px-3 py-2">
                <label
                  htmlFor="secado-quality-filter"
                  className="text-[0.66rem] font-black uppercase tracking-[0.1em] text-[#24469a]"
                >
                  Tipo de calidad
                </label>
                <select
                  id="secado-quality-filter"
                  value={qualityFilter}
                  onChange={(event) => {
                    setQualityFilter(event.target.value as SecadoQualityFilter);
                    setError(null);
                  }}
                  className="h-8 min-w-[118px] rounded-[10px] border border-[#c7d8ff] bg-white px-2.5 text-xs font-black text-[#102d92] outline-none transition focus:border-[#2f63d8] focus:ring-2 focus:ring-[#2f63d8]/15"
                >
                  {QUALITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {error ? (
              <section className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-black leading-5 text-rose-700">
                {error}
              </section>
            ) : null}

            {loading || detailLoading ? (
              <section className="rounded-[16px] border border-slate-100 bg-white p-4 shadow-sm">
                <div className="space-y-3">
                  <div className="h-4 w-28 rounded-full bg-slate-200" />
                  <div className="h-16 rounded-[16px] bg-slate-100" />
                </div>
              </section>
            ) : null}

            {!loading && !detailLoading && availableSublotes.length > 0 ? (
              <section className="space-y-2.5">
                {grouped.map(({ quality, items }) =>
                  items.length > 0 ? (
                    <div key={quality} className="space-y-2">
                      <p className="flex items-center gap-2 px-1 text-[0.62rem] font-black uppercase tracking-[0.08em] text-slate-500">
                        Calidad: {titleCase(quality)}
                      </p>
                      {items.map((sublote) => {
                        const selected = (selectedWeights[sublote.id] ?? 0) > 0;
                        const selectedKg = selectedWeights[sublote.id] ?? '';
                        const humidity = formatHumidity(sublote.humedad);

                        return (
                          <article
                            key={sublote.id}
                            className={`rounded-[12px] border bg-white px-3 py-2 transition ${
                              selected
                                ? 'border-[#9bbcff] bg-[#f3f8ff] shadow-[0_8px_18px_rgba(47,99,216,0.08)]'
                                : 'border-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleSublote(sublote)}
                                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                                    selected
                                      ? 'border-[#2f63d8] bg-[#2f63d8] text-white'
                                      : 'border-slate-300 bg-white text-transparent'
                                  }`}
                                  aria-label={`Seleccionar ${sublote.etiqueta}`}
                                >
                                  <Check size={13} strokeWidth={3} />
                                </button>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[0.82rem] font-black text-slate-950">
                                    {sublote.etiqueta}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.66rem] font-bold text-slate-500">
                                    <span>Peso disponible: {kg(sublote.pesoActual)}</span>
                                    {humidity ? <span>Humedad: {humidity}</span> : null}
                                    <span>{formatDaysLabel(sublote.fechaIngreso)}</span>
                                  </div>
                                </div>
                              </div>

                              <details className="group ml-auto shrink-0 text-right">
                                <summary className="cursor-pointer list-none rounded-full px-2 py-1 text-[0.66rem] font-black text-[#2f63d8] transition hover:bg-[#eaf2ff] hover:text-[#102d92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f63d8]/20">
                                  Ajustar
                                </summary>
                                <label className="mt-2 inline-flex h-8 w-[118px] items-center gap-1 rounded-[10px] border border-[#c7d8ff] bg-white px-2 text-[0.72rem] font-bold text-slate-600 focus-within:border-[#2f63d8]">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={selectedKg}
                                    onChange={(event) =>
                                      updateSubloteWeight(sublote, event.target.value)
                                    }
                                    onFocus={() => {
                                      if (!selected) toggleSublote(sublote);
                                    }}
                                    className="w-full min-w-0 bg-transparent text-right font-black text-slate-900 outline-none"
                                    aria-label={`Kilos a secar de ${sublote.etiqueta}`}
                                    placeholder="0"
                                  />
                                  <span className="shrink-0 text-slate-500">kg</span>
                                </label>
                              </details>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : null,
                )}
              </section>
            ) : null}

            {!loading && !detailLoading && availableSublotes.length === 0 ? (
              <section className="rounded-[16px] border border-dashed border-slate-200 bg-white px-4 py-5 text-center text-xs font-semibold leading-5 text-slate-500 shadow-sm">
                No hay lotes verdes disponibles para iniciar secado.
              </section>
            ) : null}

            <section className="sticky bottom-[72px] z-10 rounded-[18px] border border-[#c7d8ff] bg-white/95 p-3 shadow-[0_-10px_28px_rgba(47,99,216,0.14)] backdrop-blur">
              <div className="rounded-[14px] bg-[linear-gradient(135deg,#102d92_0%,#1d4ed8_100%)] px-4 py-3 text-white">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-blue-100">
                    Total seleccionado
                  </span>
                  <span className="inline-flex items-center gap-2 text-base font-black">
                    {kg(totalSeleccionado)}
                    <Scale size={16} />
                  </span>
                </div>
                <p className="mt-1 text-[0.72rem] font-bold text-blue-100">
                  {selectedIds.length} sublote{selectedIds.length === 1 ? '' : 's'} listo
                  {selectedIds.length === 1 ? '' : 's'} para secado
                </p>
              </div>
              <button
                type="button"
                onClick={iniciarSecado}
                disabled={selectedIds.length === 0 || detailLoading || loading}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#102d92] text-xs font-black uppercase tracking-[0.05em] text-white shadow-[0_14px_28px_rgba(16,45,146,0.22)] transition hover:bg-[#18358f] disabled:cursor-not-allowed disabled:bg-[#9fb2d9] disabled:shadow-none"
              >
                Iniciar secado
              </button>
            </section>
          </>
        ) : null}
      </div>

      {showDraftModal && pendingDraft ? (
        <DraftRecoveryModal
          labelledById="secado-draft-title"
          describedById="secado-draft-description"
          heading="Secado en progreso"
          message="Encontramos un proceso de secado sin finalizar. Puedes continuar con la información guardada o empezar uno nuevo."
          primaryLabel="Continuar secado"
          onPrimary={continuarBorradorSecado}
          onSecondary={empezarSecadoSinBorrador}
          details={[
            { label: 'Tipo de calidad', value: titleCase(pendingDraft.qualityFilter) },
            {
              label: 'Sublotes seleccionados',
              value: Object.keys(pendingDraft.selectedWeights).length,
            },
          ]}
        />
      ) : null}

      {cancelTarget ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancelar-secado-title"
            className="w-full max-w-[420px] rounded-[24px] bg-white p-6 text-center shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
          >
            <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
            <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#ffecef] text-[#b12937]">
              <AlertTriangle size={24} aria-hidden="true" />
            </div>
            <h2
              id="cancelar-secado-title"
              className="mt-5 text-[1.8rem] font-semibold leading-tight text-slate-900"
            >
              ¿Cancelar secado?
            </h2>
            <p className="mt-3 text-[1rem] leading-7 text-slate-500">
              El proceso de secado actual será cancelado y los sublotes volverán
              al inventario disponible.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 py-3 text-[0.95rem] font-black text-[#334b85]"
              >
                Seguir secando
              </button>
              <button
                type="button"
                onClick={confirmarCancelarSecado}
                className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] bg-[#b12937] px-4 py-3 text-[0.95rem] font-black text-white"
              >
                Sí, cancelar
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <AppBottomNav activePath={originPath} />
    </div>
  );
}
