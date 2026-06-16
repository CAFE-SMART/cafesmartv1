import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import API_BASE_URL from '../config/api';

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PASSWORD_RESET_TIMEOUT_MS = 15_000;

type ResetPasswordStatus = 'idle' | 'loading' | 'success' | 'error';

type ResetPasswordErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'NETWORK' | 'TEMPORARY';

type ResetPasswordError = {
  code: ResetPasswordErrorCode;
  message: string;
};

type ResetPasswordOptions = {
  origin?: string;
};

function normalizeApiBaseUrl() {
  return API_BASE_URL.replace(/\/$/, '');
}

function logResetPasswordDebug(event: string, payload: Record<string, unknown>) {
  console.info(`[CafeSmart][reset-password] ${event} ${JSON.stringify(payload)}`);
}

function buildResetError(
  code: ResetPasswordErrorCode,
  message: string,
): ResetPasswordError {
  return { code, message };
}

function isEmailNotFound(status: number, payload: unknown) {
  if (status === 404) return true;

  if (!payload || typeof payload !== 'object') return false;

  const data = payload as { code?: unknown; message?: unknown };
  const code = typeof data.code === 'string' ? data.code.toUpperCase() : '';
  const message =
    typeof data.message === 'string' ? data.message.toLowerCase() : '';

  return (
    code === 'EMAIL_NOT_FOUND' ||
    code === 'USER_NOT_FOUND' ||
    message.includes('correo') && message.includes('registr')
  );
}

function getPayloadMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') return '';

  const data = payload as { message?: unknown; error?: unknown };
  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message.trim();
  }

  if (Array.isArray(data.message)) {
    return data.message.filter(Boolean).join(', ').trim();
  }

  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error.trim();
  }

  return '';
}

async function requestPasswordReset(email: string, origin: string) {
  let response: Response;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    PASSWORD_RESET_TIMEOUT_MS,
  );
  const url = `${normalizeApiBaseUrl()}/auth/forgot-password`;

  try {
    logResetPasswordDebug(`origin=${origin}`, { origin });
    logResetPasswordDebug('request', {
      origin,
      method: 'POST',
      url,
      bodyKeys: ['email'],
    });

    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });
  } catch (error) {
    logResetPasswordDebug('error', {
      origin,
      type: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
    });
    throw buildResetError('NETWORK', 'No pudimos enviar el enlace.');
  } finally {
    window.clearTimeout(timeoutId);
  }

  const payload = await response.json().catch(() => null);
  logResetPasswordDebug('response status', {
    origin,
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    const payloadMessage = getPayloadMessage(payload);

    if (isEmailNotFound(response.status, payload)) {
      throw buildResetError(
        'NOT_FOUND',
        payloadMessage || 'No encontramos una cuenta asociada a este correo.',
      );
    }

    throw buildResetError(
      response.status >= 500 ? 'TEMPORARY' : 'NETWORK',
      payloadMessage ||
        (response.status >= 500
          ? 'Ocurrió un problema temporal. Intenta nuevamente.'
          : 'No pudimos enviar el enlace.'),
    );
  }
}

export function useResetPassword(options: ResetPasswordOptions = {}) {
  const origin = options.origin ?? 'login';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<ResetPasswordStatus>('idle');
  const [error, setError] = useState<ResetPasswordError | null>(null);
  const [enlaceEnviado, setEnlaceEnviado] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (!enlaceEnviado) return undefined;

    setCooldownSeconds(60);
  }, [enlaceEnviado]);

  useEffect(() => {
    if (!enlaceEnviado || cooldownSeconds <= 0) return undefined;

    const intervalId = window.setInterval(() => {
      setCooldownSeconds((currentSeconds) => Math.max(currentSeconds - 1, 0));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [cooldownSeconds, enlaceEnviado]);

  useEffect(() => {
    if (!error || (error.code !== 'NETWORK' && error.code !== 'TEMPORARY')) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setError(null);
    }, 5500);

    return () => window.clearTimeout(timeoutId);
  }, [error]);

  const validateEmail = () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      return 'Ingresa tu correo electrónico.';
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      return 'Ingresa un correo electrónico válido.';
    }

    return null;
  };

  const submit = async () => {
    const validationError = validateEmail();

    setError(null);

    if (validationError) {
      setStatus('idle');
      setError(buildResetError('VALIDATION', validationError));
      return;
    }

    setStatus('loading');
    let nextStatus: ResetPasswordStatus = 'error';

    try {
      await requestPasswordReset(email.trim().toLowerCase(), origin);
      nextStatus = 'success';
      setError(null);
      setEnlaceEnviado(true);
    } catch (caughtError) {
      const resetError = caughtError as Partial<ResetPasswordError>;
      setError(
        buildResetError(
          resetError.code ?? 'TEMPORARY',
          resetError.message ||
            (resetError.code === 'NOT_FOUND'
            ? 'No encontramos una cuenta asociada a este correo.'
            : resetError.code === 'NETWORK'
              ? 'No pudimos enviar el enlace.'
              : 'Ocurrió un problema temporal. Intenta nuevamente.'),
        ),
      );
    } finally {
      setStatus(nextStatus);
    }
  };

  const reenviarEnlace = async () => {
    if (status === 'loading' || cooldownSeconds > 0) return;

    setError(null);
    setStatus('loading');

    try {
      await requestPasswordReset(email.trim().toLowerCase(), origin);
      setError(null);
      setEnlaceEnviado(true);
      setCooldownSeconds(60);
    } catch (caughtError) {
      const resetError = caughtError as Partial<ResetPasswordError>;
      setError(
        buildResetError(
          resetError.code ?? 'TEMPORARY',
          resetError.message ||
            (resetError.code === 'NOT_FOUND'
            ? 'No encontramos una cuenta asociada a este correo.'
            : resetError.code === 'NETWORK'
              ? 'No pudimos enviar el enlace.'
              : 'Ocurrió un problema temporal. Intenta nuevamente.'),
        ),
      );
    } finally {
      setStatus('success');
    }
  };

  const usarOtroCorreo = () => {
    setEnlaceEnviado(false);
    setStatus('idle');
    setError(null);
    setCooldownSeconds(0);
    setEmail('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  return {
    email,
    setEmail,
    error,
    enlaceEnviado,
    cooldownSeconds,
    isLoading: status === 'loading',
    isSuccess: enlaceEnviado,
    handleSubmit,
    reenviarEnlace,
    usarOtroCorreo,
  };
}
