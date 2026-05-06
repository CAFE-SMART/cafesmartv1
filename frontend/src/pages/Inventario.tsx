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
  ShoppingCart,
  SunMedium,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { obtenerLotes, type LoteResumen } from '../services/lotesService';
import { obtenerConfiguracionBodega } from '../services/bodegaApi';
import { applySecadoToLots, getActiveSecadoSession, getActiveSecadoSessions } from '../utils/secadoFlow';
import { getDaysInBodega } from '../utils/date';
import { ENABLE_SECADO_PROTOTYPE } from '../config/features';

const TYPE_ORDER = ['VERDE', 'EN SECADO', 'SECO', 'TRILLADO', 'PASILLA'] as const;
const BULTO_KG = 40.7;
const QUALITY_SECTIONS = [
  { key: 'BUENO', title: 'BUENO', dot: 'bg-[#74e3dd]' },
  { key: 'REGULAR', title: 'REGULAR', dot: 'bg-[#f6b81a]' },
  { key: 'MALO', title: 'MALO', dot: 'bg-[#d82433]' },
] as const;

const OPERATIONAL_CACHE_KEYS = [
  'cafesmart-secado-flow-v1',
  'cafesmart-sublote-detail-cache-v1',
  'cafesmart-sublote-humedad-queue-v1',
  'cafesmart-sublote-factor-queue-v1',
  'cafesmart-sublote-peso-queue-v1',
];

function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
}

function formatKg(value: number) {
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
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
  const key = keyOf(value);
  if (key === 'EN SECADO') return 'En secado';
  return value.toLowerCase();
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

function clearOperationalLocalCache() {
  if (typeof window === 'undefined') return;
  OPERATIONAL_CACHE_KEYS.forEach((key) => window.localStorage.removeItem(key));
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
}: {
  totalKg: number;
  capacityKg: number | null;
}) {
  if (!capacityKg) {
    return (
      <section className="rounded-[20px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
        <p className="text-[0.95rem] font-extrabold text-black" style={{ fontWeight: 900 }}>
          Resumen de Inventario
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-[2.1rem] font-extrabold leading-none text-[#102d92]" style={{ fontWeight: 900 }}>
              {formatNumber(totalKg)} kg
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-600" style={{ fontWeight: 700 }}>
              Capacidad de bodega sin configurar
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#eef2ff] bg-white text-[#102d92] shadow-sm">
            <Coffee size={18} />
          </div>
        </div>
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
  const ringPercentage = totalKg > 0 ? Math.max(1.5, Math.min(100, rawPercentage)) : 0;
  const isCapacityExceeded = rawPercentage > 100;
  const accentColor = isCapacityExceeded ? '#d92d20' : '#102d92';
  const accentTextClass = isCapacityExceeded ? 'text-[#b42318]' : 'text-[#102d92]';
  const circumference = 2 * Math.PI * 58;
  const offset = circumference - (ringPercentage / 100) * circumference;

  return (
    <section className="rounded-[20px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
      <p className="text-[0.95rem] font-extrabold text-black" style={{ fontWeight: 900 }}>
        Resumen de Inventario
      </p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-end gap-2">
            <p className={`text-[2.1rem] font-extrabold leading-none ${accentTextClass}`} style={{ fontWeight: 900 }}>
              {formatNumber(totalKg)}
            </p>
            <span className="pb-0.5 text-[1.2rem] font-bold text-slate-400" style={{ fontWeight: 900 }}>
              / {formatNumber(safeCapacity)} kg
            </span>
          </div>
          <p className={`mt-1 text-sm font-semibold ${isCapacityExceeded ? 'text-[#b42318]' : 'text-slate-600'}`} style={{ fontWeight: 700 }}>
            Capacidad usada: {displayPercentage}%
          </p>
        </div>

        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center self-start">
          <svg viewBox="0 0 140 140" className="h-24 w-24 -rotate-90">
            <circle cx="70" cy="70" r="58" stroke="#edf1fa" strokeWidth="12" fill="none" />
            <circle
              cx="70"
              cy="70"
              r="58"
              stroke={accentColor}
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className={`absolute flex h-12 w-12 items-center justify-center rounded-full border border-[#eef2ff] bg-white shadow-sm ${accentTextClass}`}>
            <Coffee size={16} />
          </div>
        </div>
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
          <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] ${visual.bg} ${visual.text}`}>
            {visual.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[1.45rem] font-semibold leading-tight text-slate-900">{displayCoffeeName(lot.tipoCafe)}</p>
            <p className="mt-0.5 text-sm text-slate-500">
              {formatNumber(lot.pesoActual)} kg · {formatShortSacks(lot.pesoActual)} bultos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`rounded-[12px] px-4 py-2 text-sm font-semibold ${
            isProcess ? 'bg-[#fff2cc] text-[#946200]' : 'bg-[#f2f3f7] text-slate-700'
          }`}>
            {isProcess ? 'Ver secado' : sublotesLabel}
          </span>
          <ArrowRight size={18} className="text-slate-400" />
        </div>
      </div>
    </button>
  );
}

function QualityLotCard({ lot, onOpen }: { lot: LoteResumen; onOpen: () => void }) {
  const lotDays = getLotDays(lot).max;
  const sublotesLabel = pluralLabel(lot.sublotes, 'sublote', 'sublotes');

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[18px] border border-[#e8ebf4] bg-white p-4 text-left shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[1.05rem] font-semibold text-slate-900">
            {isSecadoProcessLot(lot) ? 'En proceso de secado' : 'Sublotes disponibles'}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            {formatNumber(lot.pesoActual)} kg
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            {lotDays} días
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-[12px] bg-[#f2f3f7] px-3 py-2 text-xs font-semibold text-slate-700">
            {sublotesLabel}
          </span>
          <ArrowRight size={18} className="text-slate-400" />
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
  const totalKg = session.sublotes.reduce((sum, sublote) => sum + sublote.pesoActual, 0);
  const progress = secadoProgress(session.estado);
  const startedAt = new Date(session.startedAt);
  const fecha = Number.isNaN(startedAt.getTime())
    ? 'Hoy'
    : startedAt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[18px] border border-amber-200 bg-[#fff8e7] p-4 text-left shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-amber-700">
            {secadoStatusLabel(session.estado)}
          </p>
          <p className="mt-1 truncate text-[1.05rem] font-black text-slate-900">
            {session.tipoCafe} - {session.calidad}
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
  const locationState = (location.state ?? null) as
    | {
        preferredTypeKey?: string;
        activeSecadoId?: string;
        completedSecadoId?: string;
      }
    | null;

  const [lots, setLots] = useState<LoteResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeKey, setTypeKey] = useState('');
  const [sortKey, setSortKey] = useState<'OLDEST' | 'NEWEST'>('OLDEST');
  const [preferredApplied, setPreferredApplied] = useState(false);
  const [bodegaConfig, setBodegaConfig] = useState<{ nombreBodega: string; capacidadKg: number | null }>({
    nombreBodega: 'Bodega principal',
    capacidadKg: null,
  });

  const loadLots = async () => {
    setLoading(true);
    setError(null);

    try {
      const [data, config] = await Promise.all([
        obtenerLotes(),
        obtenerConfiguracionBodega(),
      ]);

      if (data.length === 0) {
        clearOperationalLocalCache();
      }

      setLots(ENABLE_SECADO_PROTOTYPE ? applySecadoToLots(data) : data);
      setBodegaConfig({
        nombreBodega: config.nombreBodega,
        capacidadKg: config.capacidadKg,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el inventario.');
      setLots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLots();
  }, []);

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

    if (!preferredApplied && preferred && availableTypes.some((type) => type.key === preferred)) {
      setTypeKey(preferred);
      setPreferredApplied(true);
      return;
    }

    if (typeKey !== '' && !availableTypes.some((type) => type.key === typeKey)) {
      setTypeKey('');
    }
  }, [availableTypes, locationState?.preferredTypeKey, preferredApplied, typeKey]);

  const filteredLots = useMemo(() => {
    if (!typeKey) return [];
    return lots.filter((lot) => keyOf(lot.tipoCafe) === typeKey);
  }, [lots, typeKey]);

  const visibleLots = useMemo(() => (typeKey ? filteredLots : lots), [filteredLots, lots, typeKey]);

  const orderedLots = useMemo(() => {
    const copy = [...visibleLots];
    copy.sort((a, b) => {
      const daysA = getLotDays(a);
      const daysB = getLotDays(b);

      if (sortKey === 'OLDEST') {
        if (daysB.max !== daysA.max) return daysB.max - daysA.max;
        return b.pesoActual - a.pesoActual;
      }

      if (daysA.min !== daysB.min) return daysA.min - daysB.min;
      return a.pesoActual - b.pesoActual;
    });
    return copy;
  }, [visibleLots, sortKey]);

  const typeSummaries = useMemo(() => {
    const grouped = new Map<string, { key: string; name: string; lots: LoteResumen[] }>();

    for (const lot of lots) {
      const key = keyOf(lot.tipoCafe);
      const current =
        grouped.get(key) ?? {
          key,
          name: lot.tipoCafe,
          lots: [],
        };

      current.lots.push(lot);
      grouped.set(key, current);
    }

    return TYPE_ORDER.flatMap((type) => {
      const current = grouped.get(type);
      if (!current) return [];
      const totalKg = current.lots.reduce((sum, lot) => sum + lot.pesoActual, 0);
      return [
        {
          key: current.key,
          name: current.name,
          totalKg,
          lots: current.lots,
        },
      ];
    });
  }, [lots]);

  const qualitySections = useMemo(
    () =>
      QUALITY_SECTIONS.map((section) => ({
        ...section,
        lots: orderedLots.filter((lot) => keyOf(lot.calidad) === section.key),
      })),
    [orderedLots],
  );

  const totalKg = useMemo(() => lots.reduce((sum, lot) => sum + lot.pesoActual, 0), [lots]);
  const activeSecadoSessions = useMemo(
    () =>
      ENABLE_SECADO_PROTOTYPE
        ? [...getActiveSecadoSessions()].sort(
            (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
          )
        : [],
    [lots],
  );
  const activeSessionBase = ENABLE_SECADO_PROTOTYPE ? getActiveSecadoSession() : null;
  const activeSession =
    activeSessionBase && lots.some((lot) => lot.id === activeSessionBase.loteId)
      ? activeSessionBase
      : null;
  const secadoTarget = ENABLE_SECADO_PROTOTYPE && typeKey === 'VERDE' && orderedLots.length > 0 ? orderedLots[0] : null;
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
          />
        ) : null}

        {!showGlobalEmptyState ? (
          <section className="flex flex-wrap items-center gap-3">
            <div className="w-full max-w-[180px]">
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as 'OLDEST' | 'NEWEST')}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-[#f5f6fb] px-3 py-2.5 text-[1rem] font-semibold text-slate-900 outline-none focus:border-[#102d92]"
              >
                <option value="OLDEST">Más antiguo</option>
                <option value="NEWEST">Más reciente</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {[
                { key: '', label: 'Todos' },
                ...availableTypes.map((type) => ({ key: type.key, label: type.name })),
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
                    {item.key === 'EN SECADO' ? 'En secado' : item.label}
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
          <section className="space-y-3">
            <div className="grid gap-3">
              {typeSummaries.map((group) => (
                <TypeSummaryCard
                  key={group.key}
                  lot={{
                    ...group.lots[0],
                    tipoCafe: group.name,
                    pesoActual: group.totalKg,
                  }}
                  subloteCount={group.lots.reduce((sum, lot) => sum + lot.sublotes, 0)}
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
            onClick={() => navigate(`/inventario/${secadoTarget.tipoCafeId}/${secadoTarget.calidadId}/secado`)}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-[#102d92] px-5 text-[0.95rem] font-black text-white shadow-[0_12px_24px_rgba(16,45,146,0.16)]"
          >
            <SunMedium size={17} />
            Iniciar secado
          </button>
        ) : null}

        {typeKey === 'EN SECADO' && !showGlobalEmptyState ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#f6b81a]" />
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#1d2436]">Procesos de secado</p>
              </div>
              <p className="text-sm font-semibold text-slate-500">
                {activeSecadoSessions.length} activo{activeSecadoSessions.length === 1 ? '' : 's'}
              </p>
            </div>

            {activeSecadoSessions.map((session) => (
              <SecadoProcessCard
                key={session.id}
                session={session}
                onOpen={() => navigate(`/inventario/secado/${session.id}/finalizar?step=finish`)}
              />
            ))}
          </section>
        ) : null}

        {ENABLE_SECADO_PROTOTYPE && locationState?.completedSecadoId ? (
          <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-700">
            El secado se envió al inventario y ya se refleja como sublote de café seco.
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
            <p className="text-lg font-semibold text-slate-500">Cargando inventario...</p>
          </section>
        ) : null}

        {!loading && !error && typeKey !== '' && visibleLots.length === 0 ? (
          <section className="rounded-[26px] border border-dashed border-[#d8dceb] bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f6fc] text-slate-400">
              <Package2 size={22} />
            </div>
            <p className="mt-4 text-lg text-slate-600">Todavia no hay sublotes registrados en este tipo de cafe.</p>
          </section>
        ) : null}

        {!loading && !error && typeKey !== '' && typeKey !== 'EN SECADO' && orderedLots.length > 0
          ? (
              <section className="space-y-4">
                {qualitySections
                  .filter((section) => section.lots.length > 0)
                  .map((section) => (
                  <section key={section.key} className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${section.dot}`} />
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-[#1d2436]">{section.title}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-500">
                        {pluralLabel(
                          section.lots.reduce((sum, lot) => sum + lot.sublotes, 0),
                          'sublote',
                          'sublotes',
                        )}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {section.lots.map((lot) => (
                        <QualityLotCard
                          key={lot.id}
                          lot={lot}
                          onOpen={() => {
                            if (isSecadoProcessLot(lot)) {
                              navigate('/inventario/secados');
                              return;
                            }

                            navigate(`/inventario/${lot.tipoCafeId}/${lot.calidadId}/sublotes`);
                          }}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </section>
            )
          : null}
      </main>

      <AppBottomNav />
    </div>
  );
}
