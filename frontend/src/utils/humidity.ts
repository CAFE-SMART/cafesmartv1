export type HumidityQuality =
  | 'buena'
  | 'advertencia'
  | 'descuento'
  | 'rechazada'
  | 'sin_dato';

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

  if (value < 8 || value > 14) {
    return {
      quality: 'rechazada',
      label: value < 8 ? 'Muy seca' : 'Rechazada',
      toneClass: 'bg-rose-50 text-rose-700',
    };
  }

  if (value >= 10 && value <= 12) {
    return {
      quality: 'buena',
      label: 'Buena',
      toneClass: 'bg-emerald-50 text-emerald-700',
    };
  }

  if (value >= 8 && value < 10) {
    return {
      quality: 'advertencia',
      label: 'Advertencia',
      toneClass: 'bg-amber-50 text-amber-700',
    };
  }

  return {
    quality: 'descuento',
    label: 'Advertencia con descuento',
    toneClass: 'bg-orange-50 text-orange-700',
  };
}

export function getHumidityValidationMessage(value: number | null) {
  if (value === null) return null;
  if (!Number.isFinite(value)) return 'Ingresa un valor válido para continuar.';
  if (value < 8) return 'La humedad es menor a 8%. Revisa el dato antes de guardar.';
  if (value > 14) return 'La humedad supera 14%. No se puede guardar ese valor.';
  if (value < 10) return 'Humedad baja. Puedes continuar si confirmas el dato.';
  if (value > 12) return 'Humedad alta. Puede aplicar descuento.';
  return null;
}

export function getFactorValidationMessage(value: number | null) {
  if (value === null) return null;
  if (!Number.isFinite(value)) return 'Ingresa un valor válido para continuar.';
  if (value < 80) return 'El factor no puede ser menor a 80.';
  if (value > 120) return 'El factor no puede ser mayor a 120.';
  if (value < 94) return 'Factor con bonificación frente al precio base.';
  if (value > 94) return 'Factor mayor a 94. Revisa posible castigo de precio.';
  return 'Factor base.';
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
