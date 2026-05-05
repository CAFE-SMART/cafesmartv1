import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Droplets,
  FlaskConical,
  Lock,
  LogOut,
  Play,
  ReceiptText,
  ScanSearch,
  RefreshCcw,
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
import { EmptyState } from '../components/EmptyState';
import {
  createGuidedErrorFromUi,
  FloatingGuidedNotice,
  InlineGuidedError,
  type GuidedErrorMessage,
} from '../components/forms/GuidedError';
import { useUser } from '../context/UserContext';
import { listarCompras } from '../services/comprasService';
import { listarGastos } from '../services/gastosService';
import { obtenerLotes } from '../services/lotesService';
import {
  obtenerConfiguracionBodega,
  guardarConfiguracionBodega,
} from '../services/bodegaApi';
import { applySecadoToLots } from '../utils/secadoFlow';
import { createUiMessage, UI_MESSAGES } from '../utils/uiMessages';

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

type MovimientoReciente = {
  id: string;
  tipo: 'COMPRA' | 'GASTO';
  titulo: string;
  detalle: string;
  fecha: string;
  monto: number;
};

const PROFILE_STORAGE_KEY = 'cafesmart_profile_settings_v1';
const COMPANY_STORAGE_KEY = 'cafesmart_company_settings_v1';
type AjustesErrorSection = 'profile' | 'company' | 'bodega';

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

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function getPhoneDigits(value: string) {
  return value.replace(/\D/g, '');
}

function getPhoneValidationMessage(value: string) {
  const digits = getPhoneDigits(value);

  if (!digits) {
    return {
      tone: 'neutral' as const,
      text: 'Escribe un número de 10 dígitos.',
    };
  }

  if (digits.length < 10) {
    const missing = 10 - digits.length;
    return {
      tone: 'warning' as const,
      text: `Falta${missing === 1 ? '' : 'n'} ${missing} número${missing === 1 ? '' : 's'}.`,
    };
  }

  if (digits.length > 10) {
    const extra = digits.length - 10;
    return {
      tone: 'warning' as const,
      text: `Sobran ${extra} número${extra === 1 ? '' : 's'}. Debe tener 10 dígitos.`,
    };
  }

  return {
    tone: 'success' as const,
    text: 'El número tiene 10 dígitos.',
  };
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

function getAjustesErrorSection(message: string): AjustesErrorSection | null {
  if (
    message === 'Escribe el nombre del usuario.' ||
    message === 'Escribe el correo del usuario.' ||
    message === 'El teléfono debe tener 10 números.' ||
    message === 'No realizaste cambios en el perfil.'
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
    message === 'La capacidad no puede ser menor al inventario actual almacenado.'
  ) {
    return 'bodega';
  }

  return null;
}

function getAjustesGuidance(message: string): GuidedErrorMessage {
  if (message === 'Escribe el nombre del usuario.') {
    return createGuidedErrorFromUi(
      createUiMessage(
        UI_MESSAGES.forms.incompleteData.titulo,
        'Escribe el nombre del usuario.',
        'Revisa los campos marcados',
      ),
    );
  }

  if (message === 'Escribe el correo del usuario.') {
    return createGuidedErrorFromUi(
      createUiMessage(
        UI_MESSAGES.forms.incompleteData.titulo,
        'Escribe el correo del usuario.',
        'Revisa los campos marcados',
      ),
    );
  }

  if (message === 'El teléfono debe tener 10 números.') {
    return createGuidedErrorFromUi(
      createUiMessage(
        UI_MESSAGES.forms.invalidValue.titulo,
        message,
        'Corrige el dato',
      ),
    );
  }

  if (message === 'No realizaste cambios en el perfil.') {
    return createGuidedErrorFromUi(
      createUiMessage(
        'Sin cambios por guardar',
        message,
        'Modifica algún dato antes de guardar',
      ),
    );
  }

  if (message === 'Escribe el nombre de la empresa.') {
    return createGuidedErrorFromUi(
      createUiMessage(
        UI_MESSAGES.forms.incompleteData.titulo,
        message,
        'Revisa los campos marcados',
      ),
    );
  }

  if (message === 'Selecciona el tipo de empresa.') {
    return createGuidedErrorFromUi(
      createUiMessage(
        UI_MESSAGES.forms.incompleteData.titulo,
        message,
        'Revisa los campos marcados',
      ),
    );
  }

  if (message === 'Escribe un nombre para la bodega.') {
    return createGuidedErrorFromUi(
      createUiMessage(
        UI_MESSAGES.forms.incompleteData.titulo,
        message,
        'Revisa los campos marcados',
      ),
    );
  }

  if (message === 'La capacidad debe ser mayor que 0.') {
    return createGuidedErrorFromUi(
      createUiMessage(
        UI_MESSAGES.forms.invalidValue.titulo,
        message,
        'Corrige el dato',
      ),
    );
  }

  if (message === 'La capacidad no puede ser menor al inventario actual almacenado.') {
    return createGuidedErrorFromUi(
      createUiMessage(
        UI_MESSAGES.forms.invalidValue.titulo,
        message,
        'Ajusta la capacidad e intenta nuevamente',
      ),
    );
  }

  return createGuidedErrorFromUi(
    createUiMessage(
      UI_MESSAGES.system.saveFailed.titulo,
      message || UI_MESSAGES.system.saveFailed.mensaje,
      UI_MESSAGES.system.saveFailed.accion,
    ),
  );
}

export default function Ajustes() {
  const navigate = useNavigate();
  const { user } = useUser();

  const initialConfig = useMemo(() => ({
    nombreBodega: 'Bodega principal',
    capacidadKg: 3000,
    updatedAt: new Date().toISOString(),
  }), []);

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
  const [movimientosRecientes, setMovimientosRecientes] = useState<MovimientoReciente[]>([]);
  const [loadingMovimientos, setLoadingMovimientos] = useState(true);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isEditingBodega, setIsEditingBodega] = useState(false);
  const [isViewingSecado, setIsViewingSecado] = useState(false);
  const [isViewingProfile, setIsViewingProfile] = useState(false);
  const [phoneWasEdited, setPhoneWasEdited] = useState(false);
  const [profileEditBaseline, setProfileEditBaseline] = useState<ProfileSettings | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [floatingError, setFloatingError] = useState<GuidedErrorMessage | null>(null);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const activeErrorSection = error ? getAjustesErrorSection(error) : null;
  const phoneValidation = useMemo(
    () => getPhoneValidationMessage(profile.telefono),
    [profile.telefono],
  );

  const clearFeedback = () => {
    setError(null);
    setSuccess(null);
    setFloatingError(null);
  };

  const abrirEditorBodega = () => {
    clearFeedback();
    setIsEditingBodega(true);
    setIsViewingSecado(false);
    setIsEditingCompany(false);
    setIsEditingProfile(false);
    setIsViewingProfile(false);
  };

  const cerrarEditorBodega = () => {
    clearFeedback();
    setIsEditingBodega(false);
  };

  const abrirEditorEmpresa = () => {
    clearFeedback();
    setIsEditingCompany(true);
    setIsViewingProfile(false);
    setIsViewingSecado(false);
    setIsEditingProfile(false);
    setIsEditingBodega(false);
  };

  const cerrarEditorEmpresa = () => {
    clearFeedback();
    setIsEditingCompany(false);
  };

  const abrirPerfilUsuario = () => {
    clearFeedback();
    setIsViewingProfile(true);
    setIsViewingSecado(false);
    setIsEditingProfile(false);
    setIsEditingCompany(false);
    setIsEditingBodega(false);
  };

  const abrirGestionSecado = () => {
    clearFeedback();
    setIsViewingSecado(true);
    setIsViewingProfile(false);
    setIsEditingProfile(false);
    setIsEditingCompany(false);
    setIsEditingBodega(false);
  };

  const cerrarGestionSecado = () => {
    clearFeedback();
    setIsViewingSecado(false);
  };

  const abrirInicioSecado = () => {
    setIsViewingSecado(false);
    navigate('/secado', { state: { secadoView: 'start' } });
  };

  const abrirSecadosPendientes = () => {
    setIsViewingSecado(false);
    navigate('/secado', { state: { secadoView: 'pending' } });
  };

  useEffect(() => {
    if (!isViewingSecado) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cerrarGestionSecado();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isViewingSecado]);

  useEffect(() => {
    if (!isViewingSecado) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isViewingSecado]);

  useEffect(() => {
    const nextNombre = profile.nombre || user?.name || '';
    const nextCorreo = profile.correo || user?.email || '';
    const nextTelefono = profile.telefono || user?.telefono || '';
    const nextEmpresa = company.nombreEmpresa || user?.nombreOrganizacion || '';
    const nextTipo =
      company.tipoEmpresa ||
      (user?.tipoOrganizacion ? user.tipoOrganizacion.charAt(0) + user.tipoOrganizacion.slice(1).toLowerCase() : 'Compraventa');

    if (
      nextNombre !== profile.nombre ||
      nextCorreo !== profile.correo ||
      nextTelefono !== profile.telefono
    ) {
      setProfile((prev) => ({
        ...prev,
        nombre: nextNombre,
        correo: nextCorreo,
        telefono: nextTelefono,
      }));
    }

    if (!company.nombreEmpresa || !company.tipoEmpresa) {
      setCompany((prev) => ({
        nombreEmpresa: prev.nombreEmpresa || nextEmpresa || 'Mi empresa cafetera',
        tipoEmpresa: nextTipo,
        descripcion:
          prev.descripcion || user?.otroTipoDetalle || '',
      }));
    }
  }, [
    company.nombreEmpresa,
    company.tipoEmpresa,
    profile.nombre,
    profile.correo,
    profile.telefono,
    user?.name,
    user?.email,
    user?.telefono,
    user?.nombreOrganizacion,
    user?.tipoOrganizacion,
    user?.otroTipoDetalle,
  ]);

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

  useEffect(() => {
    const cargarConfiguracionBodega = async () => {
      try {
        const config = await obtenerConfiguracionBodega();
        setNombreBodega(config.nombreBodega);
        setCapacidadKg(String(config.capacidadKg));
        setUpdatedAt(config.updatedAt);
      } catch {
        // Si falla, usar valores por defecto
        setNombreBodega(initialConfig.nombreBodega);
        setCapacidadKg(String(initialConfig.capacidadKg));
        setUpdatedAt(initialConfig.updatedAt);
      }
    };

    void cargarConfiguracionBodega();
  }, []);

  useEffect(() => {
    const cargarMovimientos = async () => {
      setLoadingMovimientos(true);
      try {
        const [compras, gastos] = await Promise.all([listarCompras(), listarGastos()]);

        const itemsCompras: MovimientoReciente[] = compras.map((compra) => ({
          id: `compra-${compra.id}`,
          tipo: 'COMPRA',
          titulo: 'Compra registrada',
          detalle: `${compra.totalSublotes} sublotes`,
          fecha: compra.fecha || compra.creadoEn,
          monto: compra.totalCompra,
        }));

        const itemsGastos: MovimientoReciente[] = gastos.map((gasto) => ({
          id: `gasto-${gasto.id}`,
          tipo: 'GASTO',
          titulo: gasto.conceptoGasto || 'Gasto operativo',
          detalle: gasto.esGastoGeneral ? 'Gasto general' : `Sublotes: ${gasto.sublotes.length}`,
          fecha: gasto.fechaGasto || gasto.createdAt,
          monto: gasto.montoGasto,
        }));

        const merged = [...itemsCompras, ...itemsGastos]
          .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
          .slice(0, 3);

        setMovimientosRecientes(merged);
      } catch {
        setMovimientosRecientes([]);
      } finally {
        setLoadingMovimientos(false);
      }
    };

    void cargarMovimientos();
  }, []);

  const capacidadRestante = useMemo(() => {
    const numeric = Number(capacidadKg);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, numeric - inventarioActualKg);
  }, [capacidadKg, inventarioActualKg]);

  const guardarPerfil = () => {
    clearFeedback();
    if (phoneWasEdited && profile.telefono.trim() && getPhoneDigits(profile.telefono).length !== 10) {
      const message = 'El teléfono debe tener 10 números.';
      setError(message);
      setFloatingError(getAjustesGuidance(message));
      return;
    }

    const baseline = profileEditBaseline ?? getStoredProfile() ?? {
      nombre: user?.name ?? '',
      correo: user?.email ?? '',
      telefono: user?.telefono ?? '',
    };

    const nextProfile: ProfileSettings = {
      nombre: profile.nombre.trim() || baseline.nombre,
      correo: profile.correo.trim() || baseline.correo,
      telefono: profile.telefono.trim() || baseline.telefono,
    };

    const hasChanges =
      nextProfile.nombre !== baseline.nombre ||
      nextProfile.correo !== baseline.correo ||
      nextProfile.telefono !== baseline.telefono;

    if (!hasChanges) {
      const message = 'No realizaste cambios en el perfil.';
      setError(message);
      setFloatingError(getAjustesGuidance(message));
      return;
    }

    saveProfile(nextProfile);
    setProfile(nextProfile);
    setSuccess(UI_MESSAGES.success.saved.mensaje);
    setIsEditingProfile(false);
    setPhoneWasEdited(false);
    setProfileEditBaseline(null);
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
    saveCompany(company);
    setSuccess(UI_MESSAGES.success.saved.mensaje);
    setIsEditingCompany(false);
  };

  const guardarBodega = async () => {
    const capacidad = Number(capacidadKg);
    clearFeedback();

    if (!nombreBodega.trim()) {
      const message = 'Escribe un nombre para la bodega.';
      setError(message);
      setFloatingError(getAjustesGuidance(message));
      return;
    }

    if (!Number.isFinite(capacidad) || capacidad <= 0) {
      const message = 'La capacidad debe ser mayor que 0.';
      setError(message);
      setFloatingError(getAjustesGuidance(message));
      return;
    }

    if (capacidad < inventarioActualKg) {
      const message = 'La capacidad no puede ser menor al inventario actual almacenado.';
      setError(message);
      setFloatingError(getAjustesGuidance(message));
      return;
    }

    try {
      const result = await guardarConfiguracionBodega({
        nombreBodega,
        capacidadKg: capacidad,
      });

      setNombreBodega(result.nombreBodega);
      setCapacidadKg(String(result.capacidadKg));
      setUpdatedAt(result.updatedAt);
      setSuccess(UI_MESSAGES.success.saved.mensaje);
      setIsEditingBodega(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar la bodega.';
      setError(message);
      setFloatingError(getAjustesGuidance(message));
    }
  };

  const cerrarSesion = async () => {
    setCerrandoSesion(true);
    navigate('/cerrando-sesion', { replace: true });
  };

  const procesosOperativos = [
    {
      id: 'secado',
      title: 'Proceso de secado',
      description: 'Tiempo y humedad',
      icon: Droplets,
      iconStyle: 'bg-[#eef2ff] text-[#102d92]',
      onClick: abrirGestionSecado,
    },
    {
      id: 'gastos',
      title: 'Gastos operativos',
      description: 'Insumos y servicios',
      icon: Wallet,
      iconStyle: 'bg-[#eef2ff] text-[#102d92]',
      onClick: () => navigate('/gastos/registro'),
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
      onClick: abrirEditorEmpresa,
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
      onClick: abrirPerfilUsuario,
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

  const secadoModal =
    isViewingSecado && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[2147483640] flex items-end justify-center bg-[#020617]/85 px-0 pt-8 backdrop-blur-lg"
            onClick={cerrarGestionSecado}
          >
            <div
              className="relative max-h-[85vh] w-full max-w-[560px] overflow-y-auto rounded-t-[24px] border border-[#e6e8f3] bg-white px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-4 text-center shadow-[0_-18px_70px_rgba(2,6,23,0.45)]"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="secado-modal-title"
            >
              <div className="mx-auto h-2 w-16 rounded-full bg-[#cfd8e6]" />

              <button
                type="button"
                onClick={cerrarGestionSecado}
                className="absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500 transition hover:bg-[#e9eef8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cb8ff]"
                aria-label="Cerrar gestión de secado"
              >
                <X size={22} />
              </button>

              <div className="mx-auto mt-12 flex max-w-[390px] flex-col items-center gap-2">
                <h3
                  id="secado-modal-title"
                  className="text-[1.65rem] font-black leading-tight text-[#111827]"
                >
                  Gestión de secado
                </h3>
                <p className="text-sm font-semibold leading-6 text-slate-500">
                  Inicia un secado o continúa uno pendiente.
                </p>
              </div>

              <div className="mt-6 grid gap-4">
                <article className="flex flex-col items-center rounded-[18px] border border-[#e2e8f4] bg-[#f8faff] p-4 text-center">
                  <span className="inline-flex rounded-[14px] bg-[#e9f8f1] p-3 text-[#0f766e]">
                    <Play size={20} />
                  </span>
                  <h4 className="mt-3 text-base font-black text-slate-900">Iniciar secado</h4>
                  <p className="mt-2 max-w-[330px] text-sm leading-5 text-slate-600">
                    Registra el secado de un lote verde disponible.
                  </p>
                  <button
                    type="button"
                    onClick={abrirInicioSecado}
                    className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white transition hover:bg-[#0c2479] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cb8ff]"
                  >
                    Iniciar secado
                    <ChevronRight size={16} />
                  </button>
                </article>

                <article className="flex flex-col items-center rounded-[18px] border border-[#e2e8f4] bg-[#f8faff] p-4 text-center">
                  <span className="inline-flex rounded-[14px] bg-[#fff7df] p-3 text-[#d29309]">
                    <ClipboardList size={20} />
                  </span>
                  <h4 className="mt-3 text-base font-black text-slate-900">Secados pendientes</h4>
                  <p className="mt-2 max-w-[330px] text-sm leading-5 text-slate-600">
                    Finaliza lotes que ya están en proceso.
                  </p>
                  <button
                    type="button"
                    onClick={abrirSecadosPendientes}
                    className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#cbd6f2] bg-white px-4 text-sm font-black text-[#102d92] transition hover:bg-[#f4f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cb8ff]"
                  >
                    Ver pendientes
                    <ChevronRight size={16} />
                  </button>
                </article>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 pb-[150px] text-slate-900">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
        <header className="relative flex items-center justify-center py-1">
          <button
            type="button"
            onClick={() => navigate('/inicio')}
            className="absolute left-0 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#dce2f1] bg-white text-slate-600"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-[1.7rem] font-black tracking-tight text-[#121826]">Ajustes</h1>
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
              <h2 className="truncate text-[1.1rem] font-semibold text-[#121826]">{profile.nombre || 'Administrador'}</h2>
              <p className="text-xs font-medium text-slate-500">{company.tipoEmpresa || 'Administrador'}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                clearFeedback();
                setIsEditingProfile((prev) => {
                  const next = !prev;
                  setProfileEditBaseline(next ? profile : null);
                  return next;
                });
                setPhoneWasEdited(false);
                setIsViewingProfile(false);
                setIsEditingCompany(false);
                setIsEditingBodega(false);
              }}
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
                  setProfile((prev) => ({ ...prev, nombre: event.target.value }));
                  clearFeedback();
                }}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
                placeholder="Nombre completo"
              />
              <input
                type="email"
                value={profile.correo}
                onChange={(event) => {
                  setProfile((prev) => ({ ...prev, correo: event.target.value }));
                  clearFeedback();
                }}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
                placeholder="Correo electrónico"
              />
              <input
                type="tel"
                value={profile.telefono}
                onChange={(event) => {
                  setProfile((prev) => ({ ...prev, telefono: event.target.value }));
                  setPhoneWasEdited(true);
                  clearFeedback();
                }}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
                placeholder="Teléfono"
              />
              {phoneWasEdited ? (
                <p
                  className={`rounded-[12px] px-3 py-2 text-xs font-semibold ${
                    phoneValidation.tone === 'success'
                      ? 'bg-emerald-50 text-emerald-700'
                      : phoneValidation.tone === 'warning'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-50 text-slate-500'
                  }`}
                >
                  {phoneValidation.text}
                </p>
              ) : null}
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
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Procesos operativos</p>
          <div className="grid grid-cols-2 gap-3">
            {procesosOperativos.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className="rounded-[14px] border border-[#e5e9f5] bg-white p-3 text-left shadow-sm"
                >
                  <span className={`inline-flex rounded-lg p-2 ${item.iconStyle}`}>
                    <Icon size={14} />
                  </span>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-[11px] text-slate-500">{item.description}</p>
                </button>
              );
            })}
          </div>

          <p className="pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Configuración del negocio</p>
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
                  <span className={`inline-flex rounded-lg p-2 ${item.iconStyle}`}>
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{item.title}</span>
                    <span className="block truncate text-[11px] text-slate-500">{item.description}</span>
                  </span>
                  <ChevronRight size={14} className="mt-0.5 shrink-0 text-slate-300" />
                </button>
              );
            })}
          </div>

          {isViewingProfile ? (
            <section className="rounded-[18px] border border-[#dbe4fb] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#2c57cc]">
                    Perfil de usuario
                  </p>
                  <h3 className="mt-1 text-[1.15rem] font-semibold text-slate-900">
                    Datos guardados
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsViewingProfile(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                  aria-label="Cerrar perfil"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 grid gap-2.5">
                {[
                  ['Nombre', profile.nombre || user?.name || 'Sin nombre guardado'],
                  ['Teléfono', profile.telefono || user?.telefono || 'Sin teléfono guardado'],
                  ['Correo', profile.correo || user?.email || 'Sin correo guardado'],
                  [
                    'Empresa',
                    company.nombreEmpresa || user?.nombreOrganizacion || 'Sin empresa guardada',
                  ],
                  [
                    'Descripción',
                    company.descripcion ||
                      user?.otroTipoDetalle ||
                      'Sin descripción registrada',
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-[14px] border border-[#edf0f7] bg-[#fbfcff] px-3 py-2.5"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearFeedback();
                    setIsEditingProfile(true);
                    setProfileEditBaseline(profile);
                    setPhoneWasEdited(false);
                    setIsEditingCompany(false);
                    setIsViewingProfile(false);
                  }}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] bg-[#102d92] px-3 text-sm font-semibold text-white"
                >
                  Editar perfil
                </button>
                <button
                  type="button"
                  onClick={abrirEditorEmpresa}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] border border-[#d6deef] bg-[#f9fbff] px-3 text-sm font-semibold text-[#102d92]"
                >
                  Editar empresa
                </button>
              </div>
            </section>
          ) : null}

          <p className="pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Gestión de personas</p>
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
                  <span className={`inline-flex rounded-lg p-2 ${item.iconStyle}`}>
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{item.title}</span>
                    <span className="block truncate text-[11px] text-slate-500">{item.description}</span>
                  </span>
                  <ChevronRight size={14} className="mt-0.5 shrink-0 text-slate-300" />
                </button>
              );
            })}
          </div>

          <p className="pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Información financiera</p>
          <article className="relative overflow-hidden rounded-[16px] border border-[#1d2f66] bg-[#081336] px-4 py-5 text-white shadow-[0_12px_35px_rgba(8,19,54,0.35)]">
            <div className="absolute -right-4 -top-6 h-24 w-24 rounded-full bg-[#27459f]/40" />
            <div className="relative z-10 flex flex-col items-center text-center">
              <span className="inline-flex rounded-full bg-[#1f3fa7] p-2">
                <Lock size={15} />
              </span>
              <p className="mt-3 text-base font-semibold">Ver información financiera</p>
              <p className="mt-1 max-w-[320px] text-xs text-[#c8d4ff]">Este módulo requiere contraseña de administrador para acceso.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/resumen-financiero')}
              className="relative z-10 mx-auto mt-4 flex min-h-[36px] w-fit items-center justify-center rounded-[999px] bg-[#2b57d3] px-4 text-xs font-semibold text-white"
            >
              Acceder ahora
            </button>
          </article>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Movimientos recientes</p>
            <button
              type="button"
              onClick={() => navigate('/inventario')}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2a4fb5]"
            >
              Ver todos
              <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="rounded-[16px] border border-[#e5e9f5] bg-white p-3 shadow-sm">
            {loadingMovimientos ? (
              <p className="px-1 py-2 text-sm text-slate-500">{UI_MESSAGES.loading.movements}</p>
            ) : movimientosRecientes.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title={UI_MESSAGES.empty.recentMovements.titulo}
                description={UI_MESSAGES.empty.recentMovements.mensaje}
                actionLabel={UI_MESSAGES.empty.recentMovements.accion}
                onAction={() => navigate('/compras')}
              />
            ) : (
              <div className="space-y-2">
                {movimientosRecientes.map((movimiento) => {
                  const esCompra = movimiento.tipo === 'COMPRA';
                  return (
                    <article key={movimiento.id} className="flex items-center gap-3 rounded-[12px] bg-[#f8faff] px-3 py-2.5">
                      <span className={`inline-flex rounded-full p-2 ${esCompra ? 'bg-[#e8f7ef] text-[#1d8d4f]' : 'bg-[#ffecef] text-[#c43b54]'}`}>
                        {esCompra ? <Warehouse size={14} /> : <CircleDollarSign size={14} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{movimiento.titulo}</p>
                        <p className="truncate text-[11px] text-slate-500">{movimiento.detalle} · {formatDate(movimiento.fecha)}</p>
                      </div>
                      <p className={`text-xs font-semibold ${esCompra ? 'text-[#1d8d4f]' : 'text-[#c43b54]'}`}>
                        {esCompra ? '+' : '-'} {formatMoney(movimiento.monto)}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {error && !activeErrorSection ? (
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

      {isEditingCompany ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#0f172a]/35 px-3 pt-8 backdrop-blur-md">
          <div className="w-full max-w-[560px] rounded-t-[24px] border border-[#e6e8f3] bg-white px-5 pb-6 pt-4 shadow-[0_24px_60px_rgba(15,23,42,0.35)] sm:px-6 sm:pb-7">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#cfd8e6]" />
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[1.7rem] font-semibold leading-tight text-[#111827]">
                Editar empresa
              </h3>
              <button
                type="button"
                onClick={cerrarEditorEmpresa}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                aria-label="Cerrar"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mt-8 space-y-5">
              <div>
                <p className="mb-2 block text-base font-semibold text-slate-900">
                  Nombre de la empresa
                </p>
                <input
                  type="text"
                  value={company.nombreEmpresa}
                  onChange={(event) => {
                    setCompany((prev) => ({ ...prev, nombreEmpresa: event.target.value }));
                    clearFeedback();
                  }}
                  className="w-full rounded-[20px] border border-[#dde4f1] bg-[#f7f9fd] px-5 py-4 text-base text-slate-900 outline-none focus:border-[#173ea6]"
                  placeholder="Nombre de la empresa"
                />
              </div>

              <div>
                <p className="mb-2 block text-base font-semibold text-slate-900">
                  Tipo de empresa
                </p>
                <select
                  value={company.tipoEmpresa}
                  onChange={(event) => {
                    setCompany((prev) => ({ ...prev, tipoEmpresa: event.target.value }));
                    clearFeedback();
                  }}
                  className="w-full rounded-[20px] border border-[#dde4f1] bg-[#f7f9fd] px-5 py-4 text-base text-slate-900 outline-none focus:border-[#173ea6]"
                >
                  <option value="">Seleccionar tipo</option>
                  <option value="Cooperativa">Cooperativa</option>
                  <option value="Compraventa">Compraventa</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <p className="mb-2 block text-base font-semibold text-slate-900">
                  Descripción
                </p>
                <textarea
                  value={company.descripcion}
                  onChange={(event) => {
                    setCompany((prev) => ({ ...prev, descripcion: event.target.value }));
                    clearFeedback();
                  }}
                  className="w-full rounded-[20px] border border-[#dde4f1] bg-[#f7f9fd] px-5 py-4 text-base text-slate-900 outline-none focus:border-[#173ea6]"
                  rows={3}
                  placeholder="Descripción breve del negocio"
                />
              </div>

              {error && activeErrorSection === 'company' ? (
                <InlineGuidedError message={getAjustesGuidance(error)} />
              ) : null}

              <button
                type="button"
                onClick={guardarEmpresa}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[20px] bg-[#102d92] px-5 py-4 text-base font-semibold text-white"
              >
                <Save size={14} />
                Guardar empresa
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditingBodega ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#0f172a]/35 px-3 pt-8 backdrop-blur-md">
          <div className="w-full max-w-[560px] rounded-t-[24px] border border-[#e6e8f3] bg-white px-5 pb-6 pt-4 shadow-[0_24px_60px_rgba(15,23,42,0.35)] sm:px-6 sm:pb-7">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#cfd8e6]" />
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[1.7rem] font-semibold leading-tight text-[#111827]">Capacidad de la bodega</h3>
              <button
                type="button"
                onClick={cerrarEditorBodega}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                aria-label="Cerrar"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mt-8 space-y-5">
              <div>
                <p className="mb-2 block text-base font-semibold text-slate-900">Nombre de la bodega</p>
                <input
                  type="text"
                  value={nombreBodega}
                  onChange={(event) => {
                    setNombreBodega(event.target.value);
                    clearFeedback();
                  }}
                  className="w-full rounded-[20px] border border-[#dde4f1] bg-[#f7f9fd] px-5 py-4 text-base text-slate-900 outline-none focus:border-[#173ea6]"
                  placeholder="Bodega principal"
                />
              </div>

              <div>
                <p className="mb-2 block text-base font-semibold text-slate-900">Capacidad máxima (kg)</p>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={capacidadKg}
                  onChange={(event) => {
                    setCapacidadKg(event.target.value);
                    clearFeedback();
                  }}
                  className="w-full rounded-[20px] border border-[#dde4f1] bg-[#f7f9fd] px-5 py-4 text-base text-slate-900 outline-none focus:border-[#173ea6]"
                  placeholder="6000"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[16px] bg-[#f6f7fd] px-4 py-3.5">
                  <p className="text-sm font-semibold text-slate-500">En bodega</p>
                  <p className="mt-1 text-2xl font-black leading-tight text-slate-900">
                    {loadingStock ? 'Cargando...' : `${formatKg(inventarioActualKg)} kg`}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Kilos almacenados</p>
                </div>
                <div className="rounded-[16px] bg-[#f6f7fd] px-4 py-3.5">
                  <p className="text-sm font-semibold text-slate-500">Espacio disponible</p>
                  <p className="mt-1 text-2xl font-black leading-tight text-slate-900">
                    {Number.isFinite(Number(capacidadKg)) ? `${formatKg(capacidadRestante)} kg` : 'Sin dato'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Kilos libres</p>
                </div>
              </div>
              <div>
                <button
                  type="button"
                  onClick={guardarBodega}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[20px] bg-[#102d92] px-5 py-4 text-base font-semibold text-white"
                >
                  <Save size={14} />
                  Guardar cambios
                </button>
              </div>
              {error && activeErrorSection === 'bodega' ? (
                <InlineGuidedError message={getAjustesGuidance(error)} />
              ) : null}
              <p className="inline-flex w-full items-center justify-center gap-2 text-center text-sm font-medium text-slate-500">
                <CalendarDays size={14} className="text-[#102d92]" />
                Última actualización: {formatDate(updatedAt)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {floatingError ? (
        <FloatingGuidedNotice
          message={floatingError}
          onClose={() => setFloatingError(null)}
        />
      ) : null}

      {secadoModal}
      <AppBottomNav hidden={isViewingSecado} />
    </div>
  );
}
