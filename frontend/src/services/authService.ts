import {
  AUTH_MESSAGES,
  buildOfflineAuthError,
  mapFriendlyAuthMessage,
} from '../utils/authMessages';
import { getApiBaseUrlCandidates, SHOULD_LOG_API_DEBUG } from '../config/api';
import { emitCloudStatusEvent } from './cloudStatusEvents';
import { logDebugLine } from '../utils/debugLog';

export type AuthError = {
  message: string;
  field: string | null;
  details?: Record<string, string[]>;
  action?: string | null;
  code: 'OFFLINE' | 'TIMEOUT' | 'CORS_OR_NETWORK' | 'HTTP' | 'UNKNOWN';
  apiCode?: string;
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
    organizacion?: {
      id?: string | null;
      nombre?: string | null;
      tipo?: 'COOPERATIVA' | 'COMPRAVENTA' | 'PERSONALIZADO' | 'OTRO' | null;
      descripcion?: string | null;
    } | null;
    nombreOrganizacion?: string | null;
    tipoOrganizacion?: 'COOPERATIVA' | 'COMPRAVENTA' | 'PERSONALIZADO' | 'OTRO' | null;
    otroTipoDetalle?: string | null;
    descripcionOrganizacion?: string | null;
    avatarUrl?: string | null;
  };
  hasCompany: boolean;
};

export type ResetPasswordResponse = {
  message: string;
};

type RawApiError = {
  code?: string;
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

const AUTH_REQUEST_TIMEOUT_MS = 15_000;

function isNetworkFetchError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

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
  return getApiBaseUrlCandidates();
}

function describeAuthFetchError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    };
  }

  return { message: String(error) };
}

function buildNetworkAuthError(error: unknown): AuthError {
  const browserOffline =
    typeof navigator !== 'undefined' && navigator.onLine === false;

  if (browserOffline) {
    return buildOfflineAuthError();
  }

  return {
    message:
      error instanceof DOMException && error.name === 'AbortError'
        ? AUTH_MESSAGES.cloudTimeout
        : AUTH_MESSAGES.cloudTryAgain,
    field: null,
    action: null,
    code:
      error instanceof DOMException && error.name === 'AbortError'
        ? 'TIMEOUT'
        : 'CORS_OR_NETWORK',
    status: 0,
  };
}

function isLoginEndpoint(endpoint: string) {
  return endpoint === '/login';
}

function logLoginAuth(event: string, payload: Record<string, unknown>) {
  if (!SHOULD_LOG_API_DEBUG) {
    return;
  }

  console.info(`[CafeSmart][login] ${event} ${JSON.stringify(payload)}`);
}

function summarizeAuthResponse(data: RawApiError & Record<string, unknown>) {
  const user = data.user as Record<string, unknown> | undefined;

  return {
    hasAccessToken: Boolean(data.access_token),
    hasUser: Boolean(user),
    hasUserEmail: Boolean(user?.email),
    hasCompany: Boolean(data.hasCompany),
    apiCode: data.code ?? null,
    field: data.field ?? null,
  };
}

function shouldEmitCloudError(error: Partial<AuthError>) {
  const status = error.status ?? 0;
  return (
    status === 0 ||
    status >= 500 ||
    error.code === 'OFFLINE' ||
    error.code === 'TIMEOUT' ||
    error.code === 'CORS_OR_NETWORK'
  );
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
      const url = `${apiBaseUrl}/auth${endpoint}`;
      const shouldLogLogin = isLoginEndpoint(endpoint);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        AUTH_REQUEST_TIMEOUT_MS,
      );

      try {
        if (SHOULD_LOG_API_DEBUG) {
          console.info(`[CafeSmart][auth-fetch] request method=POST url=${url}`);
          logDebugLine('[CafeSmart][auth-fetch] request', {
            method: 'POST',
            url,
          });
        }
        if (shouldLogLogin) {
          logLoginAuth('endpoint exacto', {
            endpoint: '/auth/login',
            url,
          });
          logLoginAuth('request enviado', {
            method: 'POST',
            url,
          });
          console.log('[login] endpoint:', '/auth/login');
          console.log('[login] api url:', apiBaseUrl);
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        const data = (await response.json().catch(() => ({}))) as TResponse &
          RawApiError;

        if (SHOULD_LOG_API_DEBUG) {
          console.info(
            `[CafeSmart][auth-fetch] response status=${response.status} method=POST url=${url}`,
          );
          logDebugLine('[CafeSmart][auth-fetch] response', {
            method: 'POST',
            url,
            status: response.status,
            ok: response.ok,
          });
        }
        if (shouldLogLogin) {
          logLoginAuth('status recibido', {
            status: response.status,
            ok: response.ok,
          });
          logLoginAuth(
            'respuesta recibida',
            summarizeAuthResponse(data as RawApiError & Record<string, unknown>),
          );
          console.log('[login] status:', response.status);
          console.log(
            '[login] response:',
            summarizeAuthResponse(data as RawApiError & Record<string, unknown>),
          );
        }

        if (!response.ok) {
          if (shouldLogLogin && response.status === 401) {
            logLoginAuth('credenciales incorrectas', { status: response.status });
          }
          if (shouldLogLogin) {
            console.log('[login] error:', {
              status: response.status,
              code: data.code ?? null,
              field: data.field ?? null,
              message: data.message ?? null,
            });
          }
          if (SHOULD_LOG_API_DEBUG) {
            console.info(
              `[CafeSmart][auth-fetch] HTTP error method=POST url=${url} status=${response.status} apiCode=${data.code ?? ''} field=${data.field ?? ''} message=${data.message ?? ''}`,
            );
            logDebugLine('[CafeSmart][auth-fetch] HTTP error', {
              method: 'POST',
              url,
              status: response.status,
              apiCode: data.code,
              field: data.field,
              message: data.message,
            });
          }

          const authError: AuthError = {
            message:
              endpoint === '/login' && response.status === 401
                ? AUTH_MESSAGES.invalidCredentials
                : mapFriendlyAuthMessage(endpoint, data, fallbackError),
            field: data.field ?? null,
            details: data.details,
            action: data.action ?? null,
            code: 'HTTP',
            apiCode: data.code,
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

        if (shouldLogLogin) {
          logLoginAuth('login exitoso', {
            hasAccessToken: Boolean((data as AuthResponse).access_token),
            hasUser: Boolean((data as AuthResponse).user),
            hasCompany: Boolean((data as AuthResponse).hasCompany),
          });
        }

        return data;
      } catch (error) {
        if (!isNetworkFetchError(error)) {
          throw error;
        }

        if (SHOULD_LOG_API_DEBUG) {
          const isTimeout =
            error instanceof DOMException && error.name === 'AbortError';
          if (shouldLogLogin) {
            logLoginAuth(isTimeout ? 'timeout' : 'error de red', {
              url,
              browserOnline:
                typeof navigator === 'undefined' ? null : navigator.onLine,
              error: describeAuthFetchError(error),
            });
            console.log('[login] error:', describeAuthFetchError(error));
            if (error instanceof TypeError) {
              logLoginAuth('cors suspected', { url });
            }
          }
          console.info(
            `[CafeSmart][auth-fetch] ${isTimeout ? 'timeout' : 'network error'} method=POST url=${url} error=${JSON.stringify(describeAuthFetchError(error))}`,
          );
          if (error instanceof TypeError) {
            console.info(
              `[CafeSmart][auth-fetch] cors suspected method=POST url=${url}`,
            );
          }
          logDebugLine('[CafeSmart][auth-fetch] network error', {
            method: 'POST',
            url,
            error: describeAuthFetchError(error),
          });
        }

        lastNetworkError = error;
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    throw lastNetworkError ?? buildOfflineAuthError();
  } catch (error) {
    if (cloudTracking?.enabled) {
      const knownError = error as Partial<AuthError>;
      if (shouldEmitCloudError(knownError)) {
        emitCloudStatusEvent({
          status: 'error',
          source: cloudTracking.source ?? 'sync',
          message:
            knownError.message ||
            'No pudimos completar la acción. Vuelve a intentarlo.',
        });
      }
    }

    if (isNetworkFetchError(error)) {
      throw buildNetworkAuthError(error);
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
      apiCode: knownError.apiCode,
      status: knownError.status,
    } as AuthError;
  }
}

async function getAuth<TResponse>(
  endpoint: string,
  fallbackError: string,
): Promise<TResponse> {
  let lastNetworkError: unknown = null;

  try {
    for (const apiBaseUrl of buildApiBaseCandidates()) {
      const url = `${apiBaseUrl}/auth${endpoint}`;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        AUTH_REQUEST_TIMEOUT_MS,
      );

      try {
        if (SHOULD_LOG_API_DEBUG) {
          console.info(`[CafeSmart][auth-fetch] request method=GET url=${url}`);
          logDebugLine('[CafeSmart][auth-fetch] request', {
            method: 'GET',
            url,
          });
        }

        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => ({}))) as TResponse &
          RawApiError;

        if (!response.ok) {
          if (SHOULD_LOG_API_DEBUG) {
            console.info(
              `[CafeSmart][auth-fetch] HTTP error method=GET url=${url} status=${response.status} apiCode=${data.code ?? ''} field=${data.field ?? ''} message=${data.message ?? ''}`,
            );
            logDebugLine('[CafeSmart][auth-fetch] HTTP error', {
              method: 'GET',
              url,
              status: response.status,
              apiCode: data.code,
              field: data.field,
              message: data.message,
            });
          }

          throw {
            message: mapFriendlyAuthMessage(endpoint, data, fallbackError),
            field: data.field ?? null,
            details: data.details,
            action: data.action ?? null,
            code: 'HTTP',
            apiCode: data.code,
            status: response.status,
          } as AuthError;
        }

        return data;
      } catch (error) {
        if (!isNetworkFetchError(error)) {
          throw error;
        }

        if (SHOULD_LOG_API_DEBUG) {
          console.info(
            `[CafeSmart][auth-fetch] network error method=GET url=${url} error=${JSON.stringify(describeAuthFetchError(error))}`,
          );
          logDebugLine('[CafeSmart][auth-fetch] network error', {
            method: 'GET',
            url,
            error: describeAuthFetchError(error),
          });
        }

        lastNetworkError = error;
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    throw lastNetworkError ?? buildOfflineAuthError();
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw buildNetworkAuthError(error);
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
      apiCode: knownError.apiCode,
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
    descripcionOrganizacion?: string;
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
    descripcionOrganizacion?: string;
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

  resetPassword(
    token: string,
    nuevaPassword: string,
  ): Promise<ResetPasswordResponse> {
    return postAuth<ResetPasswordResponse>(
      '/reset-password',
      { token, nuevaPassword },
      'No pudimos actualizar la contraseña. Intenta solicitar un nuevo enlace.',
      { enabled: false },
    );
  },

  validateResetPasswordToken(token: string): Promise<{ valid: true }> {
    return getAuth<{ valid: true }>(
      `/reset-password/validate?token=${encodeURIComponent(token)}`,
      'No pudimos validar este enlace.',
    );
  },
};
