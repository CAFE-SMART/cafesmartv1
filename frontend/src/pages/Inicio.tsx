import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Coffee,
  Leaf,
  RefreshCcw,
  SunMedium,
  UserCircle2,
  Warehouse,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import { useUser } from '../context/UserContext';
import { obtenerLotes, type LoteResumen } from '../services/lotesService';
import { getBodegaConfig } from '../utils/bodegaConfig';
import { getAverageFactorForLot } from '../utils/factorStorage';
import { applySecadoToLots } from '../utils/secadoFlow';
import { getDaysInBodega } from '../utils/date';

type TipoNivelKey = 'VERDE' | 'SECO' | 'TRILLADO' | 'PASILLA';

type TipoNivelCard = {
  tipo: TipoNivelKey;
  totalKg: number;
  totalLotes: number;
  diasBodega: number;
};

type QuickIssue = {
  id: string;
  code: string;
  summary: string;
  statusLabel: 'LISTO' | 'PENDIENTE' | 'REVISAR';
  severity: 'critical' | 'attention' | 'info';
  target: 'LOTE' | 'BODEGA' | 'INVENTARIO';
  lot?: LoteResumen;
};

const TYPE_ORDER: TipoNivelKey[] = ['VERDE', 'SECO', 'TRILLADO', 'PASILLA'];

function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
}

function getInitial(name: string | null | undefined) {
  return (name?.trim()?.charAt(0) || 'U').toUpperCase();
}

function getTypeVisual(tipo: TipoNivelKey) {
  if (tipo === 'VERDE') {
    return {
      icon: <Leaf size={15} />,
      iconBox: 'bg-[#e9fbf4] text-[#0d7b67]',
      label: 'text-[#2d7a4f]',
      bar: 'bg-[#1f7f46]',
    };
  }

  if (tipo === 'SECO') {
    return {
      icon: <SunMedium size={15} />,
      iconBox: 'bg-[#fff7df] text-[#d29309]',
      label: 'text-[#b45e12]',
      bar: 'bg-[#b45a1a]',
    };
  }

  if (tipo === 'TRILLADO') {
    return {
      icon: <Warehouse size={15} />,
      iconBox: 'bg-[#eef1ff] text-[#102d92]',
      label: 'text-[#102d92]',
      bar: 'bg-[#1f3eab]',
    };
  }

  return {
    icon: <AlertTriangle size={15} />,
    iconBox: 'bg-[#ffe8ed] text-[#b4204a]',
    label: 'text-[#b4204a]',
    bar: 'bg-[#b4204a]',
  };
}

function getLotDays(lote: LoteResumen) {
  const oldest = getDaysInBodega(lote.fechaPrimerIngreso || lote.fecha);
  const newest = getDaysInBodega(lote.fechaUltimoIngreso || lote.fecha);

  return {
    max: Math.max(oldest, newest),
    min: Math.min(oldest, newest),
  };
}

function buildNiveles(lotes: LoteResumen[]) {
  const grouped = new Map<string, TipoNivelCard>();

  for (const lote of lotes) {
    const key = keyOf(lote.tipoCafe) as TipoNivelKey;
    if (!TYPE_ORDER.includes(key)) continue;

    const current = grouped.get(key) ?? {
      tipo: key,
      totalKg: 0,
      totalLotes: 0,
      diasBodega: 0,
    };

    current.totalKg += lote.pesoActual;
    current.totalLotes += 1;
    current.diasBodega = Math.max(current.diasBodega, getLotDays(lote).max);

    grouped.set(key, current);
  }

  return TYPE_ORDER.map((tipo) =>
    grouped.get(tipo) ?? {
      tipo,
      totalKg: 0,
      totalLotes: 0,
      diasBodega: 0,
    },
  );
}

function buildQuickIssues(lotes: LoteResumen[]): QuickIssue[] {
  const issues: QuickIssue[] = [];
  const usedLots = new Set<string>();
  const sortedByOldest = [...lotes].sort((a, b) => getLotDays(b).max - getLotDays(a).max);

  const missingFactor = lotes.find((lote) => {
    if (keyOf(lote.tipoCafe) !== 'SECO' || keyOf(lote.calidad) !== 'BUENO') return false;
    return getAverageFactorForLot(lote.id) === null;
  });
  if (missingFactor) {
    issues.push({
      id: `factor-${missingFactor.id}`,
      code: `#${missingFactor.codigo}`,
      summary: 'Falta factor de rendimiento',
      statusLabel: 'PENDIENTE',
      severity: 'attention',
      target: 'LOTE',
      lot: missingFactor,
    });
    usedLots.add(missingFactor.id);
  }

  const highHumidity = lotes
    .filter((lote) => lote.humedadPromedio !== null && lote.humedadPromedio > 13.5)
    .sort((a, b) => (b.humedadPromedio ?? 0) - (a.humedadPromedio ?? 0))[0];
  if (highHumidity && !usedLots.has(highHumidity.id)) {
    issues.push({
      id: `humidity-${highHumidity.id}`,
      code: `#${highHumidity.codigo}`,
      summary: 'Humedad fuera de rango',
      statusLabel: 'REVISAR',
      severity: 'critical',
      target: 'LOTE',
      lot: highHumidity,
    });
    usedLots.add(highHumidity.id);
  }

  const oldestLot = sortedByOldest.find((lote) => getLotDays(lote).max >= 20);
  if (oldestLot && !usedLots.has(oldestLot.id)) {
    issues.push({
      id: `days-${oldestLot.id}`,
      code: `#${oldestLot.codigo}`,
      summary: `Tiempo en bodega: ${getLotDays(oldestLot).max} días`,
      statusLabel: 'REVISAR',
      severity: 'critical',
      target: 'LOTE',
      lot: oldestLot,
    });
    usedLots.add(oldestLot.id);
  }

  if (issues.length === 0 && lotes.length > 0) {
    const first = lotes[0];
    issues.push({
      id: `ok-${first.id}`,
      code: `#${first.codigo}`,
      summary: `${formatNumber(first.pesoActual)} kg · Café ${first.tipoCafe}`,
      statusLabel: 'LISTO',
      severity: 'info',
      target: 'LOTE',
      lot: first,
    });
  }

  return issues.slice(0, 3);
}

function NivelCard({ item }: { item: TipoNivelCard }) {
  const visual = getTypeVisual(item.tipo);
  const barWidth = item.totalKg > 0 ? Math.max(12, Math.min(100, (item.diasBodega / 25) * 100)) : 0;

  return (
    <article className="rounded-[18px] border border-[#e6e8f3] bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between">
        <p className={`text-[12px] font-black uppercase tracking-[0.14em] ${visual.label}`}>{item.tipo}</p>
        <div className={`rounded-xl p-2 ${visual.iconBox}`}>{visual.icon}</div>
      </div>

      <p className="mt-2 text-[1.7rem] font-black leading-none text-slate-900">
        {formatNumber(item.totalKg)} <span className="text-base text-slate-400">kg</span>
      </p>
      <p className="mt-1 text-[11px] font-semibold text-slate-500">
        {item.totalLotes} lote{item.totalLotes === 1 ? '' : 's'}
      </p>

      <div className="mt-3 border-t border-slate-100 pt-2.5">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
          <Clock3 size={12} className="text-slate-400" />
          Días bodega
        </p>
        <p className="mt-1 text-sm font-black text-[#102d92]">{item.diasBodega} días</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${visual.bar}`} style={{ width: `${barWidth}%` }} />
        </div>
      </div>
    </article>
  );
}

function IssueCard({ issue, onAction }: { issue: QuickIssue; onAction?: () => void }) {
  const tone =
    issue.severity === 'critical'
      ? 'border-rose-200 bg-rose-50'
      : issue.severity === 'attention'
        ? 'border-amber-200 bg-amber-50'
        : 'border-emerald-200 bg-emerald-50';

  const iconBox =
    issue.severity === 'critical'
      ? 'bg-rose-100 text-rose-700'
      : issue.severity === 'attention'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-emerald-100 text-emerald-700';

  const badge =
    issue.statusLabel === 'REVISAR'
      ? 'bg-rose-600 text-white'
      : issue.statusLabel === 'PENDIENTE'
        ? 'bg-amber-400 text-slate-900'
        : 'bg-emerald-600 text-white';

  const Icon =
    issue.severity === 'critical' ? AlertTriangle : issue.severity === 'attention' ? Clock3 : CheckCircle2;

  return (
    <article
      className={`rounded-[16px] border p-3 shadow-sm transition ${tone} ${onAction ? 'cursor-pointer hover:shadow-md' : ''}`}
      onClick={onAction}
      role={onAction ? 'button' : undefined}
      tabIndex={onAction ? 0 : -1}
      onKeyDown={(event) => {
        if (!onAction) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onAction();
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`rounded-[12px] p-2 ${iconBox}`}>
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Sublote</p>
            <p className="truncate text-[1.12rem] font-black text-[#102d92]">{issue.code}</p>
            <p className="truncate text-sm font-semibold text-slate-700">{issue.summary}</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${badge}`}>
          {issue.statusLabel}
        </span>
      </div>
    </article>
  );
}

export default function Inicio() {
  const navigate = useNavigate();
  const { user, hydrated } = useUser();
  const [lotes, setLotes] = useState<LoteResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bodegaConfig, setBodegaConfig] = useState(() => getBodegaConfig());

  const cargarLotes = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await obtenerLotes();
      setLotes(applySecadoToLots(data));
      setBodegaConfig(getBodegaConfig());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo cargar el resumen del inventario.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    void cargarLotes();
  }, [hydrated]);

  const resumenGeneral = useMemo(() => {
    const totalKg = lotes.reduce((sum, lote) => sum + lote.pesoActual, 0);
    const capacidadKg = bodegaConfig.capacidadKg;
    const disponibleKg = Math.max(0, capacidadKg - totalKg);
    const ocupacionRaw = capacidadKg > 0 ? (totalKg / capacidadKg) * 100 : 0;
    const ocupacionDisplay =
      ocupacionRaw === 0 ? '0' : ocupacionRaw < 1 ? ocupacionRaw.toFixed(1) : ocupacionRaw.toFixed(0);
    const barraWidth = totalKg > 0 ? Math.max(2, Math.min(100, ocupacionRaw)) : 0;

    return { totalKg, capacidadKg, disponibleKg, ocupacionDisplay, barraWidth };
  }, [bodegaConfig.capacidadKg, lotes]);

  const niveles = useMemo(() => buildNiveles(lotes), [lotes]);
  const quickIssues = useMemo(() => buildQuickIssues(lotes), [lotes]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f2fb_100%)] px-4 py-5 pb-[150px] text-slate-900">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5">
        <section className="rounded-[18px] border border-[#e4e9f8] bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            Mensaje del día
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            Hoy prioriza lotes con mayor antigüedad y valida humedad/factor antes de vender.
          </p>
        </section>

        <header className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.07)] backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#eef2ff] p-3 text-[#102d92] shadow-inner">
              <Coffee size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[1.1rem] font-black leading-tight text-[#102d92]">Café Smart</p>
              <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                Resumen operativo
              </p>
              <h1 className="mt-2 text-[1.3rem] font-black leading-tight text-[#121826]">
                Hola, {user?.name?.trim() ? user.name : 'usuario'}
              </h1>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e9f4ff] text-[#102d92]">
              <UserCircle2 size={20} />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <CloudStatusBadge compact className="max-w-[220px]" />
            <button
              type="button"
              onClick={() => void cargarLotes()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"
            >
              <RefreshCcw size={14} />
              Recargar
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d7ecd4] text-[#1f5e34] shadow-inner">
              <span className="text-xs font-black">{getInitial(user?.name)}</span>
            </div>
          </div>
        </header>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[1.2rem] font-black tracking-tight text-[#121826]">Niveles de inventario</h2>
              <p className="text-xs text-slate-500">Kg, lotes y días por tipo.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/inventario')}
              className="text-xs font-black uppercase tracking-[0.14em] text-[#102d92]"
            >
              Ver todo
            </button>
          </div>

          {loading ? (
            <div className="rounded-[18px] border border-[#e6e8f3] bg-white px-4 py-6 text-center text-sm text-slate-500 shadow-sm">
              Cargando inventario...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {niveles.map((item) => (
                <NivelCard key={item.tipo} item={item} />
              ))}
            </div>
          )}
        </section>

        <section className="relative overflow-hidden rounded-[22px] border border-[#d8e4ff] bg-[#eef3ff] p-4 text-[#102d92] shadow-sm">
          <div className="absolute bottom-0 right-3 text-[#102d92]/10">
            <Warehouse size={96} strokeWidth={1.5} />
          </div>
          <div className="relative z-10">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#5b6f9d]">Capacidad en bodega</p>
            <div className="mt-2 flex items-end gap-2">
              <p className="text-[1.9rem] font-black leading-none">{loading ? '...' : formatNumber(resumenGeneral.totalKg)}</p>
              <span className="pb-1 text-base font-semibold text-[#5b6f9d]">/ {formatNumber(resumenGeneral.capacidadKg)} kg</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-[#5b6f9d]">
              {resumenGeneral.ocupacionDisplay}% ocupada · {formatNumber(resumenGeneral.disponibleKg)} kg disponibles
            </p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#d6e1f8]">
              <div className="h-full rounded-full bg-[#102d92]" style={{ width: `${resumenGeneral.barraWidth}%` }} />
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            No pude cargar el inventario: {error}
          </div>
        ) : null}

        <section className="rounded-[20px] border border-[#e2e7f8] bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[1rem] font-black text-[#121826]">Vista rápida</p>
            <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#102d92]">
              Alertas
            </span>
          </div>

          <div className="space-y-2.5">
            {quickIssues.map((issue) => {
              let onAction: (() => void) | undefined;

              if (issue.target === 'LOTE' && issue.lot) {
                const lot = issue.lot;
                onAction = () => navigate(`/inventario/${lot.tipoCafeId}/${lot.calidadId}/sublotes`);
              } else if (issue.target === 'BODEGA') {
                onAction = () => navigate('/ajustes');
              } else {
                onAction = () => navigate('/inventario');
              }

              return <IssueCard key={issue.id} issue={issue} onAction={onAction} />;
            })}
          </div>
        </section>
      </div>

      <AppBottomNav />
    </div>
  );
}
