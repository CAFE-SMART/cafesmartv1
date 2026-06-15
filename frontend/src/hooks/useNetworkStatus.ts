import { useCloudStatus } from '../context/CloudStatusContext';

export function useNetworkStatus() {
  const status = useCloudStatus();

  return {
    ...status,
    isOffline: !status.isOnline,
    backendUnavailable: status.isOnline && status.backendReachable === false,
    isReconnecting: status.tone === 'checking',
  };
}
