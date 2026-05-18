import { Preferences } from '@capacitor/preferences';

const DEVICE_ID_KEY = 'cafesmart-device-id';

function generarId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function obtenerDeviceId() {
  const { value } = await Preferences.get({ key: DEVICE_ID_KEY });

  if (value) {
    return value;
  }

  const nuevo = generarId();
  await Preferences.set({ key: DEVICE_ID_KEY, value: nuevo });
  return nuevo;
}
