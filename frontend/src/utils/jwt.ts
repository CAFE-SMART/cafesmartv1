function decodeBase64UrlSegment(segment: string) {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  );
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function tryDecodeUtf8Bytes(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function normalizePossiblyMojibake(value: string | null | undefined): string {
  const text = value ?? '';

  if (!/(Ã|Â|â)/.test(text)) {
    return text;
  }

  try {
    const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);
    const repaired =
      tryDecodeUtf8Bytes(bytes) ??
      decodeURIComponent(
        Array.from(bytes, (byte) => `%${byte.toString(16).padStart(2, '0')}`).join(''),
      );

    return repaired.includes('\uFFFD') ? text : repaired;
  } catch {
    return text;
  }
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
