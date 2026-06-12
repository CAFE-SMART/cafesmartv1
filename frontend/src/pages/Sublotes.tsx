import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  FlaskConical,
  Gauge,
  Info,
  Pencil,
  Package2,
  Scale,
  Tag,
  Timer,
  X,
} from 'lucide-react';
import { RefreshButton } from '../components/RefreshButton';
import { useCloudStatus } from '../context/CloudStatusContext';
import { CafeSmartProcessingScreen } from '../components/CafeSmartProcessingScreen';
import {
  InlineGuidedError,
  type GuidedErrorMessage,
  createGuidedError,
} from '../components/forms/GuidedError';
import { getDaysInBodega } from '../utils/date';
import {
  guardarFactoresSublotes,
  guardarHumedadesSublotes,
  guardarPesosSublotes,
  obtenerDetalleLote,
  obtenerResultadosFinancierosSublote,
  type LoteDetalle,
  type ResultadosFinancierosSublote,
} from '../services/lotesService';
import { applySecadoToDetalle } from '../utils/secadoFlow';
import { ENABLE_SECADO_PROTOTYPE } from '../config/features';
import { sanitizeLimitedText } from '../utils/inputLimits';
import {
  classifyHumidity,
  formatHumidityWithClassification,
  getFactorValidationMessage,
  getHumidityValidationMessage,
} from '../utils/humidity';
import {
  formatCoffeeFullName,
  getSubloteCodeMap,
  formatSubloteVisualCode,
} from '../utils/coffeeCodes';
import {
  fieldHelpTextClass,
  fieldInputClass,
  fieldLabelClass,
  fieldTextareaClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../styles/uiClasses';

type LoteDetalleVisual = LoteDetalle;
type SubloteVisual = LoteDetalleVisual['sublotes'][number];
type EditField = 'humedad' | 'factor';
const FACTOR_MAX = 120;
const PESO_AJUSTE_MAX_KG = 100000;
const PESO_MOTIVO_MAX = 150;

type PendingHumidityEdit = {
  tipoCafeId: string;
  calidadId: string;
  subloteId: string;
  humedad: number | null;
  updatedAt: number;
};

type PendingFactorEdit = {
  tipoCafeId: string;
  calidadId: string;
  subloteId: string;
  factor: number | null;
  updatedAt: number;
};

type PendingWeightEdit = {
  tipoCafeId: string;
  calidadId: string;
  subloteId: string;
  pesoActual: number;
  motivo?: string;
  updatedAt: number;
};

const SUBLOTES_PREVIEW_LIMIT = 4;
const SECADO_PROCESS_TYPE_ID = 'virtual-en-secado';
const SECADO_PROCESS_QUALITY_ID = 'virtual-en-proceso';

function titleCase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).toLowerCase()}`;
}

function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function getQualityStyles(calidad: string) {
  const key = keyOf(calidad);

  if (key === 'BUENO') {
    return {
      shell: 'border-emerald-200 bg-emerald-50/45 dark:border-emerald-500/50 dark:bg-emerald-950/25',
      accent: 'border-t-4 border-t-emerald-400',
      icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100',
      badge: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-100',
      text: 'text-emerald-700 dark:text-emerald-100',
      ring: 'border-emerald-400 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-700/30',
      dot: 'bg-emerald-500',
    };
  }

  if (key === 'REGULAR') {
    return {
      shell: 'border-amber-200 bg-amber-50/50 dark:border-amber-500/50 dark:bg-amber-950/25',
      accent: 'border-t-4 border-t-amber-400',
      icon: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100',
      badge: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-100',
      text: 'text-amber-700 dark:text-amber-100',
      ring: 'border-amber-400 bg-amber-50 dark:border-amber-400 dark:bg-amber-700/30',
      dot: 'bg-amber-500',
    };
  }

  if (key === 'MALO') {
    return {
      shell: 'border-rose-200 bg-rose-50/45 dark:border-rose-500/50 dark:bg-rose-950/25',
      accent: 'border-t-4 border-t-rose-400',
      icon: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100',
      badge: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-100',
      text: 'text-rose-700 dark:text-rose-100',
      ring: 'border-rose-400 bg-rose-50 dark:border-rose-400 dark:bg-rose-700/30',
      dot: 'bg-rose-500',
    };
  }

  return {
    shell: 'border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900',
    accent: 'border-t-4 border-t-slate-300',
    icon: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100',
    badge: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100',
    text: 'text-slate-700 dark:text-slate-100',
    ring: 'border-slate-300 bg-white dark:border-slate-500 dark:bg-slate-800',
    dot: 'bg-slate-400',
  };
}

function formatKg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

function formatPricePerKg(value: number) {
  return `$ ${new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function formatDateShort(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return parts.replace(/\b([a-záéíóúñ])/i, (match) => match.toUpperCase());
}

function formatDays(value: number) {
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value)} días`;
}

function formatHumedad(value: number | null) {
  return formatHumidityWithClassification(value);
}

function getSubloteOriginLine(sublote: SubloteVisual) {
  const originCode = sublote.codigoOrigen?.trim();
  if (!originCode || sublote.procesoOrigen !== 'SECADO') {
    return null;
  }

  return `Origen: ${originCode} · ${formatKg(sublote.pesoActual)} · ${formatDays(
    getDaysForSublote(sublote),
  )}`;
}

function formatFactor(value: number | null) {
  if (value === null) return 'Sin dato';

  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function readCachedDetail(tipoCafeId: string, calidadId: string) {
  void tipoCafeId;
  void calidadId;
  return null;
}

function writeCachedDetail(
  tipoCafeId: string,
  calidadId: string,
  detail: LoteDetalleVisual,
) {
  void tipoCafeId;
  void calidadId;
  void detail;
}

function readPendingHumidityEdits() {
  return [] as PendingHumidityEdit[];
}

function writePendingHumidityEdits(edits: PendingHumidityEdit[]) {
  void edits;
}

function upsertPendingHumidityEdit(edit: PendingHumidityEdit) {
  const current = readPendingHumidityEdits();
  const next = current.filter(
    (item) =>
      !(
        item.tipoCafeId === edit.tipoCafeId &&
        item.calidadId === edit.calidadId &&
        item.subloteId === edit.subloteId
      ),
  );

  next.push(edit);
  writePendingHumidityEdits(next);
}

function removePendingHumidityEdit(
  tipoCafeId: string,
  calidadId: string,
  subloteId: string,
) {
  const next = readPendingHumidityEdits().filter(
    (item) =>
      !(
        item.tipoCafeId === tipoCafeId &&
        item.calidadId === calidadId &&
        item.subloteId === subloteId
      ),
  );

  writePendingHumidityEdits(next);
}

function readPendingHumidityForSublote(
  tipoCafeId: string,
  calidadId: string,
  subloteId: string,
) {
  const pending = readPendingHumidityEdits().find(
    (item) =>
      item.tipoCafeId === tipoCafeId &&
      item.calidadId === calidadId &&
      item.subloteId === subloteId,
  );

  return pending?.humedad ?? null;
}

function readPendingFactorEdits() {
  return [] as PendingFactorEdit[];
}

function writePendingFactorEdits(edits: PendingFactorEdit[]) {
  void edits;
}

function upsertPendingFactorEdit(edit: PendingFactorEdit) {
  const current = readPendingFactorEdits();
  const next = current.filter(
    (item) =>
      !(
        item.tipoCafeId === edit.tipoCafeId &&
        item.calidadId === edit.calidadId &&
        item.subloteId === edit.subloteId
      ),
  );

  next.push(edit);
  writePendingFactorEdits(next);
}

function removePendingFactorEdit(
  tipoCafeId: string,
  calidadId: string,
  subloteId: string,
) {
  const next = readPendingFactorEdits().filter(
    (item) =>
      !(
        item.tipoCafeId === tipoCafeId &&
        item.calidadId === calidadId &&
        item.subloteId === subloteId
      ),
  );

  writePendingFactorEdits(next);
}

function readPendingFactorForSublote(
  tipoCafeId: string,
  calidadId: string,
  subloteId: string,
) {
  const pending = readPendingFactorEdits().find(
    (item) =>
      item.tipoCafeId === tipoCafeId &&
      item.calidadId === calidadId &&
      item.subloteId === subloteId,
  );

  return pending?.factor ?? null;
}

function readPendingWeightEdits() {
  return [] as PendingWeightEdit[];
}

function writePendingWeightEdits(edits: PendingWeightEdit[]) {
  void edits;
}

function upsertPendingWeightEdit(edit: PendingWeightEdit) {
  const current = readPendingWeightEdits();
  const next = current.filter(
    (item) =>
      !(
        item.tipoCafeId === edit.tipoCafeId &&
        item.calidadId === edit.calidadId &&
        item.subloteId === edit.subloteId
      ),
  );

  next.push(edit);
  writePendingWeightEdits(next);
}

function removePendingWeightEdit(
  tipoCafeId: string,
  calidadId: string,
  subloteId: string,
) {
  const next = readPendingWeightEdits().filter(
    (item) =>
      !(
        item.tipoCafeId === tipoCafeId &&
        item.calidadId === calidadId &&
        item.subloteId === subloteId
      ),
  );

  writePendingWeightEdits(next);
}

function readPendingWeightForSublote(
  tipoCafeId: string,
  calidadId: string,
  subloteId: string,
) {
  const pending = readPendingWeightEdits().find(
    (item) =>
      item.tipoCafeId === tipoCafeId &&
      item.calidadId === calidadId &&
      item.subloteId === subloteId,
  );

  return pending?.pesoActual ?? null;
}

function getDaysForSublote(sublote: {
  fechaIngreso: string;
  diasEnBodega: number;
}) {
  return Math.max(
    getDaysInBodega(sublote.fechaIngreso),
    sublote.diasEnBodega || 0,
  );
}

function formatCurrency(value: number) {
  return `$ ${new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)} %`;
}

function shouldShowFactor(sublote: SubloteVisual | null) {
  if (!sublote) return false;

  return (
    keyOf(sublote.tipoCafe) === 'SECO' && keyOf(sublote.calidad) === 'BUENO'
  );
}

function getSublotesGuidance(message: string): GuidedErrorMessage {
  if (message.includes('humedad')) {
    return createGuidedError(
      message,
      'La humedad no es valida.',
      'Debes escribir un numero entre 0 y 100.',
      'Revisa el valor e intenta de nuevo.',
    );
  }

  return createGuidedError(
    message,
    'No se pudo guardar el cambio.',
    'Vuelve a intentarlo cuando tengas conexion.',
    'Si el problema sigue, refresca la pantalla.',
  );
}

function sanitizeDecimalInput(value: string, _max: number, decimals = 2) {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const [integer = '', ...decimalParts] = normalized.split('.');
  const decimal = decimalParts.join('').slice(0, decimals);
  const next = decimalParts.length > 0 ? `${integer.slice(0, 7) || '0'}.${decimal}` : integer.slice(0, 7);
  return next;
}

function parseDecimalValue(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeBoundedDecimalInput({
  rawValue,
  currentValue,
  maxLength,
  decimals,
  min,
  max,
  outOfRangeMessage,
  invalidMessage,
}: {
  rawValue: string;
  currentValue: string;
  maxLength: number;
  decimals: number;
  min: number;
  max: number;
  outOfRangeMessage: string;
  invalidMessage: string;
}) {
  const normalized = rawValue.replace(',', '.');
  const decimalPattern =
    decimals > 0
      ? new RegExp(`^\\d{0,3}(?:\\.\\d{0,${decimals}})?$`)
      : /^\d{0,3}$/;

  if (
    normalized.length > maxLength ||
    !decimalPattern.test(normalized) ||
    (normalized.match(/\./g) ?? []).length > 1
  ) {
    return { value: currentValue, error: invalidMessage };
  }

  if (normalized === '' || normalized === '.') {
    return { value: normalized, error: null };
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return { value: currentValue, error: invalidMessage };
  }

  if (parsed > max) {
    return { value: currentValue, error: outOfRangeMessage };
  }

  if (parsed < min) {
    return { value: normalized, error: outOfRangeMessage };
  }

  return { value: normalized, error: null };
}

export default function Sublotes() {
  const navigate = useNavigate();
  const { tipoCafeId, calidadId } = useParams<{
    tipoCafeId: string;
    calidadId: string;
  }>();
  const { isOnline, refreshHealth } = useCloudStatus();
  const isSecadoProcessRoute =
    tipoCafeId === SECADO_PROCESS_TYPE_ID ||
    calidadId === SECADO_PROCESS_QUALITY_ID;

  const [detalle, setDetalle] = useState<LoteDetalleVisual | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineNoticeVisible, setOfflineNoticeVisible] = useState(false);
  const [factorNotice, setFactorNotice] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<{
    field: EditField;
    value: string;
    error: string | null;
  } | null>(null);
  const [weightModal, setWeightModal] = useState<{
    value: string;
    reason: string;
    error: string | null;
  } | null>(null);
  const [savingModal, setSavingModal] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [selectedSubloteId, setSelectedSubloteId] = useState<string | null>(
    null,
  );
  const [subloteSelectorOpen, setSubloteSelectorOpen] = useState(false);
  const [resultadosFinancieros, setResultadosFinancieros] =
    useState<ResultadosFinancierosSublote | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const subloteActivo = useMemo<SubloteVisual | null>(() => {
    if (!detalle || detalle.sublotes.length === 0) return null;
    if (!selectedSubloteId) return null;
    return (
      detalle.sublotes.find((sublote) => sublote.id === selectedSubloteId) ??
      null
    );
  }, [detalle, selectedSubloteId]);

  const sublotesPreview = useMemo(() => {
    if (!detalle) return [];
    const firstSublotes = detalle.sublotes.slice(0, SUBLOTES_PREVIEW_LIMIT);
    if (!subloteActivo || firstSublotes.some((sublote) => sublote.id === subloteActivo.id)) {
      return firstSublotes;
    }

    return [
      subloteActivo,
      ...firstSublotes.filter((sublote) => sublote.id !== subloteActivo.id),
    ].slice(0, SUBLOTES_PREVIEW_LIMIT);
  }, [detalle, subloteActivo]);
  const subloteCodeMap = useMemo(
    () => getSubloteCodeMap(detalle?.sublotes ?? []),
    [detalle],
  );

  const hiddenSublotesCount = detalle
    ? Math.max(0, detalle.sublotes.length - sublotesPreview.length)
    : 0;
  const totalSublotesKg = useMemo(
    () =>
      detalle?.sublotes.reduce(
        (sum, sublote) => sum + sublote.pesoActual,
        0,
      ) ?? 0,
    [detalle],
  );

  const cargar = useCallback(async () => {
    if (!tipoCafeId || !calidadId) {
      setError('No se encontro el lote solicitado.');
      setLoading(false);
      return;
    }

    if (isSecadoProcessRoute) {
      setDetalle(null);
      setSelectedSubloteId(null);
      setResultadosFinancieros(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let raw: LoteDetalle | null = null;

      if (isOnline) {
        try {
          raw = await obtenerDetalleLote(tipoCafeId, calidadId);
        } catch {
          raw = null;
        }
      }

      if (!raw) {
        const cached = readCachedDetail(tipoCafeId, calidadId);
        if (cached) {
          setDetalle(cached);
          setSubloteSelectorOpen(false);
          setOfflineNoticeVisible(!isOnline);
          return;
        }

        throw new Error('No se pudo cargar el detalle del sublote.');
      }

      const visual = (
        ENABLE_SECADO_PROTOTYPE
          ? applySecadoToDetalle(raw, tipoCafeId, calidadId)
          : raw
      ) as LoteDetalleVisual | null;
      if (!visual) {
        throw new Error('No se pudo cargar el detalle del sublote.');
      }

      const hydrated: LoteDetalleVisual = {
        ...visual,
        sublotes: visual.sublotes.map((sublote) => ({
          ...sublote,
          pesoActual:
            readPendingWeightForSublote(tipoCafeId, calidadId, sublote.id) ??
            sublote.pesoActual,
          humedad:
            readPendingHumidityForSublote(tipoCafeId, calidadId, sublote.id) ??
            sublote.humedad,
          factor:
            readPendingFactorForSublote(tipoCafeId, calidadId, sublote.id) ??
            sublote.factor,
        })) as LoteDetalleVisual['sublotes'],
      };

      setDetalle(hydrated);
      setSubloteSelectorOpen(false);
      writeCachedDetail(tipoCafeId, calidadId, hydrated);
      setOfflineNoticeVisible(false);
    } catch (err) {
      setError('No pudimos cargar el detalle del sublote. Intenta nuevamente.');
      setDetalle(null);
    } finally {
      setLoading(false);
    }
  }, [calidadId, isOnline, isSecadoProcessRoute, tipoCafeId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!isOnline || !detalle || !tipoCafeId || !calidadId) return;

    const pending = readPendingHumidityEdits().filter(
      (item) => item.tipoCafeId === tipoCafeId && item.calidadId === calidadId,
    );

    if (pending.length === 0) return;

    void (async () => {
      try {
        await guardarHumedadesSublotes(
          pending.map((item) => ({
            id: item.subloteId,
            humedad: item.humedad,
          })),
        );

        pending.forEach((item) =>
          removePendingHumidityEdit(
            item.tipoCafeId,
            item.calidadId,
            item.subloteId,
          ),
        );
        await cargar();
      } catch {
        // La cola se mantiene para un nuevo intento cuando vuelva a haber conexion.
      }
    })();
  }, [calidadId, cargar, detalle, isOnline, tipoCafeId]);

  useEffect(() => {
    if (!isOnline || !detalle || !tipoCafeId || !calidadId) return;

    const pending = readPendingFactorEdits().filter(
      (item) => item.tipoCafeId === tipoCafeId && item.calidadId === calidadId,
    );

    if (pending.length === 0) return;

    void (async () => {
      try {
        await guardarFactoresSublotes(
          pending.map((item) => ({ id: item.subloteId, factor: item.factor })),
        );

        pending.forEach((item) =>
          removePendingFactorEdit(
            item.tipoCafeId,
            item.calidadId,
            item.subloteId,
          ),
        );
        await cargar();
      } catch {
        // La cola se mantiene para un nuevo intento cuando vuelva a haber conexion.
      }
    })();
  }, [calidadId, cargar, detalle, isOnline, tipoCafeId]);

  useEffect(() => {
    if (!isOnline || !detalle || !tipoCafeId || !calidadId) return;

    const pending = readPendingWeightEdits().filter(
      (item) => item.tipoCafeId === tipoCafeId && item.calidadId === calidadId,
    );

    if (pending.length === 0) return;

    void (async () => {
      try {
        await guardarPesosSublotes(
          pending.map((item) => ({
            id: item.subloteId,
            pesoActual: item.pesoActual,
            motivo: item.motivo,
          })),
        );

        pending.forEach((item) =>
          removePendingWeightEdit(
            item.tipoCafeId,
            item.calidadId,
            item.subloteId,
          ),
        );
        await cargar();
      } catch {
        // La cola se mantiene para un nuevo intento cuando vuelva a haber conexion.
      }
    })();
  }, [calidadId, cargar, detalle, isOnline, tipoCafeId]);

  const handleReload = useCallback(async () => {
    if (!isOnline) {
      setOfflineNoticeVisible(true);
      return;
    }

    setOfflineNoticeVisible(false);
    setRefreshing(true);

    try {
      await Promise.all([cargar(), refreshHealth()]);
    } finally {
      setRefreshing(false);
    }
  }, [cargar, isOnline, refreshHealth]);

  useEffect(() => {
    if (!detalle?.sublotes.length) {
      setSelectedSubloteId(null);
      setResultadosFinancieros(null);
      return;
    }

    setSelectedSubloteId((current) =>
      current && detalle.sublotes.some((sublote) => sublote.id === current)
        ? current
        : null,
    );
  }, [detalle]);

  useEffect(() => {
    if (!subloteSelectorOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSubloteSelectorOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [subloteSelectorOpen]);

  useEffect(() => {
    if (!subloteActivo || !isOnline) {
      setResultadosFinancieros(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const resultados = await obtenerResultadosFinancierosSublote(
          subloteActivo.id,
        );
        if (!cancelled) {
          setResultadosFinancieros(resultados);
        }
      } catch {
        if (!cancelled) {
          setResultadosFinancieros(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOnline, subloteActivo]);

  const handleEditHumedad = useCallback(() => {
    if (!subloteActivo) return;

    const currentValue =
      subloteActivo.humedad === null ? '' : String(subloteActivo.humedad);
    setError(null);
    setEditModal({ field: 'humedad', value: currentValue, error: null });
  }, [subloteActivo]);

  const handleEditFactor = useCallback(() => {
    if (!subloteActivo) return;

    const currentValue = subloteActivo.factor;
    setEditModal({
      field: 'factor',
      value: currentValue === null ? '' : String(currentValue),
      error: null,
    });
    setError(null);
  }, [subloteActivo]);

  const handleOpenWeightModal = useCallback(() => {
    if (!subloteActivo) return;
    setError(null);
    setWeightModal({
      value: String(subloteActivo.pesoActual),
      reason: '',
      error: null,
    });
  }, [subloteActivo]);

  const handleConfirmWeight = useCallback(() => {
    if (!weightModal || !subloteActivo || !tipoCafeId || !calidadId) return;

    if (weightModal.error) return;

    const parsed = parseDecimalValue(weightModal.value);
    if (parsed === null || parsed <= 0) {
      setWeightModal((current) =>
        current
          ? { ...current, error: 'Ingresa un valor numérico válido.' }
          : current,
      );
      return;
    }

    const nextWeight = Number(parsed.toFixed(2));
    if (nextWeight > subloteActivo.pesoActual) {
      setWeightModal((current) =>
        current
          ? {
              ...current,
              error: `El nuevo peso no puede superar el peso actual en bodega (${formatKg(subloteActivo.pesoActual)}). Verifica el valor.`,
            }
          : current,
      );
      return;
    }

    const reason = weightModal.reason.trim().slice(0, PESO_MOTIVO_MAX);
    setError(null);
    setWeightModal(null);

    setDetalle((current) => {
      if (!current) return current;

      const difference = nextWeight - subloteActivo.pesoActual;
      const nextDetail: LoteDetalleVisual = {
        ...current,
        lote: {
          ...current.lote,
          pesoActual: Math.max(0, current.lote.pesoActual + difference),
        },
        sublotes: current.sublotes.map((sublote) =>
          sublote.id === subloteActivo.id
            ? { ...sublote, pesoActual: nextWeight }
            : sublote,
        ) as LoteDetalleVisual['sublotes'],
      };

      writeCachedDetail(tipoCafeId, calidadId, nextDetail);
      return nextDetail;
    });

    if (subloteActivo.id.startsWith('secado-')) {
      return;
    }

    if (!isOnline) {
      upsertPendingWeightEdit({
        tipoCafeId,
        calidadId,
        subloteId: subloteActivo.id,
        pesoActual: nextWeight,
        motivo: reason || undefined,
        updatedAt: Date.now(),
      });
      setOfflineNoticeVisible(true);
      return;
    }

    setSavingModal({
      title: 'Ajustando peso...',
      message: 'Estamos actualizando el lote.',
    });
    void (async () => {
      try {
        await guardarPesosSublotes([
          {
            id: subloteActivo.id,
            pesoActual: nextWeight,
            motivo: reason || undefined,
          },
        ]);
        removePendingWeightEdit(tipoCafeId, calidadId, subloteActivo.id);
        await cargar();
      } catch (err) {
        upsertPendingWeightEdit({
          tipoCafeId,
          calidadId,
          subloteId: subloteActivo.id,
          pesoActual: nextWeight,
          motivo: reason || undefined,
          updatedAt: Date.now(),
        });
        setError('No pudimos guardar el ajuste de peso. Intenta nuevamente.');
      } finally {
        setSavingModal(null);
      }
    })();
  }, [calidadId, cargar, isOnline, subloteActivo, tipoCafeId, weightModal]);

  const handleConfirmEdit = useCallback(() => {
    if (!editModal || !subloteActivo || !tipoCafeId || !calidadId) return;

    const trimmed = editModal.value.trim();
    const parsed = trimmed === '' ? null : Number(trimmed.replace(',', '.'));

    if (editModal.error) return;

    if (editModal.field === 'humedad') {
      if (
        parsed !== null &&
        (!Number.isFinite(parsed) || parsed < 8 || parsed > 14)
      ) {
        setEditModal((current) =>
          current
            ? {
                ...current,
                error:
                  'La humedad permitida está entre 8% y 14%. Revisa el valor ingresado.',
              }
            : current,
        );
        return;
      }

      setError(null);
      setEditModal(null);

      const nextHumedad = parsed === null ? null : Number(parsed.toFixed(1));

      setDetalle((current) => {
        if (!current) return current;

        const nextDetail: LoteDetalleVisual = {
          ...current,
          sublotes: current.sublotes.map((sublote) =>
            sublote.id === subloteActivo.id
              ? { ...sublote, humedad: nextHumedad }
              : sublote,
          ) as LoteDetalleVisual['sublotes'],
        };

        writeCachedDetail(tipoCafeId, calidadId, nextDetail);
        return nextDetail;
      });

      if (!isOnline) {
        upsertPendingHumidityEdit({
          tipoCafeId,
          calidadId,
          subloteId: subloteActivo.id,
          humedad: nextHumedad,
          updatedAt: Date.now(),
        });
        setOfflineNoticeVisible(true);
        return;
      }

      setSavingModal({
        title: 'Actualizando humedad...',
        message: 'Estamos guardando el nuevo valor.',
      });
      void (async () => {
        try {
          await guardarHumedadesSublotes([
            { id: subloteActivo.id, humedad: nextHumedad },
          ]);
          removePendingHumidityEdit(tipoCafeId, calidadId, subloteActivo.id);
          await cargar();
        } catch (err) {
          upsertPendingHumidityEdit({
            tipoCafeId,
            calidadId,
            subloteId: subloteActivo.id,
            humedad: nextHumedad,
            updatedAt: Date.now(),
          });
          setError('No pudimos guardar la humedad. Intenta nuevamente.');
        } finally {
          setSavingModal(null);
        }
      })();

      return;
    }

    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 80 || parsed > FACTOR_MAX)) {
      setEditModal((current) =>
        current
          ? {
              ...current,
              error:
                'El factor de rendimiento permitido está entre 80 y 120. Revisa el valor ingresado.',
            }
          : current,
      );
      return;
    }

    setError(null);
    setEditModal(null);

    const nextFactor = parsed === null ? null : Number(parsed.toFixed(2));

    setDetalle((current) => {
      if (!current) return current;

      const nextDetail: LoteDetalleVisual = {
        ...current,
        sublotes: current.sublotes.map((sublote) =>
          sublote.id === subloteActivo.id
            ? { ...sublote, factor: nextFactor }
            : sublote,
        ) as LoteDetalleVisual['sublotes'],
      };

      writeCachedDetail(tipoCafeId, calidadId, nextDetail);
      return nextDetail;
    });

    if (!isOnline) {
      upsertPendingFactorEdit({
        tipoCafeId,
        calidadId,
        subloteId: subloteActivo.id,
        factor: nextFactor,
        updatedAt: Date.now(),
      });
      setOfflineNoticeVisible(true);
      return;
    }

    setSavingModal({
      title: 'Actualizando factor...',
      message: 'Estamos guardando el nuevo factor.',
    });
    void (async () => {
      try {
        await guardarFactoresSublotes([
          { id: subloteActivo.id, factor: nextFactor },
        ]);
        removePendingFactorEdit(tipoCafeId, calidadId, subloteActivo.id);
        await cargar();
      } catch (err) {
        upsertPendingFactorEdit({
          tipoCafeId,
          calidadId,
          subloteId: subloteActivo.id,
          factor: nextFactor,
          updatedAt: Date.now(),
        });
        setError('No pudimos guardar el factor. Intenta nuevamente.');
      } finally {
        setSavingModal(null);
      }
    })();
  }, [calidadId, cargar, editModal, isOnline, subloteActivo, tipoCafeId]);

  const diasSubloteActivo = useMemo(() => {
    if (!subloteActivo) return 0;
    return getDaysForSublote(subloteActivo);
  }, [subloteActivo]);
  const subloteActivoIndex = useMemo(() => {
    if (!detalle || !subloteActivo) return -1;
    return detalle.sublotes.findIndex((sublote) => sublote.id === subloteActivo.id);
  }, [detalle, subloteActivo]);
  const subloteActivoCode =
    subloteActivo
      ? subloteCodeMap.get(subloteActivo.id) ??
        formatSubloteVisualCode(subloteActivo, Math.max(0, subloteActivoIndex))
      : '';

  const factorActivo = subloteActivo?.factor ?? null;
  const showFactor = shouldShowFactor(subloteActivo);
  const financieroActivo = resultadosFinancieros ?? subloteActivo;
  const qualityStyles = getQualityStyles(subloteActivo?.calidad ?? detalle?.lote.calidad ?? '');
  const detalleQualityStyles = getQualityStyles(detalle?.lote.calidad ?? '');
  const editModalValue = editModal ? parseDecimalValue(editModal.value) : null;
  const editModalInvalid = Boolean(
    editModal &&
      (editModal.error ||
        editModal.value.trim() === '' ||
        editModalValue === null ||
        (editModal.field === 'humedad'
          ? editModalValue < 8 || editModalValue > 14
          : editModalValue < 80 || editModalValue > FACTOR_MAX)),
  );
  const weightModalValue = weightModal ? parseDecimalValue(weightModal.value) : null;
  const weightModalInvalid = Boolean(
    weightModal &&
      subloteActivo &&
      (weightModal.error ||
        weightModal.value.trim() === '' ||
        weightModalValue === null ||
        weightModalValue <= 0 ||
        weightModalValue > subloteActivo.pesoActual),
  );

  return (
    <div className="cs-workflow-page min-h-screen bg-[#f4f4f4] pb-[calc(env(safe-area-inset-bottom)+96px)] text-[#1f1f1f] dark:bg-slate-950">
      <header className="sticky top-0 z-20 border-b border-[#e6e6e6] bg-white">
        <div className="mx-auto grid min-h-[56px] w-full max-w-[430px] grid-cols-[42px_1fr_auto] items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => {
              if (selectedSubloteId) {
                setSelectedSubloteId(null);
                return;
              }

              navigate('/inventario');
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#dbe2ee] bg-white text-[#102d92] shadow-sm transition hover:bg-[#eef4ff] dark:border-slate-600 dark:bg-slate-800 dark:text-blue-100 dark:hover:bg-slate-700"
            aria-label="Volver"
          >
            <ArrowLeft size={18} strokeWidth={2.25} />
          </button>

          <h1 className="text-center text-[0.95rem] font-black leading-none tracking-normal text-[#1c1c1c] dark:text-slate-100">
            {selectedSubloteId ? 'Detalles' : 'Sublotes'}
          </h1>

          <RefreshButton
            onClick={() => void handleReload()}
            loading={refreshing}
            aria-label="Recargar"
          >
            Recargar
          </RefreshButton>
        </div>
      </header>

      {(offlineNoticeVisible || !isOnline) && (
        <div className="border-b border-[#ececec] bg-white px-4 py-3">
          <div className="mx-auto max-w-[430px] rounded-[14px] border border-[#ececec] bg-[#fafafa] px-4 py-3 text-[12px] leading-5 text-[#707070] whitespace-pre-line">
            Para refrescar los datos necesitas conexion a internet.
            {'\n'}
            Tus cambios estan guardados y se sincronizaran automáticamente.
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[430px] px-3 pb-3 pt-2.5">
        {error ? (
          <InlineGuidedError
            message={getSublotesGuidance(error)}
            className="mb-4"
          />
        ) : null}

        {loading && !detalle ? (
          <div className="space-y-2">
            <section className="rounded-[22px] border border-[#dcdcdc] bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
              <div className="h-4 w-44 rounded-full bg-[#f1f1f1]" />
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <div className="h-3 w-20 rounded-full bg-[#f1f1f1]" />
                    <div className="h-4 w-24 rounded-full bg-[#ececec]" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {!loading && isSecadoProcessRoute ? (
          <section className="cs-card rounded-[16px] border border-[#d6e2ff] bg-white px-4 py-5 text-center shadow-[0_8px_24px_rgba(47,74,164,0.08)] dark:border-slate-600 dark:bg-slate-900">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eef4ff] text-[#2f4aa4] dark:bg-blue-500/20 dark:text-blue-100">
              <FlaskConical size={22} strokeWidth={2.3} />
            </div>
            <h2 className="mt-3 text-[0.95rem] font-black text-[#1f2937] dark:text-slate-100">
              Café en proceso de secado
            </h2>
            <p className="mt-2 text-[0.72rem] font-semibold leading-5 text-[#6b7280] dark:text-slate-300">
              Este café está en proceso de secado. Revisa su avance en el
              módulo de Secado.
            </p>
            <button
              type="button"
              onClick={() =>
                navigate('/inventario/secado/inicio', {
                  state: { secadoView: 'pending', from: '/inventario' },
                })
              }
              className={`${primaryButtonClass} mt-4 min-h-[42px] w-full rounded-[10px] text-[0.72rem]`}
            >
              Ir a Secado
              <ChevronRight size={15} strokeWidth={2.4} />
            </button>
          </section>
        ) : null}

        {!loading && detalle && !subloteActivo ? (
          <section className={`cs-card rounded-[16px] border px-3 py-3 shadow-[0_10px_26px_rgba(15,23,42,0.06)] ${detalleQualityStyles.shell} ${detalleQualityStyles.accent}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[0.64rem] font-black uppercase tracking-[0.08em] ${detalleQualityStyles.text}`}>
                  {titleCase(detalle.lote.tipoCafe)}{' '}
                  {titleCase(detalle.lote.calidad)}
                </p>
                <p className="mt-1 text-[0.58rem] font-semibold text-[#8a8a8a] dark:text-slate-300">
                  Elige un sublote para revisar inventario, costos y acciones.
                </p>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[0.58rem] font-black ${detalleQualityStyles.badge}`}>
                {detalle.sublotes.length} disponibles
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-[10px] border border-[#ececec] bg-[#fafafa] px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
                <p className="text-[0.52rem] font-black uppercase tracking-[0.08em] text-[#8a8a8a] dark:text-slate-300">
                  Peso total
                </p>
                <p className="mt-0.5 text-[0.82rem] font-black text-[#202020] dark:text-slate-100">
                  {formatKg(totalSublotesKg)}
                </p>
              </div>
              <div className="rounded-[10px] border border-[#ececec] bg-[#fafafa] px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
                <p className="text-[0.52rem] font-black uppercase tracking-[0.08em] text-[#8a8a8a] dark:text-slate-300">
                  En inventario
                </p>
                <p className="mt-0.5 text-[0.82rem] font-black text-[#202020] dark:text-slate-100">
                  {detalle.sublotes.length} disponibles
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              {sublotesPreview.map((sublote, index) => {
                const humidity = classifyHumidity(sublote.humedad);
                const showHumidityWarning =
                  humidity.quality === 'advertencia' ||
                  humidity.quality === 'descuento' ||
                  humidity.quality === 'rechazada';
                const visualCode =
                  subloteCodeMap.get(sublote.id) ??
                  formatSubloteVisualCode(sublote, index);
                const fullName = formatCoffeeFullName(sublote);
                const originLine = getSubloteOriginLine(sublote);
                const itemStyles = getQualityStyles(sublote.calidad);

                return (
                  <button
                    key={sublote.id}
                    type="button"
                    onClick={() => setSelectedSubloteId(sublote.id)}
                    title={`${visualCode} · ${fullName}`}
                    className={`cs-card flex min-h-[62px] w-full items-center justify-between gap-3 rounded-[10px] border bg-white px-3 py-2 text-left shadow-[0_5px_16px_rgba(15,23,42,0.045)] dark:bg-slate-900 ${itemStyles.accent} ${itemStyles.ring}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-[0.74rem] font-black text-[#202020] dark:text-slate-100">
                          {visualCode}
                        </p>
                        {showHumidityWarning ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.52rem] font-black uppercase ${humidity.toneClass}`}
                          >
                            {humidity.label}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[0.58rem] font-semibold text-[#8a8a8a] dark:text-slate-300">
                        {originLine ?? `${fullName} · ${formatKg(sublote.pesoActual)}`}
                      </p>
                      {showHumidityWarning && !originLine ? (
                        <p className="mt-1 text-[0.56rem] font-black text-orange-700 dark:text-amber-200">
                          {formatHumedad(sublote.humedad)}
                        </p>
                      ) : !originLine ? (
                        <p className="mt-1 text-[0.52rem] font-semibold text-[#a5a5a5] dark:text-slate-400">
                          {formatDays(getDaysForSublote(sublote))} en bodega
                        </p>
                      ) : null}
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[0.54rem] font-black uppercase text-[#2f4aa4] dark:text-blue-200">
                      Detalles
                      <ChevronRight size={13} strokeWidth={2.4} />
                    </span>
                  </button>
                );
              })}
            </div>

            {hiddenSublotesCount > 0 ? (
              <button
                type="button"
                onClick={() => setSubloteSelectorOpen(true)}
                className={`${secondaryButtonClass} cs-chip mt-3 h-10 w-full rounded-[10px] text-[0.68rem] uppercase tracking-[0.04em]`}
              >
                Ver más
              </button>
            ) : null}

          </section>
        ) : null}

        {!loading && subloteActivo ? (
          <div className="space-y-3">
            {detalle && detalle.sublotes.length > 1 ? (
              <section className={`cs-card rounded-[16px] border px-3 py-3 shadow-[0_10px_26px_rgba(15,23,42,0.06)] ${qualityStyles.shell} ${qualityStyles.accent}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className={`text-[0.64rem] font-black uppercase tracking-[0.08em] ${qualityStyles.text}`}>
                    Cambiar sublote
                  </p>
                  <span className={`rounded-full border px-2 py-1 text-[0.58rem] font-black ${qualityStyles.badge}`}>
                    {detalle.sublotes.length} disponibles
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {sublotesPreview.map((sublote, index) => {
                    const active = sublote.id === subloteActivo.id;
                    const humidity = classifyHumidity(sublote.humedad);
                    const showHumidityWarning =
                      humidity.quality === 'advertencia' ||
                      humidity.quality === 'descuento' ||
                      humidity.quality === 'rechazada';
                    const visualCode =
                      subloteCodeMap.get(sublote.id) ??
                      formatSubloteVisualCode(sublote, index);
                    const fullName = formatCoffeeFullName(sublote);
                    const originLine = getSubloteOriginLine(sublote);
                    const itemStyles = getQualityStyles(sublote.calidad);
                    return (
                      <button
                        key={sublote.id}
                        type="button"
                        onClick={() => {
                          setSelectedSubloteId(sublote.id);
                          setSubloteSelectorOpen(false);
                        }}
                        aria-label={`Seleccionar ${visualCode}${active ? ', seleccionado' : ''}`}
                        title={`${visualCode} · ${fullName}`}
                        className={`flex min-w-0 items-center justify-between gap-2 rounded-[10px] border px-2.5 py-2 text-left shadow-sm transition ${
                          active
                            ? `${itemStyles.ring} ${itemStyles.accent}`
                            : 'border-[#ececec] bg-white dark:border-slate-600 dark:bg-slate-900'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-[0.7rem] font-black text-[#202020] dark:text-slate-100">
                              {visualCode}
                            </p>
                            {showHumidityWarning ? (
                              <span className={`rounded-full px-1.5 py-0.5 text-[0.5rem] font-black uppercase ${humidity.toneClass}`}>
                                {humidity.label}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-[0.58rem] font-semibold text-[#8a8a8a] dark:text-slate-300">
                            {originLine ??
                              `${fullName} · ${formatKg(sublote.pesoActual)} · ${
                                showHumidityWarning
                                  ? formatHumedad(sublote.humedad)
                                  : formatDays(getDaysForSublote(sublote))
                              }`}
                          </p>
                        </div>
                        <span
                          className={`h-2 w-2 rounded-full ${active ? itemStyles.dot : 'bg-[#d5d5d5]'}`}
                        />
                      </button>
                    );
                  })}
                </div>
                {detalle.sublotes.length > SUBLOTES_PREVIEW_LIMIT ? (
                  <button
                    type="button"
                    onClick={() => setSubloteSelectorOpen(true)}
                    className={`${secondaryButtonClass} mt-3 min-h-[38px] w-full rounded-[10px] text-[0.68rem] uppercase tracking-[0.04em]`}
                  >
                    Ver más
                  </button>
                ) : null}
              </section>
            ) : null}

            <button
              type="button"
              onClick={() => setShowAnalysis((current) => !current)}
              className="cs-card flex min-h-[54px] w-full items-center justify-between rounded-[14px] border border-[#dcdcdc] bg-white px-3 py-2.5 text-left shadow-[0_8px_22px_rgba(15,23,42,0.055)] dark:border-slate-600 dark:bg-slate-900"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${qualityStyles.icon}`}>
                  <CircleDollarSign size={17} strokeWidth={2.3} />
                </span>
                <span className="min-w-0">
                <span className="block text-[0.6rem] font-black uppercase tracking-[0.08em] text-[#3a3a3a] dark:text-slate-100">
                  Análisis financiero
                </span>
                <span className="mt-0.5 block text-[0.5rem] font-semibold text-[#8a8a8a] dark:text-slate-300">
                  Utilidad, merma y valor del sublote
                </span>
                </span>
              </span>
              <span className={`text-[0.58rem] font-black ${qualityStyles.text}`}>
                {showAnalysis ? 'Ocultar' : 'Ver'}
              </span>
            </button>

            {showAnalysis ? (
              <section className="cs-card rounded-[16px] border border-[#dcdcdc] bg-white px-3 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.055)] dark:border-slate-600 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-[#1c1c1c]">
                  <span className="inline-flex h-4 w-4 items-center justify-center text-[#9a9a9a] dark:text-slate-300">
                    <Tag size={14} strokeWidth={2.3} />
                  </span>
                  <h2 className="text-[0.64rem] font-black uppercase tracking-[0.08em] text-[#3a3a3a] dark:text-slate-100">
                    Resultados financieros
                  </h2>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#f0f0f0] pt-2 dark:border-slate-600">
                  <InfoField
                    label="Utilidad neta"
                    value={formatCurrency(financieroActivo?.utilidadNeta ?? 0)}
                    accent="price"
                    icon={<CircleDollarSign size={13} />}
                  />
                  <InfoField
                    label="Merma kg"
                    value={formatKg(financieroActivo?.mermaKg ?? 0)}
                    icon={<Scale size={13} />}
                  />
                  <InfoField
                    label="Merma %"
                    value={formatPercent(financieroActivo?.mermaPorcentaje ?? 0)}
                    icon={<Gauge size={13} />}
                  />
                  <InfoField
                    label="Valor merma"
                    value={formatCurrency(financieroActivo?.mermaValor ?? 0)}
                    accent="price"
                    icon={<Tag size={13} />}
                  />
                  <InfoField
                    label="Proporcion de merma"
                    value={formatPercent(financieroActivo?.mermaPorcentaje ?? 0)}
                    icon={<Gauge size={13} />}
                  />
                </div>
              </section>
            ) : null}

            <section className={`cs-card rounded-[16px] border bg-white px-3 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.055)] dark:bg-slate-900 ${qualityStyles.accent} dark:border-slate-600`}>
              <div className="flex items-center gap-2 text-[#1c1c1c]">
                <span className="inline-flex h-4 w-4 items-center justify-center text-[#9a9a9a] dark:text-slate-300">
                  <Info size={14} strokeWidth={2.4} />
                </span>
                <h2 className="text-[0.64rem] font-black uppercase tracking-[0.08em] text-[#3a3a3a] dark:text-slate-100">
                  Informacion basica
                </h2>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#f0f0f0] pt-2 dark:border-slate-600">
                <InfoField
                  label="Sublote"
                  value={subloteActivoCode}
                  icon={<Package2 size={13} />}
                />
                <InfoField
                  label="Tipo"
                  value={titleCase(subloteActivo.tipoCafe)}
                  icon={<Info size={13} />}
                />
                <InfoField
                  label="Calidad"
                  value={titleCase(subloteActivo.calidad)}
                  icon={<Tag size={13} />}
                />
                <InfoField
                  label="Peso"
                  value={formatKg(subloteActivo.pesoActual)}
                  icon={<Scale size={13} />}
                />
                <InfoField
                  label="Precio/kg"
                  value={formatPricePerKg(subloteActivo.precioKg)}
                  accent="price"
                  icon={<CircleDollarSign size={13} />}
                />
                <InfoField
                  label="Fecha de compra"
                  value={formatDateShort(subloteActivo.fechaIngreso)}
                  icon={<CalendarDays size={13} />}
                />
                <InfoField
                  label="Tiempo en bodega"
                  value={formatDays(diasSubloteActivo)}
                  icon={<Timer size={13} />}
                />
                {subloteActivo.codigoOrigen && subloteActivo.procesoOrigen === 'SECADO' ? (
                  <>
                    <InfoField
                      label="Origen"
                      value={subloteActivo.codigoOrigen}
                      icon={<Package2 size={13} />}
                    />
                    <InfoField
                      label="Proceso"
                      value="Secado"
                      icon={<FlaskConical size={13} />}
                    />
                  </>
                ) : null}
              </div>
            </section>

            <section className="cs-card rounded-[16px] border border-[#dcdcdc] bg-white px-3 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.055)] dark:border-slate-600 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-[#1c1c1c]">
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-[10px] ${qualityStyles.icon}`}>
                  <FlaskConical size={14} strokeWidth={2.3} />
                </span>
                <span>
                  <h2 className="text-[0.64rem] font-black uppercase tracking-[0.08em] text-[#3a3a3a] dark:text-slate-100">
                    Datos tecnicos
                  </h2>
                  <p className="mt-0.5 text-[0.55rem] font-semibold text-[#8a8a8a] dark:text-slate-300">
                    Completa estos datos cuando tengas medición de calidad.
                  </p>
                </span>
              </div>

              <div className="mt-2 space-y-2 border-t border-[#f0f0f0] pt-2 dark:border-slate-600">
                <TechnicalField
                  label="Humedad"
                  value={formatHumedad(subloteActivo.humedad)}
                  toneClass={classifyHumidity(subloteActivo.humedad).toneClass}
                  onEdit={handleEditHumedad}
                />
                {showFactor ? (
                  <TechnicalField
                    label="Factor"
                    value={formatFactor(factorActivo)}
                    onEdit={handleEditFactor}
                  />
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </main>

      {subloteActivo && !isSecadoProcessRoute ? (
        <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e5e7eb] bg-[#f4f4f4]/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 backdrop-blur dark:border-slate-700 dark:bg-slate-950/95">
          <div className="mx-auto grid w-full max-w-[430px] grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => navigate('/ventas')}
              className={`${primaryButtonClass} h-[40px] min-h-0 w-full rounded-[10px] px-1 text-[0.62rem]`}
            >
              <Tag size={12} strokeWidth={2.25} />
              Vender sublote
            </button>

            <button
              type="button"
              onClick={handleOpenWeightModal}
              className={`${secondaryButtonClass} h-[40px] min-h-0 w-full rounded-[10px] px-1 text-[0.62rem]`}
            >
              <Scale size={12} strokeWidth={2.2} />
              Ajustar peso
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(
                  `/gastos?subloteId=${encodeURIComponent(subloteActivo.id)}`,
                )
              }
              className={`${secondaryButtonClass} h-[40px] min-h-0 w-full rounded-[10px] px-1 text-[0.62rem]`}
            >
              <Tag size={12} strokeWidth={2.2} />
              Ver gastos
            </button>
          </div>
        </footer>
      ) : null}

      {subloteSelectorOpen && detalle ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-4 backdrop-blur-sm sm:items-center"
          onClick={() => setSubloteSelectorOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="sublote-selector-title"
            className="max-h-[78dvh] w-full max-w-[430px] overflow-hidden rounded-[18px] border border-[#dbe5f7] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <div>
                <h2 id="sublote-selector-title" className="text-base font-black text-slate-950 dark:text-slate-100">
                  Seleccionar sublote
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                  {detalle.sublotes.length} disponibles
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubloteSelectorOpen(false)}
                aria-label="Cerrar selección de sublotes"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <X size={17} />
              </button>
            </div>

            <div className="max-h-[calc(78dvh-76px)] overflow-y-auto px-4 py-3">
              <div className="grid grid-cols-1 gap-2">
                {detalle.sublotes.map((sublote, index) => {
                  const active = sublote.id === subloteActivo?.id;
                  const humidity = classifyHumidity(sublote.humedad);
                  const showHumidityWarning =
                    humidity.quality === 'advertencia' ||
                    humidity.quality === 'descuento' ||
                    humidity.quality === 'rechazada';
                  const visualCode =
                    subloteCodeMap.get(sublote.id) ??
                    formatSubloteVisualCode(sublote, index);
                  const fullName = formatCoffeeFullName(sublote);
                  const originLine = getSubloteOriginLine(sublote);
                  const itemStyles = getQualityStyles(sublote.calidad);

                  return (
                    <button
                      key={sublote.id}
                      type="button"
                      onClick={() => {
                        setSelectedSubloteId(sublote.id);
                        setSubloteSelectorOpen(false);
                      }}
                      aria-label={`Seleccionar ${visualCode}${active ? ', seleccionado' : ''}`}
                      className={`flex min-w-0 items-center justify-between gap-2 rounded-[10px] border px-3 py-2.5 text-left shadow-sm transition focus:outline-none focus:ring-4 focus:ring-blue-400/20 ${
                        active
                          ? `${itemStyles.ring} ${itemStyles.accent}`
                          : 'border-[#ececec] bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-[0.75rem] font-black text-[#202020] dark:text-slate-100">
                            {visualCode}
                          </p>
                          {active ? (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[0.52rem] font-black uppercase text-blue-700 dark:bg-blue-500/15 dark:text-blue-100">
                              Seleccionado
                            </span>
                          ) : null}
                          {showHumidityWarning ? (
                            <span className={`rounded-full px-1.5 py-0.5 text-[0.5rem] font-black uppercase ${humidity.toneClass}`}>
                              {humidity.label}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[0.6rem] font-semibold text-[#8a8a8a] dark:text-slate-300">
                          {originLine ??
                            `${fullName} · ${formatKg(sublote.pesoActual)} · ${
                              showHumidityWarning
                                ? formatHumedad(sublote.humedad)
                                : formatDays(getDaysForSublote(sublote))
                            }`}
                        </p>
                      </div>
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${active ? itemStyles.dot : 'bg-[#d5d5d5] dark:bg-slate-600'}`}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {editModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f172a]/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[430px] rounded-[18px] border border-[#ececec] bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.25)] dark:border-slate-700 dark:bg-slate-900">
            <p className="text-center text-[16px] font-semibold text-[#1f1f1f] dark:text-slate-100">
              {editModal.field === 'humedad'
                ? 'Editar humedad'
                : 'Editar factor'}
            </p>
            <input
              type="text"
              inputMode="decimal"
              maxLength={editModal.field === 'humedad' ? 4 : 5}
              value={editModal.value}
              onChange={(event) =>
                setEditModal((current) =>
                  current
                    ? {
                        ...current,
                        ...sanitizeBoundedDecimalInput({
                          rawValue: event.target.value,
                          currentValue: current.value,
                          maxLength: current.field === 'humedad' ? 4 : 5,
                          decimals: current.field === 'humedad' ? 1 : 2,
                          min: current.field === 'humedad' ? 8 : 80,
                          max: current.field === 'humedad' ? 14 : FACTOR_MAX,
                          invalidMessage: 'Ingresa un valor numérico válido.',
                          outOfRangeMessage:
                            current.field === 'humedad'
                              ? 'La humedad permitida está entre 8% y 14%. Revisa el valor ingresado.'
                              : 'El factor de rendimiento permitido está entre 80 y 120. Revisa el valor ingresado.',
                        }),
                      }
                    : current,
                )
              }
              className={`${fieldInputClass} mt-3 rounded-[12px] text-[18px]`}
              placeholder={
                editModal.field === 'humedad' ? 'Ej: 12.0' : 'Ej: 94'
              }
            />
            {editModal.error || error ? (
              <p className="mt-2 rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">
                {editModal.error ?? error}
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditModal(null)}
                className={`${secondaryButtonClass} min-h-[40px] rounded-[10px] text-sm`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmEdit}
                disabled={editModalInvalid}
                className={`${primaryButtonClass} min-h-[40px] rounded-[10px] text-sm disabled:bg-slate-300`}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {weightModal && subloteActivo ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f172a]/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[320px] rounded-[14px] border border-[#ececec] bg-white p-3 shadow-[0_16px_40px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[0.9rem] font-black text-[#111827] dark:text-slate-100">
                Ajustar peso
              </h2>
              <button
                type="button"
                onClick={() => setWeightModal(null)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f4f4f4] text-[#9ca3af] dark:bg-slate-800 dark:text-slate-200"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="rounded-[8px] bg-[#fff4e8] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.62rem] font-semibold text-[#8b6b4d]">
                  Peso actual
                </span>
                <span className="text-[0.82rem] font-black text-[#b45309]">
                  {formatKg(subloteActivo.pesoActual)}
                </span>
              </div>
            </div>

            <div className="mt-3">
              <label className={`${fieldLabelClass} text-[0.62rem] uppercase tracking-[0.08em]`}>
                Nuevo peso
              </label>
              <div className={`${fieldInputClass} flex items-center rounded-[8px] px-3 py-2`}>
                <input
                  type="text"
                  inputMode="decimal"
                  maxLength={8}
                  value={weightModal.value}
                  onChange={(event) =>
                    setWeightModal((current) =>
                      current
                        ? {
                            ...current,
                            ...sanitizeBoundedDecimalInput({
                              rawValue: event.target.value,
                              currentValue: current.value,
                              maxLength: 8,
                              decimals: 2,
                              min: 0.01,
                              max: subloteActivo.pesoActual,
                              invalidMessage: 'Ingresa un valor numérico válido.',
                              outOfRangeMessage: `El nuevo peso no puede superar el peso actual en bodega (${formatKg(subloteActivo.pesoActual)}). Verifica el valor.`,
                            }),
                          }
                        : current,
                    )
                  }
                  placeholder="Ej: 98.5"
                  className="min-w-0 flex-1 bg-transparent text-[0.74rem] font-semibold text-[#111827] outline-none placeholder:text-[#b8b8b8]"
                />
                <span className="text-[0.66rem] font-black text-[#6b7280]">
                  kg
                </span>
              </div>
            </div>

            <div className="mt-3">
              <label className={`${fieldLabelClass} text-[0.62rem] uppercase tracking-[0.08em]`}>
                Motivo (opcional)
              </label>
              <textarea
                value={weightModal.reason}
                onChange={(event) =>
                  setWeightModal((current) =>
                    current
                      ? {
                          ...current,
                          reason: sanitizeLimitedText(
                            event.target.value,
                            PESO_MOTIVO_MAX,
                          ),
                        }
                      : current,
                  )
                }
                maxLength={PESO_MOTIVO_MAX}
                placeholder="Ej: secado, evaporacion, ajuste manual"
                className={`${fieldTextareaClass} min-h-[64px] resize-none rounded-[8px] text-[0.72rem]`}
              />
              <p className={`${fieldHelpTextClass} text-right text-[0.58rem]`}>
                {weightModal.reason.length}/{PESO_MOTIVO_MAX}
              </p>
            </div>
            {weightModal.error || error ? (
              <p className="mt-2 rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">
                {weightModal.error ?? error}
              </p>
            ) : null}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleConfirmWeight}
                disabled={weightModalInvalid}
                className={`${primaryButtonClass} min-h-[34px] rounded-[8px] text-[0.66rem] disabled:bg-slate-300 disabled:shadow-none`}
              >
                Guardar ajuste
              </button>
              <button
                type="button"
                onClick={() => setWeightModal(null)}
                className={`${secondaryButtonClass} min-h-[34px] rounded-[8px] text-[0.68rem]`}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {factorNotice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[430px] rounded-[18px] border border-amber-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.25)] dark:border-amber-500/50 dark:bg-slate-900">
            <div className="mb-2 flex justify-center text-amber-500">
              <AlertTriangle size={22} strokeWidth={2.3} />
            </div>
            <p className="text-center text-[13px] leading-5 text-[#4a4a4a] dark:text-slate-100">
              {factorNotice}
            </p>
            <button
              type="button"
              onClick={() => setFactorNotice(null)}
              className={`${primaryButtonClass} mt-3 w-full rounded-[10px] bg-amber-500 text-sm dark:bg-amber-500`}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      {savingModal ? (
        <div className="fixed inset-0 z-[60] bg-white">
          <CafeSmartProcessingScreen
            title={savingModal.title}
            subtitle={savingModal.message}
            helperText="Espera mientras sincronizamos el cambio."
            trustTitle="Tus datos siguen seguros"
            trustText="El ajuste se está guardando en el lote seleccionado."
          />
        </div>
      ) : null}
    </div>
  );
}

function InfoField({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: 'price';
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-[10px] border border-[#ececec] bg-[#fafafa] px-2.5 py-2 shadow-[0_1px_0_rgba(15,23,42,0.02)] dark:border-slate-600 dark:bg-slate-800">
      <div className="flex items-center gap-1.5">
        {icon ? (
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[#9a9a9a] dark:bg-slate-900 dark:text-slate-200">
            {icon}
          </span>
        ) : null}
        <p className="truncate text-[0.5rem] font-black uppercase tracking-[0.08em] text-[#8f8f8f] dark:text-slate-300">
          {label}
        </p>
      </div>
      <p
        className={`mt-1 text-[0.72rem] font-black leading-tight text-[#232323] dark:text-slate-100 ${accent === 'price' ? 'text-[#c4551d] dark:text-amber-200' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}

function TechnicalField({
  label,
  value,
  toneClass,
  onEdit,
}: {
  label: string;
  value: string;
  toneClass?: string;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-[12px] border border-[#ececec] bg-[#fafafa] p-2.5 dark:border-slate-600 dark:bg-slate-800">
      <p className={`${fieldLabelClass} text-[0.58rem] uppercase tracking-[0.1em]`}>
        {label}
      </p>
      <button
        type="button"
        onClick={onEdit}
        className={`${fieldInputClass} mt-1 flex min-h-[38px] items-center justify-between rounded-[10px] px-2.5 py-1 text-left`}
      >
        <p className="min-w-0 text-[0.82rem] font-black leading-none tracking-normal text-[#222222] dark:text-slate-100">
          <span>{value}</span>
        </p>
        {toneClass ? (
          <span
            className={`ml-2 h-2.5 w-2.5 shrink-0 rounded-full ${toneClass}`}
            aria-hidden="true"
          />
        ) : null}
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#b6b6b6] dark:text-slate-200">
          <Pencil size={11} strokeWidth={2.2} />
        </span>
      </button>
    </div>
  );
}
