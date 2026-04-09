import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeAlert,
  Clock3,
  Coffee,
  Droplets,
  Leaf,
  Package2,
  RefreshCcw,
  Scale,
  SunMedium,
  Warehouse,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import { obtenerLotes, type LoteResumen } from '../services/lotesService';
import { applySecadoToLots, getActiveSecadoSession } from '../utils/secadoFlow';
import { getBodegaConfig } from '../utils/bodegaConfig';
import { getAverageFactorForLot } from '../utils/factorStorage';

const QUALITY_SECTIONS = [
  {
    key: 'BUENO',
    title: 'CALIDAD: BUENO',
    dot: 'bg-[#74e3dd]',
    stripe: 'bg-[#74e3dd]',
    empty: 'No hay lotes registrados.',
  },
  {
    key: 'REGULAR',
    title: 'CALIDAD: REGULAR',
    dot: 'bg-[#f6b81a]',
    stripe: 'bg-[#f6b81a]',
    empty: 'No hay lotes registrados.',
  },
  {
    key: 'MALO',
    title: 'CALIDAD: MALO',
    dot: 'bg-[#d82433]',
    stripe: 'bg-[#d82433]',
    empty: 'No hay lotes registrados.',
  },
] as const;

const TYPE_ORDER = ['VERDE', 'SECO', 'TRILLADO', 'PASILLA'] as const;

function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
}

function formatHumidity(value: number | null) {
  if (value === null) return 'Sin dato';
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatFactor(value: number | null) {
  if (value === null) return 'Sin dato';
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function lotState(lot: LoteResumen) {
  if (lot.humedadPromedio === null || lot.sublotesConHumedad === 0) {
    return {
      label: 'PENDIENTE',
      badge: 'bg-[#fff3cf] text-[#8c5a00]',
    };
  }

  if (lot.humedadPromedio > 13.5 || lot.diasEnBodegaMax > 25) {
    return {
      label: 'CRÍTICO',
      badge: 'bg-[#ffe3e7] text-[#b42333]',
    };
  }

  if (lot.humedadPromedio > 12 || lot.diasEnBodegaMax > 15) {
    return {
      label: 'ATENCIÓN',
      badge: 'bg-[#fff3cf] text-[#8c5a00]',
    };
  }

  return {
    label: 'ÓPTIMO',
    badge: 'bg-[#e6fbfa] text-[#0f6e6a]',
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

function CapacityRing({
  totalKg,
  capacityKg,
  breakdown,
  onConfigure,
}: {
  totalKg: number;
  capacityKg: number;
  breakdown: Array<{ key: string; name: string; totalKg: number; color: string }>;
  onConfigure?: () => void;
}) {
  const safeCapacity = Math.max(1, capacityKg);
  const rawPercentage = Math.max(0, (totalKg / safeCapacity) * 100);
  const displayPercentage =
    rawPercentage === 0
      ? '0'
      : rawPercentage < 1
        ? rawPercentage.toFixed(1)
        : rawPercentage.toFixed(0);
  const ringPercentage = totalKg > 0 ? Math.max(1.5, Math.min(100, rawPercentage)) : 0;
  const circumference = 2 * Math.PI * 58;
  const offset = circumference - (ringPercentage / 100) * circumference;

  return (
    <section className="rounded-[24px] border border-[#e6e8f3] bg-white p-3.5 shadow-sm">
      <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
        Resumen de stock total
      </p>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-[2.2rem] font-black leading-none text-[#102d92]">
          {formatNumber(totalKg)}
        </p>
        <span className="pb-1 text-[1.2rem] font-semibold text-slate-400">
          / {formatNumber(safeCapacity)} kg
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">Capacidad usada: {displayPercentage}%</p>

      <div className="mt-2 flex items-center justify-between gap-2.5">
        <div className="flex-1">
          <div className="flex flex-wrap gap-3">
            {breakdown.map((item) => (
              <div key={item.key} className="flex items-center gap-2 text-xs text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.name}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Puedes ajustar la capacidad en Ajustes.
          </p>
          {onConfigure ? (
            <button
              type="button"
              onClick={onConfigure}
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#d6e2ff] bg-[#eef3ff] px-3 py-1.5 text-xs font-black text-[#102d92]"
            >
              <Warehouse size={13} />
              Configurar bodega
            </button>
          ) : null}
        </div>

        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
          <svg viewBox="0 0 140 140" className="h-24 w-24 -rotate-90">
            <circle cx="70" cy="70" r="58" stroke="#edf1fa" strokeWidth="12" fill="none" />
            <circle
              cx="70"
              cy="70"
              r="58"
              stroke="#102d92"
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute flex h-12 w-12 items-center justify-center rounded-full border border-[#eef2ff] bg-white text-[#102d92] shadow-sm">
            <Coffee size={16} />
          </div>
        </div>
      </div>
    </section>
  );
}

function LotCard({
  lot,
  stripe,
  onOpen,
  factorPromedio,
}: {
  lot: LoteResumen;
  stripe: string;
  onOpen: () => void;
  factorPromedio: number | null;
}) {
  const state = lotState(lot);
  const showFactor = keyOf(lot.tipoCafe) === 'SECO' && keyOf(lot.calidad) === 'BUENO';

  return (
    <article className="relative overflow-hidden rounded-[24px] border border-[#e4e8f2] bg-[#f8f8ff] p-4 shadow-sm">
      <div className={`absolute left-0 top-0 h-full w-2 ${stripe}`} />
      <div className="pl-2.5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[1.35rem] font-black leading-tight text-[#102d92]">
              Café {lot.tipoCafe}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{lot.sublotes} sublotes registrados</p>
          </div>
          <div className="text-right">
            <span
              className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black tracking-[0.12em] ${state.badge}`}
            >
              {state.label}
            </span>
            <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
              <Clock3 size={12} />
              Días {lot.diasEnBodegaMax}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Peso total
            </p>
            <p className="mt-1 text-[1.45rem] font-black leading-none text-slate-900">
              {formatNumber(lot.pesoActual)} kg
            </p>
          </div>
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              <Droplets size={12} />
              Humedad prom
            </p>
            <p className="mt-1 text-[1.45rem] font-black leading-none text-slate-900">
              {formatHumidity(lot.humedadPromedio)}
            </p>
            <button
              type="button"
              onClick={onOpen}
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#e8eeff] px-2.5 py-1 text-[11px] font-black text-[#102d92]"
            >
              <Droplets size={12} />
              Editar
            </button>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              {showFactor ? 'Factor prom' : 'Humedad cargada'}
            </p>
            <p className="mt-1 text-lg font-black leading-none text-slate-900">
              {showFactor ? formatFactor(factorPromedio) : lot.sublotesConHumedad}
            </p>
          </div>
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              {showFactor ? <Scale size={12} /> : <Clock3 size={12} />}
              {showFactor ? 'Factor' : 'Días bodega'}
            </p>
            <p className="mt-1 text-lg font-black leading-none text-slate-900">
              {showFactor ? formatFactor(factorPromedio) : `${lot.diasEnBodegaMax} días`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#102d92] px-4 py-3 text-base font-black text-white shadow-[0_16px_34px_rgba(16,45,146,0.16)]"
        >
          Ver sublotes
          <ArrowRight size={16} />
        </button>
      </div>
    </article>
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
  const [bodegaConfig, setBodegaConfig] = useState(() => getBodegaConfig());

  const loadLots = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await obtenerLotes();
      setLots(applySecadoToLots(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el inventario.');
      setLots(applySecadoToLots([]));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLots();
  }, []);

  useEffect(() => {
    setBodegaConfig(getBodegaConfig());
  }, [location.key]);

  const activeSession = getActiveSecadoSession();

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

    if (!typeKey || !availableTypes.some((type) => type.key === typeKey)) {
      setTypeKey(availableTypes[0].key);
    }
  }, [availableTypes, locationState?.preferredTypeKey, preferredApplied, typeKey]);

  const filteredLots = useMemo(() => {
    if (!typeKey) return [];
    return lots.filter((lot) => keyOf(lot.tipoCafe) === typeKey);
  }, [lots, typeKey]);

  const orderedLots = useMemo(() => {
    const copy = [...filteredLots];
    copy.sort((a, b) => {
      if (sortKey === 'OLDEST') {
        if (b.diasEnBodegaMax !== a.diasEnBodegaMax) return b.diasEnBodegaMax - a.diasEnBodegaMax;
        return b.pesoActual - a.pesoActual;
      }

      if (a.diasEnBodegaMin !== b.diasEnBodegaMin) return a.diasEnBodegaMin - b.diasEnBodegaMin;
      return a.pesoActual - b.pesoActual;
    });
    return copy;
  }, [filteredLots, sortKey]);

  const typeBreakdown = useMemo(() => {
    const grouped = new Map<string, { key: string; name: string; totalKg: number; color: string }>();

    for (const lot of lots) {
      const key = keyOf(lot.tipoCafe);
      const current =
        grouped.get(key) ??
        {
          key,
          name: lot.tipoCafe,
          totalKg: 0,
          color: coffeeVisual(lot.tipoCafe).ring,
        };

      current.totalKg += lot.pesoActual;
      grouped.set(key, current);
    }

    return [...grouped.values()].filter((item) => item.totalKg > 0);
  }, [lots]);

  const sections = useMemo(
    () =>
      QUALITY_SECTIONS.map((section) => ({
        ...section,
        lots: orderedLots.filter((lot) => keyOf(lot.calidad) === section.key),
      })),
    [orderedLots],
  );

  const totalKg = useMemo(() => lots.reduce((sum, lot) => sum + lot.pesoActual, 0), [lots]);
  const secadoTarget = typeKey === 'VERDE' && orderedLots.length > 0 ? orderedLots[0] : null;
  const factorPromedioPorLote = useMemo(
    () =>
      Object.fromEntries(lots.map((lot) => [lot.id, getAverageFactorForLot(lot.id)])) as Record<
        string,
        number | null
      >,
    [lots],
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] pb-[150px] text-slate-900">
      <header className="border-b border-white/80 bg-[rgba(247,245,255,0.92)] px-4 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-[18px] bg-[#eef2ff] p-3 text-[#102d92] shadow-sm">
              <Warehouse size={20} />
            </div>
            <div>
              <p className="text-[1.35rem] font-black leading-tight text-[#111827]">Inventario</p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Bodega y sublotes
              </p>
            </div>
          </div>
          <CloudStatusBadge compact className="max-w-[220px]" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[520px] flex-col gap-5 px-4 py-6">
        <CapacityRing
          totalKg={totalKg}
          capacityKg={bodegaConfig.capacidadKg}
          breakdown={typeBreakdown}
          onConfigure={() => navigate('/ajustes')}
        />

        {availableTypes.length > 0 ? (
          <section>
            <p className="mb-4 text-[1.35rem] font-black text-[#102d92]">Acceso Directo por Tipo</p>
            <div className="grid grid-cols-3 gap-3">
              {availableTypes.map((type) => {
                const visual = coffeeVisual(type.name);
                const active = type.key === typeKey;

                return (
                  <button
                    key={type.key}
                    type="button"
                    onClick={() => setTypeKey(type.key)}
                    className={`rounded-[22px] border p-4 shadow-sm ${
                      active ? 'border-[#102d92] bg-white' : 'border-[#e6e8f3] bg-white/80'
                    }`}
                  >
                    <div
                      className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${visual.bg} ${visual.text}`}
                    >
                      {visual.icon}
                    </div>
                    <p className="mt-3 text-sm font-black text-slate-800">{type.name}</p>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
          <div>
            <label className="mb-2 block text-sm font-black uppercase tracking-[0.18em] text-slate-400">
              Tipo de café
            </label>
            <select
              value={typeKey}
              onChange={(event) => setTypeKey(event.target.value)}
              className="w-full rounded-[20px] border border-[#dfe5f2] bg-white px-4 py-4 text-[1.05rem] font-semibold text-slate-900 outline-none focus:border-[#102d92]"
            >
              {availableTypes.length === 0 ? <option value="">Sin stock</option> : null}
              {availableTypes.map((type) => (
                <option key={type.key} value={type.key}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black uppercase tracking-[0.18em] text-slate-400">
              Ordenar
            </label>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as 'OLDEST' | 'NEWEST')}
              className="w-full rounded-[20px] border border-[#dfe5f2] bg-[#f5f6fb] px-4 py-4 text-[1.05rem] font-semibold text-slate-900 outline-none focus:border-[#102d92]"
            >
              <option value="OLDEST">Más viejo</option>
              <option value="NEWEST">Más nuevo</option>
            </select>
          </div>
        </section>

        {typeKey === 'VERDE' && activeSession ? (
          <section className="rounded-[28px] border border-[#cdeef1] bg-[#dff8fb] p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#0f6b6d]">
              Monitoreo activo
            </p>
            <h2 className="mt-4 text-[1.9rem] font-black leading-tight text-[#102d92]">
              Lote en proceso de secado
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] bg-white/70 px-4 py-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Lote
                </p>
                <p className="mt-2 text-xl font-black text-slate-900">{activeSession.loteCodigo}</p>
              </div>
              <div className="rounded-[20px] bg-white/70 px-4 py-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Sublotes seleccionados
                </p>
                <p className="mt-2 text-xl font-black text-slate-900">
                  {activeSession.sublotes.length}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/inventario/secado/${activeSession.id}/finalizar`)}
              className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-[20px] bg-[#102d92] px-5 py-4 text-lg font-black text-white"
            >
              Finalizar secado
            </button>
          </section>
        ) : null}

        {typeKey === 'VERDE' && !activeSession && secadoTarget ? (
          <button
            type="button"
            onClick={() => navigate(`/inventario/${secadoTarget.tipoCafeId}/${secadoTarget.calidadId}/secado`)}
            className="inline-flex w-full items-center justify-center gap-3 rounded-[20px] bg-[#102d92] px-5 py-4 text-lg font-black text-white shadow-[0_18px_38px_rgba(16,45,146,0.18)]"
          >
            <SunMedium size={20} />
            Iniciar secado
          </button>
        ) : null}

        {locationState?.completedSecadoId ? (
          <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-700">
            El secado se envió al inventario y ya se refleja como sublote de café seco.
          </section>
        ) : null}

        {error ? (
          <section className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            No pude cargar el inventario. {error}
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

        {!loading && !error && availableTypes.length === 0 ? (
          <section className="rounded-[26px] border border-dashed border-[#d8dceb] bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f6fc] text-slate-400">
              <Package2 size={22} />
            </div>
            <p className="mt-4 text-lg text-slate-600">Todavía no hay lotes registrados.</p>
          </section>
        ) : null}

        {!loading && !error && availableTypes.length > 0
          ? sections.map((section) => (
              <section key={section.key} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full ${section.dot}`} />
                    <p className="text-sm font-black uppercase tracking-[0.22em] text-[#1d2436]">
                      {section.title}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-500">
                    {section.lots.length} Lote{section.lots.length === 1 ? '' : 's'}
                  </p>
                </div>

                {section.lots.length > 0 ? (
                  <div className="space-y-4">
                    {section.lots.map((lot) => (
                      <LotCard
                        key={lot.id}
                        lot={lot}
                        stripe={section.stripe}
                        factorPromedio={factorPromedioPorLote[lot.id] ?? null}
                        onOpen={() => navigate(`/inventario/${lot.tipoCafeId}/${lot.calidadId}/sublotes`)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[26px] border border-dashed border-[#d8dceb] bg-white px-6 py-10 text-center shadow-sm">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f6fc] text-slate-400">
                      <Package2 size={22} />
                    </div>
                    <p className="mt-4 text-lg text-slate-600">{section.empty}</p>
                  </div>
                )}
              </section>
            ))
          : null}
      </main>

      <AppBottomNav />
    </div>
  );
}
