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
 *   - register(nombre, email, password)  →  Llama a POST /auth/register
 *   - login(email, password)             →  Llama a POST /auth/login
 *                                           y guarda el token en localStorage
 *
 * ¿Debo editarlo?: ✅ SÍ. La compañera de Frontend debe implementar
 * estas funciones usando fetch() o axios.
 *
 * ⚠️ No hagas lógica visual aquí (no alertas, no redirecciones).
 * Solo manda la petición y devuelve la respuesta. La pantalla decide qué hacer con ella.
 */
const API_URL = 'http://localhost:3000/auth';

export type AuthError = {
  message: string;
  field: string | null;
};

export type AuthResponse = {
  message: string;
  access_token: string;
  user: {
    id: number | string;
    email: string;
  };
};

type RawApiError = {
  message?: string | string[];
  field?: string;
};

function normalizeMessage(message: string | string[] | undefined, fallback: string) {
  if (Array.isArray(message)) {
    return message.join(', ');
  }
  return message || fallback;
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
        message: normalizeMessage(data.message, fallbackError),
        field: data.field ?? null,
      };
      throw authError;
    }

    return data;
  } catch (error) {
    const knownError = error as Partial<AuthError>;
    throw {
      message: knownError.message || 'Error al conectar con el servidor',
      field: knownError.field ?? null,
    } as AuthError;
  }
}

export const authService = {
  login(email: string, password: string): Promise<AuthResponse> {
    return postAuth<AuthResponse>('/login', { email, password }, 'Error de autenticacion');
  },

  loginWithGoogle(idToken: string): Promise<AuthResponse> {
    return postAuth<AuthResponse>('/login/google', { idToken }, 'Error de autenticacion con Google');
  },
};