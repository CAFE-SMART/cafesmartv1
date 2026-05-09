import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronRight,
  Droplets,
  FlaskConical,
  LifeBuoy,
  Lock,
  LogOut,
  ScanSearch,
  Save,
  Settings,
  Shield,
  UserCircle2,
  UserCog,
  X,
  Users,
  Users2,
  Warehouse,
  Wallet,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import {
  createGuidedError,
  FloatingGuidedNotice,
  InlineGuidedError,
  type GuidedErrorMessage,
} from '../components/forms/GuidedError';
import { useUser } from '../context/UserContext';
import { obtenerLotes } from '../services/lotesService';
import {
  obtenerConfiguracionBodega,
  guardarConfiguracionBodega,
} from '../services/bodegaApi';
import { applySecadoToLots } from '../utils/secadoFlow';
import { ENABLE_SECADO_PROTOTYPE } from '../config/features';

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

type AjustesErrorSection = 'profile' | 'company' | 'bodega';

function formatKg(value: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return parsed.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getAjustesErrorSection(message: string): AjustesErrorSection | null {
  if (
    message === 'Escribe el nombre del usuario.' ||
    message === 'Escribe el correo del usuario.'
  ) {
    return 'profile';
  }

  if (
    message === 'Escribe el nombre de la empresa.' ||
    message === 'Selecciona el tipo de empresa.'
  ) {
    return 'company';
  }

  if (
    message === 'Escribe un nombre para la bodega.' ||
    message === 'La capacidad debe ser mayor que 0.' ||
    message ===
      'La capacidad no puede ser menor al inventario actual almacenado.'
  ) {
    return 'bodega';
  }

  return null;
}

function getAjustesGuidance(message: string): GuidedErrorMessage {
  if (message === 'Escribe el nombre del usuario.') {
    return createGuidedError(
      message,
      'Falta tu nombre.',
      'No sabemos cómo llamarte.',
      'Escribe tu nombre de usuario.',
    );
  }

  if (message === 'Escribe el correo del usuario.') {
    return createGuidedError(
      message,
      'Falta el correo.',
      'Necesitamos un correo valido.',
      'Escribe el correo del usuario.',
    );
  }

  if (message === 'Escribe el nombre de la empresa.') {
    return createGuidedError(
      message,
      'Falta nombre de empresa.',
      'Tu negocio debe tener un nombre.',
      'Escribe el nombre de tu empresa.',
    );
  }

  if (message === 'Selecciona el tipo de empresa.') {
    return createGuidedError(
      message,
      'Falta el tipo.',
      '¿A que se dedica tu negocio?',
      'Selecciona el tipo de empresa.',
    );
  }

  if (message === 'Escribe un nombre para la bodega.') {
    return createGuidedError(
      message,
      'Bodega sin nombre.',
      'Ponle un nombre para identificarla.',
      'Escribe el Nombre.',
    );
  }

  if (message === 'La capacidad debe ser mayor que 0.') {
    return createGuidedError(
      message,
      'Capacidad en cero.',
      'La bodega debe tener espacio.',
      'Ingresa una capacidad mayor a 0.',
    );
  }

  if (
    message ===
    'La capacidad no puede ser menor al inventario actual almacenado.'
  ) {
    return createGuidedError(
      message,
      'Capacidad muy pequeña.',
      'Ya tienes mas cafe guardado que ese limite.',
      'Aumenta la Capacidad de bodega.',
    );
  }

  return createGuidedError(
    message,
    'Ups, no se pudo guardar.',
    'Revisa los campos señalados.',
    'Vuelve a intentar.',
  );
}

export default function Ajustes() {
  const navigate = useNavigate();
  const { user, logout } = useUser();

  const initialConfig = useMemo(
    () => ({
      nombreBodega: 'Bodega principal',
      capacidadKg: null as number | null,
      updatedAt: new Date().toISOString(),
    }),
    [],
  );

  const [profile, setProfile] = useState<ProfileSettings>(() => ({
    nombre: user?.name ?? '',
    correo: user?.email ?? '',
    telefono: '',
  }));
  const [company, setCompany] = useState<CompanySettings>(() => ({
    nombreEmpresa: '',
    tipoEmpresa: '',
    descripcion: '',
  }));

  const [nombreBodega, setNombreBodega] = useState(initialConfig.nombreBodega);
  const [capacidadKg, setCapacidadKg] = useState('');
  const [updatedAt, setUpdatedAt] = useState(initialConfig.updatedAt);
  const [inventarioActualKg, setInventarioActualKg] = useState(0);
  const [loadingStock, setLoadingStock] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isEditingBodega, setIsEditingBodega] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [floatingError, setFloatingError] = useState<GuidedErrorMessage | null>(
    null,
  );
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const activeErrorSection = error ? getAjustesErrorSection(error) : null;

  const clearFeedback = () => {
    setError(null);
    setSuccess(null);
    setFloatingError(null);
  };

  const abrirEditorBodega = () => {
    clearFeedback();
    setIsEditingBodega(true);
    setIsEditingCompany(false);
    setIsEditingProfile(false);
  };

  const cerrarEditorBodega = () => {
    clearFeedback();
    setIsEditingBodega(false);
  };

  useEffect(() => {
    const nextNombre = profile.nombre || user?.name || '';
    const nextCorreo = profile.correo || user?.email || '';
    const nextTipo =
      company.tipoEmpresa ||
      (user?.tipoOrganizacion
        ? user.tipoOrganizacion.charAt(0) +
          user.tipoOrganizacion.slice(1).toLowerCase()
        : 'Compraventa');

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
          prev.descripcion ||
          'Configuración base para operar compras, inventario y ventas.',
      }));
    }
  }, [
    company.nombreEmpresa,
    company.tipoEmpresa,
    company.descripcion,
    profile.nombre,
    profile.correo,
    user?.name,
    user?.email,
    user?.tipoOrganizacion,
  ]);

  const cargarInventario = async () => {
    setLoadingStock(true);
    try {
      const lotes = await obtenerLotes();
      const visual = ENABLE_SECADO_PROTOTYPE ? applySecadoToLots(lotes) : lotes;
      setInventarioActualKg(
        visual.reduce((sum, lote) => sum + lote.pesoActual, 0),
      );
    } catch {
      setInventarioActualKg(0);
    } finally {
      setLoadingStock(false);
    }
  };

  useEffect(() => {
    void cargarInventario();
  }, []);

  useEffect(() => {
    const cargarConfiguracionBodega = async () => {
      try {
        const config = await obtenerConfiguracionBodega();
        setNombreBodega(config.nombreBodega);
        setCapacidadKg(config.capacidadKg ? String(config.capacidadKg) : '');
        setUpdatedAt(config.updatedAt);
      } catch {
        setNombreBodega(initialConfig.nombreBodega);
        setCapacidadKg('');
        setUpdatedAt(initialConfig.updatedAt);
      }
    };

    void cargarConfiguracionBodega();
  }, []);

  const capacidadRestante = useMemo(() => {
    const numeric = Number(capacidadKg);
    if (!capacidadKg.trim() || !Number.isFinite(numeric)) return null;
    return Math.max(0, numeric - inventarioActualKg);
  }, [capacidadKg, inventarioActualKg]);

  const guardarPerfil = () => {
    clearFeedback();
    if (!profile.nombre.trim()) {
      const message = 'Escribe el nombre del usuario.';
      setError(message);
      setFloatingError(getAjustesGuidance(message));
      return;
    }
    if (!profile.correo.trim()) {
      const message = 'Escribe el correo del usuario.';
      setError(message);
      setFloatingError(getAjustesGuidance(message));
      return;
    }
    setSuccess('Perfil actualizado correctamente.');
    setIsEditingProfile(false);
  };

  const guardarEmpresa = () => {
    clearFeedback();
    if (!company.nombreEmpresa.trim()) {
      const message = 'Escribe el nombre de la empresa.';
      setError(message);
      setFloatingError(getAjustesGuidance(message));
      return;
    }
    if (!company.tipoEmpresa.trim()) {
      const message = 'Selecciona el tipo de empresa.';
      setError(message);
      setFloatingError(getAjustesGuidance(message));
      return;
    }
    setSuccess('Información de la empresa actualizada.');
    setIsEditingCompany(false);
  };

  const guardarBodega = async () => {
    const capacidad = Number(capacidadKg);
    clearFeedback();

    if (!nombreBodega.trim()) {
      const message = 'Escribe un nombre para la bodega.';
      setError(message);
      return;
    }

    if (!Number.isFinite(capacidad) || capacidad <= 0) {
      const message = 'La capacidad debe ser mayor que 0.';
      setError(message);
      return;
    }

    if (capacidad < inventarioActualKg) {
      const message =
        'La capacidad no puede ser menor al inventario actual almacenado.';
      setError(message);
      return;
    }

    try {
      const result = await guardarConfiguracionBodega({
        nombreBodega,
        capacidadKg: capacidad,
      });

      setNombreBodega(result.nombreBodega);
      setCapacidadKg(result.capacidadKg ? String(result.capacidadKg) : '');
      setUpdatedAt(result.updatedAt);
      setSuccess('Capacidad de bodega actualizada.');
      setIsEditingBodega(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al guardar la bodega.';
      setError(message);
    }
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

  const procesosOperativos = [
    {
      id: 'secado',
      title: 'Proceso de secado',
      description: 'Tiempo y humedad',
      icon: Droplets,
      iconStyle: 'bg-[#eef2ff] text-[#102d92]',
      onClick: () => navigate('/inventario'),
    },
    {
      id: 'gastos',
      title: 'Gastos operativos',
      description: 'Listado y registro',
      icon: Wallet,
      iconStyle: 'bg-[#eef2ff] text-[#102d92]',
      onClick: () => navigate('/gastos'),
    },
  ] as const;

  const configuracionNegocio = [
    {
      id: 'info-empresa',
      title: 'Información de la empresa',
      description: company.nombreEmpresa || 'Datos principales del negocio',
      icon: Building2,
      iconStyle: 'bg-[#eff4ff] text-[#2c57cc]',
      staticOnly: false,
      onClick: () => setIsEditingCompany(true),
    },
    {
      id: 'tipos-cafe',
      title: 'Tipos de café',
      description: 'Variedades registradas',
      icon: FlaskConical,
      iconStyle: 'bg-[#eff4ff] text-[#2c57cc]',
      staticOnly: true,
      onClick: undefined,
    },
    {
      id: 'calidades-cafe',
      title: 'Calidades de café',
      description: 'Estándares de calidad',
      icon: ScanSearch,
      iconStyle: 'bg-[#eff4ff] text-[#2c57cc]',
      staticOnly: true,
      onClick: undefined,
    },
    {
      id: 'capacidad-bodega',
      title: 'Capacidad de bodega',
      description: 'Límites de almacenamiento',
      icon: Warehouse,
      iconStyle: 'bg-[#eff4ff] text-[#2c57cc]',
      staticOnly: false,
      onClick: abrirEditorBodega,
    },
    {
      id: 'perfil-usuario',
      title: 'Perfil de usuario',
      description: 'Datos de tu cuenta',
      icon: UserCog,
      iconStyle: 'bg-[#eff4ff] text-[#2c57cc]',
      staticOnly: false,
      onClick: () => setIsEditingProfile(true),
    },
    {
      id: 'gestion-usuarios',
      title: 'Gestión de usuarios',
      description: 'Próximamente',
      icon: Users,
      iconStyle: 'bg-[#eff4ff] text-[#2c57cc]',
      staticOnly: true,
      onClick: undefined,
    },
    {
      id: 'contacto-soporte',
      title: 'Contacto y soporte',
      description: 'Ayuda, dudas y reportes',
      icon: LifeBuoy,
      iconStyle: 'bg-[#eef2ff] text-[#102d92]',
      staticOnly: false,
      onClick: () => navigate('/soporte'),
    },
  ] as const;

  const gestionPersonas = [
    {
      id: 'clientes-registrados',
      title: 'Clientes registrados',
      description: 'Base de datos de compradores',
      icon: Users2,
      iconStyle: 'bg-[#f3f6ff] text-[#5b6f9d]',
      staticOnly: true,
    },
    {
      id: 'usuarios-sistema',
      title: 'Usuarios del sistema',
      description: 'Roles y permisos',
      icon: Shield,
      iconStyle: 'bg-[#f3f6ff] text-[#5b6f9d]',
      staticOnly: true,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 pb-[150px] text-slate-900">
      <div className="mx-auto flex w-full max-w-[430px] flex-col gap-4">
        <header className="relative flex items-center justify-center py-1">
          <button
            type="button"
            onClick={() => navigate('/inicio')}
            className="absolute left-0 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#dce2f1] bg-white text-slate-600"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-[1.7rem] font-black tracking-tight text-[#121826]">
            Ajustes
          </h1>
        </header>

        <section className="rounded-[20px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="h-14 w-14 rounded-full bg-[#eef2ff] p-1 shadow-inner">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[#102d92]">
                  <UserCircle2 size={28} />
                </div>
              </div>
              <div className="absolute -right-1 -bottom-1 rounded-full bg-[#102d92] p-1.5 text-white">
                <Settings size={10} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[1.1rem] font-semibold text-[#121826]">
                {profile.nombre || 'Administrador'}
              </h2>
              <p className="text-xs font-medium text-slate-500">
                {company.tipoEmpresa || 'Administrador'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingProfile((prev) => !prev)}
              className="inline-flex min-h-[36px] items-center justify-center rounded-[12px] border border-[#d6deef] bg-[#f9fbff] px-3 text-xs font-semibold text-[#102d92]"
            >
              Editar
            </button>
          </div>

          {isEditingProfile ? (
            <div className="mt-4 space-y-3 rounded-[18px] border border-[#e7ebf6] bg-[#fbfcff] p-4">
              <input
                type="text"
                value={profile.nombre}
                onChange={(event) => {
                  setProfile((prev) => ({
                    ...prev,
                    nombre: event.target.value,
                  }));
                  clearFeedback();
                }}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
                placeholder="Nombre completo"
              />
              <input
                type="email"
                value={profile.correo}
                onChange={(event) => {
                  setProfile((prev) => ({
                    ...prev,
                    correo: event.target.value,
                  }));
                  clearFeedback();
                }}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
                placeholder="Correo electrónico"
              />
              <input
                type="tel"
                value={profile.telefono}
                onChange={(event) => {
                  setProfile((prev) => ({
                    ...prev,
                    telefono: event.target.value,
                  }));
                  clearFeedback();
                }}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
                placeholder="Teléfono"
              />
              {error && activeErrorSection === 'profile' ? (
                <InlineGuidedError message={getAjustesGuidance(error)} />
              ) : null}
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
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            Procesos operativos
          </p>
          <div className="grid grid-cols-2 gap-2">
            {procesosOperativos.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className="rounded-[14px] border border-[#e5e9f5] bg-white p-3 text-left shadow-sm"
                >
                  <span
                    className={`inline-flex rounded-lg p-2 ${item.iconStyle}`}
                  >
                    <Icon size={14} />
                  </span>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {item.description}
                  </p>
                </button>
              );
            })}
          </div>

          <p className="pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            Configuración del negocio
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {configuracionNegocio.map((item) => {
              const Icon = item.icon;
              const disabled = item.staticOnly === true;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  disabled={disabled}
                  className={`flex w-full items-start gap-2.5 rounded-[12px] border border-[#e5e9f5] bg-white px-3 py-3 text-left shadow-sm ${disabled ? 'opacity-75' : ''}`}
                >
                  <span
                    className={`inline-flex rounded-lg p-2 ${item.iconStyle}`}
                  >
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {item.title}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {item.description}
                    </span>
                  </span>
                  <ChevronRight
                    size={14}
                    className="mt-0.5 shrink-0 text-slate-300"
                  />
                </button>
              );
            })}
          </div>

          <p className="pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            Gestión de personas
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {gestionPersonas.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled
                  className="flex w-full items-start gap-2.5 rounded-[12px] border border-[#e5e9f5] bg-white px-3 py-3 text-left opacity-80 shadow-sm"
                >
                  <span
                    className={`inline-flex rounded-lg p-2 ${item.iconStyle}`}
                  >
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {item.title}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {item.description}
                    </span>
                  </span>
                  <ChevronRight
                    size={14}
                    className="mt-0.5 shrink-0 text-slate-300"
                  />
                </button>
              );
            })}
          </div>

          <p className="pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            Información financiera
          </p>
          <article className="relative overflow-hidden rounded-[16px] border border-[#dbe5ff] bg-[#f7f9ff] px-4 py-5 text-[#172033] shadow-[0_10px_24px_rgba(42,79,181,0.10)]">
            <div className="absolute -right-4 -top-6 h-24 w-24 rounded-full bg-[#dbe6ff]/70" />
            <div className="relative z-10 flex flex-col items-center text-center">
              <span className="inline-flex rounded-full bg-[#eaf0ff] p-2 text-[#2a4fb5]">
                <Lock size={15} />
              </span>
              <p className="mt-3 text-base font-semibold">
                Ver resumen financiero
              </p>
              <p className="mt-1 max-w-[320px] text-xs text-slate-500">
                Consulta ventas, compras y gastos con contraseña de
                administrador.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/resumen-financiero')}
              className="relative z-10 mt-4 flex min-h-[36px] w-fit items-center justify-center rounded-[999px] bg-[#2b57d3] px-4 text-xs font-semibold text-white opacity-90 mx-auto"
            >
              Acceder ahora
            </button>
          </article>
        </section>

        {isEditingCompany ? (
          <section className="rounded-[22px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-900">
              Editar empresa
            </h3>
            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={company.nombreEmpresa}
                onChange={(event) => {
                  setCompany((prev) => ({
                    ...prev,
                    nombreEmpresa: event.target.value,
                  }));
                  clearFeedback();
                }}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
                placeholder="Nombre de la empresa"
              />
              <select
                value={company.tipoEmpresa}
                onChange={(event) => {
                  setCompany((prev) => ({
                    ...prev,
                    tipoEmpresa: event.target.value,
                  }));
                  clearFeedback();
                }}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
              >
                <option value="">Seleccionar tipo</option>
                <option value="Cooperativa">Cooperativa</option>
                <option value="Compraventa">Compraventa</option>
                <option value="Otro">Otro</option>
              </select>
              <textarea
                value={company.descripcion}
                onChange={(event) => {
                  setCompany((prev) => ({
                    ...prev,
                    descripcion: event.target.value,
                  }));
                  clearFeedback();
                }}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
                rows={3}
                placeholder="Descripción breve del negocio"
              />
              {error && activeErrorSection === 'company' ? (
                <InlineGuidedError message={getAjustesGuidance(error)} />
              ) : null}
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

        {error && !activeErrorSection && !isEditingBodega ? (
          <InlineGuidedError message={getAjustesGuidance(error)} />
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

      {isEditingBodega ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f172a]/45 px-5 py-6 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-[22px] border border-[#e6e8f3] bg-white px-5 pb-5 pt-3 shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-[#cfd8e6]" />
            <div className="mt-4 flex items-center justify-between gap-3">
              <h3 className="text-[1.25rem] font-semibold leading-tight text-[#111827]">
                Capacidad de bodega
              </h3>
              <button
                type="button"
                onClick={cerrarEditorBodega}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-2 block text-[0.8rem] font-semibold text-slate-700">
                  Nombre
                </p>
                <input
                  type="text"
                  value={nombreBodega}
                  onChange={(event) => {
                    setNombreBodega(event.target.value);
                    clearFeedback();
                  }}
                  className="w-full rounded-[14px] border border-[#dde4f1] bg-[#f7f9fd] px-4 py-3 text-[0.95rem] font-semibold text-slate-900 outline-none focus:border-[#173ea6]"
                  placeholder="Bodega principal"
                />
              </div>

              <div>
                <p className="mb-2 block text-[0.8rem] font-semibold text-slate-700">
                  Capacidad max. (kg)
                </p>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={capacidadKg}
                  onChange={(event) => {
                    setCapacidadKg(event.target.value);
                    clearFeedback();
                  }}
                  className="w-full rounded-[14px] border border-[#dde4f1] bg-[#f7f9fd] px-4 py-3 text-[0.95rem] font-semibold text-slate-900 outline-none focus:border-[#173ea6]"
                  placeholder="6000"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-[10px] bg-[#f6f7fd] px-3 py-2.5">
                  <p className="text-[0.58rem] font-black uppercase tracking-[0.06em] text-slate-500">
                    En bodega
                  </p>
                  <p className="mt-1 text-[0.9rem] font-black leading-tight text-slate-900">
                    {loadingStock
                      ? 'Cargando...'
                      : `${formatKg(inventarioActualKg)} kg`}
                  </p>
                  <p className="mt-0.5 text-[0.58rem] text-slate-500">
                    Almacenados
                  </p>
                </div>
                <div className="rounded-[10px] bg-[#f6f7fd] px-3 py-2.5">
                  <p className="text-[0.58rem] font-black uppercase tracking-[0.06em] text-slate-500">
                    Disponible
                  </p>
                  <p className="mt-1 text-[0.9rem] font-black leading-tight text-slate-900">
                    {capacidadRestante !== null
                      ? `${formatKg(capacidadRestante)} kg`
                      : 'Sin dato'}
                  </p>
                  <p className="mt-0.5 text-[0.58rem] text-slate-500">Libres</p>
                </div>
              </div>
              <div>
                <button
                  type="button"
                  onClick={guardarBodega}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 py-3 text-[0.9rem] font-semibold text-white"
                >
                  <Save size={14} />
                  Guardar cambios
                </button>
              </div>
              {error ? (
                <InlineGuidedError message={getAjustesGuidance(error)} />
              ) : null}
              <p className="inline-flex w-full items-center justify-center gap-1.5 text-center text-[0.62rem] font-semibold text-slate-500">
                <CalendarDays size={12} className="text-[#102d92]" />
                Última actualización: {formatDate(updatedAt)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {floatingError && !isEditingBodega ? (
        <FloatingGuidedNotice
          message={floatingError}
          onClose={() => setFloatingError(null)}
        />
      ) : null}

      <AppBottomNav />
    </div>
  );
}
