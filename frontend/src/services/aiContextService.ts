import type { DashboardSummary } from './dashboardService';
import type { LoteResumen } from './lotesService';
import { getOfflineCache } from './offlineCacheService';
import { getSyncQueueSummary } from './syncQueueService';

export type AiBusinessContext = {
  inventario?: {
    totalKg?: number;
    capacidadUsada?: string;
    sublotesDisponibles?: number;
    sublotesAntiguos?: number;
  };
  ventas?: {
    totalMes?: number;
    totalKg?: number;
    cantidadVentas?: number;
  };
  compras?: {
    totalMes?: number;
    totalKg?: number;
    cantidadCompras?: number;
  };
  gastos?: {
    totalMes?: number;
    principales?: string[];
  };
  secado?: {
    activos?: number;
    mermaKg?: number;
  };
  offline?: {
    usandoDatosCacheados?: boolean;
    pendientesSync?: number;
  };
  financiero?: {
    utilidadEstimada?: number;
  };
  bodega?: {
    capacidadKg?: number;
  };
};

export type BuiltAiContext = {
  context: AiBusinessContext;
  hasData: boolean;
  usingCachedData: boolean;
};

type CachedDashboardHome =
  | DashboardSummary
  | {
      summary?: DashboardSummary;
      lotesBodega?: LoteResumen[];
    };

function round(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 100) / 100
    : undefined;
}

function buildCapacityLabel(summary: DashboardSummary | null) {
  if (!summary || !summary.kgCapacidad) return undefined;
  const percent = summary.kgCapacidad > 0 ? (summary.kgActual / summary.kgCapacidad) * 100 : 0;
  return `${round(percent) ?? 0}%`;
}

export async function buildAiContext(): Promise<BuiltAiContext> {
  const [dashboardCache, inventory] = await Promise.all([
    getOfflineCache<CachedDashboardHome>('cached_dashboard_home'),
    getOfflineCache<LoteResumen[]>('inventory_sublotes'),
  ]);
  const queueSummary = getSyncQueueSummary();
  const usingCachedData = typeof navigator !== 'undefined' ? !navigator.onLine : false;
  const summary =
    dashboardCache && 'summary' in dashboardCache
      ? dashboardCache.summary ?? null
      : dashboardCache ?? null;
  const cachedHomeLotes =
    dashboardCache && 'lotesBodega' in dashboardCache && Array.isArray(dashboardCache.lotesBodega)
      ? dashboardCache.lotesBodega
      : [];
  const lotes = Array.isArray(inventory) && inventory.length > 0 ? inventory : cachedHomeLotes;

  const context: AiBusinessContext = {
    inventario: {
      totalKg: round(summary?.kgActual ?? lotes.reduce((acc, lote) => acc + (lote.pesoActual || 0), 0)),
      capacidadUsada: buildCapacityLabel(summary),
      sublotesDisponibles: lotes.reduce((acc, lote) => acc + (lote.sublotes || 0), 0),
      sublotesAntiguos: lotes.filter((lote) => (lote.diasEnBodegaMax ?? 0) >= 30).length,
    },
    ventas: summary
      ? {
          totalMes: round(summary.totalVentasHoy),
          totalKg: undefined,
          cantidadVentas: summary.ventasHoy,
        }
      : undefined,
    compras: summary
      ? {
          totalMes: round(summary.totalComprasHoy),
          totalKg: round(summary.kgCompradosHoy),
          cantidadCompras: summary.comprasHoy,
        }
      : undefined,
    gastos: summary
      ? {
          totalMes: round(summary.totalGastosHoy),
          principales: summary.movimientosRecientes
            ?.filter((movimiento) => movimiento.tipo === 'GASTO')
            .map((movimiento) => movimiento.nombre)
            .slice(0, 5),
        }
      : undefined,
    secado: summary
      ? {
          activos: lotes.filter((lote) => /secado/i.test(lote.tipoCafe)).length,
          mermaKg: round(summary.mermaTotalKg),
        }
      : undefined,
    offline: {
      usandoDatosCacheados: usingCachedData,
      pendientesSync: queueSummary.pendientes + queueSummary.errores,
    },
    financiero: summary
      ? {
          utilidadEstimada: round(summary.utilidadTotalAcumulada),
        }
      : undefined,
    bodega: summary
      ? {
          capacidadKg: round(summary.kgCapacidad),
        }
      : undefined,
  };

  const hasData = Boolean(summary || lotes.length > 0 || queueSummary.total > 0);
  return { context, hasData, usingCachedData };
}
