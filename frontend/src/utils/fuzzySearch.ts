import { useEffect, useState } from 'react';

export function normalizeFuzzyText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function useDebouncedValue<T>(value: T, delayMs = 180) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

function damerauLevenshtein(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );

      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }

  return matrix[a.length][b.length];
}

function isSubsequence(query: string, candidate: string) {
  if (query.length < 3) return false;
  let cursor = 0;
  for (const char of candidate) {
    if (char === query[cursor]) cursor += 1;
    if (cursor === query.length) return true;
  }
  return false;
}

function tokenMatches(queryToken: string, candidateToken: string) {
  if (!queryToken) return true;
  if (!candidateToken) return false;
  if (candidateToken.includes(queryToken) || candidateToken.startsWith(queryToken)) {
    return true;
  }
  if (queryToken.length >= 3 && isSubsequence(queryToken, candidateToken)) {
    return true;
  }

  const maxLength = Math.max(queryToken.length, candidateToken.length);
  const allowedDistance = Math.max(1, Math.ceil(maxLength * 0.42));
  return damerauLevenshtein(queryToken, candidateToken) <= allowedDistance;
}

function tokenScore(queryToken: string, candidateToken: string) {
  if (candidateToken.startsWith(queryToken)) return 0;
  if (candidateToken.includes(queryToken)) return 0.25;
  if (isSubsequence(queryToken, candidateToken)) return 0.5;
  return damerauLevenshtein(queryToken, candidateToken);
}

function scoreCandidate(query: string, candidate: string) {
  const queryTokens = normalizeFuzzyText(query).split(' ').filter(Boolean);
  const candidateText = normalizeFuzzyText(candidate);
  if (!queryTokens.length) return 0;
  if (!candidateText) return Number.POSITIVE_INFINITY;

  const candidateTokens = candidateText.split(' ').filter(Boolean);
  const compactQuery = queryTokens.join('');
  const compactCandidate = candidateTokens.join('');

  if (candidateText.includes(queryTokens.join(' ')) || compactCandidate.includes(compactQuery)) {
    return 0;
  }

  let score = 0;
  for (const token of queryTokens) {
    let best = Number.POSITIVE_INFINITY;
    for (const candidateToken of candidateTokens) {
      if (tokenMatches(token, candidateToken)) {
        best = Math.min(best, tokenScore(token, candidateToken));
      }
    }
    if (!Number.isFinite(best)) return Number.POSITIVE_INFINITY;
    score += best;
  }

  return score + Math.abs(compactCandidate.length - compactQuery.length) / 10;
}

export function fuzzySearch<T>(
  items: T[],
  query: string,
  getValues: (item: T) => Array<unknown>,
  maxResults = items.length,
) {
  const normalizedQuery = normalizeFuzzyText(query);
  if (!normalizedQuery) {
    return { items, isSimilar: false };
  }

  const exactMatches = items.filter((item) =>
    getValues(item).some((value) => {
      const normalizedValue = normalizeFuzzyText(value);
      const valueTokens = normalizedValue.split(' ').filter(Boolean);
      const queryTokens = normalizedQuery.split(' ').filter(Boolean);
      return (
        normalizedValue.includes(normalizedQuery) ||
        valueTokens.some((token) => token.startsWith(normalizedQuery)) ||
        queryTokens.every((queryToken) =>
          valueTokens.some((valueToken) => valueToken.startsWith(queryToken)),
        )
      );
    }),
  );

  if (exactMatches.length > 0) {
    return { items: exactMatches, isSimilar: false };
  }

  const similarMatches = items
    .map((item) => {
      const score = Math.min(
        ...getValues(item).map((value) => scoreCandidate(normalizedQuery, String(value ?? ''))),
      );
      return { item, score };
    })
    .filter(({ score }) => Number.isFinite(score) && score <= Math.max(2, normalizedQuery.length * 0.75))
    .sort((a, b) => a.score - b.score)
    .slice(0, maxResults)
    .map(({ item }) => item);

  return { items: similarMatches, isSimilar: similarMatches.length > 0 };
}
