import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Droplets,
  LogOut,
  RefreshCcw,
  Save,
  Settings,
  ShieldCheck,
  UserRoundCog,
  Users,
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

const PROFILE_STORAGE_KEY_PREFIX = 'cafesmart_profile_settings_v1';
const COMPANY_STORAGE_KEY_PREFIX = 'cafesmart_company_settings_v1';

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

function getProfileStorageKey(userId: string | number | null | undefined) {
  return userId ? `${PROFILE_STORAGE_KEY_PREFIX}:${String(userId)}` : PROFILE_STORAGE_KEY_PREFIX;
}

function getCompanyStorageKey(organizacionId: string | null | undefined) {
  return organizacionId
    ? `${COMPANY_STORAGE_KEY_PREFIX}:${organizacionId}`
    : COMPANY_STORAGE_KEY_PREFIX;
}

function getStoredProfile(storageKey: string): ProfileSettings | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
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

function getStoredCompany(storageKey: string): CompanySettings | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
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

function saveProfile(storageKey: string, profile: ProfileSettings) {
  window.localStorage.setItem(storageKey, JSON.stringify(profile));
}

function saveCompany(storageKey: string, company: CompanySettings) {
  window.localStorage.setItem(storageKey, JSON.stringify(company));
}

export default function Ajustes() {
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const profileStorageKey = useMemo(() => getProfileStorageKey(user?.id), [user?.id]);
  const companyStorageKey = useMemo(
    () => getCompanyStorageKey(user?.organizacionId ?? null),
    [user?.organizacionId],
  );

  const initialConfig = useMemo(() => getBodegaConfig(), []);

  const [profile, setProfile] = useState<ProfileSettings>({
    nombre: '',
    correo: '',
    telefono: '',
  });
  const [company, setCompany] = useState<CompanySettings>({
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
    const storedProfile = getStoredProfile(profileStorageKey);
    const storedCompany = getStoredCompany(companyStorageKey);
    const defaultTipo = user?.tipoOrganizacion
      ? user.tipoOrganizacion.charAt(0) + user.tipoOrganizacion.slice(1).toLowerCase()
      : 'Compraventa';

    setProfile({
      nombre: storedProfile?.nombre || user?.name || '',
      correo: storedProfile?.correo || user?.email || '',
      telefono: storedProfile?.telefono || '',
    });

    setCompany({
      nombreEmpresa: storedCompany?.nombreEmpresa || 'Mi empresa cafetera',
      tipoEmpresa: storedCompany?.tipoEmpresa || defaultTipo,
      descripcion:
        storedCompany?.descripcion ||
        'Configuración base para operar compras, inventario y ventas.',
    });
  }, [companyStorageKey, profileStorageKey, user?.email, user?.name, user?.tipoOrganizacion]);

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
    saveProfile(profileStorageKey, profile);
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
    saveCompany(companyStorageKey, company);
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
      id: 'secado',
      title: 'Proceso de Secado',
      description: 'Revisa y continúa lotes listos para secado.',
      icon: Droplets,
      iconStyle: 'bg-[#eef2ff] text-[#102d92]',
    },
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

  const configuracionNegocio = [
    {
      id: 'company',
      title: 'Tipo de café',
      description: company.tipoEmpresa || 'Información del negocio',
      icon: Building2,
      onClick: () => setIsEditingCompany((prev) => !prev),
    },
    {
      id: 'quality',
      title: 'Calidades de café',
      description: company.descripcion || 'Configura la operación del negocio',
      icon: ShieldCheck,
      onClick: () => setIsEditingCompany((prev) => !prev),
    },
    {
      id: 'warehouse',
      title: 'Capacidad de bodega',
      description: `${formatKg(Number(capacidadKg) || 0)} kg`,
      icon: Warehouse,
      onClick: () => setIsEditingBodega((prev) => !prev),
    },
  ] as const;

  const gestionPersonas = [
    {
      id: 'profile',
      title: 'Perfil del usuario',
      description: profile.nombre || 'Administrador',
      icon: UserRoundCog,
      onClick: () => setIsEditingProfile((prev) => !prev),
    },
    {
      id: 'users',
      title: 'Gestión de usuarios',
      description: 'Próximamente',
      icon: Users,
      onClick: () => setSuccess('La gestión de usuarios estará disponible en una siguiente actualización.'),
    },
  ] as const;

  const resumenReciente = [
    {
      id: 'inventario',
      title: 'Inventario actual',
      value: loadingStock ? 'Cargando...' : `${formatKg(inventarioActualKg)} kg`,
      accent: 'text-[#102d92]',
      bg: 'bg-[#eef2ff]',
    },
    {
      id: 'capacidad',
      title: 'Capacidad disponible',
      value: `${formatKg(capacidadRestante)} kg`,
      accent: 'text-[#0f766e]',
      bg: 'bg-[#ecfdf5]',
    },
    {
      id: 'actualizacion',
      title: 'Última actualización',
      value: formatDate(updatedAt),
      accent: 'text-[#9a3412]',
      bg: 'bg-[#fff7ed]',
    },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-4 py-5 pb-[150px] text-slate-900">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/inicio')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#102d92] shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.2rem] font-black text-[#111827]">Ajustes</h1>
          </div>
          <CloudStatusBadge compact className="max-w-[150px]" />
        </header>

        <section className="rounded-[24px] bg-[linear-gradient(180deg,#f8fbff_0%,#eef3fb_100%)] px-5 py-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#e8eefb] text-[#8a97b8]">
                <UserCircle2 size={38} />
              </div>
              <div className="absolute -right-1 top-0 rounded-full bg-[#2954d8] p-1.5 text-white shadow-sm">
                <Settings size={12} />
              </div>
            </div>
            <h2 className="mt-3 text-[1rem] font-black text-[#111827]">{profile.nombre || 'Administrador'}</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {profile.correo || 'Administrador del sistema'}
            </p>
            <button
              type="button"
              onClick={() => setIsEditingProfile((prev) => !prev)}
              className="mt-4 inline-flex min-h-[38px] items-center justify-center rounded-[12px] bg-[#2954d8] px-5 py-2 text-xs font-black text-white"
            >
              Editar perfil
            </button>
          </div>

          {isEditingProfile ? (
            <div className="mt-5 space-y-3 rounded-[18px] border border-[#dfe6f4] bg-white p-4">
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

        <section className="rounded-[20px] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Procesos operativos
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {servicios.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    navigate(
                      item.id === 'gastos'
                        ? '/gastos'
                        : item.id === 'analisis'
                          ? '/analisis-financiero'
                          : '/secado',
                    )
                  }
                  className="rounded-[16px] border border-[#e8edf7] bg-[#fbfcff] p-3 text-left"
                >
                  <div className={`inline-flex rounded-xl p-2 ${item.iconStyle}`}>
                    <Icon size={16} />
                  </div>
                  <h3 className="mt-2 text-[0.78rem] font-black text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">{item.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[20px] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Configuración del negocio
          </p>
          <div className="mt-3 space-y-2">
            {configuracionNegocio.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className="flex w-full items-center gap-3 rounded-[14px] border border-[#eef2f8] bg-[#fbfcff] px-4 py-3 text-left"
                >
                  <span className="inline-flex rounded-xl bg-[#eef2ff] p-2 text-[#2954d8]">
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-slate-900">{item.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">{item.description}</span>
                  </span>
                  <ChevronRight size={16} className="text-slate-400" />
                </button>
              );
            })}
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

        <section className="rounded-[20px] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Gestión de personas
          </p>
          <div className="mt-3 space-y-2">
            {gestionPersonas.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className="flex w-full items-center gap-3 rounded-[14px] border border-[#eef2f8] bg-[#fbfcff] px-4 py-3 text-left"
                >
                  <span className="inline-flex rounded-xl bg-[#eef2ff] p-2 text-[#2954d8]">
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-slate-900">{item.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">{item.description}</span>
                  </span>
                  <ChevronRight size={16} className="text-slate-400" />
                </button>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-[22px] bg-[#101828] text-white shadow-[0_18px_45px_rgba(15,23,42,0.2)]">
          <div className="flex items-center justify-between px-5 pt-5">
            <div className="rounded-2xl bg-white/10 p-3 text-[#8fb4ff]">
              <CircleDollarSign size={20} />
            </div>
            <BarChart3 size={20} className="text-white/30" />
          </div>
          <div className="px-5 pb-5 pt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
              Información financiera
            </p>
            <h3 className="mt-2 text-[1rem] font-black">Ver información financiera</h3>
            <p className="mt-1 text-xs leading-5 text-white/70">
              Revisa utilidad, inventario disponible e indicadores del negocio.
            </p>
            <button
              type="button"
              onClick={() => navigate('/analisis-financiero')}
              className="mt-4 inline-flex min-h-[40px] items-center justify-center rounded-[12px] bg-[#2954d8] px-5 py-2 text-xs font-black text-white"
            >
              Acceder ahora
            </button>
          </div>
        </section>

        <section className="rounded-[20px] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Resumen reciente
            </p>
            <button
              type="button"
              onClick={() => void cargarInventario()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eef2ff] text-[#2954d8]"
              title="Actualizar resumen"
            >
              <RefreshCcw size={14} />
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {resumenReciente.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-[14px] border border-[#eef2f8] bg-[#fbfcff] px-4 py-3"
              >
                <p className="text-sm font-semibold text-slate-600">{item.title}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${item.bg} ${item.accent}`}>
                  {item.value}
                </span>
              </div>
            ))}
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
