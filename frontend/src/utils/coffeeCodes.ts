export type CoffeeCodeInput = {
  tipoCafe?: string | null;
  calidad?: string | null;
};

export const COFFEE_CODE_GLOSSARY = [
  { code: 'VB', label: 'Verde Bueno' },
  { code: 'VR', label: 'Verde Regular' },
  { code: 'VM', label: 'Verde Malo' },
  { code: 'PB', label: 'Pasilla Buena' },
  { code: 'PR', label: 'Pasilla Regular' },
  { code: 'PM', label: 'Pasilla Mala' },
  { code: 'SB', label: 'Seco Bueno' },
  { code: 'SR', label: 'Seco Regular' },
  { code: 'SM', label: 'Seco Malo' },
] as const;

function normalize(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function titleCase(value?: string | null) {
  const text = (value ?? '').trim().toLowerCase();
  if (!text) return '';
  return text
    .split(/\s+/)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function coffeeTypeLetter(tipoCafe?: string | null) {
  const key = normalize(tipoCafe);
  if (key.includes('PASILLA')) return 'P';
  if (key.includes('SECO')) return 'S';
  if (key.includes('VERDE')) return 'V';
  return key.charAt(0) || 'C';
}

function coffeeQualityLetter(calidad?: string | null) {
  const key = normalize(calidad);
  if (key.includes('REGULAR')) return 'R';
  if (key.includes('MALO') || key.includes('MALA') || key.includes('BAJO')) {
    return 'M';
  }
  if (key.includes('BUENO') || key.includes('BUENA') || key.includes('ALTO')) {
    return 'B';
  }
  return key.charAt(0) || 'X';
}

export function getCoffeeCodePrefix(input: CoffeeCodeInput) {
  return `${coffeeTypeLetter(input.tipoCafe)}${coffeeQualityLetter(input.calidad)}`;
}

export function formatCoffeeFullName(input: CoffeeCodeInput) {
  return [titleCase(input.tipoCafe), titleCase(input.calidad)]
    .filter(Boolean)
    .join(' ');
}

export function formatSubloteVisualCode(input: CoffeeCodeInput, index: number) {
  return `${getCoffeeCodePrefix(input)}-${String(index + 1).padStart(2, '0')}`;
}
