export const SEARCH_MAX_LENGTH = 60;
export const BODEGA_NAME_MAX_LENGTH = 40;
export const BODEGA_CAPACITY_MAX_KG = 100000;

export function sanitizeLimitedText(value: string, max: number) {
  return value.replace(/\s{2,}/g, ' ').slice(0, max);
}

export function sanitizeSearchInput(value: string) {
  return sanitizeLimitedText(value.replace(/[<>`"'\\{}[\]|]/g, ''), SEARCH_MAX_LENGTH);
}

export function sanitizePositiveIntegerInput(value: string, max: number) {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 9);
  if (!digits) return '';
  const numeric = Number(digits);
  return String(Math.min(max, Number.isFinite(numeric) ? numeric : max));
}
