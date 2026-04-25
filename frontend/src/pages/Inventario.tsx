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
import { applySecadoToLots, getActiveSecadoSession } from '../utils/secadoFlow';
import { getDaysInBodega } from '../utils/date';

const TYPE_ORDER = ['VERDE', 'SECO', 'TRILLADO', 'PASILLA'] as const;
const BULTO_KG = 40.7;
const QUALITY_SECTIONS = [
  { key: 'BUENO', title: 'BUENO', dot: 'bg-[#74e3dd]' },
  { key: 'REGULAR', title: 'REGULAR', dot: 'bg-[#f6b81a]' },
  { key: 'MALO', title: 'MALO', dot: 'bg-[#d82433]' },
] as const;

function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
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
}: {
  totalKg: number;
  capacityKg: number;
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
    <section className="rounded-[20px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
      <p className="text-[0.95rem] font-extrabold text-black" style={{ fontWeight: 900 }}>
        Resumen de Inventario
      </p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-end gap-2">
            <p className="text-[2.1rem] font-extrabold leading-none text-[#102d92]" style={{ fontWeight: 900 }}>
              {formatNumber(totalKg)}
            </p>
            <span className="pb-0.5 text-[1.2rem] font-bold text-slate-400" style={{ fontWeight: 900 }}>
              / {formatNumber(safeCapacity)} kg
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-600" style={{ fontWeight: 700 }}>
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

function TypeSummaryCard({
  lot,
  onOpen,
}: {
  lot: LoteResumen;
  onOpen: () => void;
}) {
  const visual = coffeeVisual(lot.tipoCafe);
  const totalSublotesLabel = `${lot.sublotes} SUBLOTE${lot.sublotes === 1 ? '' : 'S'}`;

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
            <p className="truncate text-[1.45rem] font-semibold leading-tight text-slate-900">{lot.tipoCafe.toLowerCase()}</p>
            <p className="mt-0.5 text-sm text-slate-500">
              {formatNumber(lot.pesoActual)} kg · {formatShortSacks(lot.pesoActual)} bultos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-[12px] bg-[#f2f3f7] px-4 py-2 text-sm font-semibold text-slate-700">
            {totalSublotesLabel}
          </span>
          <ArrowRight size={18} className="text-slate-400" />
        </div>
      </div>
    </button>
  );
}

function QualityLotCard({ lot, onOpen }: { lot: LoteResumen; onOpen: () => void }) {
  const lotDays = getLotDays(lot).max;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[18px] border border-[#e8ebf4] bg-white p-4 text-left shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[1.05rem] font-semibold text-slate-900">{lot.codigo}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {formatNumber(lot.pesoActual)} kg
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            {lotDays} días
          </p>
        </div>
        <ArrowRight size={18} className="text-slate-400" />
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
  const [bodegaConfig, setBodegaConfig] = useState<{ nombreBodega: string; capacidadKg: number }>({
    nombreBodega: 'Bodega principal',
    capacidadKg: 3000,
  });

  const loadLots = async () => {
    setLoading(true);
    setError(null);

    try {
      const [data, config] = await Promise.all([
        obtenerLotes(),
        obtenerConfiguracionBodega(),
      ]);
      setLots(applySecadoToLots(data));
      setBodegaConfig({
        nombreBodega: config.nombreBodega,
        capacidadKg: config.capacidadKg,
      });
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
      const totalSublotes = current.lots.reduce((sum, lot) => sum + lot.sublotes, 0);
      return [
        {
          key: current.key,
          name: current.name,
          totalKg,
          totalSublotes,
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
  const secadoTarget = typeKey === 'VERDE' && orderedLots.length > 0 ? orderedLots[0] : null;
  const showGlobalEmptyState = !loading && !error && lots.length === 0;
  const secadoProcessPath =
    typeKey === 'VERDE'
      ? activeSession
        ? `/inventario/secado/${activeSession.id}/finalizar`
        : secadoTarget
          ? `/inventario/${secadoTarget.tipoCafeId}/${secadoTarget.calidadId}/secado`
          : null
      : null;

  return (
    <div
      className={`min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] text-slate-900 ${
        showGlobalEmptyState ? 'pb-[112px]' : 'pb-[150px]'
      }`}
    >
      <main
        className={`mx-auto flex w-full max-w-[520px] px-4 py-6 ${
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
                    onClick={() => setTypeKey(item.key)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? 'border-[#111827] bg-[#111827] text-white shadow-sm'
                        : 'border-[#d8deea] bg-white text-slate-600'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {showGlobalEmptyState ? (
          <section className="w-full min-h-[calc(100vh-112px)] bg-white px-5 py-8 text-center">
            <div className="mx-auto flex min-h-[calc(100vh-176px)] w-full max-w-[520px] flex-col items-center justify-center">
              <div className="relative h-[210px] w-[210px]">
                <div className="absolute inset-0 rotate-3 rounded-[30px] bg-[#f9f9fb] shadow-[0_28px_42px_rgba(35,39,75,0.1)]" />
                <div className="absolute inset-[44px] flex items-center justify-center rounded-[20px] bg-[#f2f2f4] text-slate-300">
                  <Package2 size={46} />
                </div>
                <div className="absolute -right-2 bottom-4 flex h-16 w-16 rotate-[-9deg] items-center justify-center rounded-[18px] bg-[#ff7a10] text-white shadow-[0_10px_18px_rgba(255,122,16,0.45)]">
                  <Coffee size={24} />
                </div>
              </div>

              <h2 className="mt-2 text-[2.05rem] font-black leading-tight text-[#1f2432]">
                Aún no tienes café en inventario
              </h2>
              <p className="mt-3 text-[1.02rem] font-medium leading-relaxed text-slate-500">
                Registra tu primera compra para empezar a ver tu café.
              </p>

              <button
                type="button"
                onClick={() => navigate('/compras')}
                className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-[16px] bg-[#2f64db] px-5 py-4 text-[1.75rem] font-semibold text-white shadow-[0_14px_30px_rgba(47,100,219,0.3)]"
              >
                <ShoppingCart size={24} />
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
                    sublotes: group.totalSublotes,
                  }}
                  onOpen={() => setTypeKey(group.key)}
                />
              ))}
            </div>
          </section>
        ) : null}

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

        {secadoProcessPath ? (
          <button
            type="button"
            onClick={() => navigate(secadoProcessPath)}
            className="inline-flex w-full items-center justify-center gap-2 text-[1.05rem] font-semibold text-[#647cb8]"
          >
            <CircleDashed size={18} />
            Ver procesos de secado
            <ArrowRight size={18} />
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

        {!loading && !error && typeKey !== '' && visibleLots.length === 0 ? (
          <section className="rounded-[26px] border border-dashed border-[#d8dceb] bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f6fc] text-slate-400">
              <Package2 size={22} />
            </div>
            <p className="mt-4 text-lg text-slate-600">Todavía no hay lotes registrados en este tipo de café.</p>
          </section>
        ) : null}

        {!loading && !error && typeKey !== '' && orderedLots.length > 0
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
                        {section.lots.length} lote{section.lots.length === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {section.lots.map((lot) => (
                        <QualityLotCard
                          key={lot.id}
                          lot={lot}
                          onOpen={() => navigate(`/inventario/${lot.tipoCafeId}/${lot.calidadId}/sublotes`)}
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
