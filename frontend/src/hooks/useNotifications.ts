import { useCallback, useEffect, useState } from 'react';
import {
  getNotificationPermissionStatus,
  isNotificationSupported,
  requestNotificationPermission,
  sendTestNotification,
  type CafeSmartNotificationPermissionStatus,
} from '../services/notifications';

type NotificationActionResult = {
  ok: boolean;
  status: CafeSmartNotificationPermissionStatus;
  message?: string;
};

export function useNotifications() {
  const [status, setStatus] =
    useState<CafeSmartNotificationPermissionStatus>('prompt');
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const supported = isNotificationSupported();
      setIsSupported(supported);
      const nextStatus = await getNotificationPermissionStatus();
      setStatus(nextStatus);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshStatus]);

  const requestPermission =
    useCallback(async (): Promise<NotificationActionResult> => {
      setIsLoading(true);
      setMessage(null);
      try {
        const nextStatus = await requestNotificationPermission();
        setStatus(nextStatus);
        const nextMessage =
          nextStatus === 'granted'
            ? 'Notificaciones activadas'
            : nextStatus === 'denied'
              ? 'Notificaciones bloqueadas'
              : nextStatus === 'unsupported'
                ? 'Este navegador no admite notificaciones.'
                : 'Permiso pendiente';
        setMessage(nextMessage);
        return {
          ok: nextStatus === 'granted',
          status: nextStatus,
          message: nextMessage,
        };
      } finally {
        setIsLoading(false);
      }
    }, []);

  const sendTest = useCallback(async (): Promise<NotificationActionResult> => {
    setIsLoading(true);
    setMessage(null);
    try {
      const result = await sendTestNotification();
      setStatus(result.status);
      const nextMessage = result.ok
        ? 'Notificación de prueba enviada.'
        : result.status === 'denied'
          ? 'Notificaciones bloqueadas'
          : result.status === 'unsupported'
            ? 'Este navegador no admite notificaciones.'
            : 'Activa las notificaciones antes de probarlas.';
      setMessage(nextMessage);
      return { ok: result.ok, status: result.status, message: nextMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    status,
    isSupported,
    isLoading,
    message,
    refreshStatus,
    requestPermission,
    sendTestNotification: sendTest,
  };
}
