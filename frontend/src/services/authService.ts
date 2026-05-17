import {
  buildOfflineAuthError,
  mapFriendlyAuthMessage,
} from '../utils/authMessages';
import { emitCloudStatusEvent } from './cloudStatusEvents';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
  'http://localhost:3000';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export type AuthError = {
  message: string;
  field: string | null;
  details?: Record<string, string[]>;
  action?: string | null;
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
};

type CloudTrackingConfig = {
  enabled?: boolean;
  source?: 'login' | 'login-google' | 'register' | 'register-google' | 'sync';
  syncingMessage?: string;
  successMessage?: string;
};

function isNetworkFetchError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed')
  );
}

function buildApiBaseCandidates() {
  const configuredBase = API_BASE_URL.replace(/\/$/, '');
  const candidates = [configuredBase];

  if (typeof window === 'undefined') {
    return candidates;
  }

  try {
    const configuredUrl = new URL(API_BASE_URL);
    const currentHost = window.location.hostname?.trim();

    if (
      currentHost &&
      !LOCAL_HOSTS.has(currentHost) &&
      LOCAL_HOSTS.has(configuredUrl.hostname)
    ) {
      candidates.push(
        `${configuredUrl.protocol}//${currentHost}${
          configuredUrl.port ? `:${configuredUrl.port}` : ''
        }`,
      );
    }
  } catch {
    return candidates;
  }

  return [...new Set(candidates)];
}

async function postAuth<TResponse>(
  endpoint: string,
  body: Record<string, unknown>,
  fallbackError: string,
  cloudTracking?: CloudTrackingConfig,
): Promise<TResponse> {
  let lastNetworkError: unknown = null;

  try {
    if (cloudTracking?.enabled) {
      emitCloudStatusEvent({
        status: 'syncing',
        source: cloudTracking.source ?? 'sync',
        message: cloudTracking.syncingMessage ?? 'Sincronizando...',
      });
    }

    for (const apiBaseUrl of buildApiBaseCandidates()) {
      try {
        const response = await fetch(`${apiBaseUrl}/auth${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = (await response.json().catch(() => ({}))) as TResponse &
          RawApiError;

        if (!response.ok) {
          const authError: AuthError = {
            message: mapFriendlyAuthMessage(endpoint, data, fallbackError),
            field: data.field ?? null,
            details: data.details,
            action: data.action ?? null,
            code: 'HTTP',
            status: response.status,
          };
          throw authError;
        }

        if (cloudTracking?.enabled) {
          emitCloudStatusEvent({
            status: 'synced',
            source: cloudTracking.source ?? 'sync',
            message: cloudTracking.successMessage ?? 'Listo.',
          });
        }

        return data;
      } catch (error) {
        if (!isNetworkFetchError(error)) {
          throw error;
        }

        lastNetworkError = error;
      }
    }

    throw lastNetworkError ?? buildOfflineAuthError();
  } catch (error) {
    if (cloudTracking?.enabled) {
      const knownError = error as Partial<AuthError>;
      emitCloudStatusEvent({
        status: 'error',
        source: cloudTracking.source ?? 'sync',
        message:
          knownError.message ||
          'No pudimos completar la acción. Vuelve a intentarlo.',
      });
    }

    if (isNetworkFetchError(error)) {
      throw buildOfflineAuthError();
    }

    const knownError = error as Partial<AuthError>;
    throw {
      message:
        knownError.message ||
        'No pudimos completar la acción. Vuelve a intentarlo.',
      field: knownError.field ?? null,
      details: knownError.details,
      action: knownError.action ?? null,
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
      'No pudimos revisar el correo. Intenta nuevamente.',
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
    return postAuth<AuthResponse>(
      '/register',
      data,
      'No pudimos completar el registro.',
      {
        enabled: true,
        source: 'register',
        syncingMessage: 'Guardando cuenta...',
        successMessage: 'Cuenta guardada.',
      },
    );
  },

  login(email: string, password: string): Promise<AuthResponse> {
    return postAuth<AuthResponse>(
      '/login',
      { email, password },
      'No pudimos iniciar sesión en este momento.',
      {
        enabled: true,
        source: 'login',
        syncingMessage: 'Validando sesion...',
        successMessage: 'Sesion validada.',
      },
    );
  },

  loginWithGoogle(idToken: string): Promise<AuthResponse> {
    return postAuth<AuthResponse>(
      '/login/google',
      { idToken },
      'No pudimos entrar con Google en este momento.',
      {
        enabled: true,
        source: 'login-google',
        syncingMessage: 'Validando Google...',
        successMessage: 'Google validado.',
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
      'No pudimos completar el registro con Google.',
      {
        enabled: true,
        source: 'register-google',
        syncingMessage: 'Guardando Google...',
        successMessage: 'Cuenta guardada.',
      },
    );
  },
};
