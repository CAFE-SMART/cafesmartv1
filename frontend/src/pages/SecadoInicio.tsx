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
import { AppFeedbackMessage } from '../components/AppFeedbackMessage';
import { SmartSelect } from '../components/SmartSelect';
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
import { getOfflineCache, saveOfflineCache } from '../services/offlineCacheService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import {
  applySecadoToDetalle,
  applySecadoToLots,
  cancelSecadoSession,
  createSecadoDraftWithWeights,
  getSecadoSelectedKg,
  loadSecadoSessions,
  mergeSecadoSessions,
  SecadoValidationError,
  type SecadoSession,
} from '../utils/secadoFlow';
import {
  cancelSecado as cancelSecadoRemoto,
  getActiveSecado,
} from '../services/secadoService';
import {
  formatCoffeeFullName,
  formatSubloteVisualCode,
  getCoffeeCodePrefix,
} from '../utils/coffeeCodes';

type SecadoView = 'start' | 'pending';
type SecadoQualityFilter = 'BUENO' | 'REGULAR' | 'MALO';
type PendingQualityFilter = 'TODOS' | SecadoQualityFilter;
type SecadoDraft = {
  selectedId: string | null;
  qualityFilter: SecadoQualityFilter;
  selectedWeights: Record<string, number>;
  savedAt: number;
};

const SECADO_DRAFT_STORAGE_KEY = 'cafe-smart:secado-draft:v1';
const INVENTORY_SUBLOTES_CACHE_KEY = 'inventory_sublotes';
const SECADO_GREEN_SUBLOTES_CACHE_KEY = 'secado_green_sublotes';

function secadoDetalleCacheKey(tipoCafeId: string, calidadId: string) {
  return `${SECADO_GREEN_SUBLOTES_CACHE_KEY}:${tipoCafeId}:${calidadId}`;
}

const QUALITY_OPTIONS: Array<{ value: SecadoQualityFilter; label: string }> = [
  { value: 'BUENO', label: 'Bueno' },
  { value: 'REGULAR', label: 'Regular' },
  { value: 'MALO', label: 'Malo' },
];
const PENDING_QUALITY_OPTIONS: Array<{ value: PendingQualityFilter; label: string }> = [
  { value: 'TODOS', label: 'Todos' },
  ...QUALITY_OPTIONS,
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

function isPendingQualityMatch(value: string, quality: PendingQualityFilter) {
  if (quality === 'TODOS') return true;
  const key = keyOf(value);
  if (quality === 'MALO') return key === 'MALO' || key === 'PASILLA';
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

function combineLoteDetalles(
  detalles: LoteDetalle[],
  quality: SecadoQualityFilter,
): LoteDetalle | null {
  const sublotesById = new Map<
    string,
    SubloteDetalle & { sourceLoteId?: string }
  >();

  for (const detalle of detalles) {
    for (const sublote of detalle.sublotes) {
      if (
        sublote.pesoActual > 0 &&
        isQualityMatch(sublote.calidad, quality) &&
        !sublotesById.has(sublote.id)
      ) {
        sublotesById.set(sublote.id, {
          ...sublote,
          sourceLoteId: detalle.lote.id,
        });
      }
    }
  }

  const sublotes = [...sublotesById.values()];
  if (detalles.length === 0 || sublotes.length === 0) return null;

  const base = detalles[0].lote;
  const pesoActual = sublotes.reduce((sum, sublote) => sum + sublote.pesoActual, 0);
  const pesoInicial = sublotes.reduce((sum, sublote) => sum + sublote.pesoInicial, 0);
  const sublotesConHumedad = sublotes.filter((sublote) => sublote.humedad !== null).length;

  return {
    lote: {
      ...base,
      id: `secado-${base.tipoCafeId}-${quality.toLowerCase()}`,
      codigo: `${base.tipoCafe} ${quality}`,
      calidad: quality,
      sublotes: sublotes.length,
      sublotesConHumedad,
      pesoActual,
      pesoInicial,
    },
    sublotes,
  };
}

function totalSecadoKg(session: SecadoSession) {
  return session.sublotes.reduce(
    (sum, sublote) => sum + getSecadoSelectedKg(sublote),
    0,
  );
}

function formatSessionOriginCodes(session: SecadoSession) {
  const prefix = getCoffeeCodePrefix(session);
  return session.sublotes
    .map((sublote, index) => {
      const code = sublote.codigo || sublote.etiqueta;
      return code && code.toUpperCase().startsWith(`${prefix}-`)
        ? code.toUpperCase()
        : `${prefix}-${String(index + 1).padStart(2, '0')}`;
    })
    .join(', ');
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
  const { isOffline } = useNetworkStatus();
  const locationState = location.state as {
    secadoView?: SecadoView;
    from?: string;
    restoreSecadoDraft?: boolean;
  } | null;
  const initialView = locationState?.secadoView;
  const originPath =
    locationState?.from &&
    ['/inventario', '/ajustes', '/compras', '/ventas', '/inicio'].includes(
      locationState.from,
    )
      ? locationState.from
      : '/inventario';
  const [view, setView] = useState<SecadoView>(
    initialView === 'pending' ? 'pending' : 'start',
  );
  const [lotes, setLotes] = useState<LoteResumen[]>([]);
  const [pendingSessions, setPendingSessions] = useState<SecadoSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qualityFilter, setQualityFilter] = useState<SecadoQualityFilter>('BUENO');
  const [pendingQualityFilter, setPendingQualityFilter] =
    useState<PendingQualityFilter>('TODOS');
  const [detalle, setDetalle] = useState<LoteDetalle | null>(null);
  const [selectedWeights, setSelectedWeights] = useState<Record<string, number>>({});
  const [draftReady, setDraftReady] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<SecadoDraft | null>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftWeightsToRestore, setDraftWeightsToRestore] =
    useState<SecadoDraft | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SecadoSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarPendientes = () => {
    const pendientes = loadSecadoSessions()
      .filter((session) => session.estado === 'IN_PROCESS' || session.estado === 'READY')
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

    setPendingSessions(pendientes);
  };

  const recargarProcesoSecado = async () => {
    setRefreshing(true);
    try {
      cargarPendientes();
      await cargar();
    } finally {
      setRefreshing(false);
    }
  };

  const cargar = async () => {
    setLoading(true);
    setError(null);
    if (!isOffline) {
      try {
        mergeSecadoSessions(await getActiveSecado());
      } catch {
        // Si falla la consulta remota, la vista conserva los secados locales.
      }
    }
    const sessions = loadSecadoSessions();
    const pendientes = sessions
      .filter((session) => session.estado === 'IN_PROCESS' || session.estado === 'READY')
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    setPendingSessions(pendientes);

    try {
      const data = isOffline
        ? (await getOfflineCache<LoteResumen[]>(SECADO_GREEN_SUBLOTES_CACHE_KEY)) ??
          (await getOfflineCache<LoteResumen[]>(INVENTORY_SUBLOTES_CACHE_KEY))
        : await obtenerLotes();

      if (!data?.length) {
        setLotes([]);
        setSelectedId(null);
        setError(
          isOffline
            ? 'No hay sublotes guardados. Conéctate a internet una vez para cargar los sublotes verdes disponibles antes de iniciar secado sin conexión.'
            : 'No hay café verde disponible para secado.',
        );
        return;
      }

      const lotesVisuales = applySecadoToLots(data);
      const verdesDisponibles = lotesVisuales.filter(
        (lote) =>
          keyOf(lote.tipoCafe) === 'VERDE' &&
          lote.pesoActual > 0,
      );
      if (!isOffline) {
        void saveOfflineCache(INVENTORY_SUBLOTES_CACHE_KEY, data);
        void saveOfflineCache(SECADO_GREEN_SUBLOTES_CACHE_KEY, verdesDisponibles);
      }
      setLotes(verdesDisponibles);
      if (isOffline && verdesDisponibles.length > 0) {
        setError('Estás usando sublotes guardados en este dispositivo.');
      } else if (isOffline) {
        setError('No hay café verde guardado para secado.');
      }
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
      setError(
        isOffline
          ? 'No hay sublotes guardados. Conéctate a internet una vez para cargar los sublotes verdes disponibles antes de iniciar secado sin conexión.'
          : 'No pudimos cargar el flujo de secado. Intenta nuevamente.',
      );
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
      if (locationState?.restoreSecadoDraft) {
        setQualityFilter(draft.qualityFilter);
        setDraftWeightsToRestore(draft);
        setView('start');
      } else {
        setPendingDraft(draft);
        setShowDraftModal(true);
      }
    }
    setDraftReady(true);
  }, [locationState?.restoreSecadoDraft]);

  const loteSeleccionado = useMemo(
    () => lotes.find((lote) => lote.id === selectedId) ?? null,
    [lotes, selectedId],
  );

  const lotesCalidadSeleccionada = useMemo(
    () => lotes.filter((lote) => isQualityMatch(lote.calidad, qualityFilter)),
    [lotes, qualityFilter],
  );
  const pendingSessionsFiltradas = useMemo(
    () =>
      pendingSessions.filter((session) =>
        isPendingQualityMatch(session.calidad, pendingQualityFilter),
      ),
    [pendingQualityFilter, pendingSessions],
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
    if (lotesCalidadSeleccionada.length === 0 || view !== 'start') return;

    let cancelled = false;
    setDetailLoading(true);
    setError(null);

    void (async () => {
      try {
        const gruposUnicos = [
          ...new Map(
            lotesCalidadSeleccionada.map((lote) => [
              `${lote.tipoCafeId}::${lote.calidadId}`,
              lote,
            ]),
          ).values(),
        ];
        const detalles = await Promise.all(
          gruposUnicos.map(async (lote) => {
            const cacheKey = secadoDetalleCacheKey(lote.tipoCafeId, lote.calidadId);
            const base = isOffline
              ? await getOfflineCache<LoteDetalle>(cacheKey)
              : await obtenerDetalleLote(lote.tipoCafeId, lote.calidadId);
            if (!base) {
              throw new Error('No hay sublotes guardados para esa calidad.');
            }
            if (!isOffline) {
              void saveOfflineCache(cacheKey, base);
            }
            return applySecadoToDetalle(base, lote.tipoCafeId, lote.calidadId);
          }),
        );
        const visual = combineLoteDetalles(
          detalles.filter((detalle): detalle is LoteDetalle => Boolean(detalle)),
          qualityFilter,
        );
        if (cancelled) return;
        setDetalle(visual);
        const restoredWeights =
          draftWeightsToRestore?.qualityFilter === qualityFilter
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
            : {},
        );
        setDraftWeightsToRestore(null);
      } catch {
        if (!cancelled) {
          setDetalle(null);
          setSelectedWeights({});
          setError(
            isOffline
              ? 'No hay sublotes guardados. Conéctate a internet una vez para cargar los sublotes verdes disponibles antes de iniciar secado sin conexión.'
              : 'No pudimos cargar la información. Verifica tu conexión o vuelve a intentarlo.',
          );
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draftWeightsToRestore, isOffline, lotesCalidadSeleccionada, qualityFilter, view]);

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
    clearSecadoDraft();
    setSelectedWeights({});
    setDraftWeightsToRestore(null);
    setPendingDraft(null);
    setShowDraftModal(false);
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

  const confirmarCancelarSecado = async () => {
    if (!cancelTarget) return;
    try {
      if (!isOffline) {
        await cancelSecadoRemoto(cancelTarget.id);
      }
      cancelSecadoSession(cancelTarget.id);
      setCancelTarget(null);
      cargarPendientes();
      void cargar();
    } catch {
      setError('No pudimos cancelar el secado. Revisa tu conexión e intenta nuevamente.');
    }
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
      writeSecadoDraft({
        selectedId,
        qualityFilter,
        selectedWeights: visibleWeights,
        savedAt: Date.now(),
      });
      const session = createSecadoDraftWithWeights(
        { ...detalle, sublotes: availableSublotes },
        visibleWeights,
      );
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
    <div className="cs-workflow-page min-h-screen bg-[#f7f8fb] px-4 py-4 pb-[136px] text-slate-900">
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
            <RefreshButton
              onClick={() => void recargarProcesoSecado()}
              loading={refreshing || loading || detailLoading}
              aria-label="Recargar proceso de secado"
              className="shrink-0"
            >
              Recargar
            </RefreshButton>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-[14px] border border-slate-200 bg-[#eaf2ff] p-1 dark:border-slate-600 dark:bg-slate-900">
            <button
              type="button"
              aria-pressed={view === 'pending' ? 'true' : 'false'}
              onClick={() => {
                cargarPendientes();
                setView('pending');
              }}
              className={`inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[11px] px-2 text-[0.68rem] font-black transition ${
                view === 'pending'
                  ? 'border border-blue-700 bg-blue-700 text-white shadow-sm dark:border-blue-500 dark:bg-blue-600 dark:text-white'
                  : 'border border-slate-300 bg-white text-slate-800 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-blue-500/40'
              }`}
            >
              <ClipboardList size={15} />
              Activos
            </button>
            <button
              type="button"
              aria-pressed={view === 'start' ? 'true' : 'false'}
              onClick={() => setView('start')}
              disabled={loading}
              className={`inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[11px] px-2 text-[0.68rem] font-black transition ${
                view === 'start'
                  ? 'border border-blue-700 bg-blue-700 text-white shadow-sm dark:border-blue-500 dark:bg-blue-600 dark:text-white'
                  : 'border border-slate-300 bg-white text-slate-800 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 dark:focus-visible:ring-blue-500/40'
              }`}
            >
              <SunMedium size={15} />
              {loading ? 'Cargando...' : 'Iniciar secado'}
            </button>
          </div>
        </header>

        {view === 'pending' ? (
          <section className="cs-card rounded-[18px] border border-[#dbe7ff] bg-white p-3.5 shadow-[0_8px_24px_rgba(47,99,216,0.07)] dark:border-slate-600 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5570a8] dark:text-slate-300">
                  Secados pendientes
                </p>
                <h2 className="mt-2 text-[1.2rem] font-black text-[#0f235c] dark:text-slate-100">
                  Lotes por finalizar
                </h2>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[13px] border border-[#dbe7ff] bg-[#f5f9ff] px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
              <label
                htmlFor="secado-pending-quality-filter"
                className="shrink-0 text-[0.7rem] font-black uppercase tracking-[0.08em] text-[#24469a] dark:text-slate-200"
              >
                Tipo de calidad
              </label>
              <div className="w-[124px] shrink-0">
                <SmartSelect
                  id="secado-pending-quality-filter"
                  value={pendingQualityFilter}
                  onChange={(event) =>
                    setPendingQualityFilter(event.target.value as PendingQualityFilter)
                  }
                  className="h-9 rounded-[11px] border border-[#c7d8ff] bg-white px-3 py-0 pr-8 text-[0.76rem] font-black text-slate-900 shadow-[inset_0_1px_0_rgba(15,23,42,0.04)]"
                >
                  {PENDING_QUALITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SmartSelect>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {pendingSessionsFiltradas.length > 0 ? (
                pendingSessionsFiltradas.map((session) => {
                  const sessionCode = getCoffeeCodePrefix(session);
                  const sessionName = formatCoffeeFullName(session);
                  const originCodes = formatSessionOriginCodes(session);
                  return (
                  <article
                    key={session.id}
                    title={`${sessionCode} · ${sessionName}`}
                    className="cs-card rounded-[14px] border border-[#cfe0ff] bg-[#f8fbff] p-3 shadow-[0_8px_20px_rgba(47,99,216,0.08)] dark:border-slate-600 dark:bg-slate-900"
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex rounded-xl bg-[#eaf2ff] p-2 text-[#2f63d8] dark:bg-blue-500/20 dark:text-blue-100">
                        <SunMedium size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="cs-chip inline-flex rounded-[9px] border border-[#c7d8ff] bg-white px-2 py-1 text-[0.68rem] font-black text-[#102d92] dark:border-blue-400/60 dark:bg-blue-500/20 dark:text-blue-100">
                            {sessionCode}
                          </span>
                          <p className="truncate text-base font-black text-[#0f235c] dark:text-slate-100">
                            Origen: {originCodes}
                          </p>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-[#2f63d8] dark:text-blue-200">
                          {estadoLabel(session)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
                          <span>{formatKg(totalSecadoKg(session))} kg</span>
                          <span>Resultado seco pendiente</span>
                          <span>
                            {session.sublotes.length} sublote
                            {session.sublotes.length === 1 ? '' : 's'}
                          </span>
                          <span>{session.calidad}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/inventario/secado/${session.id}/finalizar`, {
                            state: { from: originPath },
                          })
                        }
                        className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#102d92] px-3 text-xs font-black text-white shadow-[0_12px_24px_rgba(16,45,146,0.18)] transition hover:bg-[#18358f]"
                      >
                        Finalizar secado
                        <ArrowRight size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCancelTarget(session)}
                        className="inline-flex min-h-[42px] w-full items-center justify-center rounded-[12px] border border-[#cdd8ef] bg-white px-3 text-xs font-black text-[#334b85] transition hover:bg-[#f4f7ff] dark:border-slate-500 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                      >
                        Cancelar secado
                      </button>
                    </div>
                  </article>
                  );
                })
              ) : (
                <EmptyState
                  icon={ClipboardList}
                  title={
                    pendingSessions.length > 0
                      ? 'No hay secados con esa calidad'
                      : 'No hay secados pendientes'
                  }
                  description={
                    pendingSessions.length > 0
                      ? 'Cambia el filtro para ver otros lotes por finalizar.'
                      : 'Cuando inicies un secado, aparecerá aquí hasta finalizarlo.'
                  }
                  actionLabel="Iniciar secado"
                  onAction={() => setView('start')}
                />
              )}
            </div>
          </section>
        ) : null}

        {view === 'start' ? (
          <>
            <section className="cs-card rounded-[18px] border border-slate-100 bg-white p-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.04)] dark:border-slate-600 dark:bg-slate-900">
              <h2 className="text-base font-black leading-tight text-slate-950 dark:text-slate-100">
                Sublotes de café verde
              </h2>
              <p className="mt-1.5 text-[0.72rem] font-semibold leading-5 text-slate-500 dark:text-slate-300">
                Selecciona solo los que vas a secar. Ajusta el peso
                si secas una parte.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={todosSeleccionados ? 'true' : 'false'}
                  onClick={seleccionarTodo}
                  disabled={availableSublotes.length === 0}
                  className={`inline-flex min-h-[34px] items-center justify-center rounded-[10px] border px-2 text-[0.66rem] font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 dark:focus-visible:ring-blue-500/40 ${
                    todosSeleccionados
                      ? 'border-blue-700 bg-blue-700 text-white dark:border-blue-500 dark:bg-blue-600 dark:text-white'
                      : 'border-slate-300 bg-white text-slate-800 hover:bg-blue-50 hover:text-blue-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white'
                  } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500`}
                >
                  Seleccionar todo
                </button>
                <button
                  type="button"
                  onClick={limpiarSeleccion}
                  disabled={selectedIds.length === 0}
                  className="inline-flex min-h-[34px] items-center justify-center rounded-[10px] border border-slate-300 bg-white px-2 text-[0.66rem] font-black text-slate-800 transition hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 dark:focus-visible:ring-blue-500/40"
                >
                  Limpiar
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[13px] border border-[#dbe7ff] bg-[#f5f9ff] px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
                <label
                  htmlFor="secado-quality-filter"
                  className="shrink-0 text-[0.7rem] font-black uppercase tracking-[0.08em] text-[#24469a] dark:text-slate-200"
                >
                  Tipo de calidad
                </label>
                <div className="w-[124px] shrink-0">
                  <SmartSelect
                    id="secado-quality-filter"
                    value={qualityFilter}
                    onChange={(event) => {
                      setQualityFilter(event.target.value as SecadoQualityFilter);
                      setError(null);
                    }}
                    className="h-9 rounded-[11px] border border-[#c7d8ff] bg-white px-3 py-0 pr-8 text-[0.76rem] font-black text-slate-900 shadow-[inset_0_1px_0_rgba(15,23,42,0.04)]"
                  >
                    {QUALITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SmartSelect>
                </div>
              </div>
            </section>

            {error ? (
              <AppFeedbackMessage
                variant={error.includes('guardados en este dispositivo') ? 'info' : 'error'}
                title={error.includes('guardados en este dispositivo') ? 'Sin conexión' : undefined}
                description={error}
              />
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
                        Tipo de calidad: {titleCase(quality)}
                      </p>
                      {items.map((sublote, index) => {
                        const selected = (selectedWeights[sublote.id] ?? 0) > 0;
                        const selectedKg = selectedWeights[sublote.id] ?? '';
                        const humidity = formatHumidity(sublote.humedad);
                        const visualCode = formatSubloteVisualCode(sublote, index);
                        const fullName = formatCoffeeFullName(sublote);

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
                                  aria-label={`Seleccionar ${visualCode} ${fullName}`}
                                >
                                  <Check size={13} strokeWidth={3} />
                                </button>
                                <div className="min-w-0 flex-1">
                                  <p
                                    className="truncate text-[0.82rem] font-black text-slate-950"
                                    title={`${visualCode} · ${fullName}`}
                                  >
                                    {visualCode}
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
                                    aria-label={`Kilos a secar de ${visualCode} ${fullName}`}
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
              <div className="rounded-[14px] bg-[linear-gradient(135deg,#5b8ff5_0%,#3b7dd8_100%)] px-4 py-2.5 text-white">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-blue-50">
                    Total seleccionado
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-black">
                    {kg(totalSeleccionado)}
                    <Scale size={14} />
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={iniciarSecado}
                disabled={selectedIds.length === 0 || detailLoading || loading}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#102d92] text-xs font-black uppercase tracking-[0.05em] text-white shadow-[0_14px_28px_rgba(16,45,146,0.22)] transition hover:bg-[#18358f] disabled:cursor-not-allowed disabled:bg-[#9fb2d9] disabled:shadow-none"
              >
                {isOffline ? 'Guardar secado pendiente' : 'Iniciar secado'}
              </button>
            </section>
          </>
        ) : null}
      </div>

      {showDraftModal && pendingDraft ? (
        <DraftRecoveryModal
          labelledById="secado-draft-title"
          describedById="secado-draft-description"
          heading="Selección de secado guardada"
          message="Tienes una selección pendiente, pero el secado aún no se ha iniciado. Puedes continuarla o empezar de nuevo."
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
