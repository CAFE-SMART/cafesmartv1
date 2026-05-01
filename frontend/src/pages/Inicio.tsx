import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LoaderCircle, ReceiptText, RefreshCcw } from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { EmptyState } from '../components/EmptyState';
import { useCloudStatus } from '../context/CloudStatusContext';
import {
  obtenerDashboardSummary,
  type DashboardMovimiento,
  type DashboardSummary,
} from '../services/dashboardService';

const sectionTitleClass =
  'text-[0.92rem] font-black uppercase tracking-[0.14em] text-[#73829a]';
const cardClass =
  'rounded-[24px] border border-[#dbe2ee] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]';

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

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
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
    <div className="flex items-center justify-between gap-4 text-[1.08rem]">
      <span className="text-[#5a6b84]">{label}</span>
      <span className="font-medium text-[#1f2937]">{value}</span>
    </div>
  );
}

function MovementRow({ movimiento }: { movimiento: DashboardMovimiento }) {
  const esVenta = movimiento.tipo === 'VENTA';

  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="pt-0.5 text-[1.45rem] font-semibold leading-none text-[#7d8ca4]">
          {esVenta ? '+' : '-'}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[1.1rem] font-medium leading-tight text-[#1f2937]">
            {esVenta ? `Venta - ${movimiento.nombre}` : `Compra - ${movimiento.nombre}`}
          </p>
          <p className="mt-1 text-[0.9rem] font-medium uppercase tracking-[0.04em] text-[#8391a7]">
            {formatKgUpper(movimiento.kg)}
          </p>
        </div>
      </div>
      <p className="shrink-0 text-[1.24rem] font-semibold text-[#18479d]">
        {formatCop(movimiento.valor)}
      </p>
    </div>
  );
}

export default function Inicio() {
  const { tone, refreshHealth } = useCloudStatus();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
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
      const response = await obtenerDashboardSummary();
      setSummary(response);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cargar el dashboard operativo.',
      );
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

  const movimientos = summary?.movimientosRecientes ?? [];

  return (
    <div className="min-h-screen bg-[#eef2f6] px-4 py-4 pb-28 text-slate-900">
      <div className="mx-auto max-w-[520px] overflow-hidden rounded-[28px] border border-[#d9e1ec] bg-[#f6f7f9] shadow-[0_20px_48px_rgba(15,23,42,0.08)]">
        <header className="border-b border-[#dde4ef] bg-white px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.65rem] font-black tracking-[-0.02em] text-[#1f2937]">
                Caf&eacute; Smart
              </h1>
              <div className="mt-2 inline-flex items-center gap-2 text-[0.9rem] font-semibold uppercase tracking-[0.12em] text-[#93a1b6]">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${resolveCloudDotClass(tone)}`}
                  aria-hidden="true"
                />
                <span>{resolveCloudLabel(tone)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleReload()}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-[16px] border border-[#dde4ef] bg-white px-4 py-3 text-[1rem] font-medium text-[#4b5c77] shadow-sm transition hover:bg-[#f8fafc] disabled:cursor-wait disabled:opacity-80"
            >
              {refreshing ? (
                <LoaderCircle size={18} className="animate-spin text-[#4b5c77]" />
              ) : (
                <RefreshCcw size={18} className="text-[#4b5c77]" />
              )}
              Recargar
            </button>
          </div>

          {error ? (
            <p className="mt-4 rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
        </header>

        <section className="border-b border-[#dde4ef] px-5 py-5">
          <p className={sectionTitleClass}>Resumen del d&iacute;a</p>

          <div className={`mt-4 ${cardClass}`}>
            <div className="space-y-4">
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

        <section className="border-b border-[#dde4ef] px-5 py-5">
          <p className={sectionTitleClass}>Capacidad en bodega</p>

          <div className={`mt-4 ${cardClass}`}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-[1.34rem] font-semibold text-[#1f2937]">Ocupaci&oacute;n actual</h2>
              <span className="text-[1.55rem] font-semibold text-[#18479d]">
                {ocupacion.etiqueta}
              </span>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#eef2f8]">
              <div
                className="h-full rounded-full bg-[#17489c] transition-[width] duration-500"
                style={{ width: `${ocupacion.porcentaje}%` }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-4 text-[0.98rem] font-medium text-[#74839a]">
              <span>
                {formatMetric(loading, summary?.kgActual ?? null, formatKg)} usados
              </span>
              <span>
                {formatMetric(loading, summary?.kgCapacidad ?? null, formatKg)} total
              </span>
            </div>
          </div>
        </section>

        <section className="px-5 py-5">
          <p className={sectionTitleClass}>&Uacute;ltimos movimientos</p>

          <div className={`mt-4 overflow-hidden ${cardClass} p-0`}>
            {loading && !summary ? (
              <div className="px-5 py-6 text-sm font-medium text-[#7f8ca1]">
                Cargando movimientos...
              </div>
            ) : movimientos.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="Todavía no hay movimientos"
                description="Registra una compra o una venta para que el resumen del día empiece a mostrar actividad."
                className="m-4"
              />
            ) : (
              <div>
                {movimientos.map((movimiento, index) => (
                  <div
                    key={movimiento.id}
                    className={index > 0 ? 'border-t border-[#edf1f7]' : ''}
                  >
                    <MovementRow movimiento={movimiento} />
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
