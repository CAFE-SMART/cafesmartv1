export type BodegaConfig = {
  nombreBodega: string;
  capacidadKg: number;
};

const STORAGE_KEY = 'cafesmart-bodega-config-v1';
export const DEFAULT_BODEGA_CAPACITY_KG = 3000;

const DEFAULT_CONFIG: BodegaConfig = {
  nombreBodega: 'Bodega principal',
  capacidadKg: DEFAULT_BODEGA_CAPACITY_KG,
};

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : DEFAULT_BODEGA_CAPACITY_KG;
}

export function getBodegaConfig(): BodegaConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_CONFIG;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;

    const parsed = JSON.parse(raw) as Partial<BodegaConfig>;
    return {
      nombreBodega: parsed.nombreBodega?.trim() || DEFAULT_CONFIG.nombreBodega,
      capacidadKg: Math.max(1, safeNumber(parsed.capacidadKg)),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveBodegaConfig(nextConfig: BodegaConfig) {
  const normalized: BodegaConfig = {
    nombreBodega: nextConfig.nombreBodega.trim() || DEFAULT_CONFIG.nombreBodega,
    capacidadKg: Math.max(1, safeNumber(nextConfig.capacidadKg)),
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
}
