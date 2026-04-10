import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  LogOut,
  RefreshCcw,
  Save,
  Settings,
  Warehouse,
} from 'lucide-react';
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

function formatDate(value: string) {
  const parsed = new Date(value);
  return parsed.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function Ajustes() {
  const navigate = useNavigate();
  const { logout } = useUser();
  const initialConfig = useMemo(() => getBodegaConfig(), []);
  const [nombreBodega, setNombreBodega] = useState(initialConfig.nombreBodega);
  const [capacidadKg, setCapacidadKg] = useState(String(initialConfig.capacidadKg));
  const [updatedAt, setUpdatedAt] = useState(initialConfig.updatedAt);
  const [inventarioActualKg, setInventarioActualKg] = useState(0);
  const [loadingStock, setLoadingStock] = useState(true);
  const [isEditingBodega, setIsEditingBodega] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

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

    const now = new Date().toISOString();
    const next = saveBodegaConfig({
      nombreBodega,
      capacidadKg: capacidad,
      updatedAt: now,
    });

    setNombreBodega(next.nombreBodega);
    setCapacidadKg(String(next.capacidadKg));
    setUpdatedAt(next.updatedAt);
    setSuccess('Capacidad actualizada correctamente.');
    setIsEditingBodega(false);
  };

  const cerrarSesion = async () => {
    setCerrandoSesion(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setCerrandoSesion(false);
    }
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
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-[#eef2ff] p-3 text-[#102d92]">
              <Warehouse size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                Bodega
              </p>
              <h2 className="mt-1 text-[1.45rem] font-black text-slate-900">{nombreBodega}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Configura la capacidad de almacenamiento para que el inventario siempre use un valor real.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] bg-[#f6f7fd] px-4 py-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Capacidad actual
              </p>
              <p className="mt-2 text-xl font-black text-slate-900">
                {formatKg(Number(capacidadKg) || 0)} kg
              </p>
            </div>
            <div className="rounded-[20px] bg-[#f6f7fd] px-4 py-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Última actualización
              </p>
              <p className="mt-2 inline-flex items-center gap-2 text-base font-black text-slate-900">
                <CalendarDays size={16} className="text-[#102d92]" />
                {formatDate(updatedAt)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditingBodega((prev) => !prev)}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[20px] border border-[#dbe1ef] bg-white px-5 py-3.5 text-sm font-black text-[#102d92] transition hover:bg-[#f6f8ff]"
          >
            {isEditingBodega ? (
              <>
                <ChevronUp size={18} />
                Ocultar edición
              </>
            ) : (
              <>
                <ChevronDown size={18} />
                Abrir para modificar capacidad
              </>
            )}
          </button>

          {isEditingBodega ? (
            <div className="mt-5 space-y-4 rounded-[24px] border border-[#e7ebf6] bg-[#fbfcff] p-4">
              <div>
                <label className="mb-2 block text-sm font-black uppercase tracking-[0.14em] text-slate-400">
                  Nombre de la bodega
                </label>
                <input
                  type="text"
                  value={nombreBodega}
                  onChange={(event) => setNombreBodega(event.target.value)}
                  className="w-full rounded-[18px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#102d92]"
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
                  className="w-full rounded-[18px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#102d92]"
                  placeholder="3000"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[16px] bg-white px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Inventario actual
                  </p>
                  <p className="mt-2 text-lg font-black text-slate-900">
                    {loadingStock ? 'Cargando...' : `${formatKg(inventarioActualKg)} kg`}
                  </p>
                </div>
                <div className="rounded-[16px] bg-white px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Espacio disponible
                  </p>
                  <p className="mt-2 text-lg font-black text-slate-900">
                    {Number.isFinite(Number(capacidadKg))
                      ? `${formatKg(capacidadRestante)} kg`
                      : 'Sin dato'}
                  </p>
                </div>
              </div>

              {error ? (
                <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
              {success ? (
                <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {success}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={guardarBodega}
                  className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-[#102d92] px-5 py-3 text-sm font-black text-white"
                >
                  <Save size={17} />
                  Guardar cambios
                </button>
                <button
                  type="button"
                  onClick={() => void cargarInventario()}
                  className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700"
                >
                  <RefreshCcw size={17} />
                  Recargar stock
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div className="mx-auto w-full max-w-[520px]">
        <button
          type="button"
          onClick={() => void cerrarSesion()}
          disabled={cerrandoSesion}
          className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[16px] border border-rose-200 bg-white px-5 py-3 text-sm font-black text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut size={16} />
          {cerrandoSesion ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </button>
      </div>

      <AppBottomNav />
    </div>
  );
}
