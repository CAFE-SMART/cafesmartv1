import { Capacitor, registerPlugin } from '@capacitor/core';

export type SystemScreenReaderStatus = {
  enabled: boolean;
  touchExplorationEnabled: boolean;
  spokenFeedbackEnabled: boolean;
  activeServices?: string[];
};

export type NativePermissionState = 'granted' | 'denied' | 'limited' | 'unavailable';

export type NativePermissionStatus = {
  state: NativePermissionState;
  canAskAgain?: boolean;
};

export type AppPermissionStatuses = {
  camera: NativePermissionStatus;
  photos: NativePermissionStatus;
  notifications: NativePermissionStatus;
};

const DEFAULT_SCREEN_READER_STATUS: SystemScreenReaderStatus = {
  enabled: false,
  touchExplorationEnabled: false,
  spokenFeedbackEnabled: false,
  activeServices: [],
};

const DEFAULT_PERMISSION_STATUSES: AppPermissionStatuses = {
  camera: { state: 'unavailable', canAskAgain: false },
  photos: { state: 'unavailable', canAskAgain: false },
  notifications: { state: 'unavailable', canAskAgain: false },
};

const CafeSmartAccessibility = registerPlugin<{
  getStatus: () => Promise<SystemScreenReaderStatus>;
  openAccessibilitySettings: () => Promise<void>;
  openAppSettings: () => Promise<void>;
  getPermissionStatuses: () => Promise<AppPermissionStatuses>;
  announce: (options: { message: string }) => Promise<void>;
}>('CafeSmartAccessibility');

export function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function isScreenReaderActive(status: SystemScreenReaderStatus | null) {
  return Boolean(status?.touchExplorationEnabled || status?.spokenFeedbackEnabled);
}

export async function isScreenReaderEnabled() {
  if (!isNativeAndroid()) return false;

  try {
    return isScreenReaderActive(await CafeSmartAccessibility.getStatus());
  } catch {
    return false;
  }
}

export async function getScreenReaderStatus() {
  if (!isNativeAndroid()) return DEFAULT_SCREEN_READER_STATUS;

  try {
    return await CafeSmartAccessibility.getStatus();
  } catch {
    return DEFAULT_SCREEN_READER_STATUS;
  }
}

export async function announceForAccessibility(message: string) {
  if (!message.trim() || !isNativeAndroid()) return;

  try {
    await CafeSmartAccessibility.announce({ message });
  } catch {
    // aria-live regions remain the primary announcement mechanism.
  }
}

export function subscribeToScreenReaderChanges(
  callback: (status: SystemScreenReaderStatus) => void,
) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  let active = true;
  const refresh = () => {
    void getScreenReaderStatus().then((status) => {
      if (active) callback(status);
    });
  };

  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);

  return () => {
    active = false;
    window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', refresh);
  };
}

export async function openAccessibilitySettings() {
  if (!isNativeAndroid()) return false;

  try {
    await CafeSmartAccessibility.openAccessibilitySettings();
    return true;
  } catch {
    return false;
  }
}

export async function openAppSettings() {
  if (!isNativeAndroid()) return false;

  try {
    await CafeSmartAccessibility.openAppSettings();
    return true;
  } catch {
    return false;
  }
}

export async function getAppPermissionStatuses() {
  if (!isNativeAndroid()) return DEFAULT_PERMISSION_STATUSES;

  try {
    return await CafeSmartAccessibility.getPermissionStatuses();
  } catch {
    return DEFAULT_PERMISSION_STATUSES;
  }
}
