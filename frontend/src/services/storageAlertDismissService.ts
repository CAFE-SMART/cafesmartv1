const STORAGE_KEY = 'cafesmart:dismissed-storage-alerts';
const RELEVANT_USED_KG_DELTA = 20;

export type StorageAlertData = {
  occupancyPercent: number;
  capacityKg: number;
  usedKg: number;
};

type DismissedStorageAlert = StorageAlertData & {
  dismissedAt: string;
};

type DismissedStorageAlerts = Record<
  string,
  {
    storageAlmostFull?: DismissedStorageAlert;
  }
>;

function readDismissals(): DismissedStorageAlerts {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as DismissedStorageAlerts)
      : {};
  } catch {
    return {};
  }
}

function writeDismissals(value: DismissedStorageAlerts) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function getStorageAlertKey(empresaId?: string | number | null) {
  return String(empresaId ?? 'default-company');
}

export function getDismissedStorageAlert(empresaId?: string | number | null) {
  return readDismissals()[getStorageAlertKey(empresaId)]?.storageAlmostFull ?? null;
}

export function dismissStorageAlert(
  empresaId: string | number | null | undefined,
  data: StorageAlertData,
) {
  const dismissals = readDismissals();
  const key = getStorageAlertKey(empresaId);
  dismissals[key] = {
    ...dismissals[key],
    storageAlmostFull: {
      ...data,
      dismissedAt: new Date().toISOString(),
    },
  };
  writeDismissals(dismissals);
}

export function shouldShowStorageAlert(
  empresaId: string | number | null | undefined,
  current: StorageAlertData | null,
) {
  if (!current) return false;
  const dismissed = getDismissedStorageAlert(empresaId);
  if (!dismissed) return true;

  const capacityChanged = dismissed.capacityKg !== current.capacityKg;
  const occupancyIncreased =
    current.occupancyPercent > dismissed.occupancyPercent;
  const usedChangedMeaningfully =
    Math.abs(current.usedKg - dismissed.usedKg) >= RELEVANT_USED_KG_DELTA;

  return capacityChanged || occupancyIncreased || usedChangedMeaningfully;
}

export const STORAGE_ALERT_DISMISS_KEY = STORAGE_KEY;
