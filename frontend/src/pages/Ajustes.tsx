import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  LogOut,
  RefreshCcw,
  Save,
  Settings,
  UserCircle2,
  Warehouse,
  Wallet,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import { FormattedPhoneInput } from '../components/FormattedPhoneInput';
import { useUser } from '../context/UserContext';
import { obtenerLotes } from '../services/lotesService';
import { getBodegaConfig, saveBodegaConfig } from '../utils/bodegaConfig';
import { applySecadoToLots } from '../utils/secadoFlow';

type ProfileSettings = {
  nombre: string;
  correo: string;
  telefono: string;
};

type CompanySettings = {
  nombreEmpresa: string;
  tipoEmpresa: string;
  descripcion: string;
};

const PROFILE_STORAGE_KEY = 'cafesmart_profile_settings_v1';
const COMPANY_STORAGE_KEY = 'cafesmart_company_settings_v1';

function formatKg(value: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return parsed.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getStoredProfile(): ProfileSettings | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProfileSettings>;
    return {
      nombre: parsed.nombre ?? '',
      correo: parsed.correo ?? '',
      telefono: parsed.telefono ?? '',
    };
  } catch {
    return null;
  }
}

function getStoredCompany(): CompanySettings | null {
  try {
    const raw = window.localStorage.getItem(COMPANY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CompanySettings>;
    return {
      nombreEmpresa: parsed.nombreEmpresa ?? '',
      tipoEmpresa: parsed.tipoEmpresa ?? '',
      descripcion: parsed.descripcion ?? '',
    };
  } catch {
    return null;
  }
}

function saveProfile(profile: ProfileSettings) {
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

function saveCompany(company: CompanySettings) {
  window.localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(company));
}

export default function Ajustes() {
  const navigate = useNavigate();
  const { user, logout } = useUser();

  const initialConfig = useMemo(() => getBodegaConfig(), []);

  const [profile, setProfile] = useState<ProfileSettings>(() => getStoredProfile() ?? { nombre: '', correo: '', telefono: '' });
  const [company, setCompany] = useState<CompanySettings>(() => getStoredCompany() ?? {
    nombreEmpresa: '',
    tipoEmpresa: '',
    descripcion: '',
  });

  const [nombreBodega, setNombreBodega] = useState(initialConfig.nombreBodega);
  const [capacidadKg, setCapacidadKg] = useState(String(initialConfig.capacidadKg));
  const [updatedAt, setUpdatedAt] = useState(initialConfig.updatedAt);
  const [inventarioActualKg, setInventarioActualKg] = useState(0);
  const [loadingStock, setLoadingStock] = useState(true);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isEditingBodega, setIsEditingBodega] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  useEffect(() => {
    const nextNombre = profile.nombre || user?.name || '';
    const nextCorreo = profile.correo || user?.email || '';
    const nextTipo =
      company.tipoEmpresa ||
      (user?.tipoOrganizacion ? user.tipoOrganizacion.charAt(0) + user.tipoOrganizacion.slice(1).toLowerCase() : 'Compraventa');

    if (nextNombre !== profile.nombre || nextCorreo !== profile.correo) {
      setProfile((prev) => ({
        ...prev,
        nombre: nextNombre,
        correo: nextCorreo,
      }));
    }

    if (!company.nombreEmpresa || !company.tipoEmpresa) {
      setCompany((prev) => ({
        nombreEmpresa: prev.nombreEmpresa || 'Mi empresa cafetera',
        tipoEmpresa: nextTipo,
        descripcion:
          prev.descripcion || 'Configuración base para operar compras, inventario y ventas.',
      }));
    }
  }, [company.nombreEmpresa, company.tipoEmpresa, company.descripcion, profile.nombre, profile.correo, user?.name, user?.email, user?.tipoOrganizacion]);

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

  const guardarPerfil = () => {
    setError(null);
    setSuccess(null);
    if (!profile.nombre.trim()) {
      setError('Escribe el nombre del usuario.');
      return;
    }
    if (!profile.correo.trim()) {
      setError('Escribe el correo del usuario.');
      return;
    }
    saveProfile(profile);
    setSuccess('Perfil actualizado correctamente.');
    setIsEditingProfile(false);
  };

  const guardarEmpresa = () => {
    setError(null);
    setSuccess(null);
    if (!company.nombreEmpresa.trim()) {
      setError('Escribe el nombre de la empresa.');
      return;
    }
    if (!company.tipoEmpresa.trim()) {
      setError('Selecciona el tipo de empresa.');
      return;
    }
    saveCompany(company);
    setSuccess('Información de la empresa actualizada.');
    setIsEditingCompany(false);
  };

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
    setSuccess('Capacidad de bodega actualizada.');
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

  const servicios = [
    {
      id: 'gastos',
      title: 'Gastos operativos',
      description: 'Controla costos diarios del negocio caficultor.',
      icon: Wallet,
      iconStyle: 'bg-[#fff6df] text-[#b77718]',
    },
    {
      id: 'analisis',
      title: 'Análisis financiero',
      description: 'Visualiza ingresos, egresos y utilidad estimada.',
      icon: BarChart3,
      iconStyle: 'bg-[#eef2ff] text-[#102d92]',
    },
  ] as const;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 pb-[150px] text-slate-900">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/inicio')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#dce2f1] bg-white text-slate-600"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-[1.7rem] font-black tracking-tight text-[#121826]">Ajustes</h1>
          <CloudStatusBadge compact className="max-w-[180px]" />
        </header>

        <section className="rounded-[28px] border border-[#e6e8f3] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-[#eef2ff] p-1.5 shadow-inner">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[#102d92]">
                  <UserCircle2 size={40} />
                </div>
              </div>
              <div className="absolute -right-0.5 -bottom-0.5 rounded-full bg-[#102d92] p-2 text-white">
                <Settings size={12} />
              </div>
            </div>
            <h2 className="mt-3 text-[1.45rem] font-black text-[#121826]">{profile.nombre || 'Administrador'}</h2>
            <p className="text-sm font-semibold text-slate-500">Administrador</p>
            <button
              type="button"
              onClick={() => setIsEditingProfile((prev) => !prev)}
              className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-[14px] bg-[#102d92] px-5 py-2.5 text-sm font-black text-white"
            >
              Editar perfil
            </button>
          </div>

          {isEditingProfile ? (
            <div className="mt-4 space-y-3 rounded-[18px] border border-[#e7ebf6] bg-[#fbfcff] p-4">
              <input
                type="text"
                value={profile.nombre}
                onChange={(event) => setProfile((prev) => ({ ...prev, nombre: event.target.value }))}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
                placeholder="Nombre completo"
              />
              <input
                type="email"
                value={profile.correo}
                onChange={(event) => setProfile((prev) => ({ ...prev, correo: event.target.value }))}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
                placeholder="Correo electrónico"
              />
              <FormattedPhoneInput
                label="Telefono"
                optional
                value={profile.telefono}
                onChange={(telefono) => setProfile((prev) => ({ ...prev, telefono }))}
                hint="Escribe solo el celular. Cafe Smart agrega +57 y los espacios."
              />
              <button
                type="button"
                onClick={guardarPerfil}
                className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 py-2.5 text-sm font-black text-white"
              >
                <Save size={15} />
                Guardar perfil
              </button>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Mi negocio</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <article className="rounded-[20px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
              <div className="inline-flex rounded-xl bg-[#e9fbf4] p-2.5 text-[#0d7b67]">
                <Building2 size={17} />
              </div>
              <h3 className="mt-3 text-sm font-black text-slate-900">Información de la empresa</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">{company.nombreEmpresa}</p>
              <p className="text-xs font-semibold text-slate-500">{company.tipoEmpresa}</p>
              <button
                type="button"
                onClick={() => setIsEditingCompany((prev) => !prev)}
                className="mt-3 inline-flex min-h-[34px] w-full items-center justify-center rounded-[12px] border border-[#d8def1] bg-white px-3 py-2 text-xs font-black text-[#102d92]"
              >
                Editar empresa
              </button>
            </article>

            <article className="rounded-[20px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
              <div className="inline-flex rounded-xl bg-[#eef2ff] p-2.5 text-[#102d92]">
                <Warehouse size={17} />
              </div>
              <h3 className="mt-3 text-sm font-black text-slate-900">Capacidad de bodega</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {formatKg(Number(capacidadKg) || 0)} kg
              </p>
              <p className="text-xs font-semibold text-slate-500">Actualizado: {formatDate(updatedAt)}</p>
              <button
                type="button"
                onClick={() => setIsEditingBodega((prev) => !prev)}
                className="mt-3 inline-flex min-h-[34px] w-full items-center justify-center rounded-[12px] border border-[#d8def1] bg-white px-3 py-2 text-xs font-black text-[#102d92]"
              >
                Configurar bodega
              </button>
            </article>
          </div>
        </section>

        {isEditingCompany ? (
          <section className="rounded-[22px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-900">Editar empresa</h3>
            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={company.nombreEmpresa}
                onChange={(event) => setCompany((prev) => ({ ...prev, nombreEmpresa: event.target.value }))}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
                placeholder="Nombre de la empresa"
              />
              <select
                value={company.tipoEmpresa}
                onChange={(event) => setCompany((prev) => ({ ...prev, tipoEmpresa: event.target.value }))}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
              >
                <option value="">Seleccionar tipo</option>
                <option value="Cooperativa">Cooperativa</option>
                <option value="Compraventa">Compraventa</option>
                <option value="Otro">Otro</option>
              </select>
              <textarea
                value={company.descripcion}
                onChange={(event) => setCompany((prev) => ({ ...prev, descripcion: event.target.value }))}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
                rows={3}
                placeholder="Descripción breve del negocio"
              />
              <button
                type="button"
                onClick={guardarEmpresa}
                className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 py-2.5 text-sm font-black text-white"
              >
                <Save size={15} />
                Guardar empresa
              </button>
            </div>
          </section>
        ) : null}

        {isEditingBodega ? (
          <section className="rounded-[22px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-900">Configurar bodega</h3>
            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={nombreBodega}
                onChange={(event) => setNombreBodega(event.target.value)}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
                placeholder="Bodega principal"
              />
              <input
                type="number"
                min="1"
                step="1"
                value={capacidadKg}
                onChange={(event) => setCapacidadKg(event.target.value)}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
                placeholder="6000"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[14px] bg-[#f6f7fd] px-3 py-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Inventario</p>
                  <p className="mt-1 text-sm font-black text-slate-900">
                    {loadingStock ? 'Cargando...' : `${formatKg(inventarioActualKg)} kg`}
                  </p>
                </div>
                <div className="rounded-[14px] bg-[#f6f7fd] px-3 py-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Disponible</p>
                  <p className="mt-1 text-sm font-black text-slate-900">
                    {Number.isFinite(Number(capacidadKg)) ? `${formatKg(capacidadRestante)} kg` : 'Sin dato'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={guardarBodega}
                  className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[12px] bg-[#102d92] px-4 py-2 text-xs font-black text-white"
                >
                  <Save size={14} />
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => void cargarInventario()}
                  className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700"
                >
                  <RefreshCcw size={14} />
                  Recargar
                </button>
              </div>
              <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                <CalendarDays size={13} className="text-[#102d92]" />
                Última actualización: {formatDate(updatedAt)}
              </p>
            </div>
          </section>
        ) : null}

        <section className="rounded-[22px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-slate-900">Servicios</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {servicios.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.id} className="rounded-[16px] border border-[#e7ebf6] bg-[#fbfcff] p-3">
                  <div className={`inline-flex rounded-xl p-2.5 ${item.iconStyle}`}>
                    <Icon size={15} />
                  </div>
                  <h4 className="mt-2 text-sm font-black text-slate-900">{item.title}</h4>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.description}</p>
                </article>
              );
            })}
          </div>
        </section>

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
