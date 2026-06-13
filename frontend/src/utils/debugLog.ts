function normalizeDebugValue(value: unknown) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack?.split('\n').slice(0, 3).join(' | '),
    };
  }

  return value;
}

export function toDebugJson(payload: Record<string, unknown>) {
  return JSON.stringify(
    payload,
    (_key, value) => normalizeDebugValue(value),
  );
}

export function logDebugLine(tag: string, payload: Record<string, unknown>) {
  console.info(`${tag} ${toDebugJson(payload)}`);
}
