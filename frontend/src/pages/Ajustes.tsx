import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleDashed,
  Droplets,
  FlaskConical,
  Lock,
  LogOut,
  Save,
  Scale,
  ScanSearch,
  Settings,
  Shield,
  UserCircle2,
  Users,
  Users2,
  Warehouse,
  Wallet,
  X,
  LoaderCircle,
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
  guardarLimitesEntrada,
} from '../services/bodegaApi';
import {
  applySecadoToLots,
  getActiveSecadoSessions,
} from '../utils/secadoFlow';
import { ENABLE_SECADO_PROTOTYPE } from '../config/features';
import {
  BUSINESS_NAME_ERROR,
  sanitizeBusinessNameInput,
  validateBusinessName,
  isValidPhone,
  sanitizeRegisterPhoneInput,
} from '../utils/registerValidators';
import {
  PESO_MAXIMO_ENTRADA_KG,
  PESO_MAXIMO_OPERATIVO_DEFAULT_KG,
  PESO_MINIMO_KG,
  PRECIO_MINIMO_KG,
} from '../utils/businessRules';

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

type AjustesErrorSection = 'profile' | 'company' | 'bodega' | 'limites';

const CAPACIDAD_BODEGA_MAX_KG = 999999;
const CAPACIDAD_BODEGA_MAX_LABEL = '999.999';
const PESO_MAXIMO_OPERATIVO_DEFAULT_LABEL = '99.999';
const CAPACIDAD_BODEGA_INVALIDA = 'Ingresa una capacidad de bodega válida.';
const CAPACIDAD_BODEGA_MENOR_INVENTARIO =
  'La capacidad no puede ser menor al café almacenado actualmente.';
const CAPACIDAD_BODEGA_MENOR_INVENTARIO_ANTERIOR =
  'La capacidad no puede ser menor al inventario actual almacenado.';

function formatKg(value: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(
    value,
  );
}

function sanitizeCapacidadBodegaInput(value: string) {
  return value.replace(/\D/g, '').slice(0, 6);
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
    message ===
      'El correo electrónico no es válido. Verifica que esté bien escrito.' ||
    message === 'El teléfono debe tener 10 dígitos y empezar con 3.'
  ) {
    return 'profile';
  }

  if (
    message === BUSINESS_NAME_ERROR ||
    message === 'Selecciona el tipo de empresa.' ||
    message === 'El nombre de la empresa no puede exceder los 30 caracteres.' ||
    message ===
      'La descripción de la empresa no puede exceder los 50 caracteres.'
  ) {
    return 'company';
  }

  if (
    message === 'Escribe un nombre para la bodega.' ||
    message === 'La capacidad debe ser mayor que 0.' ||
    message === CAPACIDAD_BODEGA_INVALIDA ||
    message === CAPACIDAD_BODEGA_MENOR_INVENTARIO ||
    message === CAPACIDAD_BODEGA_MENOR_INVENTARIO_ANTERIOR
  ) {
    return 'bodega';
  }

  if (
    message.toLowerCase().includes('límite') ||
    message.toLowerCase().includes('peso max') ||
    message.toLowerCase().includes('precio máx')
  ) {
    return 'limites';
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

  if (
    message ===
    'El correo electrónico no es válido. Verifica que esté bien escrito.'
  ) {
    return createGuidedError(
      message,
      'Correo inválido.',
      'El formato no es correcto.',
      'Ej. usuario@correo.com',
    );
  }

  if (message === 'El teléfono debe tener 10 dígitos y empezar con 3.') {
    return createGuidedError(
      message,
      'Teléfono inválido.',
      'Debe tener 10 números y empezar por 3.',
      'Verifica el número ingresado.',
    );
  }

  if (message === BUSINESS_NAME_ERROR) {
    return createGuidedError(
      message,
      'Revisa el nombre.',
      'Puede incluir letras, números, espacios y signos comerciales comunes.',
      'Escribe el nombre del negocio.',
    );
  }

  if (
    message === 'El nombre de la empresa no puede exceder los 30 caracteres.'
  ) {
    return createGuidedError(
      message,
      'Nombre muy largo.',
      'Máximo 30 caracteres permitidos.',
      'Acorta el nombre de la empresa.',
    );
  }

  if (
    message ===
    'La descripción de la empresa no puede exceder los 50 caracteres.'
  ) {
    return createGuidedError(
      message,
      'Descripción muy larga.',
      'Máximo 50 caracteres permitidos.',
      'Acorta la descripción de la empresa.',
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

  if (
    message === 'La capacidad debe ser mayor que 0.' ||
    message === CAPACIDAD_BODEGA_INVALIDA
  ) {
    return createGuidedError(
      CAPACIDAD_BODEGA_INVALIDA,
      'Capacidad inválida.',
      `Debe estar entre 1 y ${CAPACIDAD_BODEGA_MAX_LABEL} kg.`,
      'Corrige la capacidad para continuar.',
    );
  }

  if (
    message === CAPACIDAD_BODEGA_MENOR_INVENTARIO ||
    message === CAPACIDAD_BODEGA_MENOR_INVENTARIO_ANTERIOR
  ) {
    return createGuidedError(
      CAPACIDAD_BODEGA_MENOR_INVENTARIO,
      'Capacidad muy pequeña.',
      'Ya tienes mas cafe guardado que ese limite.',
      'Aumenta la Capacidad de bodega.',
    );
  }

  if (
    message.includes('Error al guardar los límites') ||
    message.includes('guardar los l\u00edmites')
  ) {
    return createGuidedError(
      message,
      'Error al guardar.',
      'No se pudieron actualizar los límites en el servidor.',
      'Intenta de nuevo.',
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
  const location = useLocation();
  const locationState = (location.state ?? null) as {
    focusSetting?: string;
  } | null;
  const { user, logout } = useUser();
  const safeUserName = typeof user?.name === 'string' ? user.name : '';
  const safeUserEmail = typeof user?.email === 'string' ? user.email : '';
  const safeUserPhone = typeof user?.telefono === 'string' ? user.telefono : '';
  const safeTipoOrganizacion =
    typeof user?.tipoOrganizacion === 'string' ? user.tipoOrganizacion : '';

  const initialConfig = useMemo(
    () => ({
      nombreBodega: 'Bodega principal',
      capacidadKg: null as number | null,
      updatedAt: new Date().toISOString(),
    }),
    [],
  );

  const [profile, setProfile] = useState<ProfileSettings>(() => ({
    nombre: safeUserName,
    correo: safeUserEmail,
    telefono: safeUserPhone,
  }));
  const [savedProfile, setSavedProfile] = useState<ProfileSettings>(() => ({
    nombre: safeUserName,
    correo: safeUserEmail,
    telefono: safeUserPhone,
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
  const [showNoActiveSecadoModal, setShowNoActiveSecadoModal] = useState(false);

  const [toastNotification, setToastNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [floatingError, setFloatingError] = useState<GuidedErrorMessage | null>(
    null,
  );
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [isEditingLimites, setIsEditingLimites] = useState(false);
  const [limitMinPesoKg, setLimitMinPesoKg] = useState('');
  const [limitMaxPesoKg, setLimitMaxPesoKg] = useState('');
  const [limitMinPrecioKg, setLimitMinPrecioKg] = useState('');
  const [limitMaxPrecioKg, setLimitMaxPrecioKg] = useState('');
  const [limitMinPrecioVentaKg, setLimitMinPrecioVentaKg] = useState('');
  const [limitMaxPrecioVentaKg, setLimitMaxPrecioVentaKg] = useState('');
  const [limitesErrors, setLimitesErrors] = useState<{
    pesoMin?: string;
    pesoMax?: string;
    precioCompraMin?: string;
    precioCompraMax?: string;
    precioVentaMin?: string;
    precioVentaMax?: string;
  }>({});
  const [guardandoLimites, setGuardandoLimites] = useState(false);
  const [focusSettingApplied, setFocusSettingApplied] = useState(false);
  const activeErrorSection = error ? getAjustesErrorSection(error) : null;

  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => setToastNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

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
    setIsEditingLimites(false);
  };

  const cerrarEditorBodega = () => {
    clearFeedback();
    setIsEditingBodega(false);
  };

  useEffect(() => {
    if (isEditingCompany) return;

    const nextTipo =
      company.tipoEmpresa ||
      (safeTipoOrganizacion
        ? safeTipoOrganizacion.charAt(0) +
          safeTipoOrganizacion.slice(1).toLowerCase()
        : 'Compraventa');

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
    safeUserName,
    safeUserEmail,
    safeTipoOrganizacion,
    isEditingCompany,
    safeUserPhone,
  ]);

  useEffect(() => {
    const nextProfile = {
      nombre: safeUserName,
      correo: safeUserEmail,
      telefono: safeUserPhone,
    };

    setSavedProfile(nextProfile);

    if (!isEditingProfile) {
      setProfile(nextProfile);
    }
  }, [safeUserEmail, safeUserName, safeUserPhone]);

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

  const cargarConfiguracionBodega = React.useCallback(async () => {
    try {
      const config = await obtenerConfiguracionBodega();
      setNombreBodega(config.nombreBodega);
      setCapacidadKg(config.capacidadKg ? String(config.capacidadKg) : '');
      setUpdatedAt(config.updatedAt);
      setLimitMinPesoKg(String(config.minPesoKg ?? PESO_MINIMO_KG));
      setLimitMaxPesoKg(
        String(config.maxPesoKg ?? PESO_MAXIMO_OPERATIVO_DEFAULT_KG),
      );
      setLimitMinPrecioKg(String(config.minPrecioKg ?? PRECIO_MINIMO_KG));
      setLimitMaxPrecioKg(String(config.maxPrecioKg ?? 100000));
      setLimitMinPrecioVentaKg(String(config.minPrecioVentaKg ?? PRECIO_MINIMO_KG));
      setLimitMaxPrecioVentaKg(String(config.maxPrecioVentaKg ?? 100000));
    } catch {
      setNombreBodega(initialConfig.nombreBodega);
      setCapacidadKg('');
      setUpdatedAt(initialConfig.updatedAt);
    }
  }, []);

  useEffect(() => {
    void cargarConfiguracionBodega();
  }, [cargarConfiguracionBodega]);

  useEffect(() => {
    if (
      focusSettingApplied ||
      locationState?.focusSetting !== 'capacidad-bodega'
    ) {
      return;
    }

    abrirEditorBodega();
    setFocusSettingApplied(true);
    navigate('/ajustes', { replace: true, state: null });
  }, [focusSettingApplied, locationState?.focusSetting, navigate]);

  const cerrarEditorLimites = () => {
    setIsEditingLimites(false);
    clearFeedback();
    setLimitesErrors({});
    void cargarConfiguracionBodega();
  };

  const abrirEditorLimites = () => {
    clearFeedback();
    setLimitesErrors({});
    setIsEditingLimites(true);
    setIsEditingCompany(false);
    setIsEditingProfile(false);
    setIsEditingBodega(false);
  };

  const abrirEditorEmpresa = () => {
    clearFeedback();
    setIsEditingCompany(true);
    setIsEditingProfile(false);
    setIsEditingBodega(false);
    setIsEditingLimites(false);
  };

  const abrirEditorPerfil = () => {
    clearFeedback();
    setProfile(savedProfile);
    setIsEditingProfile(true);
    setIsEditingCompany(false);
    setIsEditingBodega(false);
    setIsEditingLimites(false);
  };

  const cerrarEditorPerfil = () => {
    clearFeedback();
    setProfile(savedProfile);
    setIsEditingProfile(false);
  };

  const guardarLimites = async () => {
    const pesoMin = Number(limitMinPesoKg);
    const pesoMax = Number(limitMaxPesoKg);
    const precioMin = Number(limitMinPrecioKg);
    const precioMax = Number(limitMaxPrecioKg);
    const precioVentaMin = Number(limitMinPrecioVentaKg);
    const precioVentaMax = Number(limitMaxPrecioVentaKg);

    const errors: {
      pesoMin?: string;
      pesoMax?: string;
      precioCompraMin?: string;
      precioCompraMax?: string;
      precioVentaMin?: string;
      precioVentaMax?: string;
    } = {};

    if (!limitMinPesoKg.trim() || !Number.isFinite(pesoMin) || pesoMin <= 0) {
      errors.pesoMin = 'El peso mínimo debe ser un número positivo.';
    }

    if (
      !limitMaxPesoKg.trim() ||
      !Number.isFinite(pesoMax) ||
      pesoMax < pesoMin ||
      pesoMax > PESO_MAXIMO_ENTRADA_KG
    ) {
      errors.pesoMax = `El peso máximo debe estar entre el peso mínimo (${pesoMin} kg) y ${formatKg(PESO_MAXIMO_ENTRADA_KG)} kg.`;
    }

    if (!limitMinPrecioKg.trim() || !Number.isFinite(precioMin) || precioMin <= 0) {
      errors.precioCompraMin = 'El precio mínimo de compra debe ser mayor que 0.';
    }

    if (!limitMaxPrecioKg.trim() || !Number.isFinite(precioMax) || precioMax < precioMin) {
      errors.precioCompraMax = 'El precio máximo de compra debe ser mayor o igual al precio mínimo.';
    }

    if (!limitMinPrecioVentaKg.trim() || !Number.isFinite(precioVentaMin) || precioVentaMin <= 0) {
      errors.precioVentaMin = 'El precio mínimo de venta debe ser mayor que 0.';
    }

    if (!limitMaxPrecioVentaKg.trim() || !Number.isFinite(precioVentaMax) || precioVentaMax < precioVentaMin) {
      errors.precioVentaMax = 'El precio máximo de venta debe ser mayor o igual al precio mínimo.';
    }

    if (Object.keys(errors).length > 0) {
      setLimitesErrors(errors);
      return;
    }

    setLimitesErrors({});
    clearFeedback();
    setGuardandoLimites(true);
    try {
      await guardarLimitesEntrada({
        minPesoKg: pesoMin,
        maxPesoKg: pesoMax,
        minPrecioKg: precioMin,
        maxPrecioKg: precioMax,
        minPrecioVentaKg: precioVentaMin,
        maxPrecioVentaKg: precioVentaMax,
      });
      setSuccess('Límites actualizados.');
      setToastNotification({
        message: 'Límites actualizados con éxito.',
        type: 'success',
      });
      setIsEditingLimites(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al guardar los límites.';
      setError(message);
      setToastNotification({
        message: 'Error al guardar los límites.',
        type: 'error',
      });
    } finally {
      setGuardandoLimites(false);
    }
  };

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
      return;
    }
    if (profile.correo.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(profile.correo)) {
        const message =
          'El correo electrónico no es válido. Verifica que esté bien escrito.';
        setError(message);
        return;
      }
    }
    if (profile.telefono.trim()) {
      if (!isValidPhone(profile.telefono)) {
        const message = 'El teléfono debe tener 10 dígitos y empezar con 3.';
        setError(message);
        return;
      }
    }
    setSavedProfile(profile);
    setSuccess('Perfil actualizado correctamente.');
    setToastNotification({
      message: 'Perfil guardado con éxito.',
      type: 'success',
    });
    setIsEditingProfile(false);
  };

  const guardarEmpresa = () => {
    clearFeedback();
    const nombre = company.nombreEmpresa.trim();
    const businessNameValidation = validateBusinessName(nombre);

    if (!businessNameValidation.isValid) {
      const message = businessNameValidation.message ?? BUSINESS_NAME_ERROR;
      setError(message);
      return;
    }

    if (nombre.length > 30) {
      const message =
        'El nombre de la empresa no puede exceder los 30 caracteres.';
      setError(message);
      return;
    }

    if (company.descripcion.length > 50) {
      const message =
        'La descripción de la empresa no puede exceder los 50 caracteres.';
      setError(message);
      return;
    }

    setSuccess('Información de la empresa actualizada.');
    setToastNotification({
      message: 'Empresa guardada con éxito.',
      type: 'success',
    });
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

    if (
      !Number.isFinite(capacidad) ||
      capacidad <= 0 ||
      capacidad > CAPACIDAD_BODEGA_MAX_KG
    ) {
      setError(CAPACIDAD_BODEGA_INVALIDA);
      return;
    }

    if (capacidad < inventarioActualKg) {
      setError(CAPACIDAD_BODEGA_MENOR_INVENTARIO);
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
      setToastNotification({
        message: 'Capacidad de bodega actualizada con éxito.',
        type: 'success',
      });
      setIsEditingBodega(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al guardar la bodega.';
      setError(message);
      setToastNotification({
        message: 'Error al guardar la bodega.',
        type: 'error',
      });
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

  const abrirProcesoSecado = () => {
    if (getActiveSecadoSessions().length > 0) {
      navigate('/inventario/secados', { state: { from: 'ajustes' } });
      return;
    }

    setShowNoActiveSecadoModal(true);
  };

  const procesosOperativos = [
    {
      id: 'secado',
      title: 'Iniciar secado',
      description: 'Secado de café verde',
      icon: Droplets,
      iconStyle: 'bg-[#eef2ff] text-[#1D4ED8]',
      onClick: async () => {
        try {
          const lotes = await obtenerLotes();
          const greenLot = lotes.find((l) => {
            const key = l.tipoCafe.trim().toUpperCase();
            return (
              key === 'VERDE' || key === 'CAFE VERDE' || key.endsWith(' VERDE')
            );
          });
          if (greenLot) {
            navigate(`/inventario/${greenLot.tipoCafeId}/${greenLot.calidadId}/secado`);
          } else {
            navigate('/inventario');
          }
        } catch {
          navigate('/inventario');
        }
      },
    },
    {
      id: 'gastos',
      title: 'Registrar gasto',
      description: 'Control de egresos',
      icon: Wallet,
      iconStyle: 'bg-[#eef2ff] text-[#1D4ED8]',
      onClick: () => navigate('/gastos'),
    },
  ] as const;

  const configuracionNegocio = [
    {
      id: 'info-empresa',
      title: 'Datos de empresa',
      description: company.nombreEmpresa || 'Nombre y descripción',
      icon: Building2,
      iconStyle: 'bg-[#eff4ff] text-[#2c57cc]',
      staticOnly: false,
      onClick: abrirEditorEmpresa,
    },
    {
      id: 'tipos-cafe',
      title: 'Variedades de café',
      description: 'Tipos de café registrados',
      icon: FlaskConical,
      iconStyle: 'bg-[#eff4ff] text-[#2c57cc]',
      staticOnly: true,
      onClick: undefined,
    },
    {
      id: 'calidades-cafe',
      title: 'Calidad del café',
      description: 'Nivel de calidad del grano',
      icon: ScanSearch,
      iconStyle: 'bg-[#eff4ff] text-[#2c57cc]',
      staticOnly: true,
      onClick: undefined,
    },
    {
      id: 'capacidad-bodega',
      title: 'Ajustar bodega',
      description: 'Capacidad máxima en kg',
      icon: Warehouse,
      iconStyle: 'bg-[#eff4ff] text-[#2c57cc]',
      staticOnly: false,
      onClick: abrirEditorBodega,
    },
    {
      id: 'limites-entrada',
      title: 'Límites de compra',
      description: 'Precios y pesos permitidos',
      icon: Scale,
      iconStyle: 'bg-[#eff4ff] text-[#2c57cc]',
      staticOnly: false,
      onClick: abrirEditorLimites,
    },
    {
      id: 'gestion-usuarios',
      title: 'Permisos y roles',
      description: 'Acceso de trabajadores',
      icon: Users,
      iconStyle: 'bg-[#eff4ff] text-[#2c57cc]',
      staticOnly: true,
      onClick: undefined,
    },
  ] as const;

  const gestionPersonas = [
    {
      id: 'clientes-registrados',
      title: 'Compradores',
      description: 'Directorio de compradores',
      icon: Users2,
      iconStyle: 'bg-[#f3f6ff] text-[#5b6f9d]',
      staticOnly: true,
    },
    {
      id: 'usuarios-sistema',
      title: 'Personal',
      description: 'Trabajadores del sistema',
      icon: Shield,
      iconStyle: 'bg-[#f3f6ff] text-[#5b6f9d]',
      staticOnly: true,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 pb-[150px] text-slate-900">
      {toastNotification && (
        <div
          className={`fixed left-1/2 top-4 z-[100] -translate-x-1/2 rounded-full px-6 py-3 shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${toastNotification.type === 'success' ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#991b1b]'}`}
        >
          <p className="text-[0.95rem] font-semibold">
            {toastNotification.message}
          </p>
        </div>
      )}
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
              <div className="h-16 w-16 rounded-full bg-[#eef2ff] p-1 shadow-inner">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[#1D4ED8]">
                  <UserCircle2 size={31} />
                </div>
              </div>
              <div className="absolute -right-1 -bottom-1 rounded-full bg-[#1D4ED8] p-1.5 text-white">
                <Settings size={10} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[0.72rem] font-semibold text-slate-400">
                Usuario de la cuenta
              </p>
              <h2 className="mt-0.5 truncate text-[1.08rem] font-semibold leading-tight text-[#121826]">
                {profile.nombre || 'Administrador'}
              </h2>
              <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#f4f7fb] px-2.5 py-1">
                <Building2 size={12} className="shrink-0 text-[#6b7a90]" />
                <span className="truncate text-[0.72rem] font-medium text-slate-500">
                  {company.tipoEmpresa || 'Tipo de negocio sin definir'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={abrirEditorPerfil}
              className="inline-flex min-h-[38px] shrink-0 items-center justify-center rounded-[12px] border border-[#d6deef] bg-[#f9fbff] px-3 text-xs font-semibold text-[#1D4ED8]"
              aria-label="Editar datos del perfil"
            >
              Editar
            </button>
          </div>
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
                  className="flex w-full items-start gap-2.5 rounded-[12px] border border-[#e5e9f5] bg-white px-3 py-3 text-left shadow-sm"
                >
                  <span
                    className={`inline-flex shrink-0 rounded-lg p-2 ${item.iconStyle}`}
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

        {error && !activeErrorSection && !isEditingBodega && !isEditingLimites ? (
          <InlineGuidedError message={getAjustesGuidance(error)} />
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
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f172a]/45 px-5 py-6 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-[22px] border border-[#e6e8f3] bg-white px-5 pb-5 pt-3 shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-[#cfd8e6]" />
            <div className="mt-4 flex items-center justify-between gap-3">
              <h3 className="text-[1.25rem] font-semibold leading-tight text-[#111827]">
                Editar empresa
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingCompany(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-2 block text-[0.8rem] font-semibold text-slate-700">
                  Nombre de la empresa
                </p>
                <input
                  type="text"
                  value={company.nombreEmpresa}
                  maxLength={30}
                  onChange={(event) => {
                    const raw = event.target.value;
                    const filtered = sanitizeBusinessNameInput(raw).slice(
                      0,
                      30,
                    );

                    setCompany((prev) => ({
                      ...prev,
                      nombreEmpresa: filtered,
                    }));
                    clearFeedback();
                  }}
                  className={`w-full rounded-[14px] border ${
                    error && activeErrorSection === 'company'
                      ? 'border-rose-400 bg-rose-50'
                      : 'border-[#dde4f1] bg-[#f7f9fd]'
                  } px-4 py-3 text-[0.95rem] font-semibold text-slate-900 outline-none focus:border-[#173ea6]`}
                  placeholder="Nombre de la empresa"
                />
                <p className="mt-1 text-right text-[0.68rem] text-slate-400">
                  {company.nombreEmpresa.length}/30
                </p>
                {error && activeErrorSection === 'company' ? (
                  <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <InlineGuidedError message={getAjustesGuidance(error)} />
                  </div>
                ) : null}
              </div>

              <div>
                <p className="mb-2 block text-[0.8rem] font-semibold text-slate-700">
                  Descripción (Opcional)
                </p>
                <textarea
                  value={company.descripcion}
                  maxLength={50}
                  onChange={(event) => {
                    const filtered = event.target.value.slice(0, 50);
                    setCompany((prev) => ({
                      ...prev,
                      descripcion: filtered,
                    }));
                    clearFeedback();
                  }}
                  className={`w-full rounded-[14px] border ${
                    error ===
                    'La descripción de la empresa no puede exceder los 50 caracteres.'
                      ? 'border-rose-400 bg-rose-50'
                      : 'border-[#dde4f1] bg-[#f7f9fd]'
                  } px-4 py-3 text-[0.95rem] font-semibold text-slate-900 outline-none focus:border-[#173ea6]`}
                  rows={3}
                  placeholder="Descripción breve del negocio"
                />
                <p className="mt-1 text-right text-[0.68rem] text-slate-400">
                  {company.descripcion.length}/50
                </p>
                {error ===
                'La descripción de la empresa no puede exceder los 50 caracteres.' ? (
                  <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <InlineGuidedError message={getAjustesGuidance(error)} />
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={guardarEmpresa}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[#1D4ED8] px-4 py-3 text-[0.9rem] font-semibold text-white mt-2"
              >
                <Save size={14} />
                Guardar empresa
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditingProfile ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f172a]/45 px-5 py-6 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-[22px] border border-[#e6e8f3] bg-white px-5 pb-5 pt-3 shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-[#cfd8e6]" />
            <div className="mt-4 flex items-center justify-between gap-3">
              <h3 className="text-[1.25rem] font-semibold leading-tight text-[#111827]">
                Perfil de usuario
              </h3>
              <button
                type="button"
                onClick={cerrarEditorPerfil}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-2 block text-[0.8rem] font-semibold text-slate-700">
                  Nombre completo
                </p>
                <input
                  type="text"
                  value={profile.nombre}
                  maxLength={70}
                  onChange={(event) => {
                    setProfile((prev) => ({
                      ...prev,
                      nombre: event.target.value
                        .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '')
                        .slice(0, 70),
                    }));
                    clearFeedback();
                  }}
                  className={`w-full rounded-[14px] border ${error === 'Escribe el nombre del usuario.' ? 'border-rose-400 bg-rose-50' : 'border-[#dde4f1] bg-[#f7f9fd]'} px-4 py-3 text-[0.95rem] font-semibold text-slate-900 outline-none focus:border-[#173ea6]`}
                  placeholder="Ej: Juan Pérez"
                />
                <p className="mt-1 text-right text-[0.72rem] font-semibold text-slate-400">
                  {profile.nombre.length}/70
                </p>
                {error === 'Escribe el nombre del usuario.' && (
                  <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <InlineGuidedError message={getAjustesGuidance(error)} />
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 block text-[0.8rem] font-semibold text-slate-700">
                  Correo electrónico
                </p>
                <input
                  type="email"
                  maxLength={100}
                  value={profile.correo}
                  onChange={(event) => {
                    setProfile((prev) => ({
                      ...prev,
                      correo: event.target.value.slice(0, 100),
                    }));
                    clearFeedback();
                  }}
                  className={`w-full rounded-[14px] border ${error === 'El correo electrónico no es válido. Verifica que esté bien escrito.' ? 'border-rose-400 bg-rose-50' : 'border-[#dde4f1] bg-[#f7f9fd]'} px-4 py-3 text-[0.95rem] font-semibold text-slate-900 outline-none focus:border-[#173ea6]`}
                  placeholder="Ej: nombre@empresa.com"
                />
                <p className="mt-1 text-right text-[0.72rem] font-semibold text-slate-400">
                  {profile.correo.length}/100
                </p>
                {error ===
                  'El correo electrónico no es válido. Verifica que esté bien escrito.' && (
                  <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <InlineGuidedError message={getAjustesGuidance(error)} />
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 block text-[0.8rem] font-semibold text-slate-700">
                  Teléfono
                </p>
                <input
                  type="tel"
                  maxLength={10}
                  inputMode="numeric"
                  value={profile.telefono}
                  onChange={(event) => {
                    setProfile((prev) => ({
                      ...prev,
                      telefono: sanitizeRegisterPhoneInput(event.target.value),
                    }));
                    clearFeedback();
                  }}
                  className={`w-full rounded-[14px] border ${error === 'El teléfono debe tener 10 dígitos y empezar con 3.' ? 'border-rose-400 bg-rose-50' : 'border-[#dde4f1] bg-[#f7f9fd]'} px-4 py-3 text-[0.95rem] font-semibold text-slate-900 outline-none focus:border-[#173ea6]`}
                  placeholder="Ej: 3001234567"
                />
                <p className="mt-1 text-right text-[0.72rem] font-semibold text-slate-400">
                  {profile.telefono.length}/10
                </p>
                {error ===
                  'El teléfono debe tener 10 dígitos y empezar con 3.' && (
                  <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <InlineGuidedError message={getAjustesGuidance(error)} />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={guardarPerfil}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[#1D4ED8] px-4 py-3 text-[0.9rem] font-semibold text-white mt-2"
              >
                <Save size={14} />
                Guardar perfil
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                  maxLength={50}
                  onChange={(event) => {
                    setNombreBodega(event.target.value.slice(0, 50));
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
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={capacidadKg}
                  onChange={(event) => {
                    setCapacidadKg(
                      sanitizeCapacidadBodegaInput(event.target.value),
                    );
                    clearFeedback();
                  }}
                  className="w-full rounded-[14px] border border-[#dde4f1] bg-[#f7f9fd] px-4 py-3 text-[0.95rem] font-semibold text-slate-900 outline-none focus:border-[#173ea6]"
                  placeholder="6000"
                />
                <p className="mt-1 text-[0.68rem] font-semibold text-slate-400">
                  Máx. {CAPACIDAD_BODEGA_MAX_LABEL} kg
                </p>
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
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[#1D4ED8] px-4 py-3 text-[0.9rem] font-semibold text-white"
                >
                  <Save size={14} />
                  Guardar cambios
                </button>
              </div>
              {error ? (
                <InlineGuidedError message={getAjustesGuidance(error)} />
              ) : null}
              <p className="inline-flex w-full items-center justify-center gap-1.5 text-center text-[0.62rem] font-semibold text-slate-500">
                <CalendarDays size={12} className="text-[#1D4ED8]" />
                Última actualización: {formatDate(updatedAt)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {isEditingLimites ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f172a]/45 px-5 py-6 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-[22px] border border-[#e6e8f3] bg-white px-5 pb-5 pt-3 shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-[#cfd8e6]" />
            <div className="mt-4 flex items-center justify-between gap-3">
              <h3 className="text-[1.25rem] font-semibold leading-tight text-[#111827]">
                Límites de Transacción
              </h3>
              <button
                type="button"
                onClick={cerrarEditorLimites}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            {error && Object.keys(limitesErrors).length === 0 ? (
              <div className="mt-4 animate-in fade-in slide-in-from-top-1 duration-200">
                <InlineGuidedError message={getAjustesGuidance(error)} />
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 block text-[0.8rem] font-semibold text-slate-700">
                    Peso mín. compra (kg)
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={limitMinPesoKg}
                    onChange={(event) => {
                      const raw = event.target.value.replace(/\D/g, '').slice(0, 5);
                      setLimitMinPesoKg(raw);
                      setLimitesErrors((prev) => ({ ...prev, pesoMin: undefined }));
                      clearFeedback();
                    }}
                    className={`w-full rounded-[14px] border px-4 py-3 text-[0.95rem] font-semibold outline-none focus:border-[#173ea6] ${limitesErrors.pesoMin ? 'border-rose-400 bg-rose-50 text-slate-900' : 'border-[#dde4f1] bg-[#f7f9fd] text-[#121826]'}`}
                    placeholder="5"
                  />
                </div>
                <div>
                  <p className="mb-1 block text-[0.8rem] font-semibold text-slate-700">
                    Peso máx. compra (kg)
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={limitMaxPesoKg}
                    onChange={(event) => {
                      const raw = event.target.value.replace(/\D/g, '').slice(0, 5);
                      setLimitMaxPesoKg(raw);
                      setLimitesErrors((prev) => ({ ...prev, pesoMax: undefined }));
                      clearFeedback();
                    }}
                    className={`w-full rounded-[14px] border px-4 py-3 text-[0.95rem] font-semibold outline-none focus:border-[#173ea6] ${limitesErrors.pesoMax ? 'border-rose-400 bg-rose-50 text-slate-900' : 'border-[#dde4f1] bg-[#f7f9fd] text-[#121826]'}`}
                    placeholder={PESO_MAXIMO_OPERATIVO_DEFAULT_LABEL}
                  />
                </div>
              </div>
              {limitesErrors.pesoMin || limitesErrors.pesoMax ? (
                <div className="mt-1 animate-in fade-in slide-in-from-top-1 duration-200 space-y-1">
                  {limitesErrors.pesoMin && (
                    <InlineGuidedError message={createGuidedError('peso_min_err', 'Peso mínimo inválido', '', limitesErrors.pesoMin)} />
                  )}
                  {limitesErrors.pesoMax && (
                    <InlineGuidedError message={createGuidedError('peso_max_err', 'Peso máximo inválido', '', limitesErrors.pesoMax)} />
                  )}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 block text-[0.8rem] font-semibold text-slate-700">
                    Precio mín. (Compra)
                  </p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-slate-400">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={limitMinPrecioKg}
                      onChange={(event) => {
                        const raw = event.target.value.replace(/\D/g, '').slice(0, 6);
                        setLimitMinPrecioKg(raw);
                        setLimitesErrors((prev) => ({ ...prev, precioCompraMin: undefined }));
                        clearFeedback();
                      }}
                      className={`w-full rounded-[14px] border py-3 pl-7 pr-3 text-[0.95rem] font-semibold outline-none focus:border-[#173ea6] ${limitesErrors.precioCompraMin ? 'border-rose-400 bg-rose-50 text-slate-900' : 'border-[#dde4f1] bg-[#f7f9fd] text-[#121826]'}`}
                      placeholder="1000"
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-1 block text-[0.8rem] font-semibold text-slate-700">
                    Precio máx. (Compra)
                  </p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-slate-400">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={limitMaxPrecioKg}
                      onChange={(event) => {
                        const raw = event.target.value.replace(/\D/g, '').slice(0, 6);
                        setLimitMaxPrecioKg(raw);
                        setLimitesErrors((prev) => ({ ...prev, precioCompraMax: undefined }));
                        clearFeedback();
                      }}
                      className={`w-full rounded-[14px] border py-3 pl-7 pr-3 text-[0.95rem] font-semibold outline-none focus:border-[#173ea6] ${limitesErrors.precioCompraMax ? 'border-rose-400 bg-rose-50 text-slate-900' : 'border-[#dde4f1] bg-[#f7f9fd] text-[#121826]'}`}
                      placeholder="100000"
                    />
                  </div>
                </div>
              </div>
              {limitesErrors.precioCompraMin || limitesErrors.precioCompraMax ? (
                <div className="mt-1 animate-in fade-in slide-in-from-top-1 duration-200 space-y-1">
                  {limitesErrors.precioCompraMin && (
                    <InlineGuidedError message={createGuidedError('precio_comp_min_err', 'Precio mín. compra inválido', '', limitesErrors.precioCompraMin)} />
                  )}
                  {limitesErrors.precioCompraMax && (
                    <InlineGuidedError message={createGuidedError('precio_comp_max_err', 'Precio máx. compra inválido', '', limitesErrors.precioCompraMax)} />
                  )}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 block text-[0.8rem] font-semibold text-slate-700">
                    Precio mín. (Venta)
                  </p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-slate-400">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={limitMinPrecioVentaKg}
                      onChange={(event) => {
                        const raw = event.target.value.replace(/\D/g, '').slice(0, 6);
                        setLimitMinPrecioVentaKg(raw);
                        setLimitesErrors((prev) => ({ ...prev, precioVentaMin: undefined }));
                        clearFeedback();
                      }}
                      className={`w-full rounded-[14px] border py-3 pl-7 pr-3 text-[0.95rem] font-semibold outline-none focus:border-[#173ea6] ${limitesErrors.precioVentaMin ? 'border-rose-400 bg-rose-50 text-slate-900' : 'border-[#dde4f1] bg-[#f7f9fd] text-[#121826]'}`}
                      placeholder="1000"
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-1 block text-[0.8rem] font-semibold text-slate-700">
                    Precio máx. (Venta)
                  </p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-slate-400">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={limitMaxPrecioVentaKg}
                      onChange={(event) => {
                        const raw = event.target.value.replace(/\D/g, '').slice(0, 6);
                        setLimitMaxPrecioVentaKg(raw);
                        setLimitesErrors((prev) => ({ ...prev, precioVentaMax: undefined }));
                        clearFeedback();
                      }}
                      className={`w-full rounded-[14px] border py-3 pl-7 pr-3 text-[0.95rem] font-semibold outline-none focus:border-[#173ea6] ${limitesErrors.precioVentaMax ? 'border-rose-400 bg-rose-50 text-slate-900' : 'border-[#dde4f1] bg-[#f7f9fd] text-[#121826]'}`}
                      placeholder="100000"
                    />
                  </div>
                </div>
              </div>
              {limitesErrors.precioVentaMin || limitesErrors.precioVentaMax ? (
                <div className="mt-1 animate-in fade-in slide-in-from-top-1 duration-200 space-y-1">
                  {limitesErrors.precioVentaMin && (
                    <InlineGuidedError message={createGuidedError('precio_vent_min_err', 'Precio mín. venta inválido', '', limitesErrors.precioVentaMin)} />
                  )}
                  {limitesErrors.precioVentaMax && (
                    <InlineGuidedError message={createGuidedError('precio_vent_max_err', 'Precio máx. venta inválido', '', limitesErrors.precioVentaMax)} />
                  )}
                </div>
              ) : null}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={guardarLimites}
                  disabled={guardandoLimites}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[#1D4ED8] px-4 py-3 text-[0.9rem] font-semibold text-white disabled:opacity-70"
                >
                  {guardandoLimites ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {guardandoLimites ? 'Guardando...' : 'Guardar límites'}
                </button>
              </div>
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

      {showNoActiveSecadoModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0f172a]/45 px-5 py-6 backdrop-blur-sm">
          <div
            className="w-full max-w-[430px] rounded-[22px] border border-[#dbe5ff] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.24)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="no-active-secado-title"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#eef2ff] text-[#1D4ED8]">
                <CircleDashed size={22} />
              </span>
              <div>
                <h3
                  id="no-active-secado-title"
                  className="text-[1.1rem] font-semibold leading-tight text-[#111827]"
                >
                  No hay secados activos
                </h3>
                <p className="mt-2 text-sm leading-5 text-slate-500">
                  En este momento no tienes café pendiente por finalizar. Puedes
                  iniciar un nuevo secado desde los lotes verdes disponibles.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowNoActiveSecadoModal(false);
                  navigate('/inventario', {
                    state: { preferredTypeKey: 'VERDE' },
                  });
                }}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#1D4ED8] px-4 text-sm font-semibold text-white"
              >
                Iniciar secado
              </button>
              <button
                type="button"
                onClick={() => setShowNoActiveSecadoModal(false)}
                className="inline-flex min-h-[42px] w-full items-center justify-center rounded-[14px] border border-[#dbe2f0] bg-white px-4 text-sm font-semibold text-slate-600"
              >
                Seguir navegando
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AppBottomNav />
    </div>
  );
}
