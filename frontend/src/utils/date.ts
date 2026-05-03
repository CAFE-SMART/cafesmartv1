export function getTodayLocalDateValue(reference = new Date()) {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, '0');
  const day = String(reference.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const BUSINESS_MIN_DATE_VALUE = '2000-01-01';
export const BUSINESS_DATE_RANGE_MESSAGE =
  'Ingresa una fecha válida. Solo puedes registrar fechas desde el año 2000 hasta hoy.';

function parseDateValueStrict(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function validateBusinessDateRange(value: string, reference = new Date()) {
  if (!value.trim()) {
    return {
      isValid: false,
      message: 'Selecciona la fecha del registro.',
    };
  }

  const date = parseDateValueStrict(value);
  const minDate = parseDateValueStrict(BUSINESS_MIN_DATE_VALUE);
  const maxDate = parseDateValueStrict(getTodayLocalDateValue(reference));

  if (!date || !minDate || !maxDate || date < minDate || date > maxDate) {
    return {
      isValid: false,
      message: BUSINESS_DATE_RANGE_MESSAGE,
    };
  }

  return {
    isValid: true,
    message: null,
  };
}

function buildDateFromValue(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

export function getDaysInBodega(value: string, reference = new Date()) {
  const target = buildDateFromValue(value);

  if (Number.isNaN(target.getTime())) {
    return 0;
  }

  const today = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
  );
  const targetDay = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );

  const diffMs = today.getTime() - targetDay.getTime();
  return Math.max(0, Math.floor(diffMs / 86400000));
}

export function formatDateLabel(value: string) {
  const date = buildDateFromValue(value);

  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function toIsoDateAtUtcNoon(value: string) {
  if (!value.trim()) return undefined;

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
}
