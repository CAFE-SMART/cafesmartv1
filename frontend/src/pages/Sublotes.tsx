import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useNavigate,
  useParams,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Coffee,
  FlaskConical,
  Info,
  Leaf,
  Package2,
  Pencil,
  RefreshCcw,
  Scale,
  SunMedium,
  Tag,
} from 'lucide-react';
import { useCloudStatus } from '../context/CloudStatusContext';
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
import {
  classifyHumidity,
  formatHumidityWithClassification,
} from '../utils/humidity';
import { formatCoffeeLabel, formatDisplayLabel } from '../utils/uiMessages';

type LoteDetalleVisual = LoteDetalle;
type SubloteVisual = LoteDetalleVisual['sublotes'][number];
type EditField = 'humedad' | 'factor';

const MAX_AJUSTE_PESO_KG = 99999;
const MAX_MOTIVO_AJUSTE_LENGTH = 40;

function sanitizeDecimalInput(value: string, maxDigits: number) {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const [integer = '', ...decimalParts] = normalized.split('.');
  const digits = `${integer}${decimalParts.join('')}`.slice(0, maxDigits);

  if (!digits) return '';
  if (!normalized.includes('.')) return digits;

  const integerLength = Math.min(integer.length, digits.length);
  const nextInteger = digits.slice(0, integerLength) || '0';
  const nextDecimal = digits.slice(integerLength);

  return nextDecimal ? `${nextInteger}.${nextDecimal}` : `${nextInteger}.`;
}

function clampDecimalInput(value: string, maxDigits: number, maxValue: number) {
  const next = sanitizeDecimalInput(value, maxDigits);
  if (!next || next.endsWith('.')) return next;

  const parsed = Number(next);
  if (!Number.isFinite(parsed)) return '';

  return parsed > maxValue ? String(maxValue) : next;
}

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

function titleCase(value: string) {
  return formatDisplayLabel(value);
}

function keyOf(value: string) {
  return value.trim().toUpperCase();
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

function formatFactor(value: number | null) {
  if (value === null) return 'Sin dato';

  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function pluralLabel(value: number, singular: string, plural: string) {
  return `${new Intl.NumberFormat('es-CO').format(value)} ${
    value === 1 ? singular : plural
  }`;
}

function getCoffeeTone(tipoCafe: string, calidad?: string) {
  const quality = keyOf(calidad ?? '');

  if (quality === 'MALO') {
    return {
      icon: <Coffee size={18} strokeWidth={2.2} />,
      accent: 'bg-[#d92d20]',
      border: 'border-[#f4b7b1]',
      iconBox: 'bg-[#ffe7e4] text-[#b42318]',
      soft: 'bg-[#fff6f5]',
      chip: 'bg-[#ffe7e4] text-[#b42318]',
      text: 'text-[#b42318]',
    };
  }

  if (quality === 'BUENO') {
    return {
      icon: <Coffee size={18} strokeWidth={2.2} />,
      accent: 'bg-[#0d7b67]',
      border: 'border-[#bfe8d8]',
      iconBox: 'bg-[#e9fbf4] text-[#0d7b67]',
      soft: 'bg-[#f5fffa]',
      chip: 'bg-[#e9fbf4] text-[#0d7b67]',
      text: 'text-[#0d7b67]',
    };
  }

  if (quality === 'REGULAR') {
    return {
      icon: <Coffee size={18} strokeWidth={2.2} />,
      accent: 'bg-[#d29309]',
      border: 'border-[#f2d28a]',
      iconBox: 'bg-[#fff7df] text-[#b77900]',
      soft: 'bg-[#fffdf4]',
      chip: 'bg-[#fff7df] text-[#946200]',
      text: 'text-[#b77900]',
    };
  }

  const key = keyOf(tipoCafe);

  if (key === 'VERDE') {
    return {
      icon: <Leaf size={18} strokeWidth={2.2} />,
      accent: 'bg-[#0d7b67]',
      border: 'border-[#bfe8d8]',
      iconBox: 'bg-[#e9fbf4] text-[#0d7b67]',
      soft: 'bg-[#f5fffa]',
      chip: 'bg-[#e9fbf4] text-[#0d7b67]',
      text: 'text-[#0d7b67]',
    };
  }

  if (key === 'SECO') {
    return {
      icon: <SunMedium size={18} strokeWidth={2.2} />,
      accent: 'bg-[#d29309]',
      border: 'border-[#f2d28a]',
      iconBox: 'bg-[#fff7df] text-[#b77900]',
      soft: 'bg-[#fffdf4]',
      chip: 'bg-[#fff7df] text-[#946200]',
      text: 'text-[#b77900]',
    };
  }

  if (key === 'PASILLA') {
    return {
      icon: <Coffee size={18} strokeWidth={2.2} />,
      accent: 'bg-[#c92c32]',
      border: 'border-[#f1c0c3]',
      iconBox: 'bg-[#ffe7e8] text-[#c92c32]',
      soft: 'bg-[#fff8f8]',
      chip: 'bg-[#ffe7e8] text-[#a9272c]',
      text: 'text-[#c92c32]',
    };
  }

  return {
    icon: <Coffee size={18} strokeWidth={2.2} />,
    accent: 'bg-[#2f4aa4]',
    border: 'border-[#c7d2fe]',
    iconBox: 'bg-[#eef3ff] text-[#2f4aa4]',
    soft: 'bg-[#f8faff]',
    chip: 'bg-[#eef3ff] text-[#2f4aa4]',
    text: 'text-[#2f4aa4]',
  };
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
      'Revisa la humedad ingresada.',
      'Debe estar entre 8 % y 14 %. Puedes dejar el campo vacío si aún no tienes el dato.',
      'Corrige el valor y guarda de nuevo.',
    );
  }

  if (message.includes('peso')) {
    return createGuidedError(
      message,
      'Revisa el peso del sublote.',
      'El nuevo peso debe ser mayor o igual a 0 y no puede superar el peso inicial.',
      'Ajusta los kilos y vuelve a guardar.',
    );
  }

  if (message.includes('factor')) {
    return createGuidedError(
      message,
      'Revisa el factor ingresado.',
      'Usa un número válido. Si no tienes el dato, puedes dejarlo vacío.',
      'Corrige el valor y guarda de nuevo.',
    );
  }

  return createGuidedError(
    message,
    'No pudimos completar la acción.',
    'Tus datos locales se mantienen. Cuando tengas conexión, vuelve a intentarlo o refresca la pantalla.',
    'Revisa tu conexión y prueba de nuevo.',
  );
}

export default function Sublotes() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = (location.state ?? null) as { from?: string } | null;
  const requestedSubloteId = searchParams.get('subloteId');
  const { tipoCafeId, calidadId } = useParams<{
    tipoCafeId: string;
    calidadId: string;
  }>();
  const { isOnline, refreshHealth } = useCloudStatus();

  const [detalle, setDetalle] = useState<LoteDetalleVisual | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineNoticeVisible, setOfflineNoticeVisible] = useState(false);
  const [factorNotice, setFactorNotice] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<{
    field: EditField;
    value: string;
  } | null>(null);
  const [weightModal, setWeightModal] = useState<{
    value: string;
    reason: string;
  } | null>(null);
  const [selectedSubloteId, setSelectedSubloteId] = useState<string | null>(
    null,
  );
  const [deepLinkNotice, setDeepLinkNotice] = useState<string | null>(null);
  const [showAllSublotes, setShowAllSublotes] = useState(false);
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
    return showAllSublotes
      ? detalle.sublotes
      : detalle.sublotes.slice(0, SUBLOTES_PREVIEW_LIMIT);
  }, [detalle, showAllSublotes]);

  const hiddenSublotesCount = detalle
    ? Math.max(0, detalle.sublotes.length - sublotesPreview.length)
    : 0;

  const cargar = useCallback(async () => {
    if (!tipoCafeId || !calidadId) {
      setError('No encontramos el lote solicitado.');
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
          setShowAllSublotes(false);
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
      setShowAllSublotes(false);
      writeCachedDetail(tipoCafeId, calidadId, hydrated);
      setOfflineNoticeVisible(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el detalle del sublote.',
      );
      setDetalle(null);
    } finally {
      setLoading(false);
    }
  }, [calidadId, isOnline, tipoCafeId]);

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
        // La cola se mantiene para un nuevo intento cuando vuelva la conexión.
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
        // La cola se mantiene para un nuevo intento cuando vuelva la conexión.
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
        // La cola se mantiene para un nuevo intento cuando vuelva la conexión.
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
      setDeepLinkNotice(null);
      return;
    }

    if (requestedSubloteId) {
      const requestedExists = detalle.sublotes.some(
        (sublote) => sublote.id === requestedSubloteId,
      );

      if (requestedExists) {
        setSelectedSubloteId(requestedSubloteId);
        setDeepLinkNotice(null);
        return;
      }

      setDeepLinkNotice('El sublote ya no está disponible en este grupo.');
    } else {
      setDeepLinkNotice(null);
    }

    setSelectedSubloteId((current) =>
      current && detalle.sublotes.some((sublote) => sublote.id === current)
        ? current
        : null,
    );
  }, [detalle, requestedSubloteId]);

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
    setEditModal({ field: 'humedad', value: currentValue });
  }, [subloteActivo]);

  const handleEditFactor = useCallback(() => {
    if (!subloteActivo) return;

    const currentValue = subloteActivo.factor;
    setEditModal({
      field: 'factor',
      value: currentValue === null ? '' : String(currentValue),
    });
  }, [subloteActivo]);

  const handleOpenWeightModal = useCallback(() => {
    if (!subloteActivo) return;
    setWeightModal({ value: String(subloteActivo.pesoActual), reason: '' });
  }, [subloteActivo]);

  const handleConfirmWeight = useCallback(() => {
    if (!weightModal || !subloteActivo || !tipoCafeId || !calidadId) return;

    const parsed = Number(weightModal.value.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('El nuevo peso no es válido.');
      return;
    }

    const nextWeight = Number(parsed.toFixed(2));
    if (nextWeight > MAX_AJUSTE_PESO_KG) {
      setError('El peso no puede superar los 99.999 kg.');
      return;
    }

    if (nextWeight > subloteActivo.pesoInicial) {
      setError('El peso no puede superar el peso inicial del sublote.');
      return;
    }

    const reason = weightModal.reason.trim().slice(0, MAX_MOTIVO_AJUSTE_LENGTH);
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
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo guardar el ajuste de peso.',
        );
      }
    })();
  }, [calidadId, cargar, isOnline, subloteActivo, tipoCafeId, weightModal]);

  const handleConfirmEdit = useCallback(() => {
    if (!editModal || !subloteActivo || !tipoCafeId || !calidadId) return;

    const trimmed = editModal.value.trim();
    const parsed = trimmed === '' ? null : Number(trimmed.replace(',', '.'));

    if (editModal.field === 'humedad') {
      if (
        parsed !== null &&
        (!Number.isFinite(parsed) || parsed < 8 || parsed > 14)
      ) {
        setError('La humedad no es valida. Debe estar entre 8 y 14.');
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
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo guardar la humedad.',
          );
        }
      })();

      return;
    }

    if (
      parsed !== null &&
      (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_AJUSTE_PESO_KG)
    ) {
      setError('El factor no es válido.');
      return;
    }

    setError(null);
    setEditModal(null);

    if (parsed !== null && (parsed < 84 || parsed > 100)) {
      setFactorNotice(
        'El rango recomendado es 84-100. Si confirmas que el dato es correcto según la Federación Nacional de Cafeteros, puedes continuar.',
      );
    }

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
        setError(
          err instanceof Error ? err.message : 'No se pudo guardar el factor.',
        );
      }
    })();
  }, [calidadId, cargar, editModal, isOnline, subloteActivo, tipoCafeId]);

  const diasSubloteActivo = useMemo(() => {
    if (!subloteActivo) return 0;
    return getDaysForSublote(subloteActivo);
  }, [subloteActivo]);

  const subloteActivoIndex = useMemo(() => {
    if (!detalle || !subloteActivo) return -1;
    return detalle.sublotes.findIndex(
      (sublote) => sublote.id === subloteActivo.id,
    );
  }, [detalle, subloteActivo]);

  const subloteActivoNombre =
    subloteActivoIndex >= 0
      ? `Sublote ${subloteActivoIndex + 1}`
      : subloteActivo?.etiqueta ?? 'Sublote';

  const factorActivo = subloteActivo?.factor ?? null;
  const showFactor = shouldShowFactor(subloteActivo);
  const financieroActivo = resultadosFinancieros ?? subloteActivo;
  const loteTone = detalle
    ? getCoffeeTone(detalle.lote.tipoCafe, detalle.lote.calidad)
    : null;
  const subloteTone = subloteActivo
    ? getCoffeeTone(subloteActivo.tipoCafe, subloteActivo.calidad)
    : null;

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#1f1f1f]">
      <header className="sticky top-0 z-20 border-b border-[#e9edf3] bg-white">
        <div className="mx-auto grid h-[56px] w-full max-w-[430px] grid-cols-[44px_1fr_44px] items-center px-3">
          <button
            type="button"
            onClick={() => {
              if (selectedSubloteId) {
                setSelectedSubloteId(null);
                return;
              }

              navigate(
                locationState?.from === 'inicio' ? '/inicio' : '/inventario',
              );
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#2b2b2b] transition hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#9fb0e6]"
            aria-label="Volver"
          >
            <ArrowLeft size={21} strokeWidth={2.25} />
          </button>

          <h1 className="text-center text-[1.05rem] font-semibold leading-tight tracking-normal text-[#1c1c1c]">
            {selectedSubloteId ? 'Detalles' : 'Sublotes'}
          </h1>

          <button
            type="button"
            onClick={() => void handleReload()}
            aria-label="Recargar"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#7f7f7f] transition hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#9fb0e6]"
          >
            <RefreshCcw
              size={18}
              className={refreshing ? 'animate-spin' : ''}
              strokeWidth={2.2}
            />
          </button>
        </div>
      </header>

      {(offlineNoticeVisible || !isOnline) && (
        <div className="border-b border-[#ececec] bg-white px-4 py-3">
          <div
            className="mx-auto max-w-[430px] rounded-[14px] border border-[#d9e2f5] bg-[#f7f9ff] px-4 py-3 text-sm font-semibold leading-5 text-[#4d5d7c]"
            role="status"
            aria-live="polite"
          >
            Estás sin conexión. Puedes seguir consultando estos datos; los cambios se sincronizarán cuando vuelva internet.
          </div>
        </div>
      )}

      <main
        className={`mx-auto w-full max-w-[430px] px-3 pt-3 ${
          subloteActivo ? 'pb-40' : 'pb-4'
        }`}
      >
        {error ? (
          <InlineGuidedError
            message={getSublotesGuidance(error)}
            className="mb-4"
          />
        ) : null}

        {deepLinkNotice ? (
          <section className="mb-4 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">
            {deepLinkNotice}
          </section>
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

        {!loading && detalle && !subloteActivo ? (
          <section
            className={`overflow-hidden rounded-[18px] border bg-white shadow-[0_10px_26px_rgba(15,23,42,0.055)] ${loteTone?.border ?? 'border-[#e1e6ef]'}`}
            aria-labelledby="sublotes-heading"
          >
            <div className={`h-1.5 ${loteTone?.accent ?? 'bg-[#2f4aa4]'}`} />
            <div className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${loteTone?.iconBox ?? 'bg-[#eef3ff] text-[#2f4aa4]'}`}
                  >
                    {loteTone?.icon}
                  </span>
                  <div className="min-w-0">
                    <p
                      id="sublotes-heading"
                      className="text-[0.86rem] font-semibold uppercase tracking-[0.05em] text-[#263247]"
                    >
                      {formatCoffeeLabel(detalle.lote.tipoCafe)}{' '}
                      {titleCase(detalle.lote.calidad)}
                    </p>
                    <p className="mt-1 text-sm font-medium leading-5 text-[#667085]">
                      Elige un sublote para revisar inventario, costos y acciones.
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[0.78rem] font-semibold ${loteTone?.chip ?? 'bg-[#eef3ff] text-[#2f4aa4]'}`}
                >
                  {pluralLabel(
                    detalle.sublotes.length,
                    'disponible',
                    'disponibles',
                  )}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-[12px] border border-[#edf1f7] bg-[#fbfcfe] px-3 py-2.5">
                  <p className="text-[0.72rem] font-medium text-[#98a2b3]">
                    Peso total
                  </p>
                  <p className="mt-0.5 text-[0.95rem] font-semibold text-[#263247]">
                    {formatKg(detalle.lote.pesoActual)}
                  </p>
                </div>
                <div className="rounded-[12px] border border-[#edf1f7] bg-[#fbfcfe] px-3 py-2.5">
                  <p className="text-[0.72rem] font-medium text-[#98a2b3]">
                    En inventario
                  </p>
                  <p className="mt-0.5 text-[0.95rem] font-semibold text-[#263247]">
                    {pluralLabel(detalle.sublotes.length, 'sublote', 'sublotes')}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2.5">
                {sublotesPreview.map((sublote, index) => {
                  const itemTone = getCoffeeTone(
                    sublote.tipoCafe,
                    sublote.calidad,
                  );
                  return (
                    <button
                      key={sublote.id}
                      type="button"
                      onClick={() => setSelectedSubloteId(sublote.id)}
                      className="flex min-h-[76px] w-full items-center justify-between rounded-[14px] border border-[#e4e9f2] bg-white px-3.5 py-3 text-left transition hover:border-[#b9c5e8] hover:shadow-[0_8px_18px_rgba(15,23,42,0.06)] focus:outline-none focus:ring-2 focus:ring-[#9fb0e6]"
                      aria-label={`Abrir detalles del sublote ${index + 1}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${itemTone.iconBox}`}
                        >
                          <Package2 size={17} strokeWidth={2.1} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[0.95rem] font-semibold leading-tight text-[#202020]">
                            Sublote {index + 1}
                          </p>
                          <p className="mt-1 text-[0.82rem] font-medium leading-5 text-[#667085]">
                            {formatCoffeeLabel(sublote.tipoCafe)}{' '}
                            {titleCase(sublote.calidad)} ·{' '}
                            {formatKg(sublote.pesoActual)}
                          </p>
                          <p className="mt-0.5 text-[0.78rem] font-medium leading-5 text-[#98a2b3]">
                            {formatDays(getDaysForSublote(sublote))} en bodega
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 pl-3 text-[0.78rem] font-semibold ${itemTone.text}`}
                      >
                        Ver
                        <ChevronRight size={17} strokeWidth={2.4} />
                      </span>
                    </button>
                  );
                })}
              </div>

              {hiddenSublotesCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowAllSublotes(true)}
                  className="mt-3 inline-flex min-h-[42px] w-full items-center justify-center rounded-[12px] border border-[#d9e2f5] bg-[#f7f9ff] px-4 text-sm font-semibold text-[#2f4aa4] transition hover:bg-[#eef3ff] focus:outline-none focus:ring-2 focus:ring-[#9fb0e6]"
                >
                  Ver{' '}
                  {pluralLabel(
                    hiddenSublotesCount,
                    'sublote más',
                    'sublotes más',
                  )}
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {!loading && subloteActivo ? (
          <div className="space-y-3">
            {detalle && detalle.sublotes.length > 1 ? (
              <section className="rounded-[16px] border border-[#e1e6ef] bg-white px-3.5 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.82rem] font-semibold uppercase tracking-[0.05em] text-[#283044]">
                    Cambiar sublote
                  </p>
                  <span className="text-[0.78rem] font-medium text-[#667085]">
                    {pluralLabel(
                      detalle.sublotes.length,
                      'opción',
                      'opciones',
                    )}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {detalle.sublotes.map((sublote, index) => {
                    const active = sublote.id === subloteActivo.id;
                    return (
                      <button
                        key={sublote.id}
                        type="button"
                        onClick={() => setSelectedSubloteId(sublote.id)}
                        aria-current={active ? 'true' : undefined}
                        className={`flex min-h-[58px] items-center justify-between rounded-[10px] border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-[#9fb0e6] ${
                          active
                            ? `${subloteTone?.border ?? 'border-[#6f84d8]'} ${subloteTone?.soft ?? 'bg-[#f4f6ff]'}`
                            : 'border-[#e6eaf2] bg-[#fbfcfe]'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[0.86rem] font-semibold text-[#202020]">
                            Sublote {index + 1}
                          </p>
                          <p className="mt-0.5 text-[0.76rem] font-medium text-[#667085]">
                            {formatKg(sublote.pesoActual)} ·{' '}
                            {formatDays(getDaysForSublote(sublote))}
                          </p>
                        </div>
                        <span
                          className={`ml-2 h-2 w-2 shrink-0 rounded-full ${active ? 'bg-[#2f4aa4]' : 'bg-[#d5d5d5]'}`}
                        />
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="overflow-hidden rounded-[16px] border border-[#d9e2f5] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
              <button
                type="button"
                onClick={() => setShowAnalysis((current) => !current)}
                className="flex min-h-[64px] w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition hover:bg-[#f8faff] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#9fb0e6]"
                aria-expanded={showAnalysis}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#eef3ff] text-[#2f4aa4]">
                    <BarChart3 size={18} strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.84rem] font-semibold uppercase tracking-[0.05em] text-[#283044]">
                      Análisis financiero
                    </span>
                    <span className="mt-0.5 block text-[0.78rem] font-medium text-[#667085]">
                      Utilidad, merma y valor del sublote
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-[0.82rem] font-semibold text-[#2f4aa4]">
                  {showAnalysis ? 'Ocultar' : 'Ver'}
                </span>
              </button>

              {showAnalysis && financieroActivo ? (
                <div className="border-t border-[#eef2f6] px-3.5 py-3.5">
                  <p className="text-sm font-medium leading-5 text-[#667085]">
                    Una lectura rápida para decidir si conviene vender, ajustar gastos o esperar.
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <InfoField
                      label="Utilidad neta"
                      value={formatCurrency(financieroActivo.utilidadNeta)}
                      accent="price"
                      icon={<CircleDollarSign size={15} />}
                      surface="green"
                    />
                    <InfoField
                      label="Merma kg"
                      value={formatKg(financieroActivo.mermaKg)}
                      icon={<Package2 size={15} />}
                    />
                    <InfoField
                      label="Merma %"
                      value={formatPercent(financieroActivo.mermaPorcentaje)}
                      icon={<BarChart3 size={15} />}
                    />
                    <InfoField
                      label="Valor merma"
                      value={formatCurrency(financieroActivo.mermaValor)}
                      accent="price"
                      icon={<CircleDollarSign size={15} />}
                      surface="amber"
                    />
                  </div>

                  <div className="mt-3 rounded-[12px] bg-[#f8fafc] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[0.76rem] font-medium text-[#667085]">
                        Proporción de merma
                      </span>
                      <span className="text-[0.78rem] font-semibold text-[#475467]">
                        {formatPercent(financieroActivo.mermaPorcentaje)}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e8edf5]">
                      <div
                        className="h-full rounded-full bg-[#2f4aa4]"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, financieroActivo.mermaPorcentaje),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-[16px] border border-[#e1e6ef] bg-white px-3.5 py-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
              <div className="flex items-center gap-2 text-[#1c1c1c]">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#f2f4f7] text-[#667085]">
                  <Info size={17} strokeWidth={2.4} />
                </span>
                <h2 className="text-[0.86rem] font-semibold uppercase tracking-[0.05em] text-[#283044]">
                  Información básica
                </h2>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5 border-t border-[#eef2f6] pt-3">
                <InfoField
                  label="Sublote"
                  value={subloteActivoNombre}
                  icon={<Package2 size={15} />}
                  surface="blue"
                />
                <InfoField
                  label="Tipo"
                  value={formatCoffeeLabel(subloteActivo.tipoCafe)}
                  icon={subloteTone?.icon}
                  surface="green"
                />
                <InfoField
                  label="Calidad"
                  value={titleCase(subloteActivo.calidad)}
                  icon={<Coffee size={15} />}
                />
                <InfoField
                  label="Peso"
                  value={formatKg(subloteActivo.pesoActual)}
                  icon={<Scale size={15} />}
                />
                <InfoField
                  label="Precio/kg"
                  value={formatPricePerKg(subloteActivo.precioKg)}
                  accent="price"
                  icon={<CircleDollarSign size={15} />}
                  surface="amber"
                />
                <InfoField
                  label="Fecha de compra"
                  value={formatDateShort(subloteActivo.fechaIngreso)}
                  icon={<CalendarDays size={15} />}
                />
                <InfoField
                  label="Tiempo en bodega"
                  value={formatDays(diasSubloteActivo)}
                  icon={<CalendarDays size={15} />}
                  surface="blue"
                />
              </div>
            </section>

            <section className="rounded-[16px] border border-[#e1e6ef] bg-white px-3.5 py-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
              <div className="flex items-center gap-2 text-[#1c1c1c]">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#fff7df] text-[#b77900]">
                  <FlaskConical size={17} strokeWidth={2.3} />
                </span>
                <div>
                  <h2 className="text-[0.86rem] font-semibold uppercase tracking-[0.05em] text-[#283044]">
                    Datos técnicos
                  </h2>
                  <p className="mt-0.5 text-sm font-medium leading-5 text-[#667085]">
                    Completa estos datos cuando tengas medición de calidad.
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-3 border-t border-[#eef2f6] pt-3">
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

      {subloteActivo ? (
        <footer className="sticky bottom-0 z-10 border-t border-[#e6eaf2] bg-[#f6f7f9]/95 pb-3 pt-2 backdrop-blur">
          <div className="mx-auto grid w-full max-w-[430px] gap-2 px-3">
            <button
              type="button"
              onClick={() => navigate('/ventas')}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#2f4aa4] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(47,74,164,0.16)] transition hover:bg-[#263f93] focus:outline-none focus:ring-2 focus:ring-[#9fb0e6]"
            >
              <Tag size={17} strokeWidth={2.25} />
              Vender sublote
            </button>

            <button
              type="button"
              onClick={handleOpenWeightModal}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[12px] border border-[#dfe3ec] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#b9c5e8] focus:outline-none focus:ring-2 focus:ring-[#9fb0e6]"
            >
              <Scale size={17} strokeWidth={2.2} />
              Ajustar peso
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(
                  `/gastos?subloteId=${encodeURIComponent(subloteActivo.id)}`,
                )
              }
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[12px] border border-[#dfe3ec] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#b9c5e8] focus:outline-none focus:ring-2 focus:ring-[#9fb0e6]"
            >
              <Tag size={17} strokeWidth={2.2} />
              Ver gastos
            </button>
          </div>
        </footer>
      ) : null}

      {editModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f172a]/40 px-4 backdrop-blur-sm">
          <div
            className="w-full max-w-[430px] rounded-[18px] border border-[#ececec] bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.25)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-sublote-title"
          >
            <p
              id="edit-sublote-title"
              className="text-center text-[1.05rem] font-semibold text-[#1f1f1f]"
            >
              {editModal.field === 'humedad'
                ? 'Editar humedad'
                : 'Editar factor'}
            </p>
            <p className="mx-auto mt-2 max-w-[320px] text-center text-sm font-medium leading-5 text-[#667085]">
              {editModal.field === 'humedad'
                ? 'Ingresa un valor entre 8 % y 14 %, o deja el campo vacío si aún no tienes medición.'
                : 'Ingresa el factor de rendimiento. Puedes dejarlo vacío si falta confirmarlo.'}
            </p>
            <input
              type="text"
              inputMode="decimal"
              aria-label={editModal.field === 'humedad' ? 'Humedad' : 'Factor'}
              maxLength={editModal.field === 'humedad' ? 5 : 5}
              value={editModal.value}
              onChange={(event) =>
                setEditModal((current) =>
                  current
                    ? {
                        ...current,
                        value:
                          current.field === 'humedad'
                            ? clampDecimalInput(event.target.value, 4, 100)
                            : sanitizeDecimalInput(event.target.value, 4),
                      }
                    : current,
                )
              }
              className="mt-4 w-full rounded-[12px] border border-[#dcdcdc] bg-white px-3 py-3 text-[1.1rem] font-semibold text-[#1f1f1f] outline-none focus:border-[#2f4aa4] focus:ring-2 focus:ring-[#d9e2f5]"
              placeholder={
                editModal.field === 'humedad' ? 'Ej: 12.0' : 'Ej: 86'
              }
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditModal(null)}
                className="min-h-[42px] rounded-[10px] border border-[#e2e2e2] bg-white px-3 py-2 text-sm font-semibold text-[#5a5a5a] transition hover:bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#9fb0e6]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmEdit}
                className="min-h-[42px] rounded-[10px] bg-[#2f4aa4] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#263f93] focus:outline-none focus:ring-2 focus:ring-[#9fb0e6]"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {weightModal && subloteActivo ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f172a]/35 px-4 backdrop-blur-sm">
          <div
            className="w-full max-w-[360px] rounded-[16px] border border-[#ececec] bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.24)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="weight-sublote-title"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2
                id="weight-sublote-title"
                className="text-[1rem] font-semibold text-[#111827]"
              >
                Ajustar peso
              </h2>
              <button
                type="button"
                onClick={() => setWeightModal(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f4f4] text-[#667085] transition hover:bg-[#e7e9ee] focus:outline-none focus:ring-2 focus:ring-[#9fb0e6]"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <p className="mb-3 text-sm font-medium leading-5 text-[#667085]">
              Registra el peso real disponible. No puede superar el peso inicial del sublote.
            </p>

            <div className="rounded-[10px] bg-[#fff4e8] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.82rem] font-medium text-[#8b6b4d]">
                  Peso actual
                </span>
                <span className="text-[0.95rem] font-semibold text-[#b45309]">
                  {formatKg(subloteActivo.pesoActual)}
                </span>
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1.5 block text-[0.8rem] font-semibold uppercase tracking-[0.05em] text-[#6b7280]">
                Nuevo peso
              </label>
              <div className="flex items-center rounded-[10px] border border-[#e5e7eb] bg-[#fafafa] px-3 py-2.5 focus-within:border-[#2f4aa4] focus-within:ring-2 focus-within:ring-[#d9e2f5]">
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
                            value: clampDecimalInput(
                              event.target.value,
                              7,
                              Math.min(
                                MAX_AJUSTE_PESO_KG,
                                subloteActivo.pesoInicial,
                              ),
                            ),
                          }
                        : current,
                    )
                  }
                  placeholder="Ej: 98.5"
                  className="min-w-0 flex-1 bg-transparent text-[1rem] font-medium text-[#111827] outline-none placeholder:text-[#98a2b3]"
                />
                <span className="text-[0.86rem] font-semibold text-[#6b7280]">
                  kg
                </span>
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1.5 block text-[0.8rem] font-semibold uppercase tracking-[0.05em] text-[#6b7280]">
                Motivo (opcional)
              </label>
              <textarea
                maxLength={MAX_MOTIVO_AJUSTE_LENGTH}
                value={weightModal.reason}
                onChange={(event) =>
                  setWeightModal((current) =>
                    current
                      ? {
                          ...current,
                          reason: event.target.value.slice(
                            0,
                            MAX_MOTIVO_AJUSTE_LENGTH,
                          ),
                        }
                      : current,
                  )
                }
                placeholder="Ej: secado, evaporación, ajuste manual"
                className="min-h-[78px] w-full resize-none rounded-[10px] border border-[#e5e7eb] bg-[#fafafa] px-3 py-2.5 text-[0.95rem] font-medium text-[#111827] outline-none placeholder:text-[#98a2b3] focus:border-[#2f4aa4] focus:ring-2 focus:ring-[#d9e2f5]"
              />
              <p className="mt-1 text-right text-[0.76rem] font-semibold text-slate-400">
                {weightModal.reason.length}/{MAX_MOTIVO_AJUSTE_LENGTH}
              </p>
            </div>

            <button
              type="button"
              onClick={handleConfirmWeight}
              className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-[10px] bg-[#1f3fa7] px-4 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(31,63,167,0.18)] transition hover:bg-[#17348e] focus:outline-none focus:ring-2 focus:ring-[#9fb0e6]"
            >
              Guardar ajuste
            </button>
            <button
              type="button"
              onClick={() => setWeightModal(null)}
              className="mt-2 inline-flex min-h-[36px] w-full items-center justify-center text-sm font-semibold text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#9fb0e6]"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {factorNotice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/45 px-4 backdrop-blur-sm">
          <div
            className="w-full max-w-[430px] rounded-[18px] border border-amber-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.25)]"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="factor-notice-title"
          >
            <div className="mb-2 flex justify-center text-amber-500">
              <AlertTriangle size={22} strokeWidth={2.3} />
            </div>
            <p
              id="factor-notice-title"
              className="text-center text-[1rem] font-semibold text-[#1f2937]"
            >
              Confirma el factor
            </p>
            <p className="mt-2 text-center text-sm font-medium leading-5 text-[#4a4a4a]">
              {factorNotice}
            </p>
            <button
              type="button"
              onClick={() => setFactorNotice(null)}
              className="mt-3 min-h-[42px] w-full rounded-[10px] bg-amber-500 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              Entendido
            </button>
          </div>
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
  surface = 'neutral',
}: {
  label: string;
  value: string;
  accent?: 'price';
  icon?: React.ReactNode;
  surface?: 'neutral' | 'green' | 'amber' | 'blue';
}) {
  const surfaceClass = {
    neutral: 'border-[#edf1f7] bg-[#fbfcfe] text-[#667085]',
    green: 'border-[#d5f0e4] bg-[#f5fffa] text-[#0d7b67]',
    amber: 'border-[#f5dfad] bg-[#fffaf0] text-[#b77900]',
    blue: 'border-[#d9e2f5] bg-[#f7f9ff] text-[#2f4aa4]',
  }[surface];

  return (
    <div className={`min-w-0 rounded-[12px] border px-3 py-2.5 ${surfaceClass}`}>
      <div className="flex items-center gap-1.5">
        {icon ? (
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center opacity-80">
            {icon}
          </span>
        ) : null}
        <p className="truncate text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-[#98a2b3]">
          {label}
        </p>
      </div>
      <p
        className={`mt-1.5 text-[0.95rem] font-semibold leading-tight text-[#232323] ${accent === 'price' ? 'text-[#c4551d]' : ''}`}
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
    <div>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-[#98a2b3]">
        {label}
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="mt-1.5 flex min-h-[48px] w-full items-center justify-between rounded-[12px] border border-[#e2e7ef] bg-[#fbfcfe] px-3 text-left transition hover:border-[#b9c5e8] hover:bg-white focus:border-[#2f4aa4] focus:outline-none focus:ring-2 focus:ring-[#d9e2f5]"
        aria-label={`Editar ${label.toLowerCase()}: ${value}`}
      >
        <p className="min-w-0 text-[0.98rem] font-semibold leading-tight tracking-normal text-[#222222]">
          <span>{value}</span>
        </p>
        {toneClass ? (
          <span
            className={`ml-2 h-2.5 w-2.5 shrink-0 rounded-full ${toneClass}`}
            aria-hidden="true"
          />
        ) : null}
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#98a2b3]">
          <Pencil size={13} strokeWidth={2.2} />
        </span>
      </button>
    </div>
  );
}
