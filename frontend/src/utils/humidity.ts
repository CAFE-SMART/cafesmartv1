export type HumidityQuality = 'buena' | 'regular' | 'deficiente' | 'sin_dato';

export type HumidityClassification = {
  quality: HumidityQuality;
  label: string;
  toneClass: string;
};

export function classifyHumidity(
  value: number | null | undefined,
): HumidityClassification {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return {
      quality: 'sin_dato',
      label: 'Sin dato',
      toneClass: 'bg-slate-100 text-slate-500',
    };
  }

  if (value >= 10 && value <= 12) {
    return {
      quality: 'buena',
      label: 'Buena',
      toneClass: 'bg-emerald-50 text-emerald-700',
    };
  }

  if ((value >= 9 && value < 10) || (value > 12 && value <= 12.5)) {
    return {
      quality: 'regular',
      label: 'Regular',
      toneClass: 'bg-amber-50 text-amber-700',
    };
  }

  return {
    quality: 'deficiente',
    label: 'Deficiente',
    toneClass: 'bg-rose-50 text-rose-700',
  };
}

export function formatHumidityWithClassification(
  value: number | null | undefined,
) {
  const classification = classifyHumidity(value);

  if (classification.quality === 'sin_dato') {
    return classification.label;
  }

  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value as number)} % · ${classification.label}`;
}
