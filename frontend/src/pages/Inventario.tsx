import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeAlert,
  CircleDashed,
  Coffee,
  Leaf,
  Package2,
  RefreshCcw,
  Save,
  ShoppingCart,
  SunMedium,
  X,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { obtenerLotes, type LoteResumen } from '../services/lotesService';
import {
  guardarConfiguracionBodega,
  obtenerConfiguracionBodega,
} from '../services/bodegaApi';
import {
  applySecadoToLots,
  getActiveSecadoSession,
  getActiveSecadoSessions,
} from '../utils/secadoFlow';
import { getDaysInBodega } from '../utils/date';
import { ENABLE_SECADO_PROTOTYPE } from '../config/features';
import {
  classifyHumidity,
  formatHumidityWithClassification,
} from '../utils/humidity';
import { formatCoffeeLabel, formatDisplayLabel } from '../utils/uiMessages';

const TYPE_ORDER = [
  'VERDE',
  'EN SECADO',
  'SECO',
  'TRILLADO',
  'PASILLA',
] as const;
const BULTO_KG = 40.7;
function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(
    value,
  );
}

function sanitizeCapacidadInput(value: string) {
  return value.replace(/\D/g, '').slice(0, 6);
}

function sanitizeNombreBodegaInput(value: string) {
  return value.replace(/[^\p{L}0-9\s&.'/-]/gu, '').slice(0, 50);
}

function compareLotByAge(
  a: LoteResumen,
  b: LoteResumen,
  sortKey: 'OLDEST' | 'NEWEST',
) {
  const daysA = getLotDays(a);
  const daysB = getLotDays(b);

  if (sortKey === 'OLDEST') {
    if (daysB.max !== daysA.max) return daysB.max - daysA.max;
    return b.pesoActual - a.pesoActual;
  }

  if (daysA.max !== daysB.max) return daysA.max - daysB.max;
  return a.pesoActual - b.pesoActual;
}

function getCapacityTone(percentage: number) {
  if (percentage > 100) {
    return {
      label: 'Capacidad superada',
      message: 'Vende café o ajusta la bodega.',
      color: '#d92d20',
      text: 'text-[#b42318]',
      softText: 'text-[#b42318]',
      chip: 'bg-[#fee2e2] text-[#b42318]',
    };
  }

  if (percentage >= 85) {
    return {
      label: 'Critica',
      message: 'La bodega está cerca del límite.',
      color: '#d92d20',
      text: 'text-[#b42318]',
      softText: 'text-[#b42318]',
      chip: 'bg-[#fee2e2] text-[#b42318]',
    };
  }

  if (percentage >= 60) {
    return {
      label: 'Alta',
      message: 'La bodega está cerca de su capacidad máxima.',
      color: '#d29309',
      text: 'text-[#b77900]',
      softText: 'text-[#946200]',
      chip: 'bg-[#fff7df] text-[#946200]',
    };
  }

  return {
    label: 'Normal',
    message: 'Espacio disponible estable.',
    color: '#0d7b67',
    text: 'text-[#0d7b67]',
    softText: 'text-slate-600',
    chip: 'bg-[#e9fbf4] text-[#0d7b67]',
  };
}

function formatSacks(valueKg: number) {
  const sacks = valueKg / BULTO_KG;
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(sacks);
}

function formatShortSacks(valueKg: number) {
  return formatSacks(valueKg);
}

function pluralLabel(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function displayCoffeeName(value: string) {
  return formatCoffeeLabel(value);
}

function getLotDays(lot: LoteResumen) {
  const oldest = getDaysInBodega(lot.fechaPrimerIngreso || lot.fecha);
  const newest = getDaysInBodega(lot.fechaUltimoIngreso || lot.fecha);

  return {
    max: Math.max(oldest, newest),
    min: Math.min(oldest, newest),
  };
}

function coffeeVisual(name: string) {
  const key = keyOf(name);

  if (key === 'VERDE') {
    return {
      icon: <Leaf size={18} />,
      bg: 'bg-[#e9fbf4]',
      text: 'text-[#0d7b67]',
      ring: '#0d7b67',
    };
  }

  if (key === 'SECO') {
    return {
      icon: <SunMedium size={18} />,
      bg: 'bg-[#fff7df]',
      text: 'text-[#d29309]',
      ring: '#d29309',
    };
  }

  if (key === 'EN SECADO') {
    return {
      icon: <CircleDashed size={18} />,
      bg: 'bg-[#fff7df]',
      text: 'text-[#b77900]',
      ring: '#b77900',
    };
  }

  if (key === 'PASILLA') {
    return {
      icon: <BadgeAlert size={18} />,
      bg: 'bg-[#ffe7e8]',
      text: 'text-[#c92c32]',
      ring: '#c92c32',
    };
  }

  return {
    icon: <Coffee size={18} />,
    bg: 'bg-[#eef1ff]',
    text: 'text-[#102d92]',
    ring: '#102d92',
  };
}

function qualityIconTone(tipoCafe: string, calidad: string) {
  void tipoCafe;
  const quality = keyOf(calidad);

  if (quality === 'BUENO') {
    return 'bg-[#e9fbf4] text-[#0d7b67]';
  }

  if (quality === 'REGULAR') {
    return 'bg-[#fff7df] text-[#b77900]';
  }

  return 'bg-[#ffe7e4] text-[#b42318]';
}

function inventoryListClass(itemCount: number, spacing = 'space-y-3') {
  const base = `min-h-0 ${spacing} pr-1`;

  if (itemCount > 3) {
    return `${base} max-h-[320px] overflow-y-auto pb-24 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`;
  }

  return `${base} overflow-visible pb-2`;
}

function isSecadoProcessLot(lot: LoteResumen) {
  return keyOf(lot.tipoCafe) === 'EN SECADO';
}

function secadoProgress(estado: string) {
  return estado === 'READY' ? 82 : 45;
}

function secadoStatusLabel(estado: string) {
  return estado === 'READY' ? 'Listo para finalizar' : 'Secado en proceso';
}

function CapacityRing({
  totalKg,
  capacityKg,
  onAdjust,
}: {
  totalKg: number;
  capacityKg: number | null;
  onAdjust: () => void;
}) {
  if (!capacityKg) {
    return (
      <section className="rounded-[20px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
        <p
          className="text-[0.95rem] font-extrabold text-black"
          style={{ fontWeight: 900 }}
        >
          Resumen de Inventario
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <p
              className="text-[2.1rem] font-extrabold leading-none text-[#102d92]"
              style={{ fontWeight: 900 }}
            >
              {formatNumber(totalKg)} kg
            </p>
            <p
              className="mt-1 text-sm font-semibold text-slate-600"
              style={{ fontWeight: 700 }}
            >
              Configura la capacidad para calcular la ocupación.
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#eef2ff] bg-white text-[#102d92] shadow-sm">
            <Coffee size={18} />
          </div>
        </div>
        <button
          type="button"
          onClick={onAdjust}
          className="mt-3 text-[0.72rem] font-black text-[#102d92]"
        >
          Ajustar bodega
        </button>
      </section>
    );
  }

  const safeCapacity = Math.max(1, capacityKg);
  const rawPercentage = Math.max(0, (totalKg / safeCapacity) * 100);
  const displayPercentage =
    rawPercentage === 0
      ? '0'
      : rawPercentage < 1
        ? rawPercentage.toFixed(1)
        : rawPercentage.toFixed(0);
  const ringPercentage =
    totalKg > 0 ? Math.max(1.5, Math.min(100, rawPercentage)) : 0;
  const tone = getCapacityTone(rawPercentage);
  const circumference = 2 * Math.PI * 58;
  const offset = circumference - (ringPercentage / 100) * circumference;

  return (
    <section className="rounded-[20px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[0.9rem] font-extrabold text-black"
            style={{ fontWeight: 900 }}
          >
            Resumen de Inventario
          </p>
          <div className="mt-3 flex min-w-0 items-baseline gap-1.5">
            <p
              className={`text-[1.35rem] font-extrabold leading-none ${tone.text}`}
              style={{ fontWeight: 900 }}
            >
              {formatNumber(totalKg)}
            </p>
            <span
              className={`text-[1.35rem] font-extrabold leading-none ${tone.text}`}
              style={{ fontWeight: 900 }}
            >
              kg
            </span>
            <span className="text-[0.9rem] font-black leading-none text-slate-400">
              / {formatNumber(safeCapacity)}
            </span>
          </div>
        </div>

        <div className="-mt-1 flex shrink-0 flex-col items-center gap-1 self-start">
          <div className="relative flex h-[58px] w-[58px] items-center justify-center">
            <svg viewBox="0 0 140 140" className="h-[58px] w-[58px] -rotate-90">
              <circle
                cx="70"
                cy="70"
                r="58"
                stroke="#edf1fa"
                strokeWidth="12"
                fill="none"
              />
              <circle
                cx="70"
                cy="70"
                r="58"
                stroke={tone.color}
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div
              className={`absolute flex h-7 w-7 items-center justify-center rounded-full border border-[#eef2ff] bg-white shadow-sm ${tone.text}`}
            >
              <Coffee size={11} />
            </div>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[0.56rem] font-black ${tone.chip}`}
          >
            {tone.label}
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3 border-t border-[#eef2f8] pt-2">
        <p className={`text-[0.72rem] font-black ${tone.softText}`}>
          Capacidad usada: {displayPercentage}%
        </p>
        <button
          type="button"
          onClick={onAdjust}
          className="text-right text-[0.68rem] font-black text-slate-400 transition hover:text-[#102d92]"
        >
          Ajustar bodega
        </button>
      </div>
    </section>
  );
}
function TypeSummaryCard({
  lot,
  subloteCount,
  onOpen,
}: {
  lot: LoteResumen;
  subloteCount: number;
  onOpen: () => void;
}) {
  const visual = coffeeVisual(lot.tipoCafe);
  const sublotesLabel = pluralLabel(subloteCount, 'sublote', 'sublotes');
  const isProcess = isSecadoProcessLot(lot);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[20px] border border-[#e5e8f2] bg-white p-4 text-left shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] ${visual.bg} ${visual.text}`}
          >
            {visual.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[1.3rem] font-semibold leading-tight text-slate-900">
              {displayCoffeeName(lot.tipoCafe)}
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              {formatNumber(lot.pesoActual)} kg ·{' '}
              {formatShortSacks(lot.pesoActual)} bultos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`whitespace-nowrap rounded-[12px] px-3 py-2 text-[0.78rem] font-semibold ${
              isProcess
                ? 'bg-[#fff2cc] text-[#946200]'
                : 'bg-[#f2f3f7] text-slate-700'
            }`}
          >
            {isProcess ? 'Ver secado' : sublotesLabel}
          </span>
          <ArrowRight size={18} className="text-slate-400" />
        </div>
      </div>
    </button>
  );
}

function QualityLotCard({
  lot,
  onOpen,
}: {
  lot: LoteResumen;
  onOpen: () => void;
}) {
  const lotDays = getLotDays(lot).max;
  const sublotesLabel = pluralLabel(lot.sublotes, 'sublote', 'sublotes');
  const humidity = classifyHumidity(lot.humedadPromedio);
  const visual = coffeeVisual(lot.tipoCafe);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[18px] border border-[#e8ebf4] bg-white px-3 py-3 text-left shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${qualityIconTone(
              lot.tipoCafe,
              lot.calidad,
            )}`}
          >
            {visual.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[1rem] font-black text-slate-900">
              {isSecadoProcessLot(lot)
                ? 'En secado'
                : formatDisplayLabel(lot.calidad)}
            </p>
            <p className="mt-0.5 text-[0.72rem] font-semibold text-slate-500">
              {formatNumber(lot.pesoActual)} kg
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-[0.72rem] font-semibold text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              {lotDays} días
            </p>
            {lot.humedadPromedio !== null ? (
              <p
                className={`mt-1 inline-flex rounded-[10px] px-2 py-1 text-[0.62rem] font-black ${humidity.toneClass}`}
              >
                {formatHumidityWithClassification(lot.humedadPromedio)}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="whitespace-nowrap rounded-[11px] bg-[#f2f3f7] px-2.5 py-2 text-[0.68rem] font-semibold text-slate-700">
            {sublotesLabel}
          </span>
          <ArrowRight size={16} className="text-slate-400" />
        </div>
      </div>
    </button>
  );
}

function SecadoProcessCard({
  session,
  onOpen,
}: {
  session: ReturnType<typeof getActiveSecadoSessions>[number];
  onOpen: () => void;
}) {
  const totalKg = session.sublotes.reduce(
    (sum, sublote) => sum + sublote.pesoActual,
    0,
  );
  const progress = secadoProgress(session.estado);
  const startedAt = new Date(session.startedAt);
  const fecha = Number.isNaN(startedAt.getTime())
    ? 'Hoy'
    : startedAt.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[18px] border border-amber-200 bg-[#fff8e7] p-4 text-left shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.7rem] font-black text-amber-700">
            {secadoStatusLabel(session.estado)}
          </p>
          <p className="mt-1 truncate text-[1.05rem] font-black text-slate-900">
            {formatCoffeeLabel(session.tipoCafe)} -{' '}
            {formatDisplayLabel(session.calidad)}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {formatNumber(totalKg)} kg - desde {fecha}
          </p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-amber-700">
          <CircleDashed size={17} />
        </span>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-[#f6b81a] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[0.58rem] font-black uppercase tracking-[0.08em] text-amber-800/70">
        <span>Inicio</span>
        <span>{progress}%</span>
        <span>Resultado</span>
      </div>
    </button>
  );
}

export default function Inventario() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state ?? null) as {
    preferredTypeKey?: string;
    activeSecadoId?: string;
    completedSecadoId?: string;
  } | null;

  const [lots, setLots] = useState<LoteResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeKey, setTypeKey] = useState('');
  const [sortKey, setSortKey] = useState<'OLDEST' | 'NEWEST'>('OLDEST');
  const [preferredApplied, setPreferredApplied] = useState(false);
  const [bodegaConfig, setBodegaConfig] = useState<{
    nombreBodega: string;
    capacidadKg: number | null;
  }>({
    nombreBodega: 'Bodega principal',
    capacidadKg: null,
  });
  const [modalBodegaAbierto, setModalBodegaAbierto] = useState(false);
  const [nombreBodegaForm, setNombreBodegaForm] = useState('Bodega principal');
  const [capacidadBodegaForm, setCapacidadBodegaForm] = useState('');
  const [guardandoBodega, setGuardandoBodega] = useState(false);
  const [errorBodega, setErrorBodega] = useState<string | null>(null);

  const loadLots = async () => {
    setLoading(true);
    setError(null);

    try {
      const [data, config] = await Promise.all([
        obtenerLotes(),
        obtenerConfiguracionBodega(),
      ]);

      setLots(ENABLE_SECADO_PROTOTYPE ? applySecadoToLots(data) : data);
      setBodegaConfig({
        nombreBodega: config.nombreBodega,
        capacidadKg: config.capacidadKg,
      });
      setNombreBodegaForm(
        sanitizeNombreBodegaInput(config.nombreBodega || 'Bodega principal'),
      );
      setCapacidadBodegaForm(
        config.capacidadKg ? String(config.capacidadKg) : '',
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cargar el inventario.',
      );
      setLots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLots();
  }, []);

  const abrirModalBodega = () => {
    setNombreBodegaForm(
      sanitizeNombreBodegaInput(
        bodegaConfig.nombreBodega || 'Bodega principal',
      ),
    );
    setCapacidadBodegaForm(
      bodegaConfig.capacidadKg ? String(bodegaConfig.capacidadKg) : '',
    );
    setErrorBodega(null);
    setModalBodegaAbierto(true);
  };

  const guardarBodegaLocal = async () => {
    const capacidad = Number(capacidadBodegaForm);

    if (!nombreBodegaForm.trim()) {
      setErrorBodega('Escribe un nombre para la bodega.');
      return;
    }

    if (!Number.isFinite(capacidad) || capacidad <= 0) {
      setErrorBodega('Ingresa una capacidad válida.');
      return;
    }

    if (capacidad < totalKg) {
      setErrorBodega('La capacidad no puede ser menor al café almacenado.');
      return;
    }

    setGuardandoBodega(true);
    setErrorBodega(null);

    try {
      const config = await guardarConfiguracionBodega({
        nombreBodega: sanitizeNombreBodegaInput(nombreBodegaForm).trim(),
        capacidadKg: capacidad,
      });
      setBodegaConfig({
        nombreBodega: config.nombreBodega,
        capacidadKg: config.capacidadKg,
      });
      setModalBodegaAbierto(false);
      void loadLots();
    } catch {
      setErrorBodega('No se pudo guardar la capacidad de bodega.');
    } finally {
      setGuardandoBodega(false);
    }
  };

  const availableTypes = useMemo(() => {
    const map = new Map<string, { key: string; name: string }>();

    for (const lot of lots) {
      const key = keyOf(lot.tipoCafe);
      if (!map.has(key)) {
        map.set(key, { key, name: lot.tipoCafe });
      }
    }

    return [...map.values()].sort((a, b) => {
      const indexA = TYPE_ORDER.indexOf(a.key as (typeof TYPE_ORDER)[number]);
      const indexB = TYPE_ORDER.indexOf(b.key as (typeof TYPE_ORDER)[number]);

      if (indexA !== -1 || indexB !== -1) {
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      }

      return a.name.localeCompare(b.name, 'es');
    });
  }, [lots]);

  useEffect(() => {
    if (availableTypes.length === 0) {
      if (typeKey !== '') setTypeKey('');
      return;
    }

    const preferred = keyOf(locationState?.preferredTypeKey ?? '');

    if (
      !preferredApplied &&
      preferred &&
      availableTypes.some((type) => type.key === preferred)
    ) {
      setTypeKey(preferred);
      setPreferredApplied(true);
      return;
    }

    if (
      typeKey !== '' &&
      !availableTypes.some((type) => type.key === typeKey)
    ) {
      setTypeKey('');
    }
  }, [
    availableTypes,
    locationState?.preferredTypeKey,
    preferredApplied,
    typeKey,
  ]);

  const filteredLots = useMemo(() => {
    if (!typeKey) return [];
    return lots.filter((lot) => keyOf(lot.tipoCafe) === typeKey);
  }, [lots, typeKey]);

  const visibleLots = useMemo(
    () => (typeKey ? filteredLots : lots),
    [filteredLots, lots, typeKey],
  );

  const orderedLots = useMemo(() => {
    const copy = [...visibleLots];
    copy.sort((a, b) => compareLotByAge(a, b, sortKey));
    return copy;
  }, [visibleLots, sortKey]);

  const typeSummaries = useMemo(() => {
    const grouped = new Map<
      string,
      { key: string; name: string; lots: LoteResumen[] }
    >();

    for (const lot of lots) {
      const key = keyOf(lot.tipoCafe);
      const current = grouped.get(key) ?? {
        key,
        name: lot.tipoCafe,
        lots: [],
      };

      current.lots.push(lot);
      grouped.set(key, current);
    }

    const summaries = TYPE_ORDER.flatMap((type) => {
      const current = grouped.get(type);
      if (!current) return [];
      const totalKg = current.lots.reduce(
        (sum, lot) => sum + lot.pesoActual,
        0,
      );
      return [
        {
          key: current.key,
          name: current.name,
          totalKg,
          lots: [...current.lots].sort((a, b) =>
            compareLotByAge(a, b, sortKey),
          ),
        },
      ];
    });

    return summaries.sort((a, b) => {
      const mainA = a.lots[0];
      const mainB = b.lots[0];
      const byAge = mainA && mainB ? compareLotByAge(mainA, mainB, sortKey) : 0;
      if (byAge !== 0) return byAge;
      return a.totalKg - b.totalKg;
    });
  }, [lots, sortKey]);

  const totalKg = useMemo(
    () => lots.reduce((sum, lot) => sum + lot.pesoActual, 0),
    [lots],
  );
  const activeSecadoSessions = useMemo(
    () =>
      ENABLE_SECADO_PROTOTYPE
        ? [...getActiveSecadoSessions()].sort(
            (a, b) =>
              new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
          )
        : [],
    [lots],
  );
  const activeSessionBase = ENABLE_SECADO_PROTOTYPE
    ? getActiveSecadoSession()
    : null;
  const activeSession =
    activeSessionBase && lots.some((lot) => lot.id === activeSessionBase.loteId)
      ? activeSessionBase
      : null;
  const secadoTarget =
    ENABLE_SECADO_PROTOTYPE && typeKey === 'VERDE' && orderedLots.length > 0
      ? orderedLots[0]
      : null;
  const showGlobalEmptyState = !loading && !error && lots.length === 0;

  return (
    <div
      className={`min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] text-slate-900 ${
        showGlobalEmptyState ? 'pb-[112px]' : 'pb-[150px]'
      }`}
    >
      <main
        className={`mx-auto flex w-full max-w-[430px] px-4 py-6 ${
          showGlobalEmptyState
            ? 'max-w-none min-h-[calc(100vh-112px)] px-0 py-0 items-center justify-center'
            : 'flex-col gap-5'
        }`}
      >
        {!showGlobalEmptyState ? (
          <CapacityRing
            totalKg={totalKg}
            capacityKg={bodegaConfig.capacidadKg}
            onAdjust={abrirModalBodega}
          />
        ) : null}

        {!showGlobalEmptyState ? (
          <section className="flex flex-wrap items-center gap-3">
            <div className="w-full max-w-[180px]">
              <select
                value={sortKey}
                onChange={(event) =>
                  setSortKey(event.target.value as 'OLDEST' | 'NEWEST')
                }
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-[#f5f6fb] px-3 py-2.5 text-[1rem] font-semibold text-slate-900 outline-none focus:border-[#102d92]"
              >
                <option value="OLDEST">Más antiguo</option>
                <option value="NEWEST">Más reciente</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {[
                { key: '', label: 'Todos' },
                ...availableTypes.map((type) => ({
                  key: type.key,
                  label: type.name,
                })),
              ].map((item) => {
                const active = item.key === typeKey;
                return (
                  <button
                    key={item.key || 'all'}
                    type="button"
                    onClick={() => {
                      if (item.key === 'EN SECADO') {
                        navigate('/inventario/secados');
                        return;
                      }

                      setTypeKey(item.key);
                    }}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? 'border-[#111827] bg-[#111827] text-white shadow-sm'
                        : 'border-[#d8deea] bg-white text-slate-600'
                    }`}
                  >
                    {displayCoffeeName(item.label)}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {showGlobalEmptyState ? (
          <section className="px-1 pt-4">
            <div className="mx-auto max-w-[360px] rounded-[22px] border border-[#e1e8f3] bg-white px-5 py-6 text-center shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
              <div className="relative mx-auto h-[96px] w-[96px]">
                <div className="absolute inset-0 rotate-3 rounded-[24px] bg-[#f6f8fc]" />
                <div className="absolute inset-[22px] flex items-center justify-center rounded-[16px] bg-[#eef3f8] text-slate-300">
                  <Package2 size={28} />
                </div>
                <div className="absolute -right-1 bottom-2 flex h-10 w-10 rotate-[-9deg] items-center justify-center rounded-[13px] bg-[#ff7a10] text-white shadow-[0_8px_14px_rgba(255,122,16,0.35)]">
                  <Coffee size={17} />
                </div>
              </div>

              <h2 className="mt-4 text-[1.25rem] font-black leading-tight text-[#1f2432]">
                Aún no hay café en inventario
              </h2>
              <p className="mx-auto mt-2 max-w-[260px] text-[0.84rem] font-medium leading-5 text-slate-500">
                Registra tu primera compra para empezar.
              </p>

              <button
                type="button"
                onClick={() => navigate('/compras')}
                className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#2f64db] px-5 text-[0.95rem] font-black text-white shadow-[0_12px_24px_rgba(47,100,219,0.22)]"
              >
                <ShoppingCart size={18} />
                Registrar compra
              </button>
            </div>
          </section>
        ) : null}

        {typeKey === '' && !showGlobalEmptyState ? (
          <section
            className={inventoryListClass(typeSummaries.length, 'space-y-2.5')}
          >
            <div className="grid gap-3">
              {typeSummaries.map((group) => (
                <TypeSummaryCard
                  key={group.key}
                  lot={{
                    ...group.lots[0],
                    tipoCafe: group.name,
                    pesoActual: group.totalKg,
                  }}
                  subloteCount={group.lots.reduce(
                    (sum, lot) => sum + lot.sublotes,
                    0,
                  )}
                  onOpen={() => {
                    if (group.key === 'EN SECADO') {
                      navigate('/inventario/secados');
                      return;
                    }

                    setTypeKey(group.key);
                  }}
                />
              ))}
            </div>
          </section>
        ) : null}

        {typeKey === 'VERDE' && activeSession ? (
          <button
            type="button"
            onClick={() => navigate('/inventario/secados')}
            className="inline-flex w-full items-center justify-center gap-2 text-[0.82rem] font-semibold text-[#647cb8]"
          >
            <CircleDashed size={15} />
            Ver secados activos
            <ArrowRight size={15} />
          </button>
        ) : null}

        {typeKey === 'VERDE' && secadoTarget ? (
          <button
            type="button"
            onClick={() =>
              navigate(
                `/inventario/${secadoTarget.tipoCafeId}/${secadoTarget.calidadId}/secado`,
              )
            }
            translate="no"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-[#102d92] px-5 text-[0.95rem] font-black text-white shadow-[0_12px_24px_rgba(16,45,146,0.16)]"
          >
            <SunMedium size={17} />
            Iniciar secado
          </button>
        ) : null}

        {typeKey === 'EN SECADO' && !showGlobalEmptyState ? (
          <section className={inventoryListClass(activeSecadoSessions.length)}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#f6b81a]" />
                <p className="text-sm font-black text-[#1d2436]">
                  Procesos de secado
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-500">
                {activeSecadoSessions.length} activo
                {activeSecadoSessions.length === 1 ? '' : 's'}
              </p>
            </div>

            {activeSecadoSessions.map((session) => (
              <SecadoProcessCard
                key={session.id}
                session={session}
                onOpen={() =>
                  navigate(
                    `/inventario/secado/${session.id}/finalizar?step=finish`,
                  )
                }
              />
            ))}
          </section>
        ) : null}

        {ENABLE_SECADO_PROTOTYPE && locationState?.completedSecadoId ? (
          <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-700">
            El secado se envió al inventario y ya se refleja como sublote de
            café seco.
          </section>
        ) : null}

        {error ? (
          <section className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            <p className="font-bold">No se pudo cargar el inventario</p>
            <p className="mt-1">Verifica tu conexion e intenta de nuevo.</p>
            <button
              type="button"
              onClick={() => void loadLots()}
              className="mt-3 inline-flex items-center gap-2 font-black text-rose-700"
            >
              <RefreshCcw size={16} />
              Reintentar
            </button>
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-[26px] border border-[#dde4f1] bg-white px-5 py-12 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-500">
              Cargando inventario...
            </p>
          </section>
        ) : null}

        {!loading && !error && typeKey !== '' && visibleLots.length === 0 ? (
          <section className="rounded-[26px] border border-dashed border-[#d8dceb] bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f6fc] text-slate-400">
              <Package2 size={22} />
            </div>
            <p className="mt-4 text-lg text-slate-600">
              Todavía no hay sublotes registrados en este tipo de café.
            </p>
          </section>
        ) : null}

        {!loading &&
        !error &&
        typeKey !== '' &&
        typeKey !== 'EN SECADO' &&
        orderedLots.length > 0 ? (
          <section className={inventoryListClass(orderedLots.length)}>
            {orderedLots.map((lot) => (
              <QualityLotCard
                key={lot.id}
                lot={lot}
                onOpen={() => {
                  if (isSecadoProcessLot(lot)) {
                    navigate('/inventario/secados');
                    return;
                  }

                  navigate(
                    `/inventario/${lot.tipoCafeId}/${lot.calidadId}/sublotes`,
                  );
                }}
              />
            ))}
          </section>
        ) : null}
      </main>

      {modalBodegaAbierto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-5 py-6 backdrop-blur-sm">
          <div className="w-full max-w-[390px] rounded-[22px] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[1.1rem] font-black text-slate-900">
                Capacidad de bodega
              </h2>
              <button
                type="button"
                onClick={() => setModalBodegaAbierto(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-[0.76rem] font-black text-slate-600">
                  Nombre
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={nombreBodegaForm}
                  onChange={(event) => {
                    setNombreBodegaForm(
                      sanitizeNombreBodegaInput(event.target.value),
                    );
                    setErrorBodega(null);
                  }}
                  className="w-full rounded-[14px] border border-[#dde4f1] bg-[#f7f9fd] px-4 py-3 text-[0.92rem] font-semibold text-slate-900 outline-none focus:border-[#102d92]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[0.76rem] font-black text-slate-600">
                  Capacidad max. (kg)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={capacidadBodegaForm}
                  onChange={(event) => {
                    setCapacidadBodegaForm(
                      sanitizeCapacidadInput(event.target.value),
                    );
                    setErrorBodega(null);
                  }}
                  className="w-full rounded-[14px] border border-[#dde4f1] bg-[#f7f9fd] px-4 py-3 text-[0.92rem] font-semibold text-slate-900 outline-none focus:border-[#102d92]"
                  placeholder="600000"
                />
                <p className="mt-1 text-[0.66rem] font-semibold text-slate-400">
                  Máx. 999.999 kg · En bodega: {formatNumber(totalKg)} kg
                </p>
              </div>

              {errorBodega ? (
                <p className="rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-[0.76rem] font-semibold text-rose-600">
                  {errorBodega}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void guardarBodegaLocal()}
                disabled={guardandoBodega}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 text-[0.9rem] font-black text-white disabled:opacity-60"
              >
                <Save size={15} />
                {guardandoBodega ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AppBottomNav />
    </div>
  );
}
