/*
 * ========================================================
 * 📡 ARCHIVO: authService.ts (El Mensajero de Autenticación)
 * ========================================================
 * ¿Para qué sirve?: Contiene las funciones que se comunican con el
 * Backend para todo lo relacionado con autenticación. Cuando el usuario
 * hace clic en "Registrarse" o "Iniciar Sesión", las pantallas llaman
 * a las funciones de ESTE archivo.
 *
 * Funciones que vivirán aquí:
 *   - register (nombre, email, password)  →  Llama a POST /auth/register
 *   - login(email, password)             →  Llama a POST /auth/login
 *
 * ¿Debo editarlo?: ✅ SÍ. La compañera de Frontend debe implementar
 * estas funciones usando fetch() o axios.
 *
 * ⚠️ No hagas lógica visual aquí (no alertas, no redirecciones).
 * Solo manda la petición y devuelve la respuesta. La pantalla decide qué hacer con ella.
 */
import {
  buildOfflineAuthError,
  mapFriendlyAuthMessage,
} from '../utils/authMessages';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || 'http://localhost:3000';
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

async function postAuth<TResponse>(endpoint: string, body: Record<string, unknown>, fallbackError: string): Promise<TResponse> {
  try {
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

    return data;
  } catch (error) {
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
    return postAuth<AuthResponse>('/register', data, 'Error al registrarse');
  },

  login(email: string, password: string): Promise<AuthResponse> {
    return postAuth<AuthResponse>('/login', { email, password }, 'Error de autenticación');
  },

  loginWithGoogle(idToken: string): Promise<AuthResponse> {
    return postAuth<AuthResponse>('/login/google', { idToken }, 'Error de autenticación con Google');
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
    return postAuth<AuthResponse>('/register/google', data, 'Error al registrarse con Google');
  },
}; 