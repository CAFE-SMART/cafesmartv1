function decodeBase64UrlSegment(segment: string) {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  );

  return atob(padded);
}

export function parseJwtPayload<T>(token: string): T | null {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) {
      return null;
    }

    return JSON.parse(decodeBase64UrlSegment(payloadSegment)) as T;
  } catch {
    return null;
  }
}
