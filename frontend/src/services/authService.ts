import { buildOfflineAuthError, mapFriendlyAuthMessage } from '../utils/authMessages';
import API_ROOT_URL from '../config/api';
import { emitCloudStatusEvent } from './cloudStatusEvents';

// 🔥 Endpoint base
const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const AUTH_REQUEST_TIMEOUT_MS = 30000;

export type AuthError = {
  message: string;
  field: string | null;
  details?: Record<string, string[]>;
  action?: string | null;
  debug?: unknown;
  code: 'OFFLINE' | 'HTTP' | 'UNKNOWN';
  status?: number;
};

export type AuthResponse = {
  message: string;
  access_token: string;
  user: {
    id: number | string;
    email: string;
    name: string;
    telefono?: string | null;
    organizacionId?: string | null;
    nombreOrganizacion?: string | null;
    tipoOrganizacion?: 'COOPERATIVA' | 'COMPRAVENTA' | 'OTRO' | null;
    otroTipoDetalle?: string | null;
  };
  hasCompany: boolean;
};

type RawApiError = {
  message?: string | string[];
  field?: string;
  details?: Record<string, string[]>;
  action?: string;
  debug?: unknown;
  path?: string;
  raw?: string;
  statusCode?: number;
};

type CloudTrackingConfig = {
  enabled?: boolean;
  source?: 'login' | 'login-google' | 'register' | 'register-google' | 'sync';
  syncingMessage?: string;
  successMessage?: string;
};

function construirBasesAuth() {
  const apiBaseConfigurada = API_ROOT_URL.replace(/\/$/, '');
  const candidatas = [apiBaseConfigurada];

  if (typeof window === 'undefined') {
    return candidatas;
  }

  try {
    const urlConfigurada = new URL(apiBaseConfigurada);
    const hostActual = window.location.hostname?.trim();

    if (
      hostActual &&
      !HOSTS_LOCALES.has(hostActual) &&
      HOSTS_LOCALES.has(urlConfigurada.hostname)
    ) {
      candidatas.push(
        `${urlConfigurada.protocol}//${hostActual}${
          urlConfigurada.port ? `:${urlConfigurada.port}` : ''
        }`,
      );
    }
  } catch {
    return candidatas;
  }

  return [...new Set(candidatas)].map((apiBaseUrl) => `${apiBaseUrl}/auth`);
}

function isNetworkFetchError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    error.name === 'AbortError' ||
    message.includes('aborted') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed')
  );
}

async function fetchWithTimeout(url: string, options: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function postAuth<TResponse>(
  endpoint: string,
  body: Record<string, unknown>,
  fallbackError: string,
  cloudTracking?: CloudTrackingConfig,
): Promise<TResponse> {
  try {
    if (cloudTracking?.enabled) {
      emitCloudStatusEvent({
        status: 'syncing',
        source: cloudTracking.source ?? 'sync',
        message: cloudTracking.syncingMessage ?? 'Sincronizando con la nube...',
      });
    }

    let response: Response | null = null;
    let lastNetworkError: unknown = null;

    for (const authBaseUrl of construirBasesAuth()) {
      try {
        response = await fetchWithTimeout(`${authBaseUrl}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        break;
      } catch (error) {
        lastNetworkError = error;

        if (!isNetworkFetchError(error)) {
          throw error;
        }
      }
    }

    if (!response) {
      throw lastNetworkError;
    }

    const responseText = await response.text();
    let data: TResponse & RawApiError;

    try {
      data = (responseText ? JSON.parse(responseText) : {}) as TResponse & RawApiError;
    } catch (parseError) {
      if (import.meta.env.DEV) {
        console.error('AUTH API PARSE ERROR', {
          endpoint,
          status: response.status,
          raw: responseText,
          error: parseError,
        });
      }

      throw {
        message: 'El servidor respondió algo que no es JSON válido. Revisa la terminal del backend.',
        field: null,
        code: 'UNKNOWN',
        status: response.status,
      } as AuthError;
    }

    if (!response.ok) {
      if (import.meta.env.DEV) {
        console.error('AUTH API ERROR', {
          endpoint,
          status: response.status,
          message: data.message,
          path: data.path,
          debug: data.debug,
          details: data.details,
          raw: responseText,
        });
      }

      const authError: AuthError = {
        message: mapFriendlyAuthMessage(endpoint, data, fallbackError),
        field: data.field ?? null,
        details: data.details,
        action: data.action ?? null,
        debug: data.debug,
        code: 'HTTP',
        status: response.status,
      };
      throw authError;
    }

    if (cloudTracking?.enabled) {
      emitCloudStatusEvent({
        status: 'synced',
        source: cloudTracking.source ?? 'sync',
        message: cloudTracking.successMessage ?? 'Información sincronizada correctamente.',
      });
    }

    return data;
  } catch (error) {
    if (cloudTracking?.enabled) {
      const knownError = error as Partial<AuthError>;
      emitCloudStatusEvent({
        status: 'error',
        source: cloudTracking.source ?? 'sync',
        message: knownError.message || 'No pudimos completar la operación con la nube.',
      });
    }

    if (isNetworkFetchError(error)) {
      throw buildOfflineAuthError();
    }

    const knownError = error as Partial<AuthError>;
    throw {
      message: knownError.message || 'No pudimos conectar con el servidor.',
      field: knownError.field ?? null,
      details: knownError.details,
      action: knownError.action ?? null,
      debug: knownError.debug,
      code: knownError.code ?? 'UNKNOWN',
      status: knownError.status,
    } as AuthError;
  }
}

export const authService = {
  async checkEmailExists(correo: string): Promise<boolean> {
    const data = await postAuth<{ exists: boolean }>(
      '/check-email',
      { correo },
      'No pudimos validar el correo.',
      { enabled: false },
    );
    return Boolean(data.exists);
  },

  register(data: {
    nombreOrganizacion: string;
    tipoOrganizacion: 'COOPERATIVA' | 'COMPRAVENTA' | 'OTRO';
    otroTipoDetalle?: string;
    nombre: string;
    telefono: string;
    correo: string;
    password: string;
  }): Promise<AuthResponse> {
    return postAuth<AuthResponse>('/register', data, 'No pudimos crear la cuenta.', {
      enabled: true,
      source: 'register',
      syncingMessage: 'Guardando tu cuenta en la nube...',
      successMessage: 'Tu cuenta quedó lista correctamente.',
    });
  },

  login(email: string, password: string): Promise<AuthResponse> {
    return postAuth<AuthResponse>('/login', { email, password }, 'No pudimos iniciar sesión.', {
      enabled: true,
      source: 'login',
      syncingMessage: 'Validando tu sesión con la nube...',
      successMessage: 'Tu sesión se validó correctamente.',
    });
  },

  loginWithGoogle(idToken: string): Promise<AuthResponse> {
    return postAuth<AuthResponse>(
      '/login/google',
      { idToken },
      'No pudimos iniciar sesión con Google.',
      {
        enabled: true,
        source: 'login-google',
        syncingMessage: 'Validando Google con la nube...',
        successMessage: 'Tu acceso con Google se validó correctamente.',
      },
    );
  },

  registerWithGoogle(data: {
    googleToken: string;
    correo: string;
    nombre: string;
    nombreOrganizacion: string;
    tipoOrganizacion: 'COOPERATIVA' | 'COMPRAVENTA' | 'OTRO';
    otroTipoDetalle?: string;
    telefono: string;
    password: string;
  }): Promise<AuthResponse> {
    return postAuth<AuthResponse>(
      '/register/google',
      data,
      'No pudimos crear la cuenta con Google.',
      {
        enabled: true,
        source: 'register-google',
        syncingMessage: 'Guardando tu registro de Google en la nube...',
        successMessage: 'Tu cuenta de Google quedó lista correctamente.',
      },
    );
  },
};
