export class DashboardCache {
  data: any;
  expiry: number;
}

const DEFAULT_TTL_MS = 60 * 1000;

const cache: Map<string, DashboardCache> = new Map();

export function getCache(orgId: string): any | null {
  const entry = cache.get(orgId);
  if (!entry) return null;

  const { data, expiry } = entry;
  if (Date.now() < expiry) {
    return data;
  }

  return null;
}

export function setCache(orgId: string, data: unknown): void {
  cache.set(orgId, {
    data,
    expiry: Date.now() + DEFAULT_TTL_MS,
  });
}

export function invalidateCache(orgId: string): void {
  cache.delete(orgId);
}

export function invalidateAllCaches(orgIds: string[]): void {
  for (const orgId of orgIds) {
    cache.delete(orgId);
  }
}
