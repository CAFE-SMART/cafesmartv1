import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Box,
  Coffee,
  House,
  Leaf,
  RefreshCcw,
  Settings,
  ShoppingCart,
  SunMedium,
  Warehouse,
} from 'lucide-react';
import { obtenerLotes, type LoteResumen } from '../services/lotesService';
import { applySecadoToLots, getActiveSecadoSession } from '../utils/secadoFlow';
import { getDaysInBodega } from '../utils/date';

const TYPE_ORDER = ['VERDE', 'SECO', 'TRILLADO', 'PASILLA'] as const;
const BULTO_KG = 40.7;
const QUALITY_SECTIONS = [
  { key: 'BUENO', label: 'BUENO', dot: 'bg-[#22c55e]' },
  { key: 'REGULAR', label: 'REGULAR', dot: 'bg-[#f59e0b]' },
  { key: 'MALO', label: 'MALO', dot: 'bg-[#ef4444]' },
] as const;

function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function titleCase(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function formatKg(value: number) {
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}

function formatBultos(valueKg: number) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(valueKg / BULTO_KG);
}

function isStandardBultoWeight(valueKg: number) {
  if (valueKg < BULTO_KG) return false;
  const bultos = valueKg / BULTO_KG;
  return Math.abs(bultos - Math.round(bultos)) < 0.03;
}

function formatInventoryWeight(valueKg: number) {
  const kgText = `${formatKg(valueKg)} kg`;
  return isStandardBultoWeight(valueKg)
    ? `${kgText} - ${formatBultos(valueKg)} bultos`
    : kgText;
}

function lotDays(lot: LoteResumen) {
  return Math.max(
    getDaysInBodega(lot.fechaPrimerIngreso || lot.fecha),
    getDaysInBodega(lot.fechaUltimoIngreso || lot.fecha),
    lot.diasEnBodegaMax || 0,
  );
}

function typeVisual(type: string) {
  const key = keyOf(type);
  if (key === 'VERDE') {
    return {
      icon: <Leaf size={15} />,
      card: 'bg-[#eafaf1] text-[#15915f]',
      dot: 'bg-[#22c55e]',
    };
  }
  if (key === 'SECO') {
    return {
      icon: <SunMedium size={15} />,
      card: 'bg-[#fff4df] text-[#df7b10]',
      dot: 'bg-[#f59e0b]',
    };
  }
  if (key === 'PASILLA') {
    return {
      icon: <Coffee size={15} />,
      card: 'bg-[#f3f4f6] text-[#4b5563]',
      dot: 'bg-[#6b7280]',
    };
  }
  return {
    icon: <Coffee size={15} />,
    card: 'bg-[#eef2ff] text-[#1f3fa7]',
    dot: 'bg-[#1f3fa7]',
  };
}

export default function Inventario() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state ?? null) as
    | { preferredTypeKey?: string; completedSecadoId?: string }
    | null;

  const [lots, setLots] = useState<LoteResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeKey, setTypeKey] = useState('');
  const [preferredApplied, setPreferredApplied] = useState(false);

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

  const availableTypes = useMemo(() => {
    const map = new Map<string, { key: string; name: string }>();
    lots.forEach((lot) => {
      const key = keyOf(lot.tipoCafe);
      if (!map.has(key)) map.set(key, { key, name: lot.tipoCafe });
    });

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
    const preferred = keyOf(locationState?.preferredTypeKey ?? '');
    if (!preferredApplied && preferred && availableTypes.some((type) => type.key === preferred)) {
      setTypeKey(preferred);
      setPreferredApplied(true);
    }
  }, [availableTypes, locationState?.preferredTypeKey, preferredApplied]);

  const typeSummaries = useMemo(() => {
    const grouped = new Map<string, { key: string; name: string; lots: LoteResumen[] }>();
    lots.forEach((lot) => {
      const key = keyOf(lot.tipoCafe);
      const current = grouped.get(key) ?? { key, name: lot.tipoCafe, lots: [] };
      current.lots.push(lot);
      grouped.set(key, current);
    });

    return [...grouped.values()]
      .map((group) => ({
        key: group.key,
        name: group.name,
        totalKg: group.lots.reduce((sum, lot) => sum + lot.pesoActual, 0),
        sublotes: group.lots.reduce((sum, lot) => sum + lot.sublotes, 0),
        lotes: group.lots.length,
        lots: group.lots,
      }))
      .sort((a, b) => {
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

  const visibleLots = useMemo(() => {
    const base = typeKey ? lots.filter((lot) => keyOf(lot.tipoCafe) === typeKey) : lots;
    return [...base].sort((a, b) => lotDays(b) - lotDays(a));
  }, [lots, typeKey]);

  const qualitySections = useMemo(
    () =>
      QUALITY_SECTIONS.map((section) => ({
        ...section,
        totalKg: visibleLots
          .filter((lot) => keyOf(lot.calidad) === section.key)
          .reduce((sum, lot) => sum + lot.pesoActual, 0),
        lots: visibleLots.filter((lot) => keyOf(lot.calidad) === section.key),
      })),
    [visibleLots],
  );

  const activeSession = getActiveSecadoSession();
  const verdeTarget = visibleLots.find((lot) => keyOf(lot.tipoCafe) === 'VERDE') ?? null;
  const hasInventory = lots.length > 0;
  const filteredTypeName = availableTypes.find((type) => type.key === typeKey)?.name ?? '';

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-[#171717]">
      <main className="mx-auto min-h-screen w-full max-w-[340px] bg-white pb-[76px] shadow-[0_14px_38px_rgba(15,23,42,0.06)]">
        <header className="flex h-12 items-center gap-2 border-b border-[#eeeeee] px-3">
          {typeKey ? (
            <button
              type="button"
              onClick={() => setTypeKey('')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#333333]"
              aria-label="Volver"
            >
              <ArrowLeft size={14} />
            </button>
          ) : null}
          <Warehouse size={15} className={hasInventory ? 'text-[#202020]' : 'text-[#bd3a2b]'} />
          <h1 className="text-[0.82rem] font-black">Inventario</h1>
          <button
            type="button"
            onClick={() => void loadLots()}
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400"
            aria-label="Recargar inventario"
          >
            <RefreshCcw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </header>

        {loading ? (
          <section className="px-4 py-8 text-center text-[0.78rem] font-semibold text-slate-500">
            Cargando inventario...
          </section>
        ) : null}

        {!loading && error ? (
          <section className="mx-4 mt-4 rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-3 text-[0.72rem] text-rose-700">
            {error}
          </section>
        ) : null}

        {!loading && !error && !hasInventory ? <EmptyInventory onBuy={() => navigate('/compras')} /> : null}

        {!loading && !error && hasInventory ? (
          <div className="px-3 py-3">
            {!typeKey ? (
              <section className="grid grid-cols-3 gap-2">
                {typeSummaries.slice(0, 3).map((summary) => (
                  <SummaryMiniCard key={summary.key} summary={summary} />
                ))}
              </section>
            ) : null}

            <section className="mt-3 flex flex-wrap gap-2">
              {[{ key: '', name: 'Todos' }, ...availableTypes].map((type) => {
                const active = type.key === typeKey;
                return (
                  <button
                    key={type.key || 'all'}
                    type="button"
                    onClick={() => setTypeKey(type.key)}
                    className={`min-h-[26px] rounded-full px-3 text-[0.62rem] font-semibold transition ${
                      active ? 'bg-[#172554] text-white' : 'border border-[#e1e5ed] bg-white text-[#6b7280]'
                    }`}
                  >
                    {titleCase(type.name)}
                  </button>
                );
              })}
            </section>

            {typeKey === 'VERDE' ? (
              <section className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      activeSession
                        ? `/inventario/secado/${activeSession.id}/finalizar`
                        : verdeTarget
                          ? `/inventario/${verdeTarget.tipoCafeId}/${verdeTarget.calidadId}/secado`
                          : '/inventario',
                    )
                  }
                  disabled={!activeSession && !verdeTarget}
                  className="inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-[6px] border border-[#2341a0] bg-white px-3 text-[0.68rem] font-black text-[#2341a0] disabled:opacity-50"
                >
                  <SunMedium size={13} />
                  {activeSession ? 'Finalizar secado' : 'Iniciar secado'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    activeSession
                      ? navigate(`/inventario/secado/${activeSession.id}/finalizar`)
                      : verdeTarget
                        ? navigate(`/inventario/${verdeTarget.tipoCafeId}/${verdeTarget.calidadId}/secado`)
                        : undefined
                  }
                  className="inline-flex w-full items-center justify-center gap-1.5 text-[0.58rem] font-semibold text-[#8391b4]"
                >
                  Ver procesos de secado
                  <ArrowRight size={10} />
                </button>
              </section>
            ) : null}

            {locationState?.completedSecadoId ? (
              <section className="mt-3 rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.62rem] font-semibold text-emerald-700">
                El secado ya se refleja como sublote de cafe seco.
              </section>
            ) : null}

            {!typeKey ? (
              <section className="mt-3 space-y-2">
                {typeSummaries.map((summary) => (
                  <TypeRowCard
                    key={summary.key}
                    summary={summary}
                    onOpen={() => setTypeKey(summary.key)}
                    onOpenSublotes={() => {
                      if (summary.lots.length === 1) {
                        const lot = summary.lots[0];
                        navigate(`/inventario/${lot.tipoCafeId}/${lot.calidadId}/sublotes`);
                        return;
                      }

                      setTypeKey(summary.key);
                    }}
                  />
                ))}
              </section>
            ) : (
              <section className="mt-4 space-y-4">
                {qualitySections
                  .filter((section) => section.lots.length > 0)
                  .map((section) => (
                    <section key={section.key}>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${section.dot}`} />
                          <p className="text-[0.55rem] font-black uppercase tracking-[0.08em] text-[#4b5563]">
                            {section.label}
                          </p>
                        </div>
                        <p className="text-[0.55rem] font-semibold text-slate-400">{formatKg(section.totalKg)} kg</p>
                      </div>
                      <div className="space-y-2">
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

                {visibleLots.length === 0 ? (
                  <section className="rounded-[8px] border border-dashed border-[#d7dce8] bg-[#fafafa] px-4 py-8 text-center text-[0.72rem] text-slate-500">
                    No hay lotes de {titleCase(filteredTypeName)}.
                  </section>
                ) : null}
              </section>
            )}
          </div>
        ) : null}
      </main>

      <InventoryBottomNav />
    </div>
  );
}

function SummaryMiniCard({
  summary,
}: {
  summary: { key: string; name: string; totalKg: number };
}) {
  return (
    <article className="rounded-[6px] border border-[#eeeeee] bg-[#fbfbfb] px-2.5 py-2">
      <p className="text-[0.48rem] font-black uppercase text-[#a0a0a0]">Cafe {titleCase(summary.name)}</p>
      <p className="mt-1 text-[0.72rem] font-black text-[#1f1f1f]">{formatKg(summary.totalKg)} kg</p>
    </article>
  );
}

function TypeRowCard({
  summary,
  onOpen,
  onOpenSublotes,
}: {
  summary: { key: string; name: string; totalKg: number; sublotes: number; lotes: number; lots: LoteResumen[] };
  onOpen: () => void;
  onOpenSublotes: () => void;
}) {
  const visual = typeVisual(summary.name);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[58px] w-full items-center justify-between rounded-[8px] border border-[#eeeeee] bg-white px-3 py-2 text-left shadow-[0_3px_10px_rgba(15,23,42,0.035)]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] ${visual.card}`}>
          {visual.icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[0.78rem] font-black text-[#202020]">{titleCase(summary.name)}</p>
          <p className="mt-0.5 text-[0.58rem] font-semibold text-[#929292]">{formatInventoryWeight(summary.totalKg)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenSublotes();
          }}
          className="rounded-full bg-[#f4f4f4] px-2 py-1 text-[0.48rem] font-black uppercase text-[#777777] transition hover:bg-[#e9eefc] hover:text-[#1f3fa7]"
          aria-label={`Ver ${summary.lotes} lotes de cafe ${summary.name}`}
        >
          {summary.lotes} lote{summary.lotes === 1 ? '' : 's'}
        </button>
        <ArrowRight size={12} className="text-[#b8b8b8]" />
      </div>
    </button>
  );
}

function QualityLotCard({ lot, onOpen }: { lot: LoteResumen; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[58px] w-full items-center justify-between rounded-[8px] border border-[#eeeeee] bg-white px-3 py-2 text-left shadow-[0_3px_10px_rgba(15,23,42,0.035)]"
    >
      <div className="min-w-0">
        <p className="truncate text-[0.72rem] font-black text-[#202020]">{lot.codigo}</p>
        <p className="mt-0.5 text-[0.58rem] font-semibold text-[#929292]">{formatKg(lot.pesoActual)} kg</p>
        <p className="mt-1 text-[0.52rem] font-semibold text-[#a5a5a5]">{lotDays(lot)} dias</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-full bg-[#f4f4f4] px-2 py-1 text-[0.48rem] font-black uppercase text-[#777777]">
          {lot.sublotes} sublote{lot.sublotes === 1 ? '' : 's'}
        </span>
        <span className="inline-flex items-center gap-0.5 text-[0.5rem] font-black uppercase text-[#1f3fa7]">
          Ver
          <ArrowRight size={12} />
        </span>
      </div>
    </button>
  );
}

function EmptyInventory({ onBuy }: { onBuy: () => void }) {
  return (
    <section className="flex min-h-[calc(100vh-128px)] flex-col items-center justify-center px-5 text-center">
      <div className="relative h-[154px] w-[154px]">
        <div className="absolute left-7 top-5 h-[116px] w-[116px] rotate-3 rounded-[16px] bg-white shadow-[0_18px_34px_rgba(15,23,42,0.12)]" />
        <div className="absolute left-[58px] top-[50px] flex h-[54px] w-[54px] items-center justify-center rounded-[8px] bg-[#f3f3f3] text-[#c8c8c8]">
          <Box size={28} />
        </div>
        <div className="absolute bottom-4 right-4 flex h-10 w-10 rotate-[-8deg] items-center justify-center rounded-[10px] bg-[#f97316] text-white shadow-[0_8px_16px_rgba(249,115,22,0.32)]">
          <ShoppingCart size={17} />
        </div>
      </div>

      <h2 className="mt-2 text-[0.95rem] font-black leading-tight text-[#202020]">
        Aun no tienes cafe en inventario
      </h2>
      <p className="mt-2 max-w-[230px] text-[0.68rem] font-semibold leading-4 text-[#8b8b8b]">
        Registra tu primera compra para empezar a ver tu cafe.
      </p>
      <button
        type="button"
        onClick={onBuy}
        className="mt-5 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#1f3fa7] px-4 text-[0.72rem] font-black text-white shadow-[0_10px_22px_rgba(31,63,167,0.22)]"
      >
        <ShoppingCart size={14} />
        Registrar compra
      </button>
    </section>
  );
}

function InventoryBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const items = [
    { id: 'inicio', label: 'Inicio', path: '/inicio', icon: House },
    { id: 'compras', label: 'Compras', path: '/compras', icon: ShoppingCart },
    { id: 'inventario', label: 'Inventario', path: '/inventario', icon: Warehouse },
    { id: 'ventas', label: 'Ventas', path: '/ventas', icon: Banknote },
    { id: 'ajustes', label: 'Ajustes', path: '/ajustes', icon: Settings },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#eeeeee] bg-white">
      <div className="mx-auto grid h-[58px] w-full max-w-[340px] grid-cols-5">
        {items.map((item) => {
          const active = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 text-[0.48rem] font-black ${
                active ? 'text-[#1f56ff]' : 'text-[#6f6f6f]'
              }`}
            >
              <Icon size={14} strokeWidth={active ? 2.8 : 2.1} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
