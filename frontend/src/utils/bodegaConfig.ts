export type BodegaConfig = {
  nombreBodega: string;
  capacidadKg: number;
  updatedAt: string;
};

const STORAGE_KEY = 'cafesmart-bodega-config-v1';
export const DEFAULT_BODEGA_CAPACITY_KG = 3000;

function createDefaultConfig(): BodegaConfig {
  return {
    nombreBodega: 'Bodega principal',
    capacidadKg: DEFAULT_BODEGA_CAPACITY_KG,
    updatedAt: new Date().toISOString(),
  };
}

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : DEFAULT_BODEGA_CAPACITY_KG;
}

function safeDate(value: unknown) {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }

  return new Date().toISOString();
}

export function getBodegaConfig(): BodegaConfig {
  const defaultConfig = createDefaultConfig();

  if (typeof window === 'undefined') {
    return defaultConfig;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig;

    const parsed = JSON.parse(raw) as Partial<BodegaConfig>;
    const normalized: BodegaConfig = {
      nombreBodega: parsed.nombreBodega?.trim() || defaultConfig.nombreBodega,
      capacidadKg: Math.max(1, safeNumber(parsed.capacidadKg)),
      updatedAt: safeDate(parsed.updatedAt),
    };

    if (parsed.updatedAt !== normalized.updatedAt) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }

    return normalized;
  } catch {
    return defaultConfig;
  }
}

export function saveBodegaConfig(nextConfig: BodegaConfig) {
  const defaultConfig = createDefaultConfig();
  const normalized: BodegaConfig = {
    nombreBodega: nextConfig.nombreBodega.trim() || defaultConfig.nombreBodega,
    capacidadKg: Math.max(1, safeNumber(nextConfig.capacidadKg)),
    updatedAt: safeDate(nextConfig.updatedAt),
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
}
