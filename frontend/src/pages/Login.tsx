import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn, Loader, X } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { authService, type AuthError } from '../services/authService';
import { useUser } from '../context/UserContext';
import { parseJwtPayload } from '../utils/jwt';

type GoogleJwtPayload = {
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
};

type GoogleNameParts = {
  nombre: string;
  apellidos: string;
};

function splitGoogleName(payload: GoogleJwtPayload): GoogleNameParts {
  const given = payload.given_name?.trim() || '';
  const family = payload.family_name?.trim() || '';

  if (given || family) {
    return {
      nombre: given,
      apellidos: family,
    };
  }

  const fullName = payload.name?.trim() || '';
  if (!fullName) {
    return { nombre: '', apellidos: '' };
  }

  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { nombre: parts[0], apellidos: '' };
  }

  return {
    nombre: parts[0],
    apellidos: parts.slice(1).join(' '),
  };
}

function decodeGoogleJwt(idToken: string): GoogleJwtPayload {
  return parseJwtPayload<GoogleJwtPayload>(idToken) ?? {};
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function Login() {
  const isGoogleAuthEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null);
  const [passwordFieldError, setPasswordFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const navigate = useNavigate();
  const { setSession } = useUser();

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setError(null);
    setEmailFieldError(null);
    setPasswordFieldError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEmailFieldError(null);
    setPasswordFieldError(null);

    let hasValidationError = false;

    if (!email.trim()) {
      setEmailFieldError('El correo es obligatorio.');
      hasValidationError = true;
    } else if (!isValidEmail(email)) {
      setEmailFieldError('Ingresa un correo valido.');
      hasValidationError = true;
    }

    if (!password.trim()) {
      setPasswordFieldError('La contrasena es obligatoria.');
      hasValidationError = true;
    }

    if (hasValidationError) {
      return;
    }

    setLoading(true);

    try {
      const data = await authService.login(email, password);
      await setSession({
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
        },
        token: data.access_token,
        hasCompany: data.hasCompany,
        persist: rememberMe,
      });

      navigate(data.hasCompany ? '/inicio' : '/crear-empresa');
    } catch (err) {
      const authError = err as AuthError;
      const field = (authError.field || '').toLowerCase();
      const message = authError.message || 'No se pudo iniciar sesion. Intenta nuevamente.';
      const details = authError.details ?? {};

      const emailDetail = details.email?.[0] || details.correo?.[0];
      const passwordDetail = details.password?.[0] || details.contrasena?.[0];

      if (emailDetail) {
        setEmailFieldError(emailDetail);
      }

      if (passwordDetail) {
        setPasswordFieldError(passwordDetail);
      }

      if (emailDetail || passwordDetail) {
        setError(null);
      } else if (field === 'email' || field === 'correo') {
        setEmailFieldError(message);
        setError(null);
      } else if (field === 'password' || field === 'contrasena') {
        setPasswordFieldError(message);
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setError(null);
    setEmailFieldError(null);
    setPasswordFieldError(null);
    setGoogleLoading(true);

    const idToken = credentialResponse?.credential;
    if (!idToken) {
      setError('No se pudo iniciar sesion con Google. Intenta nuevamente.');
      setGoogleLoading(false);
      return;
    }

    try {
      const data = await authService.loginWithGoogle(idToken);
      await setSession({
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
        },
        token: data.access_token,
        hasCompany: data.hasCompany,
        persist: rememberMe,
      });

      navigate(data.hasCompany ? '/inicio' : '/crear-empresa');
    } catch (err) {
      const loginError = err as AuthError;

      if (loginError.action === 'register') {
        const googleData = decodeGoogleJwt(idToken);
        const nameParts = splitGoogleName(googleData);
        navigate('/crear-empresa', {
          state: {
            googleToken: idToken,
            googlePrefill: {
              correo: googleData.email || '',
              nombre: nameParts.nombre,
              apellidos: nameParts.apellidos,
            },
          },
        });
        return;
      }

      setError(loginError.message || 'No se pudo iniciar sesion con Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('No se pudo iniciar sesion con Google.');
    setEmailFieldError(null);
    setPasswordFieldError(null);
    setGoogleLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-800">
      <header className="flex justify-between items-center p-6 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="bg-[#1e3a8a] text-white p-2 rounded-lg">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 8h1a4 4 0 1 1 0 8h-1"></path>
              <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"></path>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#0f172a]">Cafe Smart</h1>
        </div>

        <button
          type="button"
          onClick={resetForm}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          Limpiar <X size={16} />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-[480px]">
          <h2 className="text-3xl font-bold text-center text-[#0f172a] mb-2">Iniciar Sesion</h2>
          <p className="text-center text-gray-500 mb-8 mx-auto" style={{ maxWidth: '300px' }}>
            Bienvenido de nuevo a la gestion inteligente de Cafe Smart
          </p>

          {error && (
          <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-xl mb-6 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Correo electronico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all text-gray-700 placeholder-gray-400 ${
                    emailFieldError ? 'border-red-300 bg-red-50/40' : 'border-gray-200'
                  }`}
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailFieldError(null);
                  }}
                />
              </div>
              {emailFieldError && (
                <p className="mt-2 text-xs font-medium text-red-600">{emailFieldError}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-slate-700">Contrasena</label>
                <button
                  type="button"
                  onClick={() =>
                    setError('La recuperacion de contrasena aun no esta disponible.')
                  }
                  className="text-sm font-semibold text-[#1e3a8a] hover:underline"
                >
                  Olvidaste tu contrasena?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className={`block w-full pl-10 pr-10 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all text-gray-700 placeholder-gray-400 text-lg tracking-wider ${
                    passwordFieldError ? 'border-red-300 bg-red-50/40' : 'border-gray-200'
                  }`}
                  placeholder="********"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordFieldError(null);
                  }}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                  )}
                </button>
              </div>
              {passwordFieldError && (
                <p className="mt-2 text-xs font-medium text-red-600">{passwordFieldError}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <input
                id="remember_me"
                type="checkbox"
                className="w-5 h-5 rounded border-gray-300 text-[#1e3a8a] focus:ring-[#1e3a8a] bg-gray-50 cursor-pointer"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label
                htmlFor="remember_me"
                className="text-sm text-slate-600 cursor-pointer select-none"
              >
                Recordar mi cuenta en este
                <br />
                dispositivo
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 px-4 rounded-xl text-white font-semibold transition-all flex items-center justify-center gap-2 ${
                loading
                  ? 'bg-[#1e3a8a]/70 cursor-wait'
                  : 'bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 shadow-md hover:shadow-lg'
              }`}
            >
              {loading ? 'Entrando...' : 'Entrar'} <LogIn size={18} />
            </button>
          </form>

          {isGoogleAuthEnabled && (
            <div className="mt-8 mb-6 flex items-center">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-4 text-xs font-semibold text-gray-400 tracking-wider">
                O CONTINUA CON
              </span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>
          )}

          {isGoogleAuthEnabled && googleLoading && (
            <div className="mb-6 flex flex-col items-center justify-center py-8">
              <div className="relative w-16 h-16 mb-4">
                <Loader className="w-16 h-16 text-[#1e3a8a] animate-spin" />
              </div>
              <p className="text-center text-sm font-semibold text-gray-700 mb-2">
                Procesando inicio de sesion...
              </p>
              <p className="text-center text-xs text-gray-500">
                Espera un momento mientras validamos tu cuenta.
              </p>
            </div>
          )}

          {isGoogleAuthEnabled && !googleLoading && (
            <div className="w-full flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                text="signin_with"
                theme="outline"
                size="large"
                width="100%"
              />
            </div>
          )}

          {!isGoogleAuthEnabled && (
            <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-800">
              El acceso con Google no esta disponible porque falta configurar
              <strong> VITE_GOOGLE_CLIENT_ID </strong>
              en el frontend.
            </div>
          )}

          <p className="mt-8 text-center text-sm text-slate-600">
            No tienes una cuenta?{' '}
            <Link to="/register" className="font-bold text-[#1e3a8a] hover:underline">
              Registrate gratis
            </Link>
          </p>
        </div>
      </main>

      <footer className="p-6 text-center">
        <p className="text-xs text-slate-400 font-medium tracking-wide">
          Copyright 2024 Cafe Smart Inc. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
