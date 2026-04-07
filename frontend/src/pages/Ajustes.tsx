import React, { useEffect, useMemo, useState } from 'react';
import { Bell, LogOut, RefreshCcw, Save, Settings, Shield, Warehouse } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppBottomNav } from '../components/AppBottomNav';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import { useUser } from '../context/UserContext';
import { obtenerLotes } from '../services/lotesService';
import { getBodegaConfig, saveBodegaConfig } from '../utils/bodegaConfig';
import { applySecadoToLots } from '../utils/secadoFlow';

function formatKg(value: number) {
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Ajustes() {
  const navigate = useNavigate();
  const { logout } = useUser();
  const [nombreBodega, setNombreBodega] = useState(() => getBodegaConfig().nombreBodega);
  const [capacidadKg, setCapacidadKg] = useState(() => String(getBodegaConfig().capacidadKg));
  const [inventarioActualKg, setInventarioActualKg] = useState(0);
  const [loadingStock, setLoadingStock] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const cargarInventario = async () => {
    setLoadingStock(true);
    try {
      const lotes = await obtenerLotes();
      const visual = applySecadoToLots(lotes);
      setInventarioActualKg(visual.reduce((sum, lote) => sum + lote.pesoActual, 0));
    } catch {
      setInventarioActualKg(0);
    } finally {
      setLoadingStock(false);
    }
  };

  useEffect(() => {
    void cargarInventario();
  }, []);

  const capacidadRestante = useMemo(() => {
    const numeric = Number(capacidadKg);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, numeric - inventarioActualKg);
  }, [capacidadKg, inventarioActualKg]);

  const guardarBodega = () => {
    const capacidad = Number(capacidadKg);
    setError(null);
    setSuccess(null);

    if (!nombreBodega.trim()) {
      setError('Escribe un nombre para la bodega.');
      return;
    }

    if (!Number.isFinite(capacidad) || capacidad <= 0) {
      setError('La capacidad debe ser mayor que 0.');
      return;
    }

    if (capacidad < inventarioActualKg) {
      setError('La capacidad no puede ser menor al inventario actual almacenado.');
      return;
    }

    const next = saveBodegaConfig({
      nombreBodega,
      capacidadKg: capacidad,
    });

    setNombreBodega(next.nombreBodega);
    setCapacidadKg(String(next.capacidadKg));
    setSuccess('La configuracion de bodega quedo guardada.');
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 pb-[150px] text-slate-900">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-6">
        <header className="rounded-[30px] border border-white/80 bg-white/90 px-5 py-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-[24px] bg-[#eef2ff] p-4 text-[#102d92] shadow-inner">
                <Settings size={24} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Cafe Smart
                </p>
                <h1 className="text-[1.75rem] font-black tracking-tight text-[#121826]">
                  Ajustes
                </h1>
              </div>
            </div>
            <CloudStatusBadge compact />
          </div>
        </header>

        <section className="rounded-[30px] border border-[#e6e8f3] bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="inline-flex rounded-2xl bg-[#eef2ff] p-3 text-[#102d92]">
            <Warehouse size={20} />
          </div>
          <h2 className="mt-5 text-[1.55rem] font-black text-slate-900">Configuracion de bodega</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            Ajusta la capacidad para que el inventario no quede amarrado a un numero fijo.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-black uppercase tracking-[0.14em] text-slate-400">
                Nombre de la bodega
              </label>
              <input
                type="text"
                value={nombreBodega}
                onChange={(event) => setNombreBodega(event.target.value)}
                className="w-full rounded-[20px] border border-[#dfe5f2] bg-[#fbfcff] px-4 py-4 text-base font-semibold text-slate-900 outline-none focus:border-[#102d92]"
                placeholder="Bodega principal"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-black uppercase tracking-[0.14em] text-slate-400">
                Capacidad maxima (kg)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={capacidadKg}
                onChange={(event) => setCapacidadKg(event.target.value)}
                className="w-full rounded-[20px] border border-[#dfe5f2] bg-[#fbfcff] px-4 py-4 text-base font-semibold text-slate-900 outline-none focus:border-[#102d92]"
                placeholder="3000"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] bg-[#f6f7fd] px-4 py-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Inventario actual
              </p>
              <p className="mt-2 text-xl font-black text-slate-900">
                {loadingStock ? 'Cargando...' : `${formatKg(inventarioActualKg)} kg`}
              </p>
            </div>
            <div className="rounded-[20px] bg-[#f6f7fd] px-4 py-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Espacio disponible
              </p>
              <p className="mt-2 text-xl font-black text-slate-900">
                {Number.isFinite(Number(capacidadKg))
                  ? `${formatKg(capacidadRestante)} kg`
                  : 'Sin dato'}
              </p>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-5 rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={guardarBodega}
              className="inline-flex items-center justify-center gap-3 rounded-[20px] bg-[#102d92] px-5 py-4 text-base font-black text-white"
            >
              <Save size={18} />
              Guardar bodega
            </button>
            <button
              type="button"
              onClick={() => void cargarInventario()}
              className="inline-flex items-center justify-center gap-3 rounded-[20px] border border-slate-200 bg-white px-5 py-4 text-base font-black text-slate-700"
            >
              <RefreshCcw size={18} />
              Recargar stock
            </button>
          </div>
        </section>

        <section className="grid gap-4">
          <article className="rounded-[30px] border border-[#e6e8f3] bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="inline-flex rounded-2xl bg-[#eef2ff] p-3 text-[#102d92]">
              <Shield size={20} />
            </div>
            <h2 className="mt-5 text-[1.4rem] font-black text-slate-900">Cuenta y seguridad</h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              Este espacio queda listo para configuraciones de perfil, seguridad y permisos.
            </p>
          </article>

          <article className="rounded-[30px] border border-[#e6e8f3] bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="inline-flex rounded-2xl bg-[#ecfbf8] p-3 text-[#0f6b6d]">
              <Bell size={20} />
            </div>
            <h2 className="mt-5 text-[1.4rem] font-black text-slate-900">Preferencias</h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              Aqui luego podemos conectar alertas, datos administrativos y mas reglas del negocio.
            </p>
          </article>
        </section>

        <section className="rounded-[30px] border border-[#e6e8f3] bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <h2 className="text-[1.4rem] font-black text-slate-900">Acciones rapidas</h2>
          <div className="mt-5 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => navigate('/inicio')}
              className="inline-flex items-center justify-center rounded-[22px] border border-slate-200 bg-white px-5 py-4 text-base font-black text-slate-700"
            >
              Volver al inicio
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center justify-center gap-3 rounded-[22px] bg-[#102d92] px-5 py-4 text-base font-black text-white"
            >
              <LogOut size={20} />
              Cerrar sesion
            </button>
          </div>
        </section>
      </div>

      <AppBottomNav />
    </div>
  );
}
