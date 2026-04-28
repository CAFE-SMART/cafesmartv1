import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Leaf,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  SunMedium,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { useCloudStatus } from '../context/CloudStatusContext';
import { obtenerDashboardSummary, type DashboardSummary } from '../services/dashboardService';
import { obtenerLotes, type LoteResumen } from '../services/lotesService';
import { applySecadoToLots } from '../utils/secadoFlow';
import { getDaysInBodega } from '../utils/date';

const sectionTitleClass =
  'text-[0.74rem] font-black uppercase tracking-[0.16em] text-[#73829a]';
const cardClass =
  'rounded-[18px] border border-[#dbe2ee] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]';

function formatInteger(value: number) {
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatKg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)} kg`;
}

function formatKgUpper(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)} KG`;
}

function resolveCloudLabel(tone: string) {
  if (tone === 'offline' || tone === 'error') {
    return 'SIN CONEXION';
  }

  if (tone === 'checking') {
    return 'VERIFICANDO';
  }

  if (tone === 'syncing') {
    return 'SINCRONIZANDO';
  }

  if (tone === 'degraded') {
    return 'CONEXION INESTABLE';
  }

  return 'CONECTADO';
}

function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function resolveDashboardErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';

  if (/^Cannot\s+(GET|POST|PUT|PATCH|DELETE)\s+/i.test(message)) {
    return 'Inicio no disponible por el momento.';
  }

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Surgio un problema interno. Intenta nuevamente. Si el problema continua, comunicate con el encargado.';
  }

  return message || 'No pudimos cargar el inicio.';
}

function resolveCloudDotClass(tone: string) {
  if (tone === 'offline' || tone === 'error') {
    return 'bg-[#a0aec0]';
  }

  if (tone === 'checking') {
    return 'bg-[#c7d2e3]';
  }

  if (tone === 'syncing') {
    return 'bg-[#d6a64d]';
  }

  if (tone === 'degraded') {
    return 'bg-[#e38b47]';
  }

  return 'bg-[#3d8b5f]';
}

function formatMetric(
  loading: boolean,
  value: number | null,
  formatter: (value: number) => string,
) {
  if (loading) {
    return '...';
  }

  if (value === null) {
    return '-';
  }

  return formatter(value);
}

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-[0.76rem]">
      <span className="text-[#5a6b84]">{label}</span>
      <span className="font-black text-[#1f2937]">{value}</span>
    </div>
  );
}

function lotDays(lot: LoteResumen) {
  return Math.max(
    getDaysInBodega(lot.fechaPrimerIngreso || lot.fecha),
    getDaysInBodega(lot.fechaUltimoIngreso || lot.fecha),
    lot.diasEnBodegaMax || 0,
  );
}

type BodegaCoffeeItem = {
  key: 'VERDE_BUENO' | 'VERDE_REGULAR' | 'SECO_BUENO';
  tipo: 'Verde' | 'Seco';
  calidad: 'Bueno' | 'Regular';
  totalKg: number;
  lots: number;
  averageDays: number;
  dayWeight: number;
};

function BodegaCoffeeRow({
  item,
}: {
  item: BodegaCoffeeItem;
}) {
  const isGood = item.calidad === 'Bueno';
  const isDry = item.tipo === 'Seco';
  const Icon = isDry ? SunMedium : isGood ? ShieldCheck : Sparkles;
  const iconClass = isDry
    ? 'bg-[#fff1da] text-[#c4670e]'
    : isGood
    ? 'bg-[#dcfce7] text-[#16845a]'
    : 'bg-[#fff7d6] text-[#b77905]';
  const qualityClass = isGood
    ? 'bg-[#dcfce7] text-[#16845a]'
    : 'bg-[#fff3c4] text-[#a15c00]';

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${iconClass}`}>
          <Icon size={17} strokeWidth={2.35} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[0.78rem] font-black leading-tight text-[#1f2937]">
            {item.tipo}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[0.58rem] font-bold uppercase tracking-[0.04em] text-[#8a98ad]">
            <CalendarDays size={10} strokeWidth={2.2} />
            Prom. {item.averageDays} dias
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[0.78rem] font-black text-[#18479d]">{formatKgUpper(item.totalKg)}</p>
        <span className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[0.46rem] font-black uppercase ${qualityClass}`}>
          {item.calidad}
        </span>
      </div>
    </div>
  );
}

export default function Inicio() {
  const { tone, refreshHealth } = useCloudStatus();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [lotesBodega, setLotesBodega] = useState<LoteResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [dashboardResult, lotesResult] = await Promise.allSettled([
        obtenerDashboardSummary(),
        obtenerLotes(),
      ]);

      if (dashboardResult.status === 'fulfilled') {
        setSummary(dashboardResult.value);
        setError(null);
      } else {
        setError(resolveDashboardErrorMessage(dashboardResult.reason));
      }

      if (lotesResult.status === 'fulfilled') {
        setLotesBodega(applySecadoToLots(lotesResult.value));
      } else {
        setLotesBodega([]);
      }
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void cargarDashboard();
  }, [cargarDashboard]);

  const handleReload = useCallback(async () => {
    await Promise.allSettled([cargarDashboard(true), refreshHealth()]);
  }, [cargarDashboard, refreshHealth]);

  const ocupacion = useMemo(() => {
    const kgActual = summary?.kgActual ?? null;
    const kgCapacidad = summary?.kgCapacidad ?? null;

    if (
      kgActual === null ||
      kgCapacidad === null ||
      !Number.isFinite(kgCapacidad) ||
      kgCapacidad <= 0
    ) {
      return {
        porcentaje: 0,
        etiqueta: loading ? '...' : '0%',
      };
    }

    const porcentaje = Math.max(0, Math.min(100, (kgActual / kgCapacidad) * 100));

    return {
      porcentaje,
      etiqueta: `${Math.round(porcentaje)}%`,
    };
  }, [loading, summary?.kgActual, summary?.kgCapacidad]);

  const cafeEnBodega = useMemo(() => {
    const sections: BodegaCoffeeItem[] = [
      { key: 'VERDE_BUENO', tipo: 'Verde', calidad: 'Bueno', totalKg: 0, lots: 0, averageDays: 0, dayWeight: 0 },
      { key: 'VERDE_REGULAR', tipo: 'Verde', calidad: 'Regular', totalKg: 0, lots: 0, averageDays: 0, dayWeight: 0 },
      { key: 'SECO_BUENO', tipo: 'Seco', calidad: 'Bueno', totalKg: 0, lots: 0, averageDays: 0, dayWeight: 0 },
    ];

    lotesBodega.forEach((lot) => {
      const typeKey = keyOf(lot.tipoCafe);
      const qualityKey = keyOf(lot.calidad);
      const section = sections.find((item) => item.key === `${typeKey}_${qualityKey}`);
      if (!section) return;

      const weight = Math.max(1, lot.sublotes);
      section.totalKg += lot.pesoActual;
      section.lots += lot.sublotes;
      section.dayWeight += lotDays(lot) * weight;
    });

    return sections
      .map((section) => ({
        ...section,
        averageDays: section.totalKg > 0 ? Math.round(section.dayWeight / Math.max(1, section.lots)) : 0,
      }))
      .filter((section) => section.totalKg > 0);
  }, [lotesBodega]);

  return (
    <div className="min-h-screen bg-[#eef2f6] px-4 py-3 pb-28 text-slate-900">
      <div className="mx-auto max-w-[340px] overflow-hidden rounded-[28px] border border-[#d9e1ec] bg-[#f6f7f9] shadow-[0_20px_48px_rgba(15,23,42,0.08)]">
        <header className="border-b border-[#dde4ef] bg-white px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.08rem] font-black text-[#1f2937]">
                Caf&eacute; Smart
              </h1>
              <div className="mt-1 inline-flex items-center gap-2 text-[0.56rem] font-black uppercase tracking-[0.14em] text-[#93a1b6]">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${resolveCloudDotClass(tone)}`}
                  aria-hidden="true"
                />
                <span>{resolveCloudLabel(tone)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleReload()}
              disabled={refreshing}
              className="inline-flex h-8 items-center gap-1.5 rounded-[12px] border border-[#dde4ef] bg-white px-3 text-[0.68rem] font-semibold text-[#4b5c77] shadow-sm transition hover:bg-[#f8fafc] disabled:cursor-wait disabled:opacity-80"
            >
              {refreshing ? (
                <LoaderCircle size={13} className="animate-spin text-[#4b5c77]" />
              ) : (
                <RefreshCcw size={13} className="text-[#4b5c77]" />
              )}
              Recargar
            </button>
          </div>

        </header>

        <section className="border-b border-[#dde4ef] px-4 py-3">
          <p className={sectionTitleClass}>Resumen del d&iacute;a</p>

          <div className={`mt-3 ${cardClass}`}>
            <div className="space-y-2.5">
              <MetricRow
                label="Compras hoy:"
                value={formatMetric(loading, summary?.comprasHoy ?? null, formatInteger)}
              />
              <MetricRow
                label="Ventas hoy:"
                value={formatMetric(loading, summary?.ventasHoy ?? null, formatInteger)}
              />
              <MetricRow
                label="Kg comprados hoy:"
                value={formatMetric(loading, summary?.kgCompradosHoy ?? null, formatKg)}
              />
              <MetricRow
                label="Productores registrados:"
                value={formatMetric(
                  loading,
                  summary?.totalProductores ?? null,
                  formatInteger,
                )}
              />
            </div>
          </div>
        </section>

        <section className="border-b border-[#dde4ef] px-4 py-3">
          <p className={sectionTitleClass}>Capacidad en bodega</p>

          <div className={`mt-3 ${cardClass}`}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-[0.9rem] font-black text-[#1f2937]">Ocupaci&oacute;n actual</h2>
              <span className="text-[1rem] font-black text-[#18479d]">
                {ocupacion.etiqueta}
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eef2f8]">
              <div
                className="h-full rounded-full bg-[#17489c] transition-[width] duration-500"
                style={{ width: `${ocupacion.porcentaje}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-4 text-[0.58rem] font-black text-[#74839a]">
              <span>
                {formatMetric(loading, summary?.kgActual ?? null, formatKg)} usados
              </span>
              <span>
                {formatMetric(loading, summary?.kgCapacidad ?? null, formatKg)} total
              </span>
            </div>
          </div>
        </section>

        <section className="px-4 py-3">
          <p className={sectionTitleClass}>Inventario en bodega</p>

          <div className={`mt-3 overflow-hidden ${cardClass} p-0`}>
            {loading && !summary ? (
              <div className="px-5 py-6 text-sm font-medium text-[#7f8ca1]">
                Cargando bodega...
              </div>
            ) : cafeEnBodega.length === 0 ? (
              <div className="px-5 py-6 text-sm font-medium text-[#7f8ca1]">
                Aun no hay cafe disponible en bodega.
              </div>
            ) : (
              <div>
                {cafeEnBodega.map((item, index) => (
                  <div
                    key={item.key}
                    className={index > 0 ? 'border-t border-[#edf1f7]' : ''}
                  >
                    <BodegaCoffeeRow item={item} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <AppBottomNav />
    </div>
  );
}
