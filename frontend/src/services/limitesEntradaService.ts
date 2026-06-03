import {
  PESO_MAXIMO_OPERATIVO_DEFAULT_KG,
  PESO_MINIMO_KG,
  PRECIO_MAXIMO_KG,
  PRECIO_MINIMO_KG,
} from '../utils/businessRules';
import type { ConfiguracionBodega } from './bodegaApi';

const LIMITES_ENTRADA_STORAGE_KEY = 'cafesmart_limites_entrada';

export type LimitesTransaccion = {
  minPesoCompraKg: number;
  maxPesoCompraKg: number;
  minPrecioCompraKg: number;
  maxPrecioCompraKg: number;
  minPrecioVentaKg: number;
  maxPrecioVentaKg: number;
};

export const LIMITES_TRANSACCION_DEFAULT: LimitesTransaccion = {
  minPesoCompraKg: PESO_MINIMO_KG,
  maxPesoCompraKg: PESO_MAXIMO_OPERATIVO_DEFAULT_KG,
  minPrecioCompraKg: PRECIO_MINIMO_KG,
  maxPrecioCompraKg: PRECIO_MAXIMO_KG,
  minPrecioVentaKg: PRECIO_MINIMO_KG,
  maxPrecioVentaKg: PRECIO_MAXIMO_KG,
};

let limitesCache = { ...LIMITES_TRANSACCION_DEFAULT };

function toPositiveNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function normalizeLimites(
  value?: Partial<LimitesTransaccion> | null,
  config?: Partial<ConfiguracionBodega> | null,
): LimitesTransaccion {
  const base = {
    ...LIMITES_TRANSACCION_DEFAULT,
    maxPesoCompraKg: toPositiveNumber(
      config?.maxPesoKg,
      LIMITES_TRANSACCION_DEFAULT.maxPesoCompraKg,
    ),
    maxPrecioCompraKg: toPositiveNumber(
      config?.maxPrecioKg,
      LIMITES_TRANSACCION_DEFAULT.maxPrecioCompraKg,
    ),
    maxPrecioVentaKg: toPositiveNumber(
      config?.maxPrecioVentaKg,
      LIMITES_TRANSACCION_DEFAULT.maxPrecioVentaKg,
    ),
    ...value,
  };

  return {
    minPesoCompraKg: toPositiveNumber(
      base.minPesoCompraKg,
      LIMITES_TRANSACCION_DEFAULT.minPesoCompraKg,
    ),
    maxPesoCompraKg: toPositiveNumber(
      base.maxPesoCompraKg,
      LIMITES_TRANSACCION_DEFAULT.maxPesoCompraKg,
    ),
    minPrecioCompraKg: toPositiveNumber(
      base.minPrecioCompraKg,
      LIMITES_TRANSACCION_DEFAULT.minPrecioCompraKg,
    ),
    maxPrecioCompraKg: toPositiveNumber(
      base.maxPrecioCompraKg,
      LIMITES_TRANSACCION_DEFAULT.maxPrecioCompraKg,
    ),
    minPrecioVentaKg: toPositiveNumber(
      base.minPrecioVentaKg,
      LIMITES_TRANSACCION_DEFAULT.minPrecioVentaKg,
    ),
    maxPrecioVentaKg: toPositiveNumber(
      base.maxPrecioVentaKg,
      LIMITES_TRANSACCION_DEFAULT.maxPrecioVentaKg,
    ),
  };
}

function readStoredLimites() {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(LIMITES_ENTRADA_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<LimitesTransaccion>) : null;
  } catch {
    return null;
  }
}

export function obtenerLimitesEntradaLocales(
  config?: Partial<ConfiguracionBodega> | null,
) {
  limitesCache = normalizeLimites(readStoredLimites(), config);
  return limitesCache;
}

export function guardarLimitesEntradaLocales(limites: LimitesTransaccion) {
  limitesCache = normalizeLimites(limites);
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        LIMITES_ENTRADA_STORAGE_KEY,
        JSON.stringify(limitesCache),
      );
    }
  } catch {
    // El backend sigue guardando los máximos; el almacenamiento local mejora la UX.
  }
  return limitesCache;
}

export function configurarLimitesEntradaCache(
  config?: Partial<ConfiguracionBodega> | null,
) {
  limitesCache = obtenerLimitesEntradaLocales(config);
  return limitesCache;
}

export function getLimitesEntradaSnapshot() {
  return limitesCache;
}
