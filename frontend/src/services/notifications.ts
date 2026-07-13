import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { LocalNotifications } from '@capacitor/local-notifications';

export type CafeSmartNotificationPermissionStatus =
  | 'prompt'
  | 'granted'
  | 'denied'
  | 'unsupported';

export type CafeSmartNotificationPayload = {
  title?: string;
  body: string;
  id?: number;
};

const NOTIFICATIONS_ENABLED_KEY = 'cafesmart:notifications-enabled:v1';
const DEFAULT_TITLE = 'Café Smart';
const DEFAULT_BODY = 'Las notificaciones están funcionando correctamente.';
const DEFAULT_ICON = '/icons/icon-192.png';

function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function normalizeNativePermission(
  value?: string,
): CafeSmartNotificationPermissionStatus {
  if (value === 'granted') return 'granted';
  if (value === 'denied') return 'denied';
  if (value === 'prompt' || value === 'prompt-with-rationale') return 'prompt';
  return 'prompt';
}

function nextNotificationId() {
  return Math.max(1, Math.floor(Date.now() % 2147483647));
}

async function persistNotificationsEnabled(enabled: boolean) {
  try {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({
        key: NOTIFICATIONS_ENABLED_KEY,
        value: String(enabled),
      });
      return;
    }

    window.localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(enabled));
  } catch {
    // La preferencia interna nunca debe bloquear el permiso real del sistema.
  }
}

export function isNotificationSupported() {
  if (isNativeAndroid()) return true;
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function getNotificationPermissionStatus(): Promise<CafeSmartNotificationPermissionStatus> {
  if (!isNotificationSupported()) return 'unsupported';

  if (isNativeAndroid()) {
    const permission = await LocalNotifications.checkPermissions();
    return normalizeNativePermission(permission.display);
  }

  return Notification.permission === 'default'
    ? 'prompt'
    : Notification.permission;
}

export async function requestNotificationPermission(): Promise<CafeSmartNotificationPermissionStatus> {
  if (!isNotificationSupported()) return 'unsupported';

  if (isNativeAndroid()) {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'denied') {
      await persistNotificationsEnabled(false);
      return 'denied';
    }

    const permission = await LocalNotifications.requestPermissions();
    const status = normalizeNativePermission(permission.display);
    await persistNotificationsEnabled(status === 'granted');
    return status;
  }

  if (Notification.permission === 'denied') {
    await persistNotificationsEnabled(false);
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  const status = permission === 'default' ? 'prompt' : permission;
  await persistNotificationsEnabled(status === 'granted');
  return status;
}

export async function showLocalNotification(
  payload: CafeSmartNotificationPayload,
) {
  const status = await getNotificationPermissionStatus();
  if (status !== 'granted') {
    return { ok: false, status } as const;
  }

  const title = payload.title ?? DEFAULT_TITLE;
  const body = payload.body;

  if (isNativeAndroid()) {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: payload.id ?? nextNotificationId(),
          title,
          body,
          schedule: { at: new Date(Date.now() + 1000) },
        },
      ],
    });
    return { ok: true, status } as const;
  }

  new Notification(title, {
    body,
    icon: DEFAULT_ICON,
  });
  return { ok: true, status } as const;
}

export async function sendTestNotification() {
  return showLocalNotification({
    title: DEFAULT_TITLE,
    body: DEFAULT_BODY,
  });
}
