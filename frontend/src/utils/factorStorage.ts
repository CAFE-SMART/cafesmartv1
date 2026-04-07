type FactorEntry = {
  lotKey: string;
  subloteId: string;
  factor: number;
};

const STORAGE_KEY = 'cafesmart-factor-seco-bueno-v1';

function readEntries() {
  if (typeof window === 'undefined') return [] as FactorEntry[];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [] as FactorEntry[];

    const parsed = JSON.parse(raw) as FactorEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as FactorEntry[];
  }
}

function writeEntries(entries: FactorEntry[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function getFactorForSublote(subloteId: string) {
  const match = readEntries().find((entry) => entry.subloteId === subloteId);
  return match ? match.factor : null;
}

export function getAverageFactorForLot(lotKey: string) {
  const lotEntries = readEntries().filter((entry) => entry.lotKey === lotKey);
  if (lotEntries.length === 0) return null;

  const average =
    lotEntries.reduce((sum, entry) => sum + entry.factor, 0) / lotEntries.length;

  return Number(average.toFixed(2));
}

export function saveFactorsForLot(
  lotKey: string,
  factors: Array<{ subloteId: string; factor: number | null }>,
) {
  const current = readEntries().filter((entry) => entry.lotKey !== lotKey);
  const next = [...current];

  for (const item of factors) {
    if (item.factor === null || !Number.isFinite(item.factor)) continue;

    next.push({
      lotKey,
      subloteId: item.subloteId,
      factor: Number(item.factor.toFixed(2)),
    });
  }

  writeEntries(next);
}
