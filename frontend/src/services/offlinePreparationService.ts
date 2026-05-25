import { obtenerConfiguracionBodega } from './bodegaApi';
import { listarClientes } from './clientesService';
import { listarProductores } from './productoresService';
import { obtenerCatalogosCompra } from './comprasService';
import { obtenerDashboardSummary } from './dashboardService';
import { obtenerLotes } from './lotesService';
import { saveOfflineCache } from './offlineCacheService';

export type OfflinePreparationResult = {
  savedKeys: string[];
};

function isNonEmptyArray(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

async function saveIfUseful<T>(savedKeys: string[], key: string, value: T | null) {
  if (value == null) return;
  if (Array.isArray(value) && value.length === 0) return;
  await saveOfflineCache(key, value);
  savedKeys.push(key);
}

export async function prepareOfflineData(): Promise<OfflinePreparationResult> {
  const savedKeys: string[] = [];
  const [catalogos, productores, clientes, lotes, bodega, dashboard] =
    await Promise.allSettled([
      obtenerCatalogosCompra(),
      listarProductores(),
      listarClientes(),
      obtenerLotes(),
      obtenerConfiguracionBodega(),
      obtenerDashboardSummary(),
    ]);

  if (catalogos.status === 'fulfilled') {
    await saveIfUseful(savedKeys, 'catalog_tipos_cafe', catalogos.value.tiposCafe);
    await saveIfUseful(savedKeys, 'catalog_calidades', catalogos.value.calidades);
  }

  if (productores.status === 'fulfilled' && isNonEmptyArray(productores.value)) {
    await saveIfUseful(savedKeys, 'catalog_productores', productores.value);
  }

  if (clientes.status === 'fulfilled' && isNonEmptyArray(clientes.value)) {
    await saveIfUseful(savedKeys, 'catalog_clientes', clientes.value);
  }

  if (lotes.status === 'fulfilled' && isNonEmptyArray(lotes.value)) {
    await saveIfUseful(savedKeys, 'inventory_sublotes', lotes.value);
    await saveIfUseful(savedKeys, 'inventory_list', lotes.value);
    await saveIfUseful(
      savedKeys,
      'secado_green_sublotes',
      lotes.value.filter((lote) => /verde/i.test(lote.tipoCafe) && lote.pesoActual > 0),
    );
  }

  if (bodega.status === 'fulfilled') {
    await saveIfUseful(savedKeys, 'warehouse_capacity', bodega.value);
  }

  if (dashboard.status === 'fulfilled') {
    await saveIfUseful(savedKeys, 'cached_dashboard_home', {
      summary: dashboard.value,
      lotesBodega: lotes.status === 'fulfilled' ? lotes.value : [],
      savedAt: new Date().toISOString(),
    });
    await saveIfUseful(savedKeys, 'dashboard_inventory_summary', {
      kgActual: dashboard.value.kgActual,
      kgCapacidad: dashboard.value.kgCapacidad,
      inventarioPorTipo: dashboard.value.inventarioPorTipo,
      updatedAt: dashboard.value.updatedAt,
    });
    await saveIfUseful(savedKeys, 'inventory_summary', {
      kgActual: dashboard.value.kgActual,
      kgCapacidad: dashboard.value.kgCapacidad,
      inventarioPorTipo: dashboard.value.inventarioPorTipo,
      updatedAt: dashboard.value.updatedAt,
    });
  }

  return { savedKeys };
}
