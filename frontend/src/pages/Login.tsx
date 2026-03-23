import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn, LogOut } from 'lucide-react';
import { authService } from '../services/authService';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await authService.login(email, password);
      // Guardar el token
      localStorage.setItem('token', data.access_token);
      
      // Si el backend es adaptado para Google, se llamaría otra api
      navigate('/inventario');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Aquí podrías redireccionar al auth de google si tu backend lo soporta vía redirect
    // window.location.href = 'http://localhost:3000/auth/google';
    alert("Login de Google pendiente de habilitar.");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-800">
      
      {/* Header */}
      <header className="flex justify-between items-center p-6 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="bg-[#1e3a8a] text-white p-2 rounded-lg">
            {/* Logo de tacita o icono representativo */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 8h1a4 4 0 1 1 0 8h-1"></path>
              <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"></path>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#0f172a]">Café Smart</h1>
        </div>
        
        <button className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
          Salir <LogOut size={16} />
        </button>
      </header>
      
      {/* Contenedor central */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        
        {/* Tarjeta de Login */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-[480px]">
          <h2 className="text-3xl font-bold text-center text-[#0f172a] mb-2">Iniciar Sesión</h2>
          <p className="text-center text-gray-500 mb-8 mx-auto" style={{ maxWidth: '300px' }}>
            Bienvenido de nuevo a la gestión inteligente de Café Smart
          </p>
          
          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-xl mb-6 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* Correo Electrónico */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Correo electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="email" 
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all text-gray-700 placeholder-gray-400"
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            
            {/* Contraseña */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-slate-700">Contraseña</label>
                <a href="#" className="text-sm font-semibold text-[#1e3a8a] hover:underline">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all text-gray-700 placeholder-gray-400 text-lg tracking-wider"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            </div>

            {/* Recordar Cuenta */}
            <div className="flex items-center gap-3">
              <input
                id="remember_me"
                type="checkbox"
                className="w-5 h-5 rounded border-gray-300 text-[#1e3a8a] focus:ring-[#1e3a8a] bg-gray-50 cursor-pointer"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember_me" className="text-sm text-slate-600 cursor-pointer select-none">
                Recordar mi cuenta en este<br />dispositivo
              </label>
            </div>

            {/* Botón Principal */}
            <button 
              type="submit" 
              disabled={loading}
              className={`w-full py-3.5 px-4 rounded-xl text-white font-semibold transition-all flex items-center justify-center gap-2 ${loading ? 'bg-[#1e3a8a]/70 cursor-wait' : 'bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 shadow-md hover:shadow-lg'}`}
            >
              {loading ? 'Entrando...' : 'Entrar'} <LogIn size={18} />
            </button>
          </form>

          {/* Separador */}
          <div className="mt-8 mb-6 flex items-center">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="px-4 text-xs font-semibold text-gray-400 tracking-wider">O CONTINÚA CON</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          {/* Botón Google */}
          <button 
            type="button"
            onClick={handleGoogleLogin}
            className="w-full py-3.5 px-4 rounded-xl text-slate-700 font-bold transition-all flex items-center justify-center gap-3 border border-gray-200 bg-white hover:bg-gray-50"
          >
            {/* Logo de Google SVG estático */}
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              <path d="M1 1h22v22H1z" fill="none"/>
            </svg>
            Continuar con Google
          </button>

          {/* Registro Link */}
          <p className="mt-8 text-center text-sm text-slate-600">
            ¿No tienes una cuenta? <a href="/register" className="font-bold text-[#1e3a8a] hover:underline">Regístrate gratis</a>
          </p>

        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center">
        <p className="text-xs text-slate-400 font-medium tracking-wide">
          © 2024 Café Smart Inc. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
