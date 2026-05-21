export type CoffeeCodeInput = {
  tipoCafe?: string | null;
  calidad?: string | null;
};

export type SubloteCodeInput = CoffeeCodeInput & {
  id?: string | null;
  codigo?: string | null;
  etiqueta?: string | null;
  fechaIngreso?: string | null;
  createdAt?: string | null;
  creadoEn?: string | null;
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

export function formatSubloteSequenceCode(input: CoffeeCodeInput, sequence: number) {
  const safeSequence = Math.max(1, Math.trunc(sequence || 1));
  return `${getCoffeeCodePrefix(input)}-${String(safeSequence).padStart(2, '0')}`;
}

export function getSubloteDisplayCode(input: SubloteCodeInput, fallbackIndex = 0) {
  const expectedPrefix = getCoffeeCodePrefix(input);
  const explicitCode = input.codigo?.trim();
  if (explicitCode && explicitCode.toUpperCase().startsWith(`${expectedPrefix}-`)) {
    return explicitCode.toUpperCase();
  }

  const etiqueta = input.etiqueta?.trim();
  if (etiqueta && etiqueta.toUpperCase().startsWith(`${expectedPrefix}-`)) {
    return etiqueta.toUpperCase();
  }

  return formatSubloteVisualCode(input, fallbackIndex);
}

function getSubloteSortTime(input: SubloteCodeInput) {
  const raw = input.fechaIngreso ?? input.createdAt ?? input.creadoEn ?? '';
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

export function getSubloteCodeMap<T extends SubloteCodeInput>(sublotes: T[]) {
  const counters = new Map<string, number>();
  const codes = new Map<string, string>();

  [...sublotes]
    .sort((a, b) => {
      const prefixCompare = getCoffeeCodePrefix(a).localeCompare(getCoffeeCodePrefix(b));
      if (prefixCompare !== 0) return prefixCompare;
      const timeCompare = getSubloteSortTime(a) - getSubloteSortTime(b);
      if (timeCompare !== 0) return timeCompare;
      return String(a.id ?? '').localeCompare(String(b.id ?? ''));
    })
    .forEach((sublote) => {
      const id = sublote.id;
      if (!id) return;
      const prefix = getCoffeeCodePrefix(sublote);
      const rawExplicitCode = sublote.codigo?.trim() || sublote.etiqueta?.trim() || '';
      const explicitMatch = rawExplicitCode.match(new RegExp(`^${prefix}-(\\d+)$`, 'i'));
      if (explicitMatch) {
        const explicitSequence = Number(explicitMatch[1]);
        counters.set(prefix, Math.max(counters.get(prefix) ?? 0, explicitSequence));
        codes.set(id, rawExplicitCode.toUpperCase());
        return;
      }
      const nextSequence = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, nextSequence);
      codes.set(id, formatSubloteSequenceCode(sublote, nextSequence));
    });

  return codes;
}
