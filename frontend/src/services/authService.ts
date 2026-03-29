import { buildOfflineAuthError, mapFriendlyAuthMessage } from '../utils/authMessages';
import { emitCloudStatusEvent } from './cloudStatusEvents';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || 'http://localhost:3000';
const API_URL = `${API_BASE_URL.replace(/\/$/, '')}/auth`;

export type AuthError = {
  message: string;
  field: string | null;
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
  };
  hasCompany: boolean;
};

type RawApiError = {
  message?: string | string[];
  field?: string;
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

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as TResponse & RawApiError;

    if (!response.ok) {
      const authError: AuthError = {
        message: mapFriendlyAuthMessage(endpoint, data, fallbackError),
        field: data.field ?? null,
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
        message: cloudTracking.successMessage ?? 'Operacion confirmada en la nube.',
      });
    }

    return data;
  } catch (error) {
    if (cloudTracking?.enabled) {
      const knownError = error as Partial<AuthError>;
      emitCloudStatusEvent({
        status: 'error',
        source: cloudTracking.source ?? 'sync',
        message:
          knownError.message || 'No se pudo completar la operacion con la nube.',
      });
    }

    if (isNetworkFetchError(error)) {
      throw buildOfflineAuthError();
    }

    const knownError = error as Partial<AuthError>;
    throw {
      message: knownError.message || 'Error al conectar con el servidor',
      field: knownError.field ?? null,
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
      'No se pudo validar el correo',
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
    return postAuth<AuthResponse>('/register', data, 'Error al registrarse', {
      enabled: true,
      source: 'register',
      syncingMessage: 'Guardando tu cuenta en la nube...',
      successMessage: 'La cuenta quedo guardada en la nube.',
    });
  },

  login(email: string, password: string): Promise<AuthResponse> {
    return postAuth<AuthResponse>('/login', { email, password }, 'Error de autenticacion', {
      enabled: true,
      source: 'login',
      syncingMessage: 'Validando tu sesion con la nube...',
      successMessage: 'La sesion fue validada con la nube.',
    });
  },

  loginWithGoogle(idToken: string): Promise<AuthResponse> {
    return postAuth<AuthResponse>(
      '/login/google',
      { idToken },
      'Error de autenticacion con Google',
      {
        enabled: true,
        source: 'login-google',
        syncingMessage: 'Validando Google con la nube...',
        successMessage: 'Google fue validado con la nube.',
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
      'Error al registrarse con Google',
      {
        enabled: true,
        source: 'register-google',
        syncingMessage: 'Guardando tu registro de Google en la nube...',
        successMessage: 'La cuenta de Google quedo guardada en la nube.',
      },
    );
  },
};
