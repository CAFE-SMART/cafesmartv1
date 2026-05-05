import React from 'react';
import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="container mx-auto px-6 py-6">
        <nav className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-[#1e3a8a] text-white p-3 rounded-xl">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 8h1a4 4 0 1 1 0 8h-1"></path>
                <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-black text-[#0f172a]">Cafe Smart</h1>
          </div>
          <Link 
            to="/login" 
            className="px-8 py-3 bg-[#1e3a8a] text-white font-semibold rounded-xl hover:bg-[#1e40af] transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            Iniciar Sesión
          </Link>
        </nav>
      </header>

      <main className="container mx-auto px-6 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center pt-20">
          <div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black bg-gradient-to-r from-[#1e3a8a] via-[#1e40af] to-[#1e3a8a] bg-clip-text text-transparent mb-8 leading-tight">
              Cafe Smart
            </h1>
            <p className="text-2xl md:text-3xl text-gray-700 mb-8 max-w-lg leading-relaxed font-light">
              Gestión inteligente para el negocio cafetero del siglo XXI
            </p>
            <div className="grid md:grid-cols-2 gap-4 mb-12">
              <div className="flex items-start gap-4 p-6 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50 shadow-xl hover:shadow-2xl transition-all">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-xl text-gray-900 mb-1">Preciso</h3>
                  <p className="text-gray-600">Control total de inventarios y trazabilidad completa</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-6 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50 shadow-xl hover:shadow-2xl transition-all">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-xl text-gray-900 mb-1">Rápido</h3>
                  <p className="text-gray-600">Interfaz optimizada para uso diario sin complicaciones</p>
                </div>
              </div>
            </div>
            <Link 
              to="/register" 
              className="inline-flex items-center gap-3 px-12 py-5 bg-gradient-to-r from-[#1e3a8a] to-[#1e40af] text-white font-bold text-lg rounded-2xl hover:from-[#1e40af] hover:to-[#1e3a8a] shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-1 w-fit"
            >
              Comenzar Gratis
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
          
          <div className="relative">
            <div className="relative z-10 bg-white/80 backdrop-blur-xl rounded-3xl p-12 shadow-2xl border border-white/50">
              <img 
                src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDU2IiBoZWlnaHQ9IjI4NCIgdmlld0JveD0iMCAwIDQ1NiAyODQiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0NTYiIGhlaWdodD0iMjg0IiBmeD0iMCIgZnk9IjAiIGZpbGw9IiNGRkZGRkYiLz4KPHBhdGggZD0iTTM0LjcgMjE1LjZDNS4MyAyMTUuNiAyNS44IDIzMiAxNTAgMjMyQzI3NC4yIDIzMiAzOTUuNyAyMTUuNiAzOTUuNyAyMTUuNkM0MDIuMiAyMTUuNiA0MDUuMSAyMDguMiA0MDUuMSAyMDEuNUM0MDUuMSAxOTQuNyA0MDIuMiAxODcuNCAzOTUuNyAxODcuNEgzOS4zTDE1MCAxODcuNEwxNSAwTDE1MCAxODcuNEw0MTYuNyAxODcuNEw0MTYuNyAyMTUuNkMzOTUuNyAyMTUuNiAzNDcuMiAyMTUuNiAzNC43IDIxNS42WiIgZmlsbD0iIzFEM0E4QSIvPgo8cGF0aCBkPSJNMzQ3LjIgMjE1LjZDNS4MyAyMTUuNiAyNS44IDIzMiAxNTAgMjMyQzI3NC4yIDIzMiAzOTUuNyAyMTUuNiAzOTUuNyAyMTUuNkM0MDIuMiAyMTUuNiA0MDUuMSAyMDguMiA0MDUuMSAyMDEuNUM0MDUuMSAxOTQuNyA0MDIuMiAxODcuNCAzOTUuNyAxODcuNEgzOS4zTDE1MCAxODcuNEwxNSAwTDE1MCAxODcuNEw0MTYuNyAxODcuNEw0MTYuNyAyMTUuNkMzOTUuNyAyMTUuNiAzNDcuMiAyMTUuNiAzNDcuMiAyMTUuNloiIGZpbGw9IiMxRTNBOGEiIGZpbGgtb3BhY2l0eT0iMC43NSIvPgo8L3N2Zz4K" 
                alt="Dashboard Preview" 
                className="w-full h-96 object-contain rounded-2xl shadow-2xl"
              />
            </div>
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-3xl blur-xl"></div>
          </div>
        </div>

        <div className="mt-32 grid md:grid-cols-3 gap-8">
          <div className="text-center p-8 bg-white/70 backdrop-blur-sm rounded-3xl border border-white/50 shadow-xl hover:shadow-2xl transition-all group">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2h10a2 2 0 012 2v2M8 7v2m6-2v2m-3 5v4m-3-4h6" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Inventario Total</h3>
            <p className="text-gray-600 leading-relaxed">Control preciso de café en todas las etapas: beneficiado, almacenamiento y secado</p>
          </div>
          <div className="text-center p-8 bg-white/70 backdrop-blur-sm rounded-3xl border border-white/50 shadow-xl hover:shadow-2xl transition-all group">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Reportes IA</h3>
            <p className="text-gray-600 leading-relaxed">Análisis inteligente de rendimiento y recomendaciones automáticas</p>
          </div>
          <div className="text-center p-8 bg-white/70 backdrop-blur-sm rounded-3xl border border-white/50 shadow-xl hover:shadow-2xl transition-all group">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Seguridad Total</h3>
            <p className="text-gray-600 leading-relaxed">Protección avanzada de datos con backups automáticos en la nube</p>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 mt-32 pt-12">
        <div className="container mx-auto px-6 text-center">
          <p className="text-lg font-semibold text-gray-900 mb-4">Listo para transformar tu negocio cafetero?</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-2xl mx-auto">
            <Link to="/register" className="px-10 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-lg rounded-2xl hover:from-emerald-600 hover:to-teal-700 shadow-xl hover:shadow-2xl transition-all w-full sm:w-auto text-center">
              Crear Cuenta Gratis
            </Link>
            <Link to="/login" className="px-10 py-4 border-2 border-gray-200 text-gray-900 font-bold text-lg rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all w-full sm:w-auto text-center">
              Ver Demo
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-8">
            © 2024 Cafe Smart Inc. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
