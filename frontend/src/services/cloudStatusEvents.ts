export const CLOUD_STATUS_EVENT = 'cafe-smart-cloud-status';

export type CloudStatusEventDetail = {
  status: 'syncing' | 'synced' | 'error';
  source: 'login' | 'login-google' | 'register' | 'register-google' | 'sync';
  message: string;
};

export function emitCloudStatusEvent(detail: CloudStatusEventDetail) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<CloudStatusEventDetail>(CLOUD_STATUS_EVENT, {
      detail,
    }),
  );
}
