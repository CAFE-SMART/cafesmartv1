import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, Bell, ClipboardList, LogOut, ShieldCheck } from 'lucide-react';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import { useUser } from '../context/UserContext';

export default function Inicio() {
  const navigate = useNavigate();
  const { user, logout } = useUser();

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
        <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-[#0b2a85]">Cafe Smart</p>
            <h1 className="text-xl font-bold">
              Hola, {user?.name?.trim() ? user.name : 'usuario'}
            </h1>
            <p className="text-sm text-slate-500">Bienvenido al dashboard operativo</p>
          </div>
          <CloudStatusBadge />
        </header>

        <section className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
          <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <ShieldCheck size={26} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Resumen de bienvenida</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Tu cuenta ya esta activa y lista para ingresar al sistema. Desde aqui puedes
            confirmar el estado general del acceso y continuar al panel principal.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <Bell className="mb-3 text-[#0b2a85]" size={18} />
              <p className="text-sm font-semibold text-slate-900">Sincronizacion</p>
              <p className="mt-1 text-xs text-slate-500">Tu sesion y la nube estan activas.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <ClipboardList className="mb-3 text-[#0b2a85]" size={18} />
              <p className="text-sm font-semibold text-slate-900">Registro</p>
              <p className="mt-1 text-xs text-slate-500">Creacion de cuenta y acceso listos.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <BarChart3 className="mb-3 text-[#0b2a85]" size={18} />
              <p className="text-sm font-semibold text-slate-900">Dashboard</p>
              <p className="mt-1 text-xs text-slate-500">Listo para continuar al panel principal.</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('/estado-sistema')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0b2a85] px-4 py-3 text-sm font-semibold text-white"
            >
              Continuar al sistema <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
            >
              Cerrar sesion <LogOut size={16} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
