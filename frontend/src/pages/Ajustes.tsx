import React, { useEffect, useMemo, useState } from 'react';
import { Preferences } from '@capacitor/preferences';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BellRing,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  CloudCog,
  Droplets,
  Eye,
  FlaskConical,
  ImageIcon,
  LifeBuoy,
  LoaderCircle,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Package2,
  Pencil,
  RefreshCcw,
  ScanSearch,
  Save,
  Settings,
  Shield,
  SlidersHorizontal,
  Sun,
  Trash2,
  UserCircle2,
  X,
  Users,
  Users2,
  Warehouse,
  Wallet,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { AppFeedbackMessage } from '../components/AppFeedbackMessage';
import { AppLoadingScreen } from '../components/AppLoadingScreen';
import { CafeSmartEmptyState } from '../components/common/CafeSmartEmptyState';
import { CafeSmartModal } from '../components/common/CafeSmartModal';
import { RefreshButton } from '../components/RefreshButton';
import { SmartSelect } from '../components/SmartSelect';
import {
  createGuidedError,
  FloatingGuidedNotice,
  InlineGuidedError,
  type GuidedErrorMessage,
} from '../components/forms/GuidedError';
import { useUser } from '../context/UserContext';
import { useTheme, type ThemePreference } from '../theme/themeProvider';
import { useAccessibility } from '../theme/accessibilityProvider';
import type { FontScalePreference } from '../theme/accessibilityService';
import { updateRememberedAccountIfCurrent } from '../storage/authStorage';
import {
  obtenerDetalleLote,
  obtenerLotes,
  type LoteDetalle,
  type LoteResumen,
} from '../services/lotesService';
import {
  obtenerConfiguracionBodega,
  guardarLimitesEntrada,
  listarBodegas,
  crearBodega,
  editarBodega,
  eliminarBodega,
  obtenerLimitesBodega,
  guardarLimitesBodega,
  aplicarLimitesBodegaGeneral,
  type BodegaItem,
  type LimitesBodega,
} from '../services/bodegaApi';
import {
  guardarLimitesEntradaLocales,
  obtenerLimitesEntradaLocales,
  type LimitesTransaccion,
} from '../services/limitesEntradaService';
import {
  actualizarCliente,
  crearCliente,
  eliminarCliente,
  listarClientes,
  type ClienteItem,
} from '../services/clientesService';
import {
  actualizarProductor,
  crearProductor,
  eliminarProductor,
  listarProductores,
  type ProductorItem,
} from '../services/productoresService';
import {
  actualizarContacto,
  agregarRolContacto,
  crearContacto,
  listarContactos,
  type ContactoItem,
  type ContactoRol,
} from '../services/contactosService';
import {
  actualizarConfiguracionOrganizacion,
  actualizarPerfilUsuario,
  quitarFotoPerfilRemota,
  subirFotoPerfil,
} from '../services/userSettingsService';
import {
  getAppPermissionStatuses,
  getScreenReaderStatus,
  isNativeAndroid,
  isScreenReaderActive,
  openAccessibilitySettings,
  openAppSettings,
  subscribeToScreenReaderChanges,
  type AppPermissionStatuses,
  type SystemScreenReaderStatus,
} from '../services/screenReaderService';
import {
  fieldHelpTextClass,
  fieldInputClass,
  fieldLabelClass,
  fieldTextareaClass,
} from '../styles/uiClasses';
import {
  applySecadoToDetalle,
  applySecadoToLots,
  getActiveSecadoSessions,
  startSecadoWithWeights,
} from '../utils/secadoFlow';
import {
  deleteSyncOperation,
  getSyncQueue,
  getSyncQueueSummary,
  clearSyncedOperations,
  retryOperation,
  syncAllPending,
  syncOperationById,
  SYNC_QUEUE_EVENT,
  type SyncOperation,
  type SyncQueueSummary,
} from '../services/syncQueueService';
import {
  formatCoffeeFullName,
  formatSubloteVisualCode,
  getCoffeeCodePrefix,
} from '../utils/coffeeCodes';
import { ENABLE_SECADO_PROTOTYPE } from '../config/features';
import {
  BUSINESS_NAME_MAX_LENGTH,
  BUSINESS_DESCRIPTION_MAX_LENGTH,
  validateBusinessName,
} from '../utils/registerValidators';
import {
  BODEGA_CAPACITY_MAX_KG,
  BODEGA_NAME_MAX_LENGTH,
  sanitizeLimitedText,
  sanitizePositiveIntegerInput,
  sanitizeSearchInput,
} from '../utils/inputLimits';
import {
  formatPhoneNumber,
  normalizePhoneNumberForStorage,
  normalizeCompanyName,
  normalizeHumanName,
  normalizeDocumentForStorage,
  sanitizeDigits,
  sanitizeDocumentInput,
  validatePhoneNumber,
  validateCompanyName,
  type DocumentType,
  validateDocumentNumber,
  validatePersonName,
} from '../utils/personValidation';
import { fuzzySearch, useDebouncedValue } from '../utils/fuzzySearch';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import granitoInteligente from '../assets/granito-inteligente.png';
import {
  PESO_MAXIMO_ENTRADA_KG,
  PESO_MAXIMO_OPERATIVO_DEFAULT_KG,
  PRECIO_MAXIMO_KG,
} from '../utils/businessRules';
import {
  canImportDeviceContacts,
  normalizeImportedContactPhone,
  pickDeviceContact,
  type DeviceContact,
  type DeviceContactPhone,
} from '../services/deviceContactsService';

const PESO_MAXIMO_OPERATIVO_DEFAULT_LABEL = '99.999';

function ariaChecked(active: boolean) {
  return { 'aria-checked': active ? 'true' : 'false' } as const;
}

function ariaPressed(active: boolean) {
  return { 'aria-pressed': active ? 'true' : 'false' } as const;
}

type ProfileSettings = {
  nombre: string;
  correo: string;
  telefono: string;
};

type LimitesTab = 'todos' | 'compra' | 'venta';

const OFFLINE_BLOCKED_ACTION_MESSAGE =
  'Esta acción necesita conexión. Puedes guardar un borrador y finalizarlo cuando vuelvas a tener internet.';
const LIMITS_ONBOARDING_KEY_PREFIX = 'cafesmart:limits-onboarding:v1';
const SCREEN_READER_SETUP_KEY = 'cafesmart:screen-reader-setup-opened:v1';

type CompanySettings = {
  nombreEmpresa: string;
  tipoEmpresa: string;
  descripcion: string;
};

function isCustomBusinessType(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized === 'OTRO' || normalized === 'PERSONALIZADO';
}

function getBusinessTypeLabel(value: string) {
  return isCustomBusinessType(value) ? 'Personalizado' : value;
}

type AjustesErrorSection = 'profile' | 'company' | 'bodega';
type ProfileErrors = Partial<Record<keyof ProfileSettings, string>>;
type PeopleAdminMode = 'todos' | 'clientes' | 'productores' | 'multirol' | null;
type PeopleSortMode = 'recent' | 'oldest' | 'az' | 'za';
type SecadoPanelMode = 'home' | 'start' | 'active' | null;
type SecadoSortMode = 'recent' | 'oldest';
type SecadoQualityFilter = 'TODOS' | 'BUENO' | 'REGULAR' | 'MALO';
type PeopleAdminItem = {
  id: string;
  contactType: 'cliente' | 'productor';
  nombre: string;
  documento: string;
  tipoDocumento: DocumentType;
  telefono: string;
  roles: ContactoRol[];
  clienteId?: string | null;
  productorId?: string | null;
  createdAt?: string;
};
type PeopleAdminForm = {
  nombre: string;
  tipoDocumento: DocumentType | '';
  documento: string;
  telefono: string;
  roles: ContactoRol[];
};

const PROFILE_NAME_MAX_LENGTH = 60;
const PROFILE_EMAIL_MAX_LENGTH = 60;
const PROFILE_AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_AVATAR_ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

function validateProfileName(value: string) {
  const result = validatePersonName(value, 'El nombre');
  if (result.isValid) return null;
  const message = result.message ?? 'Corrige el nombre para continuar.';
  return message.toLowerCase().includes('espacios')
    ? 'Evita espacios innecesarios en el nombre.'
    : message;
}

function validateProfileEmail(value: string) {
  const correo = value.trim();
  if (!correo) return 'Escribe el correo del usuario.';
  if (correo.length > PROFILE_EMAIL_MAX_LENGTH) {
    return 'El correo no puede pasar de 60 caracteres.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return 'Escribe un correo válido.';
  }
  return null;
}

function validateColombianPhone(value: string) {
  const result = validatePhoneNumber(value, 'El teléfono', { optional: true });
  return result.isValid ? null : result.message ?? 'Ingresa un número de teléfono válido.';
}

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('') || 'CS';
}

function isAllowedAvatarType(type: string) {
  return PROFILE_AVATAR_ALLOWED_TYPES.has(type.toLowerCase());
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Formato de imagen no válido.'));
    reader.onerror = () => reject(reader.error ?? new Error('No pudimos leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

function formatKg(value: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatSecadoKg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return parsed.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function mapClienteAdmin(cliente: ClienteItem): PeopleAdminItem {
  const tipoDocumento =
    cliente.tipoDocumento ?? (cliente.documento?.includes('-') ? 'NIT' : 'CEDULA');
  return {
    id: cliente.id,
    contactType: 'cliente',
    nombre: cliente.nombre,
    documento: cliente.documento ?? '',
    tipoDocumento,
    telefono: cliente.telefono ?? '',
    roles: ['CLIENTE'],
    createdAt: cliente.createdAt,
  };
}

function mapProductorAdmin(productor: ProductorItem): PeopleAdminItem {
  const tipoDocumento =
    productor.tipoDocumento ?? (productor.documento?.includes('-') ? 'NIT' : 'CEDULA');
  return {
    id: productor.id,
    contactType: 'productor',
    nombre: productor.nombre,
    documento: productor.documento ?? '',
    tipoDocumento,
    telefono: productor.telefono ?? '',
    roles: ['PRODUCTOR'],
    createdAt: productor.createdAt,
  };
}

function getAjustesErrorSection(message: string): AjustesErrorSection | null {
  if (
    message === 'Escribe el nombre del usuario.' ||
    message === 'Escribe el correo del usuario.' ||
    message === 'El nombre debe tener mínimo 3 caracteres.' ||
    message === 'El nombre no puede pasar de 40 caracteres.' ||
    message === 'El correo no puede pasar de 60 caracteres.' ||
    message === 'Escribe un correo válido.' ||
    message === 'Ingresa un número de teléfono válido.' ||
    message === 'Revisa el indicativo del país y el número.' ||
    message === 'Este número no parece válido para el país seleccionado.' ||
    message === 'No uses letras ni símbolos.'
  ) {
    return 'profile';
  }

  if (
    message === 'Escribe el nombre de la empresa.' ||
    message === 'Escribe el nombre del negocio.' ||
    message === 'Selecciona el tipo de empresa.' ||
    message === 'Selecciona el tipo de negocio.' ||
    message === 'Usa al menos 3 caracteres.' ||
    message ===
      'El nombre del negocio es demasiado largo. Usa máximo 40 caracteres.' ||
    message === 'Usa letras, números, espacios y signos básicos.' ||
    message === 'Usa un nombre claro y fácil de reconocer.'
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
      'Necesitamos un correo válido.',
      'Escribe el correo del usuario.',
    );
  }

  if (
    message === 'Escribe el nombre de la empresa.' ||
    message === 'Escribe el nombre del negocio.'
  ) {
    return createGuidedError(
      'Escribe el nombre del negocio.',
      'Falta nombre del negocio.',
      'Tu negocio debe tener un nombre.',
      'Escribe el nombre de tu negocio.',
    );
  }

  if (
    message === 'El nombre debe tener mínimo 3 caracteres.' ||
    message === 'El nombre no puede pasar de 40 caracteres.'
  ) {
    return createGuidedError(
      message,
      'Revisa el nombre.',
      'El nombre debe tener entre 3 y 40 caracteres.',
      message,
    );
  }

  if (
    message === 'El correo no puede pasar de 60 caracteres.' ||
    message === 'Escribe un correo válido.'
  ) {
    return createGuidedError(
      message,
      'Revisa el correo.',
      'Usa un correo con @ y dominio.',
      message,
    );
  }

  if (
    message === 'Ingresa un número de teléfono válido.' ||
    message === 'Revisa el indicativo del país y el número.' ||
    message === 'Este número no parece válido para el país seleccionado.' ||
    message === 'No uses letras ni símbolos.'
  ) {
    return createGuidedError(
      message,
      'Revisa el celular.',
      'Revisa el indicativo y el número.',
      message,
    );
  }

  if (
    message === 'Usa al menos 3 caracteres.' ||
    message ===
      'El nombre del negocio es demasiado largo. Usa máximo 40 caracteres.' ||
    message === 'Usa letras, números, espacios y signos básicos.' ||
    message === 'Usa un nombre claro y fácil de reconocer.'
  ) {
    return createGuidedError(
      message,
      'Revisa el nombre.',
      'El nombre del negocio debe ser claro y corto.',
      message,
    );
  }

  if (
    message === 'Selecciona el tipo de empresa.' ||
    message === 'Selecciona el tipo de negocio.'
  ) {
    return createGuidedError(
      'Selecciona el tipo de negocio.',
      'Falta el tipo.',
      '¿A que se dedica tu negocio?',
      'Selecciona el tipo de negocio.',
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
  const location = useLocation();
  const { user, token, hasCompany, setSession, logout } = useUser();
  const { isOffline } = useNetworkStatus();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const {
    preferences: accessibilityPreferences,
    setHighContrast,
    setFontScale,
  } = useAccessibility();

  const initialConfig = useMemo(
    () => ({
      nombreBodega: 'Bodega principal',
      capacidadKg: null as number | null,
      maxPesoKg: PESO_MAXIMO_OPERATIVO_DEFAULT_KG,
      maxPrecioKg: PRECIO_MAXIMO_KG,
      maxPrecioVentaKg: PRECIO_MAXIMO_KG,
      updatedAt: new Date().toISOString(),
    }),
    [],
  );
  const initialLimites = useMemo(
    () => obtenerLimitesEntradaLocales(initialConfig),
    [initialConfig],
  );

  const [profile, setProfile] = useState<ProfileSettings>(() => ({
    nombre: user?.name ?? '',
    correo: user?.email ?? '',
    telefono: formatPhoneNumber(user?.telefono ?? ''),
  }));
  const profileBaselineRef = React.useRef<ProfileSettings | null>(null);
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(
    () => user?.avatarUrl ?? '',
  );
  const [profileAvatarDraft, setProfileAvatarDraft] = useState<string | null>(null);
  const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
  const [profileAvatarRemove, setProfileAvatarRemove] = useState(false);
  const [profilePhotoOpen, setProfilePhotoOpen] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{
    variant: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [company, setCompany] = useState<CompanySettings>(() => ({
    nombreEmpresa: '',
    tipoEmpresa: '',
    descripcion: '',
  }));
  const companyBaselineRef = React.useRef<CompanySettings | null>(null);

  const [nombreBodega, setNombreBodega] = useState(initialConfig.nombreBodega);
  const [capacidadKg, setCapacidadKg] = useState('');
  const [ubicacionBodega, setUbicacionBodega] = useState('');
  const [bodegas, setBodegas] = useState<BodegaItem[]>([]);
  const [bodegasLoading, setBodegasLoading] = useState(false);
  const [bodegaFormOpen, setBodegaFormOpen] = useState(false);
  const [bodegaEditando, setBodegaEditando] = useState<BodegaItem | null>(null);
  const [bodegaDeleteTarget, setBodegaDeleteTarget] = useState<BodegaItem | null>(null);
  const [bodegaFeedback, setBodegaFeedback] = useState<{
    variant: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);
  const [bodegaLimitesTarget, setBodegaLimitesTarget] =
    useState<BodegaItem | null>(null);
  const [bodegaLimitesGeneralOpen, setBodegaLimitesGeneralOpen] =
    useState(false);
  const [bodegaLimitesLoading, setBodegaLimitesLoading] = useState(false);
  const [bodegaLimitesForm, setBodegaLimitesForm] = useState<LimitesBodega>({
    alertaPreventivaPct: 80,
    alertaCriticaPct: 95,
    bloquearAlSuperarCapacidad: true,
    alertasActivas: true,
  });
  const [bodegaLimitesScope, setBodegaLimitesScope] =
    useState<'todas' | 'activas'>('todas');
  const [limitesTab, setLimitesTab] = useState<LimitesTab>('todos');
  const [limitMinPesoCompraKg, setLimitMinPesoCompraKg] = useState(
    String(initialLimites.minPesoCompraKg),
  );
  const [limitMaxPesoKg, setLimitMaxPesoKg] = useState(
    String(initialLimites.maxPesoCompraKg),
  );
  const [limitMinPrecioCompraKg, setLimitMinPrecioCompraKg] = useState(
    String(initialLimites.minPrecioCompraKg),
  );
  const [limitMaxPrecioKg, setLimitMaxPrecioKg] = useState(
    String(initialLimites.maxPrecioCompraKg),
  );
  const [limitMinPrecioVentaKg, setLimitMinPrecioVentaKg] = useState(
    String(initialLimites.minPrecioVentaKg),
  );
  const [limitMaxPrecioVentaKg, setLimitMaxPrecioVentaKg] = useState(
    String(initialLimites.maxPrecioVentaKg),
  );
  const [updatedAt, setUpdatedAt] = useState(initialConfig.updatedAt);
  const [inventarioActualKg, setInventarioActualKg] = useState(0);
  const [loadingStock, setLoadingStock] = useState(true);
  const [secadoPanel, setSecadoPanel] = useState<SecadoPanelMode>(null);
  const [secadoLoading, setSecadoLoading] = useState(false);
  const [secadoError, setSecadoError] = useState<string | null>(null);
  const [secadoLotes, setSecadoLotes] = useState<LoteResumen[]>([]);
  const [secadoLoteKey, setSecadoLoteKey] = useState('');
  const [secadoDetalle, setSecadoDetalle] = useState<LoteDetalle | null>(null);
  const [secadoWeights, setSecadoWeights] = useState<Record<string, number>>({});
  const [secadoSessionsVersion, setSecadoSessionsVersion] = useState(0);
  const [secadoSortMode, setSecadoSortMode] = useState<SecadoSortMode>('recent');
  const [secadoQualityFilter, setSecadoQualityFilter] =
    useState<SecadoQualityFilter>('TODOS');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileInfoOpen, setProfileInfoOpen] = useState(false);
  const [isViewingPublicProfile, setIsViewingPublicProfile] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isEditingBodega, setIsEditingBodega] = useState(false);
  const [isEditingLimites, setIsEditingLimites] = useState(false);
  const [guardandoLimites, setGuardandoLimites] = useState(false);
  const [guardandoBodega, setGuardandoBodega] = useState(false);
  const [guardandoEmpresa, setGuardandoEmpresa] = useState(false);
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({});
  const [nombreLimitNotice, setNombreLimitNotice] = useState(false);
  const [peopleMode, setPeopleMode] = useState<PeopleAdminMode>(null);
  const [clientesAdmin, setClientesAdmin] = useState<PeopleAdminItem[]>([]);
  const [productoresAdmin, setProductoresAdmin] = useState<PeopleAdminItem[]>([]);
  const [contactosAdmin, setContactosAdmin] = useState<PeopleAdminItem[]>([]);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [peopleSortMode, setPeopleSortMode] = useState<PeopleSortMode>('recent');
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [peopleDetail, setPeopleDetail] = useState<PeopleAdminItem | null>(null);
  const [peopleEditing, setPeopleEditing] = useState<PeopleAdminItem | null>(null);
  const [peopleDeleteTarget, setPeopleDeleteTarget] =
    useState<PeopleAdminItem | null>(null);
  const [peopleFormError, setPeopleFormError] = useState<string | null>(null);
  const [peopleDraft, setPeopleDraft] = useState<{
    editing: PeopleAdminItem;
    form: PeopleAdminForm;
  } | null>(null);
  const [showPeopleDraftModal, setShowPeopleDraftModal] = useState(false);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  const [peopleForm, setPeopleForm] = useState<PeopleAdminForm>({
    nombre: '',
    tipoDocumento: '',
    documento: '',
    telefono: '',
    roles: ['CLIENTE'],
  });
  const [peopleImportedPendingDocument, setPeopleImportedPendingDocument] =
    useState(false);
  const [peopleImportMessage, setPeopleImportMessage] = useState<string | null>(
    null,
  );
  const [peoplePhoneChoice, setPeoplePhoneChoice] = useState<{
    contact: DeviceContact;
    phones: DeviceContactPhone[];
  } | null>(null);

  useEffect(() => {
    const state = location.state as { openBodega?: boolean; openLimits?: boolean } | null;
    if (state?.openBodega) {
      setIsEditingBodega(true);
      navigate(location.pathname, { replace: true });
      return;
    }
    if (state?.openLimits) {
      setIsEditingLimites(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location.pathname, location.state, navigate]);
  const [peopleFormErrors, setPeopleFormErrors] = useState<
    Partial<Record<keyof PeopleAdminForm, string>>
  >({});

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [floatingError, setFloatingError] = useState<GuidedErrorMessage | null>(
    null,
  );
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [mostrarConfirmacionCerrarSesion, setMostrarConfirmacionCerrarSesion] =
    useState(false);
  const [syncQueue, setSyncQueue] = useState<SyncOperation[]>(() =>
    getSyncQueue(),
  );
  const [syncSummary, setSyncSummary] = useState<SyncQueueSummary>(() =>
    getSyncQueueSummary(),
  );
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);
  const [syncAllRetrying, setSyncAllRetrying] = useState(false);
  const [retryingSyncIds, setRetryingSyncIds] = useState<string[]>([]);
  const [syncFeedback, setSyncFeedback] = useState<{
    variant: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);
  const [syncDeleteCandidate, setSyncDeleteCandidate] =
    useState<SyncOperation | null>(null);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [accessibilityModal, setAccessibilityModal] = useState<
    'screen-reader' | 'high-contrast' | 'font-scale' | 'permissions' | null
  >(null);
  const [screenReaderSetupPromptOpen, setScreenReaderSetupPromptOpen] =
    useState(false);
  const [systemScreenReaderStatus, setSystemScreenReaderStatus] =
    useState<SystemScreenReaderStatus | null>(null);
  const [screenReaderStatusLoading, setScreenReaderStatusLoading] =
    useState(false);
  const [permissionStatuses, setPermissionStatuses] =
    useState<AppPermissionStatuses | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsFeedback, setPermissionsFeedback] = useState<{
    variant: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);
  const [bodegaLimitesFeedback, setBodegaLimitesFeedback] = useState<{
    variant: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);
  const [bodegaLimitesConfirmOpen, setBodegaLimitesConfirmOpen] =
    useState(false);

  const activeErrorSection = error ? getAjustesErrorSection(error) : null;
  const currentAvatarUrl = profileAvatarRemove
    ? ''
    : profileAvatarDraft ?? profileAvatarUrl ?? user?.avatarUrl ?? '';

  const clearFeedback = () => {
    setError(null);
    setSuccess(null);
    setFloatingError(null);
    setProfileFeedback(null);
  };

  useEffect(() => {
    if (!success) return undefined;
    const timeout = window.setTimeout(() => setSuccess(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [success]);

  useEffect(() => {
    if (profileFeedback?.variant !== 'success') return undefined;
    const timeout = window.setTimeout(() => setProfileFeedback(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [profileFeedback]);

  useEffect(() => {
    const unsubscribe = subscribeToScreenReaderChanges((status) => {
      setSystemScreenReaderStatus(status);
      if (isScreenReaderActive(status)) {
        setScreenReaderSetupPromptOpen(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (accessibilityModal === 'screen-reader') {
      void consultarLectorPantallaSistema();
    }
    if (accessibilityModal === 'permissions') {
      void cargarEstadosPermisos();
    }
  }, [accessibilityModal]);

  useEffect(() => {
    const refreshSyncQueue = () => {
      setSyncQueue(getSyncQueue());
      setSyncSummary(getSyncQueueSummary());
    };

    window.addEventListener(SYNC_QUEUE_EVENT, refreshSyncQueue);
    refreshSyncQueue();
    return () => window.removeEventListener(SYNC_QUEUE_EVENT, refreshSyncQueue);
  }, []);

  useEffect(() => {
    if (!limitNotice) return undefined;
    const timeout = window.setTimeout(() => setLimitNotice(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [limitNotice]);

  const showLimitNotice = (message = 'Llegaste al máximo permitido.') => {
    setLimitNotice(message);
  };

  const abrirEditorBodega = () => {
    clearFeedback();
    setBodegaFeedback(null);
    setBodegaFormOpen(false);
    setBodegaEditando(null);
    setBodegaDeleteTarget(null);
    setIsEditingBodega(true);
    setIsEditingCompany(false);
    setIsEditingProfile(false);
    setIsViewingPublicProfile(false);
    setIsEditingLimites(false);
    void cargarBodegas();
  };

  const abrirEditorLimites = (options?: { keepBodega?: boolean }) => {
    clearFeedback();
    setLimitesTab('todos');
    setIsEditingLimites(true);
    if (!options?.keepBodega) {
      setIsEditingBodega(false);
    }
    setIsEditingCompany(false);
    setIsEditingProfile(false);
    setIsViewingPublicProfile(false);
  };

  const markLimitsOnboarding = async (status: 'dismissed' | 'configured') => {
    const key = `${LIMITS_ONBOARDING_KEY_PREFIX}:${user?.id ?? 'anon'}`;
    await Preferences.set({ key, value: status });
  };

  const abrirAjustesAccesibilidadSistema = async () => {
    const opened = await openAccessibilitySettings();
    if (!opened) {
      setPermissionsFeedback({
        variant: 'warning',
        message:
          'No pudimos abrir los ajustes de accesibilidad. Puedes activarlo desde Configuración > Accesibilidad > TalkBack.',
      });
    }
  };

  const consultarLectorPantallaSistema = async () => {
    if (!isNativeAndroid()) {
      setSystemScreenReaderStatus(null);
      return null;
    }

    try {
      setScreenReaderStatusLoading(true);
      const status = await getScreenReaderStatus();
      setSystemScreenReaderStatus(status);
      return status;
    } catch {
      setSystemScreenReaderStatus(null);
      return null;
    } finally {
      setScreenReaderStatusLoading(false);
    }
  };

  const isSystemScreenReaderActive = (status: SystemScreenReaderStatus | null) =>
    isScreenReaderActive(status);

  const cargarEstadosPermisos = async () => {
    setPermissionsLoading(true);
    try {
      const statuses = await getAppPermissionStatuses();
      setPermissionStatuses(statuses);
      setPermissionsFeedback(null);
      return statuses;
    } catch {
      const message = 'No pudimos consultar los permisos de la aplicación.';
      setPermissionsFeedback({ variant: 'error', message });
      return null;
    } finally {
      setPermissionsLoading(false);
    }
  };

  const abrirAjustesAplicacion = async () => {
    const opened = await openAppSettings();
    if (!opened) {
      setPermissionsFeedback({
        variant: 'warning',
        message:
          'No pudimos abrir los ajustes de Café Smart. Puedes hacerlo desde la configuración del celular.',
      });
    }
  };

  const cerrarSugerenciaLectorPantalla = async () => {
    await Preferences.set({ key: SCREEN_READER_SETUP_KEY, value: 'shown' });
    setScreenReaderSetupPromptOpen(false);
  };

  const abrirAccesibilidadDesdeSugerencia = async () => {
    await Preferences.set({ key: SCREEN_READER_SETUP_KEY, value: 'shown' });
    setScreenReaderSetupPromptOpen(false);
    await abrirAjustesAccesibilidadSistema();
  };

  const mostrarOpcionPendiente = () => {
    clearFeedback();
    setSuccess('Esta opción estará disponible más adelante.');
  };

  const abrirEditorPerfil = () => {
    clearFeedback();
    profileBaselineRef.current = profile;
    setProfileErrors({});
    setProfileAvatarDraft(null);
    setProfileAvatarFile(null);
    setProfileAvatarRemove(false);
    setProfileFeedback(null);
    setIsEditingProfile(true);
    setIsViewingPublicProfile(false);
    setIsEditingCompany(false);
    setIsEditingBodega(false);
    setIsEditingLimites(false);
  };

  const cerrarEditorPerfil = () => {
    clearFeedback();
    if (profileBaselineRef.current) {
      setProfile(profileBaselineRef.current);
    }
    setProfileErrors({});
    setProfileAvatarDraft(null);
    setProfileAvatarFile(null);
    setProfileAvatarRemove(false);
    setProfileFeedback(null);
    setProfilePhotoOpen(false);
    setProfileInfoOpen(false);
    profileBaselineRef.current = null;
    setIsEditingProfile(false);
  };

  const abrirPerfilPublico = () => {
    clearFeedback();
    setIsViewingPublicProfile(true);
    setIsEditingProfile(false);
    setIsEditingCompany(false);
    setIsEditingBodega(false);
    setIsEditingLimites(false);
  };

  const abrirEditorEmpresa = () => {
    clearFeedback();
    companyBaselineRef.current = company;
    setIsEditingCompany(true);
    setIsEditingBodega(false);
    setIsEditingLimites(false);
  };

  const cerrarEditorEmpresa = () => {
    clearFeedback();
    if (companyBaselineRef.current) {
      setCompany(companyBaselineRef.current);
    }
    companyBaselineRef.current = null;
    setIsEditingCompany(false);
  };

  const cerrarEditorBodega = () => {
    clearFeedback();
    setBodegaFeedback(null);
    setBodegaFormOpen(false);
    setBodegaEditando(null);
    setBodegaDeleteTarget(null);
    setIsEditingBodega(false);
  };

  const abrirCrearBodega = () => {
    clearFeedback();
    setBodegaFeedback(null);
    setBodegaEditando(null);
    setNombreBodega('');
    setUbicacionBodega('');
    setCapacidadKg('');
    setBodegaFormOpen(true);
  };

  const abrirEditarBodega = (bodega: BodegaItem) => {
    clearFeedback();
    setBodegaFeedback(null);
    setBodegaEditando(bodega);
    setNombreBodega(bodega.nombre);
    setUbicacionBodega(bodega.ubicacion ?? '');
    setCapacidadKg(String(Math.round(bodega.capacidadMaxKg)));
    setInventarioActualKg(bodega.cafeAlmacenadoKg);
    setBodegaFormOpen(true);
  };

  const abrirLimitesBodega = async (bodega: BodegaItem) => {
    clearFeedback();
    setBodegaFeedback(null);
    setBodegaLimitesFeedback(null);
    setBodegaLimitesTarget(bodega);
    setBodegaLimitesLoading(true);
    try {
      const limites = await obtenerLimitesBodega(bodega.id);
      setBodegaLimitesForm(limites);
    } catch (err) {
      setBodegaLimitesForm({
        alertaPreventivaPct: 80,
        alertaCriticaPct: 95,
        bloquearAlSuperarCapacidad: true,
        alertasActivas: true,
      });
      setBodegaLimitesFeedback({
        variant: 'warning',
        message:
          err instanceof Error && err.message
            ? err.message
            : 'Esta bodega aún no tiene límites configurados. Puedes crearlos ahora.',
      });
    } finally {
      setBodegaLimitesLoading(false);
    }
  };

  const abrirLimiteGeneral = () => {
    clearFeedback();
    setBodegaFeedback(null);
    setBodegaLimitesFeedback(null);
    setBodegaLimitesScope('todas');
    setBodegaLimitesForm({
      alertaPreventivaPct: 80,
      alertaCriticaPct: 95,
      bloquearAlSuperarCapacidad: true,
      alertasActivas: true,
    });
    setBodegaLimitesGeneralOpen(true);
  };

  const cerrarEditorLimites = () => {
    clearFeedback();
    setIsEditingLimites(false);
  };

  const mapClienteAdmin = (cliente: ClienteItem): PeopleAdminItem => ({
    id: cliente.id,
    contactType: 'cliente',
    nombre: cliente.nombre,
    documento: cliente.documento ?? '',
    tipoDocumento:
      cliente.tipoDocumento ?? (cliente.documento?.includes('-') ? 'NIT' : 'CEDULA'),
    telefono: cliente.telefono ?? '',
    roles: ['CLIENTE'],
    createdAt: cliente.createdAt,
  });

  const mapProductorAdmin = (productor: ProductorItem): PeopleAdminItem => ({
    id: productor.id,
    contactType: 'productor',
    nombre: productor.nombre,
    documento: productor.documento ?? '',
    tipoDocumento: productor.tipoDocumento ?? 'CEDULA',
    telefono: productor.telefono ?? '',
    roles: ['PRODUCTOR'],
    createdAt: productor.createdAt,
  });

  const mapContactoAdmin = (contacto: ContactoItem): PeopleAdminItem => ({
    id: contacto.id,
    contactType: contacto.roles.includes('PRODUCTOR') ? 'productor' : 'cliente',
    nombre: contacto.nombre,
    documento: contacto.documento,
    tipoDocumento: contacto.tipoDocumento,
    telefono: contacto.telefono ?? '',
    roles: contacto.roles,
    clienteId: contacto.clienteId,
    productorId: contacto.productorId,
    createdAt: contacto.createdAt,
  });

  const cargarPersonasAdmin = async (
    mode: Exclude<PeopleAdminMode, null>,
    options: { resetSearch?: boolean } = {},
  ) => {
    setPeopleMode(mode);
    if (options.resetSearch ?? true) {
      setPeopleSearch('');
    }
    setPeopleError(null);
    setPeopleLoading(true);
    try {
      const rol =
        mode === 'clientes'
          ? 'CLIENTE'
          : mode === 'productores'
            ? 'PRODUCTOR'
            : mode === 'multirol'
              ? 'MULTIROL'
              : undefined;
      const contactos = await listarContactos(rol);
      setContactosAdmin(contactos.map(mapContactoAdmin));
    } catch {
      setPeopleError('No pudimos cargar los contactos');
    } finally {
      setPeopleLoading(false);
    }
  };

  useEffect(() => {
    const nombreOrganizacionReal = normalizeCompanyName(
      user?.nombreOrganizacion ?? '',
    );
    const nextNombre = profile.nombre || user?.name || '';
    const nextCorreo = profile.correo || user?.email || '';
    const nextTelefono = profile.telefono || formatPhoneNumber(user?.telefono ?? '');
    const nextTipo =
      company.tipoEmpresa ||
      (user?.tipoOrganizacion
        ? user.tipoOrganizacion.charAt(0) +
          user.tipoOrganizacion.slice(1).toLowerCase()
        : 'Compraventa');
    const nextDescripcion =
      user?.descripcionOrganizacion?.trim() || company.descripcion;

    if (
      !isEditingProfile &&
      (nextNombre !== profile.nombre ||
        nextCorreo !== profile.correo ||
        nextTelefono !== profile.telefono)
    ) {
      setProfile((prev) => ({
        ...prev,
        nombre: nextNombre,
        correo: nextCorreo,
        telefono: nextTelefono,
      }));
    }

    if (
      !isEditingCompany &&
      (!company.nombreEmpresa ||
        !company.tipoEmpresa ||
        ((company.nombreEmpresa === 'Mi negocio cafetero' ||
          company.nombreEmpresa === 'Negocio sin nombre') &&
          nombreOrganizacionReal))
    ) {
      setCompany((prev) => ({
        nombreEmpresa:
          !prev.nombreEmpresa ||
          prev.nombreEmpresa === 'Mi negocio cafetero' ||
          prev.nombreEmpresa === 'Negocio sin nombre'
            ? nombreOrganizacionReal || 'Negocio sin nombre'
            : prev.nombreEmpresa,
        tipoEmpresa: nextTipo,
        descripcion: nextDescripcion,
      }));
    }

    if (!profileAvatarDraft && !profileAvatarRemove && user?.avatarUrl !== profileAvatarUrl) {
      setProfileAvatarUrl(user?.avatarUrl ?? '');
    }
  }, [
    company.nombreEmpresa,
    company.tipoEmpresa,
    company.descripcion,
    isEditingCompany,
    isEditingProfile,
    profile.nombre,
    profile.correo,
    profile.telefono,
    user?.name,
    user?.email,
    user?.telefono,
    user?.nombreOrganizacion,
    user?.tipoOrganizacion,
    user?.descripcionOrganizacion,
    user?.avatarUrl,
    profileAvatarDraft,
    profileAvatarRemove,
    profileAvatarUrl,
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

  const secadosActivosInline = useMemo(
    () =>
      getActiveSecadoSessions()
        .filter((session) => keyOf(session.tipoCafe) === 'VERDE')
        .filter(
          (session) =>
            secadoQualityFilter === 'TODOS' ||
            keyOf(session.calidad) === secadoQualityFilter,
        )
        .sort(
          (a, b) =>
            secadoSortMode === 'oldest'
              ? new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
              : new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
        ),
    [secadoQualityFilter, secadoSessionsVersion, secadoSortMode],
  );

  const sublotesSecadoDisponibles = useMemo(
    () => secadoDetalle?.sublotes.filter((sublote) => sublote.pesoActual > 0) ?? [],
    [secadoDetalle],
  );

  const totalSecadoSeleccionado = useMemo(
    () =>
      Object.values(secadoWeights).reduce(
        (sum, value) => sum + (Number.isFinite(value) ? value : 0),
        0,
      ),
    [secadoWeights],
  );

  const cargarPanelSecadoInicio = async () => {
    setSecadoPanel('start');
    setSecadoLoading(true);
    setSecadoError(null);
    try {
      const lotes = await obtenerLotes();
      const visual = ENABLE_SECADO_PROTOTYPE ? applySecadoToLots(lotes) : lotes;
      const verdes = visual.filter(
        (lote) => keyOf(lote.tipoCafe) === 'VERDE' && lote.pesoActual > 0,
      );
      setSecadoLotes(verdes);
      const selected = verdes.find(
        (lote) => `${lote.tipoCafeId}:${lote.calidadId}` === secadoLoteKey,
      ) ?? verdes[0];

      if (!selected) {
        setSecadoDetalle(null);
        setSecadoWeights({});
        return;
      }

      const nextKey = `${selected.tipoCafeId}:${selected.calidadId}`;
      setSecadoLoteKey(nextKey);
      const detalleBase = await obtenerDetalleLote(
        selected.tipoCafeId,
        selected.calidadId,
      );
      const detalle =
        ENABLE_SECADO_PROTOTYPE
          ? applySecadoToDetalle(detalleBase, selected.tipoCafeId, selected.calidadId)
          : detalleBase;
      setSecadoDetalle(detalle);
      setSecadoWeights(
        Object.fromEntries(
          (detalle?.sublotes ?? [])
            .filter((sublote) => sublote.pesoActual > 0)
            .map((sublote) => [sublote.id, sublote.pesoActual]),
        ),
      );
    } catch {
      setSecadoError('No pudimos cargar los sublotes para secado.');
    } finally {
      setSecadoLoading(false);
    }
  };

  const cargarDetalleSecadoInline = async (value: string) => {
    const lote = secadoLotes.find(
      (item) => `${item.tipoCafeId}:${item.calidadId}` === value,
    );
    if (!lote) return;

    setSecadoLoteKey(value);
    setSecadoLoading(true);
    setSecadoError(null);
    try {
      const detalleBase = await obtenerDetalleLote(lote.tipoCafeId, lote.calidadId);
      const detalle =
        ENABLE_SECADO_PROTOTYPE
          ? applySecadoToDetalle(detalleBase, lote.tipoCafeId, lote.calidadId)
          : detalleBase;
      setSecadoDetalle(detalle);
      setSecadoWeights(
        Object.fromEntries(
          (detalle?.sublotes ?? [])
            .filter((sublote) => sublote.pesoActual > 0)
            .map((sublote) => [sublote.id, sublote.pesoActual]),
        ),
      );
    } catch {
      setSecadoError('No pudimos cargar ese lote verde.');
    } finally {
      setSecadoLoading(false);
    }
  };

  const iniciarSecadoInline = () => {
    if (!secadoDetalle || totalSecadoSeleccionado <= 0) {
      setSecadoError('Selecciona al menos un sublote para iniciar secado.');
      return;
    }

    try {
      startSecadoWithWeights(secadoDetalle, secadoWeights);
      setSecadoPanel('active');
      setSecadoSessionsVersion((current) => current + 1);
      setSecadoError(null);
    } catch {
      setSecadoError('No pudimos iniciar el secado. Revisa los pesos.');
    }
  };

  useEffect(() => {
    if (!nombreLimitNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setNombreLimitNotice(false);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [nombreLimitNotice]);

  useEffect(() => {
    const cargarConfiguracionBodega = async () => {
      try {
        const config = await obtenerConfiguracionBodega();
        const limites = obtenerLimitesEntradaLocales(config);
        setNombreBodega(config.nombreBodega);
        setCapacidadKg(config.capacidadKg ? String(config.capacidadKg) : '');
        setLimitMinPesoCompraKg(String(limites.minPesoCompraKg));
        setLimitMaxPesoKg(String(limites.maxPesoCompraKg));
        setLimitMinPrecioCompraKg(String(limites.minPrecioCompraKg));
        setLimitMaxPrecioKg(String(limites.maxPrecioCompraKg));
        setLimitMinPrecioVentaKg(String(limites.minPrecioVentaKg));
        setLimitMaxPrecioVentaKg(String(limites.maxPrecioVentaKg));
        setUpdatedAt(config.updatedAt);
      } catch {
        const limites = obtenerLimitesEntradaLocales(initialConfig);
        setNombreBodega(initialConfig.nombreBodega);
        setCapacidadKg('');
        setLimitMinPesoCompraKg(String(limites.minPesoCompraKg));
        setLimitMaxPesoKg(String(limites.maxPesoCompraKg));
        setLimitMinPrecioCompraKg(String(limites.minPrecioCompraKg));
        setLimitMaxPrecioKg(String(limites.maxPrecioCompraKg));
        setLimitMinPrecioVentaKg(String(limites.minPrecioVentaKg));
        setLimitMaxPrecioVentaKg(String(limites.maxPrecioVentaKg));
        setUpdatedAt(initialConfig.updatedAt);
      }
    };

    void cargarConfiguracionBodega();
  }, []);

  const cargarBodegas = async () => {
    setBodegasLoading(true);
    try {
      const items = await listarBodegas();
      setBodegaFeedback(null);
      setBodegas(items);
      const principal = items.find((item) => item.esPrincipal) ?? items[0];
      if (principal) {
        setNombreBodega(principal.nombre);
        setCapacidadKg(String(Math.round(principal.capacidadMaxKg)));
        setUbicacionBodega(principal.ubicacion ?? '');
        setInventarioActualKg(principal.cafeAlmacenadoKg);
        setUpdatedAt(principal.updatedAt);
      }
    } catch {
      setBodegaFeedback({
        variant: 'error',
        message: 'No pudimos cargar las bodegas. Intenta nuevamente.',
      });
    } finally {
      setBodegasLoading(false);
    }
  };

  useEffect(() => {
    void cargarBodegas();
  }, []);

  const peopleItems = contactosAdmin.filter((item) => {
    if (peopleMode === 'clientes') return item.roles.includes('CLIENTE');
    if (peopleMode === 'productores') return item.roles.includes('PRODUCTOR');
    if (peopleMode === 'multirol') {
      return item.roles.includes('CLIENTE') && item.roles.includes('PRODUCTOR');
    }
    return true;
  });
  const debouncedPeopleSearch = useDebouncedValue(peopleSearch);
  const peopleSearchResult = useMemo(
    () =>
      fuzzySearch(peopleItems, debouncedPeopleSearch, (item) => [
        item.nombre,
        item.documento,
        item.telefono,
      ]),
    [debouncedPeopleSearch, peopleItems],
  );
  const peopleFiltered = peopleSearchResult.items
    .sort((a, b) => {
      if (peopleSortMode === 'oldest') {
        return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
      }
      if (peopleSortMode === 'az') return a.nombre.localeCompare(b.nombre, 'es');
      if (peopleSortMode === 'za') return b.nombre.localeCompare(a.nombre, 'es');
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });
  const peopleEmptyTitle = peopleSearch.trim()
    ? 'No encontramos contactos con esa búsqueda'
    : peopleMode === 'clientes'
      ? 'Sin clientes registrados'
      : peopleMode === 'productores'
        ? 'Sin productores registrados'
        : peopleMode === 'multirol'
          ? 'Sin contactos Multirol registrados'
          : 'Sin contactos registrados';
  const peopleEmptyDescription = peopleSearch.trim()
    ? 'Prueba con otro nombre, documento o teléfono.'
    : peopleMode === 'clientes'
      ? 'Agrega clientes para usarlos en ventas.'
      : peopleMode === 'productores'
        ? 'Agrega productores para usarlos en compras.'
        : peopleMode === 'multirol'
          ? 'Los contactos Multirol pueden participar en compras y ventas.'
          : 'Agrega clientes o productores para usarlos en compras y ventas.';

  const abrirEdicionPersona = (item: PeopleAdminItem) => {
    setPeopleEditing(item);
    setPeopleDetail(null);
    setPeopleForm({
      nombre: item.nombre,
      tipoDocumento: item.tipoDocumento,
      documento: item.documento,
      telefono: item.telefono ? formatPhoneNumber(item.telefono) : '',
      roles: item.roles,
    });
    setPeopleFormErrors({});
  };

  const seleccionarFotoPerfil = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setProfileFeedback(null);
    setError(null);

    if (!file) return;

    if (!isAllowedAvatarType(file.type)) {
      setProfileFeedback({
        variant: 'error',
        message: 'Formato no permitido. Usa JPG, PNG o WEBP.',
      });
      return;
    }

    if (file.size <= 0) {
      setProfileFeedback({
        variant: 'error',
        message: 'El archivo está vacío. Elige otra imagen.',
      });
      return;
    }

    if (file.size > PROFILE_AVATAR_MAX_BYTES) {
      setProfileFeedback({
        variant: 'error',
        message: 'La imagen es demasiado grande. Selecciona una foto de máximo 5 MB.',
      });
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setProfileAvatarDraft(dataUrl);
      setProfileAvatarFile(file);
      setProfileAvatarRemove(false);
      setProfileFeedback({
        variant: 'success',
        message: 'Vista previa lista. Guarda cambios para conservarla.',
      });
    } catch {
      setProfileFeedback({
        variant: 'error',
        message: 'No pudimos leer la imagen. Intenta con otro archivo.',
      });
    }
  };

  const quitarFotoPerfil = () => {
    if (
      (profileAvatarUrl || profileAvatarDraft) &&
      !window.confirm('¿Quitar foto de perfil? Se mostrará la inicial de tu nombre.')
    ) {
      return;
    }
    setProfileAvatarDraft(null);
    setProfileAvatarFile(null);
    setProfileAvatarRemove(true);
    setProfileFeedback({
      variant: 'warning',
      message: 'La foto se quitará cuando guardes los cambios.',
    });
  };

  const cancelarEdicionFotoPerfil = () => {
    setProfilePhotoOpen(false);
    setProfileAvatarDraft(null);
    setProfileAvatarFile(null);
    setProfileAvatarRemove(false);
    setProfileFeedback(null);
  };

  const guardarFotoPerfil = async () => {
    clearFeedback();

    if (!profileAvatarFile && !profileAvatarRemove) {
      setProfilePhotoOpen(false);
      return;
    }

    if (isOffline) {
      const message =
        'Conéctate a internet para guardar la foto de perfil en la nube.';
      setProfileFeedback({ variant: 'warning', message });
      setError(message);
      return;
    }

    try {
      setGuardandoPerfil(true);
      const wasRemovingAvatar = profileAvatarRemove;
      const perfilActualizado = profileAvatarRemove
        ? await quitarFotoPerfilRemota()
        : await subirFotoPerfil(profileAvatarFile as File);
      const nextAvatarUrl = perfilActualizado.avatarUrl ?? '';

      setProfileAvatarUrl(nextAvatarUrl);
      setProfileAvatarDraft(null);
      setProfileAvatarFile(null);
      setProfileAvatarRemove(false);
      setProfilePhotoOpen(false);

      if (user && token) {
        await setSession({
          token,
          hasCompany,
          user: {
            ...user,
            id: perfilActualizado.id,
            name: perfilActualizado.nombre,
            email: perfilActualizado.correo,
            telefono: perfilActualizado.telefono ?? user.telefono,
            organizacionId:
              perfilActualizado.organizacionId ?? user.organizacionId ?? null,
            avatarUrl: nextAvatarUrl || null,
          },
        });
      }

      setProfileFeedback({
        variant: 'success',
        message: wasRemovingAvatar
          ? 'Foto eliminada. Ahora se mostrará la inicial de tu nombre.'
          : 'Foto de perfil actualizada.',
      });
    } catch {
      const message =
        'No pudimos guardar la foto. Revisa tu conexión e inténtalo nuevamente.';
      setError(message);
      setProfileFeedback({ variant: 'error', message });
      setFloatingError(getAjustesGuidance(message));
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const guardarPerfil = async () => {
    clearFeedback();

    const telefono = normalizePhoneNumberForStorage(profile.telefono);
    const nextErrors: ProfileErrors = {};
    const nombreError = validateProfileName(profile.nombre);
    const correoError = validateProfileEmail(profile.correo);
    const telefonoError = validateColombianPhone(profile.telefono);

    if (nombreError) nextErrors.nombre = nombreError;
    if (correoError) nextErrors.correo = correoError;
    if (telefonoError) nextErrors.telefono = telefonoError;

    if (Object.keys(nextErrors).length > 0) {
      const message =
        nextErrors.nombre ??
        nextErrors.correo ??
        nextErrors.telefono ??
        'Ingresa un número de teléfono válido.';
      setProfileErrors(nextErrors);
      setError(message);
      setFloatingError(getAjustesGuidance(message));
      return;
    }

    const normalizedProfile = {
      ...profile,
      nombre: normalizeHumanName(profile.nombre),
      correo: profile.correo.trim().slice(0, PROFILE_EMAIL_MAX_LENGTH),
      telefono,
    };

    try {
      setGuardandoPerfil(true);
      const perfilActualizado = isOffline
        ? {
            id: user?.id ?? '',
            nombre: normalizedProfile.nombre,
            correo: normalizedProfile.correo,
            telefono: normalizedProfile.telefono || null,
            avatarUrl: profileAvatarUrl || null,
            organizacionId: user?.organizacionId ?? null,
          }
        : await actualizarPerfilUsuario({
            nombre: normalizedProfile.nombre,
            correo: normalizedProfile.correo,
            telefono: normalizedProfile.telefono || null,
          });

      const nextAvatarUrl = perfilActualizado.avatarUrl ?? profileAvatarUrl ?? null;

      const nextProfile = {
        nombre: perfilActualizado.nombre,
        correo: perfilActualizado.correo,
        telefono: perfilActualizado.telefono ?? '',
      };

      setProfile((prev) => ({
        ...prev,
        ...nextProfile,
      }));
      setProfileAvatarUrl(nextAvatarUrl ?? '');
      profileBaselineRef.current = nextProfile;
      setProfileErrors({});

      if (user && token) {
        await setSession({
          token,
          hasCompany,
          user: {
            ...user,
            id: perfilActualizado.id,
            name: nextProfile.nombre,
            email: nextProfile.correo,
            telefono: nextProfile.telefono,
            organizacionId:
              perfilActualizado.organizacionId ?? user.organizacionId ?? null,
            avatarUrl: nextAvatarUrl,
          },
        });
        await updateRememberedAccountIfCurrent({
          previousEmail: user.email,
          email: nextProfile.correo,
          name: nextProfile.nombre,
        });
      }

      setProfileInfoOpen(false);
      setProfileFeedback(
        isOffline
          ? {
              variant: 'warning',
              message:
                'Datos guardados en este dispositivo. Se sincronizarán cuando tengas conexión.',
            }
          : {
              variant: 'success',
              message: 'Perfil actualizado correctamente.',
            },
      );
    } catch (error) {
      const message = 'No pudimos actualizar tu perfil. Intenta de nuevo.';
      setError(message);
      setProfileFeedback({ variant: 'error', message });
      setFloatingError(getAjustesGuidance(message));
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const guardarEmpresa = async () => {
    clearFeedback();
    if (isOffline) {
      setError(OFFLINE_BLOCKED_ACTION_MESSAGE);
      setFloatingError(getAjustesGuidance(OFFLINE_BLOCKED_ACTION_MESSAGE));
      return;
    }

    const companyNameValidation = validateCompanyName(company.nombreEmpresa);
    const businessNameError = companyNameValidation.isValid
      ? validateBusinessName(company.nombreEmpresa)
      : companyNameValidation.message;
    if (businessNameError) {
      const message = businessNameError;
      setError(message);
      setFloatingError(getAjustesGuidance(message));
      return;
    }
    if (!company.tipoEmpresa.trim()) {
      const message = 'Selecciona el tipo de negocio.';
      setError(message);
      setFloatingError(getAjustesGuidance(message));
      return;
    }
    const nombreEmpresa = normalizeCompanyName(company.nombreEmpresa);
    const descripcionEmpresa = company.descripcion.trim().replace(/\s+/g, ' ');
    try {
      setGuardandoEmpresa(true);
      const organizacionActualizada = await actualizarConfiguracionOrganizacion({
        nombreOrganizacion: nombreEmpresa,
        tipoOrganizacion: company.tipoEmpresa,
        descripcionOrganizacion: descripcionEmpresa || null,
      });
      const descripcionActualizada =
        organizacionActualizada.descripcion ?? descripcionEmpresa;
      setCompany((prev) => ({
        ...prev,
        nombreEmpresa: organizacionActualizada.nombre ?? nombreEmpresa,
        tipoEmpresa: organizacionActualizada.tipo,
        descripcion: descripcionActualizada,
      }));
      companyBaselineRef.current = {
        ...company,
        nombreEmpresa: organizacionActualizada.nombre ?? nombreEmpresa,
        tipoEmpresa: organizacionActualizada.tipo,
        descripcion: descripcionActualizada,
      };
      if (user && token) {
        await setSession({
          token,
          hasCompany,
          user: {
            ...user,
            nombreOrganizacion: organizacionActualizada.nombre ?? nombreEmpresa,
            tipoOrganizacion: organizacionActualizada.tipo as typeof user.tipoOrganizacion,
            otroTipoDetalle: organizacionActualizada.otroTipoDetalle ?? null,
            descripcionOrganizacion: descripcionActualizada || null,
          },
        });
      }
      setSuccess('Negocio actualizado correctamente.');
    } catch {
      const message = 'No pudimos guardar los cambios. Intenta nuevamente.';
      setError(message);
      setFloatingError(getAjustesGuidance(message));
    } finally {
      setGuardandoEmpresa(false);
    }
  };

  const guardarPersonaAdmin = async () => {
    if (!peopleMode || !peopleEditing) return;
    if (isOffline) {
      setPeopleError(OFFLINE_BLOCKED_ACTION_MESSAGE);
      return;
    }

    const tipoDocumento = peopleForm.tipoDocumento || 'CEDULA';
    const nombreValidation =
      tipoDocumento === 'NIT'
        ? validateCompanyName(peopleForm.nombre)
        : validatePersonName(peopleForm.nombre, 'El nombre');
    const documento = normalizeDocumentForStorage(peopleForm.documento, tipoDocumento);
    const documentoValidation = validateDocumentNumber(peopleForm.documento, 'El documento', {
      optional: false,
      type: tipoDocumento,
    });
    const telefono = normalizePhoneNumberForStorage(peopleForm.telefono);
    const telefonoError = validateColombianPhone(peopleForm.telefono);
    const duplicates = [...clientesAdmin, ...productoresAdmin].some(
      (item) =>
        !(item.id === peopleEditing.id && item.contactType === peopleEditing.contactType) &&
        item.contactType === peopleEditing.contactType &&
        item.tipoDocumento === tipoDocumento &&
        normalizeDocumentForStorage(item.documento, item.tipoDocumento) === documento,
    );
    const nextErrors: Partial<Record<keyof PeopleAdminForm, string>> = {};

    if (!nombreValidation.isValid) nextErrors.nombre = nombreValidation.message;
    if (!documentoValidation.isValid) {
      nextErrors.documento = documentoValidation.message;
    } else if (duplicates) {
      nextErrors.documento = 'Este documento ya está registrado.';
    }
    if (telefonoError) nextErrors.telefono = telefonoError;

    setPeopleFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPeopleLoading(true);
    try {
      const payload = {
        nombre:
          tipoDocumento === 'NIT'
            ? normalizeCompanyName(peopleForm.nombre)
            : normalizeHumanName(peopleForm.nombre),
        documento,
        tipoDocumento,
        telefono: telefono || undefined,
      };

      if (peopleEditing.contactType === 'cliente') {
        const updated = await actualizarCliente(peopleEditing.id, payload);
        setClientesAdmin((items) =>
          items.map((item) => (item.id === updated.id ? mapClienteAdmin(updated) : item)),
        );
      } else {
        const updated = await actualizarProductor(peopleEditing.id, payload);
        setProductoresAdmin((items) =>
          items.map((item) =>
            item.id === updated.id ? mapProductorAdmin(updated) : item,
          ),
        );
      }
      setSuccess('Contacto actualizado correctamente.');
      setPeopleEditing(null);
      setPeopleFormErrors({});
    } catch {
      setPeopleError(
        'No pudimos guardar el contacto. Revisa tu conexión e intenta nuevamente.',
      );
    } finally {
      setPeopleLoading(false);
    }
  };

  const guardarBodega = async () => {
    const capacidad = Number(capacidadKg);
    clearFeedback();
    setBodegaFeedback(null);

    if (isOffline) {
      setBodegaFeedback({
        variant: 'warning',
        message: OFFLINE_BLOCKED_ACTION_MESSAGE,
      });
      return;
    }

    if (!nombreBodega.trim()) {
      setBodegaFeedback({
        variant: 'error',
        message: 'Ingresa el nombre de la bodega.',
      });
      return;
    }

    if (!Number.isFinite(capacidad) || capacidad <= 0) {
      setBodegaFeedback({
        variant: 'error',
        message: 'La capacidad debe ser mayor que 0 kg.',
      });
      return;
    }

    if (capacidad < inventarioActualKg) {
      setBodegaFeedback({
        variant: 'error',
        message: 'La capacidad no puede ser menor al café almacenado actualmente.',
      });
      return;
    }

    try {
      setGuardandoBodega(true);
      const payload = {
        nombre: nombreBodega.trim(),
        ubicacion: ubicacionBodega.trim() || null,
        capacidadMaxKg: capacidad,
      };

      if (bodegaEditando) {
        await editarBodega(bodegaEditando.id, {
          ...payload,
          activa: bodegaEditando.activa,
          esPrincipal: bodegaEditando.esPrincipal,
        });
        setBodegaFeedback({
          variant: 'success',
          message: 'Bodega actualizada correctamente.',
        });
      } else {
        await crearBodega(payload);
        setBodegaFeedback({
          variant: 'success',
          message: 'Bodega creada correctamente.',
        });
      }

      setBodegaFormOpen(false);
      setBodegaEditando(null);
      await cargarBodegas();
    } catch (err) {
      setBodegaFeedback({
        variant: 'error',
        message:
          err instanceof Error && err.message
            ? err.message
            : 'No pudimos guardar la bodega. Intenta nuevamente.',
      });
    } finally {
      setGuardandoBodega(false);
    }
  };

  const marcarBodegaPrincipal = async (bodega: BodegaItem) => {
    clearFeedback();
    setBodegaFeedback(null);

    if (isOffline) {
      setBodegaFeedback({
        variant: 'warning',
        message: OFFLINE_BLOCKED_ACTION_MESSAGE,
      });
      return;
    }

    try {
      setGuardandoBodega(true);
      await editarBodega(bodega.id, { esPrincipal: true, activa: true });
      setBodegaFeedback({
        variant: 'success',
        message: 'Bodega principal actualizada correctamente.',
      });
      await cargarBodegas();
    } catch (err) {
      setBodegaFeedback({
        variant: 'error',
        message:
          err instanceof Error && err.message
            ? err.message
            : 'No pudimos actualizar la bodega principal.',
      });
    } finally {
      setGuardandoBodega(false);
    }
  };

  const alternarBodegaActiva = async (bodega: BodegaItem) => {
    const nextActiva = !bodega.activa;
    clearFeedback();
    setBodegaFeedback(null);

    if (isOffline) {
      setBodegaFeedback({
        variant: 'warning',
        message: OFFLINE_BLOCKED_ACTION_MESSAGE,
      });
      return;
    }

    if (!nextActiva) {
      const activeCount = bodegas.filter((item) => item.activa).length;
      if (bodega.esPrincipal) {
        setBodegaFeedback({
          variant: 'warning',
          message:
            'La bodega principal debe estar activa. Marca otra bodega como principal antes de desactivarla.',
        });
        return;
      }
      if (activeCount <= 1) {
        setBodegaFeedback({
          variant: 'warning',
          message: 'Debe existir al menos una bodega activa.',
        });
        return;
      }
      if (bodega.cafeAlmacenadoKg > 0) {
        setBodegaFeedback({
          variant: 'warning',
          message:
            'No puedes desactivar esta bodega porque tiene inventario activo.',
        });
        return;
      }
    }

    try {
      setGuardandoBodega(true);
      await editarBodega(bodega.id, { activa: nextActiva });
      setBodegaFeedback({
        variant: 'success',
        message: nextActiva
          ? 'Bodega activada correctamente.'
          : 'Bodega desactivada correctamente.',
      });
      await cargarBodegas();
    } catch (err) {
      setBodegaFeedback({
        variant: 'error',
        message:
          err instanceof Error && err.message
            ? err.message
            : 'No pudimos actualizar la bodega.',
      });
    } finally {
      setGuardandoBodega(false);
    }
  };

  const validarLimitesBodega = () => {
    if (
      !Number.isInteger(bodegaLimitesForm.alertaPreventivaPct) ||
      bodegaLimitesForm.alertaPreventivaPct <= 0 ||
      bodegaLimitesForm.alertaPreventivaPct > 100
    ) {
      return 'Ingresa una alerta preventiva válida.';
    }
    if (
      !Number.isInteger(bodegaLimitesForm.alertaCriticaPct) ||
      bodegaLimitesForm.alertaCriticaPct <= 0 ||
      bodegaLimitesForm.alertaCriticaPct > 100
    ) {
      return 'Ingresa un estado crítico válido.';
    }
    if (bodegaLimitesForm.alertaCriticaPct <= bodegaLimitesForm.alertaPreventivaPct) {
      return 'El nivel preventivo debe ser menor que el nivel crítico.';
    }
    return null;
  };

  const guardarLimitesBodegaActual = async () => {
    if (!bodegaLimitesTarget) return;
    const validationError = validarLimitesBodega();
    if (validationError) {
      setBodegaLimitesFeedback({ variant: 'error', message: validationError });
      return;
    }
    try {
      setGuardandoBodega(true);
      await guardarLimitesBodega(bodegaLimitesTarget.id, bodegaLimitesForm);
      setBodegaLimitesTarget(null);
      setBodegaLimitesFeedback(null);
      setBodegaFeedback({
        variant: 'success',
        message: `Límites actualizados. Las alertas de ${bodegaLimitesTarget.nombre} se guardaron correctamente.`,
      });
    } catch (err) {
      setBodegaLimitesFeedback({
        variant: 'error',
        message:
          err instanceof Error && err.message
            ? err.message
            : 'No pudimos guardar los límites de esta bodega.',
      });
    } finally {
      setGuardandoBodega(false);
    }
  };

  const aplicarLimitesGenerales = async () => {
    const validationError = validarLimitesBodega();
    if (validationError) {
      setBodegaLimitesFeedback({ variant: 'error', message: validationError });
      return;
    }
    setBodegaLimitesConfirmOpen(true);
  };

  const confirmarAplicarLimitesGenerales = async () => {
    try {
      setGuardandoBodega(true);
      const result = await aplicarLimitesBodegaGeneral({
        ...bodegaLimitesForm,
        scope: bodegaLimitesScope,
      });
      setBodegaLimitesGeneralOpen(false);
      setBodegaLimitesConfirmOpen(false);
      setBodegaLimitesFeedback(null);
      setBodegaFeedback({
        variant: 'success',
        message: `Límites aplicados a ${result.bodegasAfectadas} bodega${
          result.bodegasAfectadas === 1 ? '' : 's'
        }.`,
      });
    } catch (err) {
      setBodegaLimitesFeedback({
        variant: 'error',
        message:
          err instanceof Error && err.message
            ? err.message
            : 'No pudimos aplicar el límite general.',
      });
    } finally {
      setGuardandoBodega(false);
    }
  };

  const confirmarEliminarBodega = async () => {
    if (!bodegaDeleteTarget) return;

    clearFeedback();
    setBodegaFeedback(null);

    if (bodegas.length <= 1) {
      setBodegaFeedback({
        variant: 'warning',
        message: 'Debe existir al menos una bodega registrada.',
      });
      setBodegaDeleteTarget(null);
      return;
    }

    if (bodegaDeleteTarget.cafeAlmacenadoKg > 0) {
      setBodegaFeedback({
        variant: 'warning',
        message: 'No puedes eliminar esta bodega porque tiene inventario activo.',
      });
      setBodegaDeleteTarget(null);
      return;
    }

    try {
      setGuardandoBodega(true);
      await eliminarBodega(bodegaDeleteTarget.id);
      setBodegaDeleteTarget(null);
      setBodegaFeedback({
        variant: 'success',
        message: 'Bodega eliminada correctamente.',
      });
      await cargarBodegas();
    } catch (err) {
      setBodegaFeedback({
        variant: 'error',
        message:
          err instanceof Error && err.message
            ? err.message
            : 'No pudimos eliminar la bodega. Intenta nuevamente.',
      });
    } finally {
      setGuardandoBodega(false);
    }
  };

  const guardarLimites = async () => {
    const pesoMin = Number(limitMinPesoCompraKg);
    const pesoMax = Number(limitMaxPesoKg);
    const precioMin = Number(limitMinPrecioCompraKg);
    const precioMax = Number(limitMaxPrecioKg);
    const precioVentaMin = Number(limitMinPrecioVentaKg);
    const precioVentaMax = Number(limitMaxPrecioVentaKg);
    clearFeedback();

    if (isOffline) {
      setError(OFFLINE_BLOCKED_ACTION_MESSAGE);
      return;
    }

    if (!Number.isFinite(pesoMin) || pesoMin <= 0) {
      setError('El peso mínimo debe ser mayor a 0 kg.');
      return;
    }

    if (
      !Number.isFinite(pesoMax) ||
      pesoMax < pesoMin ||
      pesoMax > PESO_MAXIMO_ENTRADA_KG
    ) {
      setError('El peso máximo no puede ser menor que el peso mínimo.');
      return;
    }

    if (!Number.isFinite(precioMin) || precioMin <= 0) {
      setError('El precio mínimo debe ser mayor a $0.');
      return;
    }

    if (!Number.isFinite(precioMax) || precioMax < precioMin) {
      setError('El precio máximo no puede ser menor que el precio mínimo.');
      return;
    }

    if (!Number.isFinite(precioVentaMin) || precioVentaMin <= 0) {
      setError('El precio mínimo debe ser mayor a $0.');
      return;
    }

    if (!Number.isFinite(precioVentaMax) || precioVentaMax < precioVentaMin) {
      setError('El precio máximo no puede ser menor que el precio mínimo.');
      return;
    }

    const limitesLocales: LimitesTransaccion = {
      minPesoCompraKg: pesoMin,
      maxPesoCompraKg: pesoMax,
      minPrecioCompraKg: precioMin,
      maxPrecioCompraKg: precioMax,
      minPrecioVentaKg: precioVentaMin,
      maxPrecioVentaKg: precioVentaMax,
    };

    setGuardandoLimites(true);
    try {
      const result = await guardarLimitesEntrada({
        maxPesoKg: pesoMax,
        maxPrecioKg: precioMax,
        maxPrecioVentaKg: precioVentaMax,
      });
      const limitesGuardados = guardarLimitesEntradaLocales({
        ...limitesLocales,
        maxPesoCompraKg: result.maxPesoKg,
        maxPrecioCompraKg: result.maxPrecioKg,
        maxPrecioVentaKg: result.maxPrecioVentaKg,
      });
      setLimitMinPesoCompraKg(String(limitesGuardados.minPesoCompraKg));
      setLimitMaxPesoKg(String(limitesGuardados.maxPesoCompraKg));
      setLimitMinPrecioCompraKg(String(limitesGuardados.minPrecioCompraKg));
      setLimitMaxPrecioKg(String(limitesGuardados.maxPrecioCompraKg));
      setLimitMinPrecioVentaKg(String(limitesGuardados.minPrecioVentaKg));
      setLimitMaxPrecioVentaKg(String(limitesGuardados.maxPrecioVentaKg));
      await markLimitsOnboarding('configured');
      setSuccess('Límites actualizados.');
    } catch {
      setError('No pudimos guardar los límites. Revisa tu conexión e intenta nuevamente.');
    } finally {
      setGuardandoLimites(false);
    }
  };

  const activePeopleItems = contactosAdmin.filter((item) => {
    if (peopleMode === 'clientes') return item.roles.includes('CLIENTE');
    if (peopleMode === 'productores') return item.roles.includes('PRODUCTOR');
    if (peopleMode === 'multirol') {
      return item.roles.includes('CLIENTE') && item.roles.includes('PRODUCTOR');
    }
    return true;
  });
  const activePeopleLabel =
    peopleMode === 'clientes'
      ? 'Clientes registrados'
      : peopleMode === 'productores'
        ? 'Productores registrados'
        : peopleMode === 'multirol'
          ? 'Contactos Multirol'
          : 'Gestión de contactos';
  const activePeopleSingular =
    peopleEditing?.roles.includes('PRODUCTOR') && !peopleEditing?.roles.includes('CLIENTE')
      ? 'productor'
      : 'contacto';
  const activePeopleSearchResult = useMemo(
    () =>
      fuzzySearch(activePeopleItems, debouncedPeopleSearch, (item) => [
        item.nombre,
        item.documento,
        item.telefono,
      ]),
    [activePeopleItems, debouncedPeopleSearch],
  );
  const filteredPeopleItems = activePeopleSearchResult.items;
  const recentPeopleItems = filteredPeopleItems.slice(0, 4);

  const cargarPersonas = async (mode: Exclude<PeopleAdminMode, null>) => {
    setPeopleLoading(true);
    setPeopleError(null);
    try {
      const rol =
        mode === 'clientes'
          ? 'CLIENTE'
          : mode === 'productores'
            ? 'PRODUCTOR'
            : mode === 'multirol'
              ? 'MULTIROL'
              : undefined;
      const contactos = await listarContactos(rol);
      setContactosAdmin(contactos.map(mapContactoAdmin));
    } catch {
      setPeopleError('No pudimos cargar los contactos. Intenta nuevamente.');
    } finally {
      setPeopleLoading(false);
    }
  };

  const abrirModuloPersonas = (mode: Exclude<PeopleAdminMode, null>) => {
    clearFeedback();
    setPeopleMode(mode);
    setPeopleSearch('');
    setPeopleDetail(null);
    setPeopleEditing(null);
    setPeopleFormErrors({});
    setPeopleFormError(null);
    void cargarPersonas(mode);
  };

  const cerrarModuloPersonas = () => {
    setPeopleMode(null);
    setPeopleDetail(null);
    setPeopleEditing(null);
    setPeopleFormErrors({});
    setPeopleFormError(null);
    setPeopleError(null);
  };

  const confirmarSalidaSinGuardar = () =>
    window.confirm(
      '¿Salir sin guardar?\n\nLos cambios que realizaste se perderán.',
    );

  useEffect(() => {
    const handleNativeBack = (event: Event) => {
      const backEvent = event as CustomEvent<{ pathname?: string }>;
      if (mostrarConfirmacionCerrarSesion) {
        setMostrarConfirmacionCerrarSesion(false);
        backEvent.preventDefault();
        return;
      }
      if (profilePhotoOpen) {
        if ((profileAvatarFile || profileAvatarRemove) && !confirmarSalidaSinGuardar()) {
          backEvent.preventDefault();
          return;
        }
        cancelarEdicionFotoPerfil();
        backEvent.preventDefault();
        return;
      }
      if (profileInfoOpen) {
        const baseline = profileBaselineRef.current;
        const hasProfileChanges = Boolean(
          baseline &&
            (baseline.nombre !== profile.nombre ||
              baseline.correo !== profile.correo ||
              baseline.telefono !== profile.telefono),
        );
        if (hasProfileChanges && !confirmarSalidaSinGuardar()) {
          backEvent.preventDefault();
          return;
        }
        setProfileInfoOpen(false);
        backEvent.preventDefault();
        return;
      }
      if (isViewingPublicProfile) {
        setIsViewingPublicProfile(false);
        backEvent.preventDefault();
        return;
      }
      if (isEditingProfile) {
        cerrarEditorPerfil();
        backEvent.preventDefault();
        return;
      }
      if (bodegaDeleteTarget) {
        setBodegaDeleteTarget(null);
        backEvent.preventDefault();
        return;
      }
      if (bodegaLimitesConfirmOpen) {
        setBodegaLimitesConfirmOpen(false);
        backEvent.preventDefault();
        return;
      }
      if (bodegaLimitesTarget) {
        setBodegaLimitesTarget(null);
        setBodegaLimitesFeedback(null);
        backEvent.preventDefault();
        return;
      }
      if (bodegaLimitesGeneralOpen) {
        setBodegaLimitesGeneralOpen(false);
        setBodegaLimitesFeedback(null);
        setBodegaLimitesConfirmOpen(false);
        backEvent.preventDefault();
        return;
      }
      if (screenReaderSetupPromptOpen) {
        setScreenReaderSetupPromptOpen(false);
        backEvent.preventDefault();
        return;
      }
      if (accessibilityModal) {
        setAccessibilityModal(null);
        backEvent.preventDefault();
        return;
      }
      if (bodegaFormOpen) {
        const original = bodegaEditando;
        const hasBodegaChanges = original
          ? original.nombre !== nombreBodega.trim() ||
            (original.ubicacion ?? '') !== ubicacionBodega.trim() ||
            Math.round(original.capacidadMaxKg) !== Number(capacidadKg)
          : Boolean(
              nombreBodega.trim() ||
                ubicacionBodega.trim() ||
                capacidadKg.trim(),
            );
        if (hasBodegaChanges && !confirmarSalidaSinGuardar()) {
          backEvent.preventDefault();
          return;
        }
        setBodegaFormOpen(false);
        setBodegaEditando(null);
        setBodegaFeedback(null);
        backEvent.preventDefault();
        return;
      }
      if (isEditingBodega) {
        cerrarEditorBodega();
        backEvent.preventDefault();
        return;
      }
      if (isEditingCompany) {
        cerrarEditorEmpresa();
        backEvent.preventDefault();
        return;
      }
      if (isEditingLimites) {
        cerrarEditorLimites();
        backEvent.preventDefault();
        return;
      }
      if (peopleMode) {
        cerrarModuloPersonas();
        backEvent.preventDefault();
      }
    };

    window.addEventListener('cafesmart:native-back', handleNativeBack);
    return () => {
      window.removeEventListener('cafesmart:native-back', handleNativeBack);
    };
  }, [
    accessibilityModal,
    bodegaDeleteTarget,
    bodegaLimitesTarget,
    bodegaLimitesGeneralOpen,
    bodegaLimitesConfirmOpen,
    screenReaderSetupPromptOpen,
    bodegaFormOpen,
    isEditingBodega,
    isEditingCompany,
    isEditingLimites,
    isEditingProfile,
    isViewingPublicProfile,
    mostrarConfirmacionCerrarSesion,
    peopleMode,
    profileInfoOpen,
    profile,
    profileAvatarFile,
    profileAvatarRemove,
    profilePhotoOpen,
    bodegaEditando,
    nombreBodega,
    ubicacionBodega,
    capacidadKg,
  ]);

  const iniciarEdicionPersona = (item: PeopleAdminItem) => {
    setPeopleDetail(null);
    setPeopleEditing(item);
    setPeopleForm({
      nombre: item.nombre,
      tipoDocumento: item.tipoDocumento,
      documento: item.documento,
      telefono: formatPhoneNumber(item.telefono),
      roles: item.roles,
    });
    setPeopleFormErrors({});
    setPeopleFormError(null);
    setPeopleImportedPendingDocument(false);
    setPeopleImportMessage(null);
  };

  const hasPeopleDraftChanges = (item: PeopleAdminItem | null, form: PeopleAdminForm) => {
    if (!item) return false;
    if (!item.id) {
      return Boolean(
        form.nombre.trim() ||
          form.tipoDocumento ||
          form.documento.trim() ||
          form.telefono.trim(),
      );
    }
    const itemRoles = [...item.roles].sort().join(',');
    const formRoles = [...form.roles].sort().join(',');
    return (
      form.nombre.trim() !== item.nombre ||
      form.tipoDocumento !== item.tipoDocumento ||
      normalizeDocumentForStorage(form.documento, item.tipoDocumento) !==
        normalizeDocumentForStorage(item.documento, item.tipoDocumento) ||
      normalizePhoneNumberForStorage(form.telefono) !==
        normalizePhoneNumberForStorage(item.telefono) ||
      itemRoles !== formRoles
    );
  };

  const cerrarEdicionPersona = () => {
    if (hasPeopleDraftChanges(peopleEditing, peopleForm) && peopleEditing) {
      setPeopleDraft({ editing: peopleEditing, form: peopleForm });
      setShowPeopleDraftModal(true);
    }
    setPeopleEditing(null);
    setPeopleFormError(null);
    setPeopleFormErrors({});
    setPeopleImportedPendingDocument(false);
    setPeopleImportMessage(null);
  };

  const iniciarRegistroPersona = () => {
    if (peopleDraft) {
      setShowPeopleDraftModal(true);
      return;
    }
    setPeopleDetail(null);
    setPeopleEditing({
      id: '',
      contactType: peopleMode === 'productores' ? 'productor' : 'cliente',
      nombre: '',
      tipoDocumento: 'CEDULA',
      documento: '',
      telefono: '',
      roles:
        peopleMode === 'productores'
          ? ['PRODUCTOR']
          : peopleMode === 'multirol'
            ? ['CLIENTE', 'PRODUCTOR']
            : ['CLIENTE'],
    });
    setPeopleForm({
      nombre: '',
      tipoDocumento: '',
      documento: '',
      telefono: '',
      roles:
        peopleMode === 'productores'
          ? ['PRODUCTOR']
          : peopleMode === 'multirol'
            ? ['CLIENTE', 'PRODUCTOR']
            : ['CLIENTE'],
    });
    setPeopleFormErrors({});
    setPeopleFormError(null);
    setPeopleImportedPendingDocument(false);
    setPeopleImportMessage(null);
  };

  const aplicarContactoImportadoPersona = (
    contact: DeviceContact,
    phone?: DeviceContactPhone,
  ) => {
    const phoneResult = phone?.number
      ? normalizeImportedContactPhone(phone.number)
      : null;
    const nextForm: PeopleAdminForm = {
      nombre: contact.name?.trim() || peopleForm.nombre,
      tipoDocumento: '',
      documento: '',
      telefono: phoneResult?.formatted ?? peopleForm.telefono,
      roles: peopleForm.roles.length ? peopleForm.roles : ['CLIENTE'],
    };
    const telefonoDuplicado =
      phoneResult?.normalized
        ? contactosAdmin.some(
            (item) =>
              item.roles.some((rol) => nextForm.roles.includes(rol)) &&
              normalizePhoneNumberForStorage(item.telefono) ===
                normalizePhoneNumberForStorage(phoneResult.formatted),
          )
        : false;
    const telefonoWarning = phoneResult
      ? telefonoDuplicado
        ? 'Este celular ya está registrado. Revisa el contacto existente antes de crear uno nuevo.'
        : phoneResult.isColombianMobile
          ? undefined
          : 'Revisa el número importado. Este contacto no tiene un número celular colombiano válido; puedes corregirlo antes de guardar.'
      : 'Este contacto no tiene un número guardado. Puedes ingresarlo manualmente.';

    setPeopleForm(nextForm);
    setPeopleFormErrors({
      tipoDocumento: 'Selecciona el tipo de documento.',
      documento: 'Ingresa el número de documento.',
      telefono: telefonoWarning,
    });
    setPeopleImportedPendingDocument(true);
    setPeopleImportMessage(
      'Contacto importado. Completa el tipo y número de documento antes de guardar este contacto.',
    );
    setPeopleFormError('Falta completar el documento del contacto.');
    setPeoplePhoneChoice(null);
    window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>('[aria-label="Tipo de documento"]')?.focus();
    }, 50);
  };

  const importarPersonaDesdeContactos = async () => {
    if (!canImportDeviceContacts()) {
      setPeopleFormError(
        'La importación de contactos está disponible en la aplicación Android. Puedes registrar los datos manualmente.',
      );
      return;
    }

    try {
      const contact = await pickDeviceContact();
      if (contact.cancelled) return;

      const phones = (contact.phones ?? []).filter((phone) => phone.number?.trim());
      if (phones.length > 1) {
        setPeoplePhoneChoice({ contact, phones });
        return;
      }

      aplicarContactoImportadoPersona(contact, phones[0]);
    } catch (importError) {
      const message =
        importError instanceof Error && importError.message.includes('CONTACTS_PERMISSION_REQUIRED')
          ? 'No pudimos leer el contacto seleccionado. Puedes registrar los datos manualmente o revisar los permisos de contactos en Android.'
          : 'No pudimos importar el contacto seleccionado. Intenta nuevamente o ingresa los datos manualmente.';
      setPeopleFormError(message);
    }
  };

  const validarPersonaEnTiempoReal = (
    nextForm: PeopleAdminForm,
    currentEditing = peopleEditing,
  ) => {
    const nextErrors: Partial<Record<keyof PeopleAdminForm, string>> = {};
    const tipoDocumento = nextForm.tipoDocumento;
    if (!tipoDocumento) {
      setPeopleFormErrors(nextErrors);
      return;
    }

    const documentoNormalizado = normalizeDocumentForStorage(
      nextForm.documento,
      tipoDocumento,
    );
    const telefonoNormalizado = normalizePhoneNumberForStorage(nextForm.telefono);
    const contactos = contactosAdmin.filter(
      (item) =>
        !(
          currentEditing &&
          item.id === currentEditing.id
        ),
    );

    if (documentoNormalizado) {
      const documentoDuplicado = contactos.some(
        (item) =>
          item.roles.some((rol) => nextForm.roles.includes(rol)) &&
          item.tipoDocumento === tipoDocumento &&
          normalizeDocumentForStorage(item.documento, item.tipoDocumento) ===
            documentoNormalizado,
      );
      if (documentoDuplicado) {
        nextErrors.documento =
          tipoDocumento === 'NIT'
            ? 'Ya existe un registro con este NIT.'
            : 'Ya existe un registro con esta cédula.';
      }
    }

    if (telefonoNormalizado) {
      const telefonoDuplicado = contactos.some(
        (item) =>
          item.roles.some((rol) => nextForm.roles.includes(rol)) &&
          normalizePhoneNumberForStorage(item.telefono) === telefonoNormalizado,
      );
      if (telefonoDuplicado) {
        nextErrors.telefono = 'Este número ya está registrado.';
      }
    } else if (nextForm.telefono.trim()) {
      const telefonoValidation = validatePhoneNumber(nextForm.telefono, 'El teléfono', {
        optional: true,
      });
      if (!telefonoValidation.isValid) {
        nextErrors.telefono = telefonoValidation.message;
      }
    }

    setPeopleFormErrors((prev) => ({
      ...prev,
      documento: nextErrors.documento,
      telefono: nextErrors.telefono,
    }));
  };

  const guardarPersona = async () => {
    if (!peopleMode || !peopleEditing) return;
    if (isOffline) {
      setPeopleFormError(OFFLINE_BLOCKED_ACTION_MESSAGE);
      return;
    }

    const tipoDocumento = peopleForm.tipoDocumento;
    const nextErrors: Partial<Record<keyof PeopleAdminForm, string>> = {};
    if (!tipoDocumento) {
      const message =
        'Selecciona el tipo de documento para continuar. Luego podrás ingresar el nombre y documento.';
      nextErrors.tipoDocumento = message;
      setPeopleFormErrors(nextErrors);
      setPeopleFormError(message);
      return;
    }

    const nombreNormalizado =
      tipoDocumento === 'NIT'
        ? normalizeCompanyName(peopleForm.nombre)
        : normalizeHumanName(peopleForm.nombre);
    const documentoNormalizado = normalizeDocumentForStorage(
      peopleForm.documento,
      tipoDocumento,
    );
    const telefonoNormalizado = normalizePhoneNumberForStorage(peopleForm.telefono);
    const nombreValidation =
      tipoDocumento === 'NIT'
        ? validateCompanyName(peopleForm.nombre)
        : validatePersonName(peopleForm.nombre, 'El nombre');
    const documentoValidation = validateDocumentNumber(peopleForm.documento, 'El documento', {
      type: tipoDocumento,
    });
    const telefonoValidation = validatePhoneNumber(peopleForm.telefono, 'El teléfono', {
      optional: true,
    });
    if (!nombreValidation.isValid) nextErrors.nombre = nombreValidation.message;
    if (!documentoValidation.isValid) nextErrors.documento = documentoValidation.message;
    if (!telefonoValidation.isValid) nextErrors.telefono = telefonoValidation.message;
    if (peopleForm.roles.length === 0) {
      nextErrors.roles = 'Selecciona al menos un rol para el contacto.';
    }

    const duplicated = contactosAdmin.find(
      (item) =>
        item.id !== peopleEditing.id &&
        item.roles.some((rol) => peopleForm.roles.includes(rol)) &&
        item.tipoDocumento === tipoDocumento &&
        normalizeDocumentForStorage(item.documento, item.tipoDocumento) === documentoNormalizado,
    );

    if (duplicated) {
      nextErrors.documento =
        tipoDocumento === 'NIT'
          ? 'Ya existe un registro con este NIT.'
          : 'Ya existe un registro con esta cédula.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setPeopleFormErrors(nextErrors);
      setPeopleFormError(
        nextErrors.nombre ??
          nextErrors.tipoDocumento ??
          nextErrors.documento ??
          nextErrors.telefono ??
          'Revisa los datos para continuar.',
      );
      return;
    }

    setPeopleLoading(true);
    try {
      const payload = {
        nombre: nombreNormalizado,
        tipoDocumento,
        documento: documentoNormalizado,
        telefono: telefonoNormalizado || undefined,
        roles: peopleForm.roles,
      };
      const saved = mapContactoAdmin(
        peopleEditing.id
          ? await actualizarContacto(peopleEditing.id, payload)
          : await crearContacto(payload),
      );
      setContactosAdmin((items) => [
        saved,
        ...items.filter((item) => item.id !== saved.id),
      ]);
      setPeopleEditing(null);
      setPeopleDraft(null);
      setShowPeopleDraftModal(false);
      setPeopleFormErrors({});
      setPeopleFormError(null);
      setSuccess(
        peopleEditing.id
          ? 'Contacto actualizado correctamente.'
          : 'Contacto registrado correctamente.',
      );
    } catch (err) {
      const apiError = err as {
        status?: number;
        code?: string;
        message?: string;
        details?: Record<string, unknown> | null;
      };
      if (apiError.code === 'CONTACT_ROLE_CAN_BE_ADDED') {
        const contactId =
          typeof apiError.details?.contactId === 'string'
            ? apiError.details.contactId
            : null;
        const missingRoles = Array.isArray(apiError.details?.missingRoles)
          ? (apiError.details.missingRoles.filter(
              (rol): rol is ContactoRol => rol === 'CLIENTE' || rol === 'PRODUCTOR',
            ))
          : peopleForm.roles;
        const roleLabel = missingRoles.includes('CLIENTE')
          ? 'cliente'
          : 'productor';
        const shouldAddRole = window.confirm(
          `Este contacto ya está registrado. ¿Deseas agregarle también el rol de ${roleLabel}?`,
        );

        if (shouldAddRole && contactId) {
          const saved = mapContactoAdmin(
            await missingRoles.reduce(
              async (previous, rol) => agregarRolContacto((await previous).id, rol),
              Promise.resolve({ id: contactId } as ContactoItem),
            ),
          );
          setContactosAdmin((items) => [
            saved,
            ...items.filter((item) => item.id !== saved.id),
          ]);
          setPeopleEditing(null);
          setPeopleDraft(null);
          setShowPeopleDraftModal(false);
          setPeopleFormErrors({});
          setPeopleFormError(null);
          setSuccess(
            missingRoles.length > 1
              ? 'Contacto Multirol actualizado.'
              : `Rol de ${roleLabel} agregado correctamente.`,
          );
          return;
        }

        const message =
          missingRoles.includes('CLIENTE')
            ? 'Este contacto ya está registrado como productor. Puedes agregarle el rol de cliente sin duplicar sus datos.'
            : 'Este contacto ya está registrado como cliente. Puedes agregarle el rol de productor sin duplicar sus datos.';
        setPeopleFormErrors((current) => ({
          ...current,
          documento: message,
        }));
        setPeopleFormError(message);
        return;
      }
      if (
        apiError.status === 409 ||
        apiError.code === 'DOCUMENT_ALREADY_EXISTS' ||
        /documento|registrad|duplicad/i.test(apiError.message ?? '')
      ) {
        const message =
          apiError.code === 'CONTACT_ROLE_CAN_BE_ADDED'
            ? 'Este contacto ya está registrado. Puedes agregarle otro rol sin duplicar su información.'
            : apiError.code === 'CONTACT_ALREADY_HAS_ROLES'
              ? 'Este contacto ya tiene los roles seleccionados.'
              : 'Ya existe un contacto con este tipo y número de documento.';
        setPeopleFormErrors((current) => ({
          ...current,
          documento: message,
        }));
        setPeopleFormError(message);
        return;
      }

      const message =
        err instanceof Error
          ? err.message
          : `No pudimos guardar el ${activePeopleSingular}.`;
      setPeopleFormError(message);
    } finally {
      setPeopleLoading(false);
    }
  };

  const eliminarPersona = async (item: PeopleAdminItem) => {
    setPeopleError(null);
    if (isOffline) {
      setPeopleError(OFFLINE_BLOCKED_ACTION_MESSAGE);
      return;
    }

    setPeopleLoading(true);
    try {
      await Promise.all([
        item.clienteId ? eliminarCliente(item.clienteId) : Promise.resolve(),
        item.productorId ? eliminarProductor(item.productorId) : Promise.resolve(),
      ]);
      setContactosAdmin((items) => items.filter((current) => current.id !== item.id));
      setPeopleDetail(null);
      setSuccess('Contacto desactivado correctamente.');
    } catch {
      setPeopleError(
        'No pudimos eliminar el contacto. Revisa tu conexión e intenta nuevamente.',
      );
    } finally {
      setPeopleLoading(false);
    }
  };

  const cerrarSesion = async () => {
    setMostrarConfirmacionCerrarSesion(false);
    setCerrandoSesion(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setCerrandoSesion(false);
    }
  };

  const reintentarSincronizacion = async () => {
    if (isOffline) {
      setSyncFeedback({
        variant: 'warning',
        message: OFFLINE_BLOCKED_ACTION_MESSAGE,
      });
      return;
    }

    setSyncFeedback(null);
    setSyncAllRetrying(true);
    try {
      getSyncQueue()
        .filter((operation) => operation.estado === 'ERROR')
        .forEach((operation) => retryOperation(operation.idLocal));
      const result = await syncAllPending();
      setSyncQueue(getSyncQueue());
      setSyncSummary(getSyncQueueSummary());
      setSyncFeedback({
        variant: result.failed > 0 ? 'error' : 'success',
        message:
          result.failed > 0
            ? 'No pudimos sincronizar todos los registros. Revisa la información e intenta nuevamente.'
            : 'Registro sincronizado correctamente.',
      });
    } finally {
      setSyncAllRetrying(false);
    }
  };

  const reintentarOperacionSync = async (operation: SyncOperation) => {
    if (isOffline) {
      setSyncFeedback({
        variant: 'warning',
        message: OFFLINE_BLOCKED_ACTION_MESSAGE,
      });
      return;
    }

    setSyncFeedback(null);
    setRetryingSyncIds((current) =>
      current.includes(operation.idLocal) ? current : [...current, operation.idLocal],
    );
    retryOperation(operation.idLocal);

    try {
      await syncOperationById(operation.idLocal);
      const updatedQueue = getSyncQueue();
      const updatedOperation = updatedQueue.find(
        (item) => item.idLocal === operation.idLocal,
      );
      setSyncQueue(updatedQueue);
      setSyncSummary(getSyncQueueSummary());
      setSyncFeedback({
        variant: updatedOperation?.estado === 'SINCRONIZADO' ? 'success' : 'error',
        message:
          updatedOperation?.estado === 'SINCRONIZADO'
            ? 'Registro sincronizado correctamente.'
            : 'No pudimos sincronizar este registro. Revisa la información e intenta nuevamente.',
      });
    } finally {
      setRetryingSyncIds((current) =>
        current.filter((idLocal) => idLocal !== operation.idLocal),
      );
    }
  };

  const confirmarEliminarOperacionSync = () => {
    if (!syncDeleteCandidate) return;
    deleteSyncOperation(syncDeleteCandidate.idLocal);
    setSyncDeleteCandidate(null);
    setSyncQueue(getSyncQueue());
    setSyncSummary(getSyncQueueSummary());
    setSyncFeedback({
      variant: 'success',
      message: 'Registro local eliminado de la cola de sincronización.',
    });
  };

  const procesosOperativos = [
    {
      id: 'secado',
      title: 'Secado',
      description: 'Revisa procesos de secado.',
      icon: Droplets,
      iconStyle: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
      onClick: () => {
        setSecadoError(null);
        navigate('/inventario/secado/inicio', { state: { from: '/ajustes' } });
      },
    },
    {
      id: 'gastos',
      title: 'Gastos',
      description: 'Consulta y registra gastos.',
      icon: Wallet,
      iconStyle: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
      onClick: () => navigate('/gastos'),
    },
    {
      id: 'sincronizacion',
      title: 'Sincronización',
      description: `${syncSummary.pendientes} pendientes · ${syncSummary.errores} con error`,
      icon: CloudCog,
      iconStyle: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
      onClick: () => setSyncPanelOpen((current) => !current),
    },
  ] as const;

  const configuracionNegocio = [
    {
      id: 'info-empresa',
      title: 'Negocio',
      description: 'Nombre, tipo y descripción',
      icon: Building2,
      iconStyle: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
      staticOnly: false,
      onClick: abrirEditorEmpresa,
    },
    {
      id: 'tipos-cafe',
      title: 'Tipos de café',
      description: 'Variedades registradas',
      icon: FlaskConical,
      iconStyle: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
      staticOnly: true,
      onClick: undefined,
    },
    {
      id: 'calidades-cafe',
      title: 'Calidades de café',
      description: 'Estándares de calidad',
      icon: ScanSearch,
      iconStyle: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
      staticOnly: true,
      onClick: undefined,
    },
    {
      id: 'capacidad-bodega',
      title: 'Bodega',
      description: 'Espacio de bodega',
      icon: Warehouse,
      iconStyle: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
      staticOnly: false,
      onClick: abrirEditorBodega,
    },
    {
      id: 'gestion-usuarios',
      title: 'Usuarios',
      description: 'Roles y permisos',
      icon: Users,
      iconStyle: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100',
      staticOnly: true,
      onClick: undefined,
    },
    {
      id: 'contacto-soporte',
      title: 'Soporte',
      description: 'Ayuda y reportes',
      icon: LifeBuoy,
      iconStyle: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
      staticOnly: false,
      onClick: () => navigate('/soporte'),
    },
  ] as const;
  const configuracionNegocioInactiva = new Set([
    'tipos-cafe',
    'calidades-cafe',
    'gestion-usuarios',
  ]);

  const gestionPersonas = [
    {
      id: 'gestion-contactos',
      title: 'Contactos',
      description: 'Clientes y productores registrados',
      icon: Users2,
      iconStyle: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
      onClick: () => void cargarPersonasAdmin('todos'),
    },
    {
      id: 'usuarios-sistema',
      title: 'Usuarios del sistema',
      description: 'Roles y permisos',
      icon: Shield,
      iconStyle: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100',
      onClick: undefined,
    },
  ] as const;

  if (cerrandoSesion) {
    return (
      <AppLoadingScreen
        title="Cerrando sesión"
        subtitle="Estamos protegiendo tus datos antes de salir."
      />
    );
  }

  const themeOptions = [
    {
      value: 'light' as const,
      label: 'Claro',
      description: 'Usa siempre colores claros.',
      icon: Sun,
    },
    {
      value: 'dark' as const,
      label: 'Oscuro',
      description: 'Usa siempre colores oscuros.',
      icon: Moon,
    },
    {
      value: 'system' as const,
      label: 'Sistema',
      description: 'Se adapta automáticamente al dispositivo.',
      icon: Monitor,
    },
  ];

  const systemScreenReaderActive =
    isSystemScreenReaderActive(systemScreenReaderStatus);
  const screenReaderStatusTitle = screenReaderStatusLoading
    ? 'Comprobando lector de pantalla'
    : systemScreenReaderActive
      ? 'Lector de pantalla activo'
      : 'TalkBack no está activo';
  const screenReaderStatusDescription = systemScreenReaderActive
    ? 'Café Smart está preparado para funcionar con el lector de tu dispositivo.'
    : 'Abre los ajustes de accesibilidad para activarlo.';

  const accessibilityCards = [
    {
      id: 'screen-reader',
      title: 'Lector de pantalla',
      description: 'Mejora la navegación con asistencia',
      status: screenReaderStatusTitle,
      icon: ScanSearch,
      iconStyle: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
      onClick: () => setAccessibilityModal('screen-reader' as const),
    },
    {
      id: 'high-contrast',
      title: 'Alto contraste',
      description: 'Aumenta textos, bordes y contraste',
      status: accessibilityPreferences.highContrast
        ? 'Activado'
        : 'Desactivado',
      icon: Eye,
      iconStyle: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
      onClick: () => setAccessibilityModal('high-contrast' as const),
    },
    {
      id: 'font-scale',
      title: 'Tamaño de fuente',
      description: 'Ajusta el texto en toda la app',
      status:
        accessibilityPreferences.fontScale === 'xlarge'
          ? 'Extra grande'
          : accessibilityPreferences.fontScale === 'large'
            ? 'Grande'
            : 'Normal',
      icon: Settings,
      iconStyle: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
      onClick: () => setAccessibilityModal('font-scale' as const),
    },
    {
      id: 'permissions',
      title: 'Permisos',
      description: 'Cámara, fotos y notificaciones',
      status: permissionsLoading ? 'Consultando' : 'Configurar',
      icon: Shield,
      iconStyle: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
      onClick: () => setAccessibilityModal('permissions' as const),
    },
  ] as const;

  const binaryAccessibilityOptions = [
    { value: false, label: 'Desactivado' },
    { value: true, label: 'Activado' },
  ] as const;

  const fontScaleOptions: Array<{
    value: FontScalePreference;
    label: string;
    description: string;
  }> = [
    {
      value: 'normal',
      label: 'Normal',
      description: 'Usa el tamaño actual de CaféSmart.',
    },
    {
      value: 'large',
      label: 'Grande',
      description: 'Aumenta el texto aproximadamente 12.5%.',
    },
    {
      value: 'xlarge',
      label: 'Extra grande',
      description: 'Aumenta el texto aproximadamente 25%.',
    },
  ];

  const permissionRows = [
    {
      id: 'camera' as const,
      title: 'Cámara',
      description: 'Se usa para tomar fotos de perfil y adjuntar comprobantes.',
      icon: Camera,
      status: permissionStatuses?.camera,
    },
    {
      id: 'photos' as const,
      title: 'Fotos',
      description: 'Se usa para seleccionar imágenes desde el dispositivo.',
      icon: ImageIcon,
      status: permissionStatuses?.photos,
    },
    {
      id: 'notifications' as const,
      title: 'Notificaciones',
      description: 'Se usa para avisos de inventario, secado y movimientos.',
      icon: BellRing,
      status: permissionStatuses?.notifications,
    },
  ];

  const formatPermissionState = (state?: string) => {
    if (state === 'granted') return 'Permitido';
    if (state === 'limited') return 'Limitado';
    if (state === 'denied') return 'No permitido';
    return isNativeAndroid() ? 'No disponible' : 'Solo Android';
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 pb-[150px] text-slate-900 dark:bg-none dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-[430px] flex-col gap-4">
        <header className="flex items-center justify-center py-1">
          <h1 className="text-[1.7rem] font-black tracking-tight text-[#121826] dark:text-slate-100">
            Ajustes
          </h1>
        </header>

        <CafeSmartModal
          open={themeModalOpen}
          onClose={() => setThemeModalOpen(false)}
          labelledById="theme-modal-title"
          title="Tema visual"
          description="Elige cómo quieres ver CaféSmart."
        >
          <div className="space-y-3" role="radiogroup" aria-label="Tema visual">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const active = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  {...ariaChecked(active)}
                  onClick={() => setTheme(option.value)}
                  className={`flex w-full items-center gap-3 rounded-[16px] border px-4 py-3 text-left transition ${
                    active
                      ? 'border-[#102d92] bg-[#eef4ff] shadow-sm dark:border-slate-300 dark:bg-slate-800'
                      : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                  }`}
                >
                  <span
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${
                      active
                        ? 'bg-[#102d92] text-white dark:bg-slate-100 dark:text-slate-950'
                        : 'bg-[#eff4ff] text-[#2c57cc] dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-slate-950 dark:text-slate-100">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">
                      {option.description}
                    </span>
                  </span>
                  <span
                    className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${
                      active
                        ? 'bg-[#102d92] dark:bg-emerald-500'
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                    aria-hidden="true"
                  >
                    <span
                      className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${
                        active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </CafeSmartModal>

        <CafeSmartModal
          open={accessibilityModal === 'screen-reader'}
          onClose={() => setAccessibilityModal(null)}
          labelledById="screen-reader-modal-title"
          title="Lector de pantalla"
          description="Usa TalkBack para escuchar y controlar Café Smart."
        >
          <div
            role="status"
            aria-live="polite"
            className={`mb-3 rounded-[16px] border px-4 py-3 ${
              systemScreenReaderActive
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100'
                : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100'
            }`}
          >
            <p className="text-sm font-black">{screenReaderStatusTitle}</p>
            <p className="mt-1 text-xs font-semibold leading-5">
              {screenReaderStatusDescription}
            </p>
          </div>
          {systemScreenReaderActive ? (
            <p className="rounded-[14px] bg-[#f8faff] px-4 py-3 text-sm font-bold text-slate-600 dark:bg-slate-950 dark:text-slate-200">
              TalkBack está activo. Café Smart está listo para usarse con lector de pantalla.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setScreenReaderSetupPromptOpen(true)}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white dark:bg-blue-600"
            >
              Configurar TalkBack
            </button>
          )}
        </CafeSmartModal>

        <CafeSmartModal
          open={accessibilityModal === 'permissions'}
          onClose={() => setAccessibilityModal(null)}
          labelledById="permissions-modal-title"
          title="Permisos de la aplicación"
          description="Controla qué funciones del dispositivo puede utilizar Café Smart."
        >
          <div className="space-y-3">
            {permissionsFeedback ? (
              <AppFeedbackMessage
                variant={permissionsFeedback.variant}
                description={permissionsFeedback.message}
              />
            ) : null}
            {permissionRows.map((permission) => {
              const Icon = permission.icon;
              return (
                <article
                  key={permission.id}
                  className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-slate-950 dark:text-slate-50">
                        {permission.title}
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">
                        {permission.description}
                      </p>
                      <p className="mt-2 text-xs font-black text-[#102d92] dark:text-blue-200">
                        Estado: {permissionsLoading ? 'Consultando...' : formatPermissionState(permission.status?.state)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void abrirAjustesAplicacion()}
                      className="shrink-0 rounded-full border border-[#d5deee] bg-white px-3 py-1.5 text-xs font-black text-[#334b85] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                      Configurar
                    </button>
                  </div>
                </article>
              );
            })}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => void cargarEstadosPermisos()}
                disabled={permissionsLoading}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[14px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#334b85] disabled:cursor-wait disabled:opacity-70 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {permissionsLoading ? (
                  <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCcw size={15} aria-hidden="true" />
                )}
                Recargar
              </button>
              <button
                type="button"
                onClick={() => void abrirAjustesAplicacion()}
                className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white dark:bg-blue-600"
              >
                Abrir ajustes
              </button>
            </div>
          </div>
        </CafeSmartModal>

        {screenReaderSetupPromptOpen ? (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="activar-lector-pantalla-title"
              className="w-full max-w-[380px] rounded-[22px] border border-[#dbe5f7] bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3
                    id="activar-lector-pantalla-title"
                    className="text-lg font-black text-slate-950 dark:text-slate-50"
                  >
                    Activa el lector de pantalla del celular
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-5 text-slate-600 dark:text-slate-200">
                    El modo compatible de Café Smart está listo, pero debes activar TalkBack desde los ajustes de accesibilidad de tu dispositivo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void cerrarSugerenciaLectorPantalla()}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-200"
                  aria-label="Cerrar ayuda de lector de pantalla"
                >
                  <X size={17} />
                </button>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void cerrarSugerenciaLectorPantalla()}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#334b85] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  Ahora no
                </button>
                <button
                  type="button"
                  onClick={() => void abrirAccesibilidadDesdeSugerencia()}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white dark:bg-blue-600"
                >
                  Abrir accesibilidad
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <CafeSmartModal
          open={accessibilityModal === 'high-contrast'}
          onClose={() => setAccessibilityModal(null)}
          labelledById="high-contrast-modal-title"
          title="Texto de alto contraste"
          description="Aumenta el contraste para facilitar la lectura de textos, alertas y botones."
        >
          <div
            className="space-y-3"
            role="radiogroup"
            aria-label="Texto de alto contraste"
          >
            {binaryAccessibilityOptions.map((option) => {
              const active = accessibilityPreferences.highContrast === option.value;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  role="radio"
                  {...ariaChecked(active)}
                  onClick={() => setHighContrast(option.value)}
                  className={`flex w-full items-center gap-3 rounded-[16px] border px-4 py-3 text-left transition ${
                    active
                      ? 'border-[#102d92] bg-[#eef4ff] shadow-sm dark:border-blue-300 dark:bg-blue-500/15'
                      : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800'
                  }`}
                >
                  <span
                    className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${
                      active ? 'bg-[#102d92] dark:bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                    aria-hidden="true"
                  >
                    <span
                      className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${
                        active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-slate-950 dark:text-slate-50">
                      {option.label}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </CafeSmartModal>

        <CafeSmartModal
          open={accessibilityModal === 'font-scale'}
          onClose={() => setAccessibilityModal(null)}
          labelledById="font-scale-modal-title"
          title="Tamaño de fuente"
          description="Elige el tamaño de texto que te resulte más cómodo."
        >
          <div
            className="space-y-3"
            role="radiogroup"
            aria-label="Tamaño de fuente"
          >
            {fontScaleOptions.map((option) => {
              const active = accessibilityPreferences.fontScale === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  {...ariaChecked(active)}
                  onClick={() => setFontScale(option.value)}
                  className={`flex w-full items-center gap-3 rounded-[16px] border px-4 py-3 text-left transition ${
                    active
                      ? 'border-[#102d92] bg-[#eef4ff] shadow-sm dark:border-blue-300 dark:bg-blue-500/15'
                      : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800'
                  }`}
                >
                  <span
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                      active
                        ? 'border-[#102d92] bg-[#102d92] dark:border-blue-300 dark:bg-blue-500'
                        : 'border-slate-300 bg-white dark:border-slate-500 dark:bg-slate-900'
                    }`}
                    aria-hidden="true"
                  >
                    {active ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-white" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-slate-950 dark:text-slate-50">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs font-semibold leading-5 text-slate-500 dark:text-slate-200">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </CafeSmartModal>

        <p className="pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">
          PERFIL
        </p>
        <section className="rounded-[20px] border border-[#e6e8f3] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div
            role="button"
            tabIndex={0}
            onClick={abrirEditorPerfil}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                abrirEditorPerfil();
              }
            }}
            className="flex cursor-pointer items-center gap-3 rounded-[16px] outline-none transition focus-visible:ring-4 focus-visible:ring-[#102d92]/15"
            aria-label="Abrir editar perfil"
          >
            <div className="relative shrink-0">
              <div className="h-14 w-14 overflow-hidden rounded-full bg-[#eef2ff] p-1 shadow-inner">
                {currentAvatarUrl ? (
                  <img
                    src={currentAvatarUrl}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[#102d92]">
                    <UserCircle2 size={28} />
                  </div>
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[1.1rem] font-semibold text-[#121826] dark:text-slate-50">
                {profile.nombre || 'Administrador'}
              </h2>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-300">
                {getBusinessTypeLabel(company.tipoEmpresa) || 'Administrador'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ChevronRight size={17} className="text-slate-400" aria-hidden="true" />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setMostrarConfirmacionCerrarSesion(true);
                }}
                disabled={cerrandoSesion}
                aria-label={cerrandoSesion ? 'Cerrando sesión' : 'Cerrar sesión'}
                title="Cerrar sesión"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#fee2e2] text-rose-700 transition hover:bg-[#fecaca] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>

          {mostrarConfirmacionCerrarSesion ? (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
              onClick={() => setMostrarConfirmacionCerrarSesion(false)}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="cerrar-sesion-title"
                className="w-full max-w-[390px] rounded-[22px] border border-[#dbe5f7] bg-[#f8fbff] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.24)] animate-[cafesmartFadeUp_220ms_ease-out_both] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                  <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-100 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/30">
                    <LogOut size={22} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2
                      id="cerrar-sesion-title"
                      className="text-lg font-black text-slate-950 dark:text-slate-50"
                    >
                      ¿Cerrar sesión?
                    </h2>
                    <p className="mt-1 text-sm font-semibold leading-5 text-slate-600 dark:text-slate-200">
                      Tu sesión se cerrará en este dispositivo.
                    </p>
                  </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMostrarConfirmacionCerrarSesion(false)}
                    aria-label="Cerrar confirmación"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                  >
                    <X size={17} aria-hidden="true" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 max-[330px]:grid-cols-1">
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setMostrarConfirmacionCerrarSesion(false)}
                    className="inline-flex h-12 items-center justify-center rounded-[14px] border border-[#dbe5f7] bg-white px-4 text-sm font-black text-[#1f3fa7] shadow-sm transition hover:bg-[#f3f6ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#274ab8]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    Permanecer
                  </button>
                  <button
                    type="button"
                    disabled={cerrandoSesion}
                    onClick={() => void cerrarSesion()}
                    className="inline-flex h-12 items-center justify-center rounded-[14px] bg-rose-600 px-4 text-sm font-black text-white shadow-[0_12px_26px_rgba(225,29,72,0.24)] transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-500/20 disabled:cursor-wait disabled:opacity-70 dark:bg-rose-500 dark:hover:bg-rose-400"
                  >
                    {cerrandoSesion ? 'Cerrando...' : 'Cerrar sesión'}
                  </button>
                </div>
              </section>
            </div>
          ) : null}

          {isViewingPublicProfile ? (
            <div
              className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 px-3 pb-3 pt-3 backdrop-blur-sm sm:items-center"
              onClick={() => setIsViewingPublicProfile(false)}
            >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="perfil-usuario-title"
              className="max-h-[86dvh] w-full max-w-[430px] overflow-y-auto rounded-[24px] border border-[#dbe5f7] bg-[#f8fbff] p-4 shadow-[0_24px_70px_rgba(15,23,42,0.24)] animate-[cafesmartFadeUp_220ms_ease-out_both]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 id="perfil-usuario-title" className="text-base font-black text-slate-950">
                  Perfil de usuario
                </h3>
                <button
                  type="button"
                  onClick={() => setIsViewingPublicProfile(false)}
                  aria-label="Cerrar perfil de usuario"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#102d92] text-base font-black text-white">
                  {currentAvatarUrl ? (
                    <img
                      src={currentAvatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials(profile.nombre || company.nombreEmpresa)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-slate-900">
                    {company.nombreEmpresa || profile.nombre || 'CaféSmart'}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">
                    {getBusinessTypeLabel(company.tipoEmpresa) || 'Compraventa'}
                  </p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                  Activo
                </span>
              </div>
              <div className="mt-4 grid gap-2 text-sm">
                <p className="rounded-[14px] bg-white px-3 py-2 font-semibold text-slate-700">
                  <span className="block text-[0.66rem] font-black uppercase tracking-[0.08em] text-slate-400">
                    Nombre completo
                  </span>
                  {profile.nombre || 'Nombre no registrado'}
                </p>
                <p className="rounded-[14px] bg-white px-3 py-2 font-semibold text-slate-700">
                  <span className="block text-[0.66rem] font-black uppercase tracking-[0.08em] text-slate-400">
                    Nombre de usuario
                  </span>
                  {user?.name || profile.nombre || 'Usuario no registrado'}
                </p>
                <p className="rounded-[14px] bg-white px-3 py-2 font-semibold text-slate-700">
                  <span className="block text-[0.66rem] font-black uppercase tracking-[0.08em] text-slate-400">
                    Correo electrónico
                  </span>
                  {profile.correo || 'Correo no registrado'}
                </p>
                <p className="rounded-[14px] bg-white px-3 py-2 font-semibold text-slate-700">
                  <span className="block text-[0.66rem] font-black uppercase tracking-[0.08em] text-slate-400">
                    Teléfono
                  </span>
                  {profile.telefono
                    ? formatPhoneNumber(profile.telefono)
                    : 'Teléfono no registrado'}
                </p>
                <p className="rounded-[14px] bg-white px-3 py-2 font-semibold text-slate-700">
                  <span className="block text-[0.66rem] font-black uppercase tracking-[0.08em] text-slate-400">
                    Tipo de negocio
                  </span>
                  {getBusinessTypeLabel(company.tipoEmpresa) || 'Compraventa'}
                </p>
                <p className="rounded-[14px] bg-white px-3 py-2 font-semibold text-slate-700">
                  <span className="block text-[0.66rem] font-black uppercase tracking-[0.08em] text-slate-400">
                    Descripción del negocio
                  </span>
                  {company.descripcion.trim() || 'Sin descripción registrada.'}
                </p>
                <p className="rounded-[14px] bg-white px-3 py-2 font-semibold text-emerald-700">
                  <span className="block text-[0.66rem] font-black uppercase tracking-[0.08em] text-emerald-500">
                    Estado
                  </span>
                  Activo
                </p>
              </div>
              <button
                type="button"
                onClick={abrirEditorPerfil}
                className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center rounded-[14px] border border-[#cdd8ef] bg-white px-4 text-sm font-black text-[#102d92]"
              >
                Editar perfil
              </button>
            </section>
            </div>
          ) : null}

          {isEditingProfile ? (
            <div
              className="fixed inset-0 z-[90] flex items-stretch justify-center bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6"
              onClick={cerrarEditorPerfil}
            >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="editar-perfil-title"
              className="flex h-[100dvh] w-full max-w-[520px] flex-col overflow-hidden bg-[#f8fbff] text-slate-950 shadow-[0_24px_70px_rgba(15,23,42,0.24)] animate-[cafesmartFadeUp_220ms_ease-out_both] dark:bg-slate-950 dark:text-slate-100 sm:h-[min(92dvh,820px)] sm:rounded-[26px]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="shrink-0 border-b border-slate-200 bg-white px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 id="editar-perfil-title" className="text-xl font-black">
                    Editar perfil
                  </h3>
                  <p className="mt-1 text-sm font-semibold leading-5 text-slate-500 dark:text-slate-300">
                    Gestiona tu información personal y la foto de perfil.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cerrarEditorPerfil}
                  aria-label="Cerrar edición de perfil"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500 transition hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-col items-center text-center">
                  <div className="h-24 w-24 overflow-hidden rounded-full bg-[#eef4ff] p-1 ring-1 ring-[#dbe6ff] dark:bg-slate-800 dark:ring-slate-700">
                    {currentAvatarUrl ? (
                      <img
                        src={currentAvatarUrl}
                        alt="Foto de perfil"
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-[#eaf0ff] text-2xl font-black text-[#102d92]">
                        {getInitials(profile.nombre || company.nombreEmpresa)}
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-base font-black">{profile.nombre || 'Administrador'}</p>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                    {company.nombreEmpresa || 'Negocio sin nombre'}
                  </p>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(event) => void seleccionarFotoPerfil(event)}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={abrirPerfilPublico}
                  className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[14px] border border-[#d5deee] bg-white px-3 text-sm font-black text-[#334b85] dark:border-slate-700 dark:bg-slate-900 dark:text-blue-100"
                >
                  <Eye size={15} /> Ver perfil
                </button>
                <button
                  type="button"
                  onClick={() => setProfileInfoOpen(true)}
                  className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-3 text-sm font-black text-white dark:bg-blue-600"
                >
                  <Pencil size={15} /> Editar información
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProfilePhotoOpen(true);
                  setProfileFeedback(null);
                }}
                className="mt-2 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#d5deee] bg-white px-3 text-sm font-black text-[#334b85] dark:border-slate-700 dark:bg-slate-900 dark:text-blue-100"
              >
                <Pencil size={15} /> Editar foto
              </button>
              {profileFeedback ? (
                <AppFeedbackMessage
                  variant={profileFeedback.variant}
                  description={profileFeedback.message}
                  className="mt-4"
                />
              ) : null}
              {error && activeErrorSection === 'profile' ? (
                <AppFeedbackMessage
                  variant="error"
                  description="No pudimos actualizar tu perfil. Intenta de nuevo."
                  className="mt-4"
                />
              ) : null}
              {profilePhotoOpen ? (
                <div className="fixed inset-0 z-[112] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
                  <section
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="editar-foto-perfil-title"
                    className="w-full max-w-[380px] rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h4
                          id="editar-foto-perfil-title"
                          className="text-lg font-black text-slate-950 dark:text-slate-100"
                        >
                          Editar foto
                        </h4>
                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                          Revisa la vista previa antes de guardar.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={cancelarEdicionFotoPerfil}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-200"
                        aria-label="Cerrar edición de foto"
                      >
                        <X size={17} />
                      </button>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <div className="h-28 w-28 overflow-hidden rounded-full bg-[#eef4ff] p-1 ring-1 ring-[#dbe6ff] dark:bg-slate-800 dark:ring-slate-700">
                        {currentAvatarUrl ? (
                          <img
                            src={currentAvatarUrl}
                            alt="Foto de perfil"
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center rounded-full bg-[#eaf0ff] text-2xl font-black text-[#102d92]">
                            {getInitials(profile.nombre || company.nombreEmpresa)}
                          </div>
                        )}
                      </div>
                      <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-300">
                        La foto se guardará solo cuando pulses Guardar cambios.
                      </p>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] bg-[#102d92] px-3 text-sm font-black text-white dark:bg-blue-600"
                      >
                        Cambiar foto
                      </button>
                      <button
                        type="button"
                        onClick={quitarFotoPerfil}
                        disabled={!currentAvatarUrl}
                        className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-3 text-sm font-black text-[#334b85] transition disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        Quitar foto
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void guardarFotoPerfil()}
                        disabled={guardandoPerfil || (!profileAvatarFile && !profileAvatarRemove)}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] bg-[#1683f7] px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {guardandoPerfil ? (
                          <LoaderCircle size={15} className="animate-spin" />
                        ) : (
                          <Save size={15} />
                        )}
                        {guardandoPerfil ? 'Guardando foto...' : 'Guardar cambios'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelarEdicionFotoPerfil}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-3 text-sm font-black text-[#334b85] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        Cancelar
                      </button>
                    </div>
                  </section>
                </div>
              ) : null}
              {profileInfoOpen ? (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
                  <section
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="editar-info-perfil-title"
                    className="max-h-[88dvh] w-full max-w-[400px] overflow-y-auto rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h4
                          id="editar-info-perfil-title"
                          className="text-lg font-black text-slate-950 dark:text-slate-100"
                        >
                          Editar información
                        </h4>
                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                          Actualiza tus datos personales.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProfileInfoOpen(false)}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-200"
                        aria-label="Cerrar edición de información"
                      >
                        <X size={17} />
                      </button>
                    </div>
                    <div className="space-y-4">
              <div>
              <label className={fieldLabelClass}>
                Nombre completo
              </label>
              <input
                type="text"
                value={profile.nombre}
                maxLength={PROFILE_NAME_MAX_LENGTH}
                onChange={(event) => {
                  const next = event.target.value.slice(0, PROFILE_NAME_MAX_LENGTH);
                  if (event.target.value.length >= PROFILE_NAME_MAX_LENGTH) {
                    setNombreLimitNotice(true);
                  }
                  setProfile((prev) => ({
                    ...prev,
                    nombre: next,
                  }));
                  setProfileErrors((prev) => ({
                    ...prev,
                    nombre: undefined,
                  }));
                  clearFeedback();
                }}
                onBlur={() => {
                  const nombreError = validateProfileName(profile.nombre);
                  setProfileErrors((prev) => ({
                    ...prev,
                    nombre: nombreError ?? undefined,
                  }));
                }}
                className={`${fieldInputClass}`}
                placeholder="Nombre completo"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] font-bold">
                <span className="text-amber-700">
                  {nombreLimitNotice ? 'Llegaste al límite.' : ''}
                </span>
                <span className="text-slate-500">
                  {profile.nombre.length}/{PROFILE_NAME_MAX_LENGTH}
                </span>
              </div>
              {profileErrors.nombre ? (
                <p className={fieldErrorClass}>
                  {profileErrors.nombre}
                </p>
              ) : null}
              </div>
              <div>
              <label className={fieldLabelClass}>
                Correo electrónico
              </label>
              <input
                type="email"
                value={profile.correo}
                maxLength={PROFILE_EMAIL_MAX_LENGTH}
                onChange={(event) => {
                  const next = event.target.value.slice(
                    0,
                    PROFILE_EMAIL_MAX_LENGTH,
                  );
                  setProfile((prev) => ({
                    ...prev,
                    correo: next,
                  }));
                  setProfileErrors((prev) => ({
                    ...prev,
                    correo: validateProfileEmail(next) ?? undefined,
                  }));
                  clearFeedback();
                }}
                className={`${fieldInputClass}`}
                placeholder="Correo electrónico"
              />
              {profileErrors.correo ? (
                <p className={fieldErrorClass}>
                  {profileErrors.correo}
                </p>
              ) : null}
              </div>
              <div className="mt-5">
              <label className={fieldLabelClass}>
                Número de teléfono (Opcional)
              </label>
              <p className={fieldHelpTextClass}>
                Puedes dejarlo vacío o escribir un número internacional válido.
              </p>
              <input
                type="tel"
                value={profile.telefono}
                inputMode="tel"
                maxLength={18}
                onChange={(event) => {
                  const raw = event.target.value;
                  const hasInvalid = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(raw) || /[^\d\s()+-]/.test(raw);
                  const next = formatPhoneNumber(raw);
                  setProfile((prev) => ({
                    ...prev,
                    telefono: next,
                  }));
                  setProfileErrors((prev) => ({
                    ...prev,
                    telefono: hasInvalid
                      ? 'No uses letras ni símbolos.'
                      : validateColombianPhone(next) ?? undefined,
                  }));
                  clearFeedback();
                }}
                className={`${fieldInputClass}`}
                placeholder="Ej. 300 123 4567"
              />
              {profileErrors.telefono ? (
                <p className={fieldErrorClass}>
                  {profileErrors.telefono}
                </p>
              ) : null}
              </div>
              {error && activeErrorSection === 'profile' ? (
                <InlineGuidedError message={getAjustesGuidance(error)} />
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => void guardarPerfil()}
                  disabled={guardandoPerfil}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#1683f7] px-4 py-2.5 text-sm font-black text-white disabled:cursor-wait disabled:opacity-70"
                >
                  {guardandoPerfil ? (
                    <LoaderCircle size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  {guardandoPerfil ? 'Guardando...' : 'Guardar datos'}
                </button>
                <button
                  type="button"
                  onClick={() => setProfileInfoOpen(false)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 py-2.5 text-sm font-black text-[#334b85]"
                >
                  Cancelar
                </button>
              </div>
                    </div>
                  </section>
                </div>
              ) : null}
              </div>
            </section>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            Procesos operativos
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {procesosOperativos.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className="flex w-full items-start gap-2.5 rounded-[12px] border border-[#e5e9f5] bg-white px-3 py-3 text-left shadow-sm transition hover:border-[#cfd8ee] hover:bg-[#fbfcff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:focus-visible:ring-blue-500/40"
                >
                  <span
                    className={`inline-flex shrink-0 rounded-lg p-2 ${item.iconStyle}`}
                  >
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-4 text-slate-900 dark:text-slate-50">
                      {item.title}
                    </span>
                    <span className="block text-[11px] leading-4 text-slate-500 dark:text-slate-200">
                      {item.description}
                    </span>
                  </span>
                  <ChevronRight
                    size={14}
                    className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-300"
                  />
                </button>
              );
            })}
          </div>
          {syncPanelOpen ? (
            <CafeSmartModal
              open={syncPanelOpen}
              onClose={() => setSyncPanelOpen(false)}
              labelledById="sync-offline-title"
              title="Sincronización offline"
              description="Revisa registros guardados sin conexión."
            >
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-[13px] border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-400/60 dark:bg-amber-500/15">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-700 dark:text-amber-200">
                      Pendientes
                    </p>
                    <p className="mt-1 text-lg font-black text-amber-900 dark:text-amber-100">
                      {syncSummary.pendientes}
                    </p>
                  </div>
                  <div className="rounded-[13px] border border-red-200 bg-red-50 px-3 py-2 dark:border-red-400/60 dark:bg-red-500/15">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-red-700 dark:text-red-200">
                      Con error
                    </p>
                    <p className="mt-1 text-lg font-black text-red-900 dark:text-red-100">
                      {syncSummary.errores}
                    </p>
                  </div>
                  <div className="rounded-[13px] border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-400/60 dark:bg-emerald-500/15">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-200">
                      Sincronizados
                    </p>
                    <p className="mt-1 text-lg font-black text-emerald-900 dark:text-emerald-100">
                      {syncSummary.sincronizados}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void reintentarSincronizacion()}
                    disabled={
                      syncAllRetrying ||
                      retryingSyncIds.length > 0 ||
                      syncSummary.pendientes + syncSummary.errores === 0 ||
                      isOffline
                    }
                    className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[12px] bg-[#102d92] px-3 text-xs font-black text-white transition hover:bg-[#1f3fa7] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
                  >
                    {syncAllRetrying ? (
                      <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                    ) : null}
                    {syncAllRetrying ? 'Reintentando...' : 'Reintentar'}
                  </button>
                  <button
                    type="button"
                    onClick={clearSyncedOperations}
                    disabled={syncSummary.sincronizados === 0}
                    className="inline-flex min-h-[36px] items-center justify-center rounded-[12px] border border-[#dbe5f7] bg-white px-3 text-xs font-black text-[#334b85] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    Limpiar sincronizados
                  </button>
                </div>

                {syncFeedback ? (
                  <AppFeedbackMessage
                    variant={syncFeedback.variant}
                    description={syncFeedback.message}
                    className="mt-4"
                  />
                ) : null}

                {syncQueue.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {syncQueue.map((operation) => {
                      const isRetrying = retryingSyncIds.includes(operation.idLocal);
                      const technicalError =
                        operation.error?.match(/property\s+[\w.]+\s+should not exist/i)?.[0] ??
                        null;
                      const friendlyError =
                        operation.estado === 'ERROR'
                          ? operation.modulo === 'VENTA'
                            ? 'No pudimos sincronizar esta venta. Intenta nuevamente.'
                            : operation.modulo === 'SECADO'
                              ? 'No pudimos sincronizar este secado. Intenta nuevamente.'
                              : 'No pudimos sincronizar este registro. Intenta nuevamente.'
                          : null;

                      return (
                      <div
                        key={operation.idLocal}
                        className="rounded-[14px] border border-[#e7ecf7] bg-[#fbfcff] px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900 dark:text-slate-100">
                              {operation.modulo === 'COMPRA'
                                ? 'Compra'
                                : operation.modulo === 'GASTO'
                                  ? 'Gasto'
                                  : operation.modulo}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                              {new Date(operation.creadoEn).toLocaleString('es-CO', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${
                              operation.estado === 'SINCRONIZADO'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-1 dark:ring-emerald-400/40'
                                : operation.estado === 'ERROR'
                                  ? 'bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-200 dark:ring-1 dark:ring-red-400/40'
                                  : operation.estado === 'SINCRONIZANDO'
                                    ? 'bg-sky-50 text-sky-700 dark:bg-blue-500/20 dark:text-blue-200 dark:ring-1 dark:ring-blue-400/40'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-1 dark:ring-amber-400/40'
                            }`}
                          >
                            {operation.estado === 'PENDIENTE'
                              ? 'Pendiente'
                              : operation.estado === 'SINCRONIZANDO'
                                ? 'Sincronizando'
                                : operation.estado === 'SINCRONIZADO'
                                  ? 'Sincronizado'
                                  : 'Error'}
                          </span>
                        </div>
                        {operation.error ? (
                          <div className="mt-2 rounded-[10px] border border-red-100 bg-red-50 px-2.5 py-2 text-[11px] font-semibold leading-4 text-red-800 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-100">
                            <p>{technicalError ? friendlyError : operation.error}</p>
                            {technicalError ? (
                              <details className="mt-1 text-red-700 dark:text-red-200">
                                <summary className="cursor-pointer font-black">
                                  Detalle técnico
                                </summary>
                                <p className="mt-1 break-words">{technicalError}</p>
                              </details>
                            ) : null}
                          </div>
                        ) : null}
                        {operation.estado === 'ERROR' ? (
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => void reintentarOperacionSync(operation)}
                              disabled={isRetrying || syncAllRetrying || isOffline}
                              className="inline-flex min-h-[32px] items-center justify-center gap-1.5 rounded-[10px] bg-[#102d92] px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-[#1f3fa7] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
                            >
                              {isRetrying ? (
                                <LoaderCircle size={13} className="animate-spin" aria-hidden="true" />
                              ) : null}
                              {isRetrying ? 'Reintentando...' : 'Reintentar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSyncDeleteCandidate(operation)}
                              disabled={isRetrying || syncAllRetrying}
                              className="min-h-[32px] rounded-[10px] border border-red-200 bg-white px-3 py-1.5 text-[11px] font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-400/50 dark:bg-slate-900 dark:text-red-200 dark:hover:bg-red-500/10"
                            >
                              Eliminar local
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                    })}
                  </div>
                ) : (
                  <CafeSmartEmptyState
                    title="Todo está sincronizado"
                    description="No hay operaciones pendientes en este dispositivo."
                  />
                )}
            </CafeSmartModal>
          ) : null}
          <CafeSmartModal
            open={Boolean(syncDeleteCandidate)}
            onClose={() => setSyncDeleteCandidate(null)}
            labelledById="eliminar-sync-local-title"
            title="¿Eliminar registro local?"
            description="Este registro se quitará de la cola de sincronización. No se enviará al servidor."
            className="max-w-[390px]"
          >
            <div className="flex items-start gap-3 rounded-[14px] border border-red-100 bg-red-50 px-3 py-3 dark:border-red-400/30 dark:bg-red-500/10">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-red-700 shadow-sm dark:bg-slate-900 dark:text-red-200">
                <Trash2 size={18} aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold leading-5 text-red-900 dark:text-red-100">
                Elimina solo si ya no quieres intentar sincronizar este registro.
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 max-[330px]:grid-cols-1">
              <button
                type="button"
                autoFocus
                onClick={() => setSyncDeleteCandidate(null)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-[#dbe5f7] bg-white px-4 text-sm font-black text-[#1f3fa7] shadow-sm transition hover:bg-[#f3f6ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#274ab8]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminarOperacionSync}
                className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-rose-600 px-4 text-sm font-black text-white shadow-[0_12px_26px_rgba(225,29,72,0.24)] transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-500/20 dark:bg-rose-500 dark:hover:bg-rose-400"
              >
                Eliminar local
              </button>
            </div>
          </CafeSmartModal>
          {secadoPanel ? (
            <section className="overflow-hidden rounded-[18px] border border-[#dbe5ff] bg-white shadow-sm">
              <button
                type="button"
                aria-label="Cerrar panel de secado"
                onClick={() => setSecadoPanel(null)}
                className="hidden"
              />
              <div className="relative flex max-h-[min(72dvh,760px)] w-full flex-col overflow-hidden bg-white">
                <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-[#cfd8e6]" />
                <div className="shrink-0 px-4 pb-3 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-950">
                    Proceso de secado
                  </h3>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    Revisa secados activos o inicia un nuevo proceso.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSecadoPanel(null)}
                  aria-label="Cerrar panel de secado"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSecadoError(null);
                    setSecadoPanel('active');
                    setSecadoSessionsVersion((current) => current + 1);
                  }}
                  className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[13px] px-3 text-xs font-black transition ${
                    secadoPanel === 'active'
                      ? 'border border-blue-700 bg-blue-700 text-white shadow-sm dark:border-blue-500 dark:bg-blue-600 dark:text-white'
                      : 'border border-slate-300 bg-white text-slate-800 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-blue-500/40'
                  }`}
                  {...ariaPressed(secadoPanel === 'active')}
                >
                  <CircleDashed size={15} />
                  Ver secados activos
                </button>
                <button
                  type="button"
                  onClick={() => void cargarPanelSecadoInicio()}
                  className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[13px] px-3 text-xs font-black transition ${
                    secadoPanel === 'start'
                      ? 'border border-blue-700 bg-blue-700 text-white shadow-sm dark:border-blue-500 dark:bg-blue-600 dark:text-white'
                      : 'border border-slate-300 bg-white text-slate-800 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-blue-500/40'
                  }`}
                  {...ariaPressed(secadoPanel === 'start')}
                >
                  <Droplets size={15} />
                  Iniciar secado
                </button>
              </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">

              {secadoLoading ? (
                <div className="mt-3 space-y-2">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-14 animate-pulse rounded-[14px] bg-[#eef2f7]" />
                  ))}
                </div>
              ) : null}

              {secadoError ? (
                <AppFeedbackMessage
                  variant="error"
                  description={secadoError}
                  className="mt-3"
                />
              ) : null}

              {!secadoLoading && secadoPanel === 'home' ? (
                <div className="mt-3 rounded-[14px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-5 text-center text-xs font-bold text-slate-500">
                  Elige una acción para revisar procesos activos o preparar un nuevo secado.
                </div>
              ) : null}

              {!secadoLoading && secadoPanel === 'start' ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <h4 className="text-sm font-black text-slate-950">
                      Iniciar secado
                    </h4>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                      Selecciona los sublotes de café verde.
                    </p>
                  </div>
                  {secadoLotes.length > 1 ? (
                    <label className="block">
                      <span className="mb-1 block text-[0.64rem] font-black uppercase tracking-[0.08em] text-slate-500">
                        Lote verde
                      </span>
                      <SmartSelect
                        value={secadoLoteKey}
                        onChange={(event) => void cargarDetalleSecadoInline(event.target.value)}
                      >
                        {secadoLotes.map((lote) => (
                          <option
                            key={`${lote.tipoCafeId}:${lote.calidadId}`}
                            value={`${lote.tipoCafeId}:${lote.calidadId}`}
                          >
                            {getCoffeeCodePrefix(lote)} · {formatCoffeeFullName(lote)} - {formatSecadoKg(lote.pesoActual)}
                          </option>
                        ))}
                      </SmartSelect>
                    </label>
                  ) : null}

                  {sublotesSecadoDisponibles.length === 0 ? (
                    <div className="rounded-[14px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-5 text-center text-xs font-bold text-slate-500">
                      No hay sublotes verdes disponibles para iniciar secado.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sublotesSecadoDisponibles.map((sublote, index) => {
                        const checked = (secadoWeights[sublote.id] ?? 0) > 0;
                        const visualCode = formatSubloteVisualCode(sublote, index);
                        const fullName = formatCoffeeFullName(sublote);
                        return (
                          <article
                            key={sublote.id}
                            title={`${visualCode} · ${fullName}`}
                            className={`rounded-[14px] border px-3 py-2.5 ${
                              checked
                                ? 'border-[#c9d7ff] bg-[#f5f8ff]'
                                : 'border-[#e5e9f5] bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  setSecadoWeights((current) => {
                                    const next = { ...current };
                                    if (event.target.checked) {
                                      next[sublote.id] = sublote.pesoActual;
                                    } else {
                                      delete next[sublote.id];
                                    }
                                    return next;
                                  })
                                }
                                className="h-4 w-4 accent-[#102d92]"
                                aria-label={`Seleccionar ${visualCode} ${fullName}`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-black text-slate-950">
                                  {visualCode}
                                </p>
                                <p className="text-[0.66rem] font-semibold text-slate-500">
                                  {fullName} · {formatSecadoKg(sublote.pesoActual)}
                                </p>
                              </div>
                              <input
                                type="number"
                                aria-label={`Kilos a secar de ${visualCode} ${fullName}`}
                                title={`Kilos a secar de ${visualCode}`}
                                inputMode="decimal"
                                min="0"
                                max={sublote.pesoActual}
                                step="0.1"
                                value={secadoWeights[sublote.id] ?? ''}
                                onChange={(event) => {
                                  const value = Number(event.target.value);
                                  setSecadoWeights((current) => {
                                    if (!Number.isFinite(value) || value <= 0) {
                                      const next = { ...current };
                                      delete next[sublote.id];
                                      return next;
                                    }
                                    return {
                                      ...current,
                                      [sublote.id]: Math.min(value, sublote.pesoActual),
                                    };
                                  });
                                }}
                                className="h-9 w-20 rounded-[10px] border border-[#dbe2f0] bg-white px-2 text-right text-xs font-black text-slate-800"
                              />
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  <div className="rounded-[14px] bg-[#eef4ff] px-3 py-2 text-sm font-black text-[#102d92]">
                    Total seleccionado: {formatSecadoKg(totalSecadoSeleccionado)}
                  </div>
                  <button
                    type="button"
                    disabled={totalSecadoSeleccionado <= 0}
                    onClick={iniciarSecadoInline}
                    className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[13px] bg-[#102d92] px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    <CheckCircle2 size={15} />
                    Iniciar secado
                  </button>
                </div>
              ) : null}

              {!secadoLoading && secadoPanel === 'active' ? (
                <div className="mt-3 space-y-2">
                  <div>
                    <h4 className="text-sm font-black text-slate-950">
                      Secados activos
                    </h4>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                      Café en proceso de secado.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-[14px] border border-[#e3e8f2] bg-[#f8faff] p-2">
                    <label className="block">
                      <span className="mb-1 block text-[0.6rem] font-black uppercase tracking-[0.08em] text-slate-500">
                        Orden
                      </span>
                      <SmartSelect
                        value={secadoSortMode}
                        onChange={(event) =>
                          setSecadoSortMode(event.target.value as SecadoSortMode)
                        }
                        className="h-9 rounded-[11px] text-[0.66rem]"
                      >
                        <option value="recent">Más recientes</option>
                        <option value="oldest">Más antiguos</option>
                      </SmartSelect>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[0.6rem] font-black uppercase tracking-[0.08em] text-slate-500">
                        Calidad
                      </span>
                      <SmartSelect
                        value={secadoQualityFilter}
                        onChange={(event) =>
                          setSecadoQualityFilter(
                            event.target.value as SecadoQualityFilter,
                          )
                        }
                        className="h-9 rounded-[11px] text-[0.66rem]"
                      >
                        <option value="TODOS">Todos</option>
                        <option value="BUENO">Bueno</option>
                        <option value="REGULAR">Regular</option>
                        <option value="MALO">Malo</option>
                      </SmartSelect>
                    </label>
                  </div>
                  {secadosActivosInline.length === 0 ? (
                    <div className="rounded-[14px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-5 text-center">
                      <Package2 size={18} className="mx-auto text-slate-400" />
                      <p className="mt-2 text-xs font-black text-slate-700">
                        No hay secados activos
                      </p>
                    </div>
                  ) : (
                    secadosActivosInline.map((session) => (
                      <article
                        key={session.id}
                        title={`${getCoffeeCodePrefix(session)} · ${formatCoffeeFullName(session)}`}
                        className="rounded-[14px] border border-[#c7d8ff] bg-[#f4f8ff] px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="inline-flex shrink-0 rounded-[9px] border border-[#c7d8ff] bg-white px-2 py-1 text-[0.66rem] font-black text-[#102d92]">
                                {getCoffeeCodePrefix(session)}
                              </span>
                              <p className="truncate text-sm font-black text-[#102d92]">
                                {formatCoffeeFullName(session)}
                              </p>
                            </div>
                            <p className="text-[0.66rem] font-semibold text-slate-500">
                              {session.sublotes.length} sublotes · {formatSecadoKg(session.sublotes.reduce((sum, item) => sum + item.pesoActual, 0))}
                            </p>
                          </div>
                          <CircleDashed size={17} className="shrink-0 text-[#102d92]" />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/inventario/secado/${session.id}/finalizar?step=finish`, {
                              state: { from: '/ajustes' },
                            })
                          }
                          className="mt-3 inline-flex min-h-[38px] w-full items-center justify-center rounded-[12px] bg-[#102d92] px-3 text-xs font-black text-white"
                        >
                          Finalizar secado
                        </button>
                      </article>
                    ))
                  )}
                  <RefreshButton
                    onClick={() => setSecadoSessionsVersion((current) => current + 1)}
                    aria-label="Actualizar lista"
                  >
                    Actualizar lista
                  </RefreshButton>
                </div>
              ) : null}
                </div>
              </div>
            </section>
          ) : null}
          <p className="pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            Apariencia
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setThemeModalOpen(true)}
              className="flex w-full items-start gap-2.5 rounded-[12px] border border-[#e5e9f5] bg-white px-3 py-3 text-left shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <span className="inline-flex rounded-lg bg-blue-50 p-2 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
                <Settings size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Tema visual
                </span>
                <span className="block truncate text-[11px] text-slate-500 dark:text-slate-300">
                  Actual: {theme === 'system' ? 'Sistema' : resolvedTheme === 'dark' ? 'Oscuro' : 'Claro'}
                </span>
              </span>
              <ChevronRight
                size={14}
                className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-300"
              />
            </button>
          </div>

          <p className="pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">
            Accesibilidad
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {accessibilityCards.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  aria-label={`${item.title}: ${item.description}. Estado actual: ${item.status}.`}
                  title={`${item.title}: ${item.status}`}
                  className="flex w-full items-start gap-2.5 rounded-[12px] border border-[#e5e9f5] bg-white px-3 py-3 text-left shadow-sm transition hover:border-[#cfd8ee] hover:bg-[#fbfcff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/15 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                >
                  <span className={`inline-flex rounded-lg p-2 ${item.iconStyle}`}>
                    <Icon size={14} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {item.title}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500 dark:text-slate-200">
                      {item.description}
                    </span>
                  </span>
                  <ChevronRight
                    size={14}
                    className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-300"
                  />
                </button>
              );
            })}
          </div>

          <p className="pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">
            Asistente inteligente
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/asistente')}
              className="flex w-full items-start gap-2.5 rounded-[12px] border border-[#e5e9f5] bg-white px-3 py-3 text-left shadow-sm transition hover:border-[#cfd8ee] hover:bg-[#fbfcff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/15 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50 dark:hover:border-slate-500 dark:hover:bg-slate-800"
            >
              <span className="inline-flex shrink-0 rounded-lg bg-blue-50 p-2 ring-1 ring-blue-100 dark:bg-blue-500/15 dark:ring-blue-300/20">
                <img
                  src={granitoInteligente}
                  alt=""
                  className="h-[14px] w-[14px] object-contain drop-shadow-sm"
                  draggable={false}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                  IA asistente 
                </span>
                <span className="block truncate text-[11px] text-slate-500 dark:text-slate-200">
                  Consulta tu negocio
                </span>
              </span>
              <ChevronRight
                size={14}
                className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-300"
              />
            </button>
          </div>

          <p className="pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            Configuración del negocio
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {configuracionNegocio.map((item) => {
              const Icon = item.icon;
              const disabled = configuracionNegocioInactiva.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={disabled ? mostrarOpcionPendiente : item.onClick}
                  aria-disabled={disabled}
                  className={`flex w-full items-start gap-2.5 rounded-[12px] border px-3 py-3 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-4 ${
                    disabled
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 shadow-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-500'
                      : 'border-[#e5e9f5] bg-white hover:border-[#cfd8ee] hover:bg-[#fbfcff] focus-visible:ring-blue-300/40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:focus-visible:ring-blue-500/40'
                  }`}
                >
                  <span
                    className={`inline-flex rounded-lg p-2 ${
                      disabled
                        ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                        : item.iconStyle
                    }`}
                  >
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-semibold ${
                        disabled
                          ? 'text-slate-500 dark:text-slate-400'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {item.title}
                    </span>
                    <span
                      className={`block truncate text-[11px] ${
                        disabled
                          ? 'text-slate-400 dark:text-slate-500'
                          : 'text-slate-500 dark:text-slate-300'
                      }`}
                    >
                      {item.description}
                    </span>
                  </span>
                  <ChevronRight
                    size={14}
                    className={`mt-0.5 shrink-0 ${
                      disabled
                        ? 'text-slate-300 dark:text-slate-600'
                        : 'text-slate-400 dark:text-slate-300'
                    }`}
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
              const disabled = !item.onClick;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={disabled ? mostrarOpcionPendiente : item.onClick}
                  aria-disabled={disabled}
                  className={`flex w-full items-start gap-2.5 rounded-[12px] border px-3 py-3 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-4 ${
                    disabled
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 shadow-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-500'
                      : 'border-[#e5e9f5] bg-white hover:border-[#cfd8ee] hover:bg-[#fbfcff] focus-visible:ring-blue-300/40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:focus-visible:ring-blue-500/40'
                  }`}
                >
                  <span
                    className={`inline-flex rounded-lg p-2 ${
                      disabled
                        ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                        : item.iconStyle
                    }`}
                  >
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-semibold ${
                        disabled
                          ? 'text-slate-500 dark:text-slate-400'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {item.title}
                    </span>
                    <span
                      className={`block truncate text-[11px] ${
                        disabled
                          ? 'text-slate-400 dark:text-slate-500'
                          : 'text-slate-500 dark:text-slate-300'
                      }`}
                    >
                      {item.description}
                    </span>
                  </span>
                  <ChevronRight
                    size={14}
                    className={`mt-0.5 shrink-0 ${
                      disabled
                        ? 'text-slate-300 dark:text-slate-600'
                        : 'text-slate-400 dark:text-slate-300'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <p className="pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            Información financiera
          </p>
          <article className="relative overflow-hidden rounded-[16px] border border-[#dbe5ff] bg-[#f7f9ff] px-4 py-5 text-[#172033] shadow-[0_10px_24px_rgba(42,79,181,0.10)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <div className="absolute -right-4 -top-6 h-24 w-24 rounded-full bg-[#dbe6ff]/70 dark:bg-blue-500/10" />
            <div className="relative z-10 flex flex-col items-center text-center">
              <span className="inline-flex rounded-full bg-[#eaf0ff] p-2 text-[#2a4fb5] dark:bg-blue-500/15 dark:text-blue-200">
                <Lock size={15} />
              </span>
              <p className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
                Ver resumen financiero
              </p>
              <p className="mt-1 max-w-[320px] text-xs text-slate-500 dark:text-slate-300">
                Consulta ventas, compras y gastos con contraseña de
                administrador.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                navigate('/resumen-financiero/acceso', {
                  state: {
                    returnTo: '/ajustes',
                    finalBackTo: '/ajustes',
                  },
                })
              }
              className="relative z-10 mt-4 flex min-h-[36px] w-fit items-center justify-center rounded-[999px] bg-[#2b57d3] px-4 text-xs font-semibold text-white opacity-90 mx-auto dark:bg-blue-600"
            >
              Acceder ahora
            </button>
          </article>
        </section>

        {isEditingCompany ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f172a]/45 px-5 py-6 backdrop-blur-sm">
            <section className="max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-[22px] border border-[#e6e8f3] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[1.2rem] font-black text-slate-900 dark:text-slate-100">
                  Editar negocio
                </h3>
                <button
                  type="button"
                  onClick={cerrarEditorEmpresa}
                  aria-label="Cerrar edición de negocio"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-400/25 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-4 space-y-3">
              {limitNotice ? (
                <AppFeedbackMessage variant="warning" description={limitNotice} />
              ) : null}
              <label htmlFor="settings-business-name" className="block">
                <span className={fieldLabelClass}>
                  Nombre del negocio
                </span>
                <input
                  id="settings-business-name"
                  type="text"
                  value={company.nombreEmpresa}
                  onChange={(event) => {
                    setCompany((prev) => ({
                      ...prev,
                      nombreEmpresa: event.target.value.slice(0, BUSINESS_NAME_MAX_LENGTH),
                    }));
                    if (event.target.value.length >= BUSINESS_NAME_MAX_LENGTH) {
                      showLimitNotice('Llegaste al máximo de caracteres.');
                    }
                    clearFeedback();
                  }}
                  onBlur={() => {
                    const validation = validateCompanyName(company.nombreEmpresa);
                    const message = validation.isValid
                      ? validateBusinessName(company.nombreEmpresa)
                      : validation.message;
                    if (message) {
                      setError(message);
                      setFloatingError(getAjustesGuidance(message));
                    }
                  }}
                  maxLength={BUSINESS_NAME_MAX_LENGTH}
                  className={fieldInputClass}
                  placeholder="Nombre del negocio"
                />
              </label>
              <div className="-mt-1 flex justify-end">
                <span
                  className={`text-xs font-bold ${
                    company.nombreEmpresa.length >= BUSINESS_NAME_MAX_LENGTH
                      ? 'text-amber-600 dark:text-amber-300'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {company.nombreEmpresa.length}/{BUSINESS_NAME_MAX_LENGTH}
                </span>
              </div>
              <label htmlFor="settings-business-type" className="block">
                <span className={fieldLabelClass}>
                  Tipo de negocio
                </span>
                <SmartSelect
                  id="settings-business-type"
                  value={company.tipoEmpresa}
                  onChange={(event) => {
                    setCompany((prev) => ({
                      ...prev,
                      tipoEmpresa: event.target.value,
                    }));
                    clearFeedback();
                  }}
                  className="text-sm"
                >
                  <option value="">Seleccionar tipo</option>
                  <option value="Compraventa">Compraventa</option>
                  <option value="Cooperativa">Cooperativa</option>
                  <option value="Otro">Personalizado</option>
                </SmartSelect>
              </label>
              <label htmlFor="settings-business-description" className="block">
                <span className={fieldLabelClass}>
                  Describe cómo opera tu negocio. (Opcional)
                </span>
                <textarea
                  id="settings-business-description"
                  value={company.descripcion}
                  onChange={(event) => {
                    setCompany((prev) => ({
                      ...prev,
                      descripcion: event.target.value.slice(
                        0,
                        BUSINESS_DESCRIPTION_MAX_LENGTH,
                      ),
                    }));
                    if (event.target.value.length >= BUSINESS_DESCRIPTION_MAX_LENGTH) {
                      showLimitNotice('Llegaste al máximo de caracteres.');
                    }
                    clearFeedback();
                  }}
                  maxLength={BUSINESS_DESCRIPTION_MAX_LENGTH}
                  className={fieldTextareaClass}
                  rows={3}
                  placeholder="Ej: Laboratorio de finca que evalúa muestras de café y registra calidad."
                />
              </label>
              <div className="-mt-1 flex justify-end">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {company.descripcion.length}/{BUSINESS_DESCRIPTION_MAX_LENGTH}
                </span>
              </div>
              {error && activeErrorSection === 'company' ? (
                <InlineGuidedError message={getAjustesGuidance(error)} />
              ) : null}
              {success === 'Negocio actualizado correctamente.' ? (
                <AppFeedbackMessage
                  variant="success"
                  description="Negocio actualizado correctamente."
                  action={
                    <button type="button" onClick={() => setSuccess(null)} aria-label="Cerrar aviso">
                      <X size={14} />
                    </button>
                  }
                />
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={guardarEmpresa}
                  disabled={guardandoEmpresa}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 py-2.5 text-sm font-black text-white disabled:cursor-wait disabled:opacity-70"
                >
                  {guardandoEmpresa ? (
                    <LoaderCircle size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  {guardandoEmpresa ? 'Guardando...' : 'Guardar negocio'}
                </button>
                <button
                  type="button"
                  onClick={cerrarEditorEmpresa}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 py-2.5 text-sm font-black text-[#334b85] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </section>
        </div>
        ) : null}

              {error && !activeErrorSection && !isEditingBodega && !isEditingLimites ? (
          <InlineGuidedError message={getAjustesGuidance(error)} />
        ) : null}

      </div>

      {isEditingBodega ? (
        <div className="fixed inset-0 z-[80] bg-[#f4f7fb] text-slate-950 dark:bg-slate-950 dark:text-slate-100">
          <section
            aria-labelledby="bodegas-title"
            className="mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#f4f7fb] dark:bg-slate-950"
          >
            <header className="shrink-0 border-b border-slate-200 bg-white px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <button
                    type="button"
                    onClick={cerrarEditorBodega}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-[#102d92] dark:bg-slate-800 dark:text-blue-100"
                    aria-label="Volver a ajustes"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div className="min-w-0">
                <h3 id="bodegas-title" className="text-[1.25rem] font-semibold leading-tight text-[#111827] dark:text-slate-100">
                  Bodegas
                </h3>
                <p className="mt-1 text-[0.78rem] font-semibold text-slate-500 dark:text-slate-300">
                  Administra los puntos de almacenamiento de tu negocio.
                </p>
                  </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void cargarBodegas()}
                  disabled={bodegasLoading}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d5deee] bg-white text-[#334b85] disabled:cursor-wait disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-blue-100"
                  aria-label="Recargar bodegas"
                  title="Recargar bodegas"
                >
                  <RefreshCcw
                    size={16}
                    className={bodegasLoading ? 'animate-spin' : ''}
                  />
                </button>
                <button
                  type="button"
                  onClick={abrirLimiteGeneral}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[13px] border border-[#d5deee] bg-white px-3 text-[0.72rem] font-black text-[#334b85] dark:border-slate-600 dark:bg-slate-800 dark:text-blue-100"
                >
                  <SlidersHorizontal size={14} />
                  Límite general
                </button>
              </div>
            </div>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+92px)]">
              {bodegaFeedback ? (
                <AppFeedbackMessage
                  variant={bodegaFeedback.variant}
                  description={bodegaFeedback.message}
                  action={
                    <button
                      type="button"
                      onClick={() => setBodegaFeedback(null)}
                      aria-label="Cerrar aviso de bodegas"
                    >
                      <X size={14} />
                    </button>
                  }
                />
              ) : null}

              <button
                type="button"
                onClick={abrirCrearBodega}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 py-3 text-[0.9rem] font-black text-white transition hover:bg-[#0d2475] focus:outline-none focus:ring-4 focus:ring-blue-400/25 disabled:opacity-70 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <Warehouse size={16} />
                Crear bodega
              </button>

              {bodegasLoading ? (
                <div className="space-y-2">
                  {[0, 1].map((item) => (
                    <div
                      key={item}
                      className="h-[132px] animate-pulse rounded-[16px] bg-slate-100 dark:bg-slate-800"
                    />
                  ))}
                </div>
              ) : bodegas.length === 0 ? (
                <CafeSmartEmptyState
                  icon={<Warehouse size={22} />}
                  title="Sin bodegas registradas"
                  description="Crea la primera bodega para controlar tu capacidad."
                />
              ) : (
                <div className="space-y-2.5">
                  {bodegas.map((bodega) => (
                    <article
                      key={bodega.id}
                      className="rounded-[16px] border border-[#e5eaf4] bg-[#fbfcff] p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="truncate text-[0.95rem] font-black text-slate-950 dark:text-slate-100">
                              {bodega.nombre}
                            </h4>
                            {bodega.esPrincipal ? (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[0.55rem] font-black uppercase text-blue-700 dark:bg-blue-500/15 dark:text-blue-100">
                                Principal
                              </span>
                            ) : null}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[0.55rem] font-black uppercase ${
                                bodega.activa
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-100'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {bodega.activa ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
                            {bodega.ubicacion?.trim() || 'Sin ubicación registrada'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => abrirEditarBodega(bodega)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#d5deee] bg-white text-[#334b85] dark:border-slate-600 dark:bg-slate-800 dark:text-blue-100"
                            aria-label={`Editar ${bodega.nombre}`}
                          >
                            <Pencil size={13} />
                          </button>
                          {bodegas.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (bodega.cafeAlmacenadoKg > 0) {
                                  setBodegaFeedback({
                                    variant: 'warning',
                                    message:
                                      'No puedes eliminar esta bodega porque tiene inventario activo.',
                                  });
                                  return;
                                }
                                setBodegaDeleteTarget(bodega);
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-rose-200 bg-rose-50 text-rose-700"
                              aria-label={`Eliminar ${bodega.nombre}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-[12px] bg-white px-2.5 py-2 dark:bg-slate-900">
                          <p className="text-[0.55rem] font-black uppercase text-slate-500 dark:text-slate-400">
                            Capacidad
                          </p>
                          <p className="mt-1 text-[0.72rem] font-black text-slate-950 dark:text-slate-100">
                            {formatKg(bodega.cafeAlmacenadoKg)} / {formatKg(bodega.capacidadMaxKg)} kg
                          </p>
                        </div>
                        <div className="rounded-[12px] bg-white px-2.5 py-2 dark:bg-slate-900">
                          <p className="text-[0.55rem] font-black uppercase text-slate-500 dark:text-slate-400">
                            Disponible
                          </p>
                          <p className="mt-1 text-[0.72rem] font-black text-slate-950 dark:text-slate-100">
                            {formatKg(bodega.disponibleKg)} kg
                          </p>
                        </div>
                        <div className="rounded-[12px] bg-white px-2.5 py-2 dark:bg-slate-900">
                          <p className="text-[0.55rem] font-black uppercase text-slate-500 dark:text-slate-400">
                            Ocupación
                          </p>
                          <p className="mt-1 text-[0.72rem] font-black text-slate-950 dark:text-slate-100">
                            {Math.round(bodega.ocupacionPct)}%
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-[#102d92] dark:bg-blue-500"
                          style={{ width: `${Math.min(100, Math.max(0, bodega.ocupacionPct))}%` }}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => void abrirLimitesBodega(bodega)}
                          disabled={guardandoBodega}
                          className="col-span-2 inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[12px] border border-[#d5deee] bg-white px-3 text-[0.7rem] font-black text-[#334b85] disabled:cursor-wait disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-blue-100"
                        >
                          <SlidersHorizontal size={13} />
                          Límites y alertas
                        </button>
                        {!bodega.esPrincipal ? (
                          <button
                            type="button"
                            onClick={() => void marcarBodegaPrincipal(bodega)}
                            disabled={guardandoBodega}
                            className="inline-flex min-h-[36px] items-center justify-center rounded-[12px] border border-[#d5deee] bg-white px-3 text-[0.7rem] font-black text-[#334b85] disabled:cursor-wait disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-blue-100"
                          >
                            Marcar principal
                          </button>
                        ) : (
                          <span className="inline-flex min-h-[36px] items-center justify-center rounded-[12px] border border-blue-100 bg-blue-50 px-3 text-[0.7rem] font-black text-blue-700 dark:border-blue-300/20 dark:bg-blue-500/15 dark:text-blue-100">
                            Selección por defecto
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => void alternarBodegaActiva(bodega)}
                          disabled={guardandoBodega}
                          className={`inline-flex min-h-[36px] items-center justify-center rounded-[12px] px-3 text-[0.7rem] font-black disabled:cursor-wait disabled:opacity-60 ${
                            bodega.activa
                              ? 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-100'
                              : 'bg-emerald-600 text-white dark:bg-emerald-500'
                          }`}
                        >
                          {bodega.activa ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <p className="inline-flex w-full items-center justify-center gap-1.5 text-center text-[0.62rem] font-semibold text-slate-500 dark:text-slate-400">
                <CalendarDays size={12} className="text-[#102d92] dark:text-blue-300" />
                Última actualización: {formatDate(updatedAt)}
              </p>
            </div>
            <AppBottomNav />
          </section>

          {bodegaFormOpen ? (
            <div className="fixed inset-0 z-[90] bg-[#f4f7fb] text-slate-950 dark:bg-slate-950 dark:text-slate-100">
              <section className="mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#f4f7fb] dark:bg-slate-950">
                <header className="shrink-0 border-b border-slate-200 bg-white px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setBodegaFormOpen(false);
                        setBodegaEditando(null);
                        setBodegaFeedback(null);
                      }}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-[#102d92] dark:bg-slate-800 dark:text-blue-100"
                      aria-label="Volver a bodegas"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <div className="min-w-0">
                    <h4 className="text-lg font-black text-slate-950 dark:text-slate-100">
                      {bodegaEditando ? 'Editar bodega' : 'Crear bodega'}
                    </h4>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                      Registra un punto de almacenamiento para tu café.
                    </p>
                  </div>
                </div>
                </header>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+92px)]">
                  {bodegaFeedback && bodegaFeedback.variant !== 'success' ? (
                    <AppFeedbackMessage
                      variant={bodegaFeedback.variant}
                      description={bodegaFeedback.message}
                    />
                  ) : null}
                  {limitNotice ? (
                    <AppFeedbackMessage variant="warning" description={limitNotice} />
                  ) : null}
                  <label className="block">
                    <span className={fieldLabelClass}>Nombre de bodega</span>
                    <input
                      type="text"
                      maxLength={BODEGA_NAME_MAX_LENGTH}
                      value={nombreBodega}
                      onChange={(event) => {
                        if (event.target.value.length >= BODEGA_NAME_MAX_LENGTH) {
                          showLimitNotice();
                        }
                        setNombreBodega(
                          sanitizeLimitedText(event.target.value, BODEGA_NAME_MAX_LENGTH),
                        );
                        setBodegaFeedback(null);
                      }}
                      className={fieldInputClass}
                      placeholder="Bodega principal"
                    />
                  </label>

                  <label className="block">
                    <span className={fieldLabelClass}>Ubicación o descripción (opcional)</span>
                    <input
                      type="text"
                      maxLength={120}
                      value={ubicacionBodega}
                      onChange={(event) => {
                        setUbicacionBodega(sanitizeLimitedText(event.target.value, 120));
                        setBodegaFeedback(null);
                      }}
                      className={fieldInputClass}
                      placeholder="Tuluá, zona centro"
                    />
                  </label>

                  <label className="block">
                    <span className={fieldLabelClass}>Capacidad máxima (kg)</span>
                    <input
                      type="number"
                      min="1"
                      max={BODEGA_CAPACITY_MAX_KG}
                      step="1"
                      value={capacidadKg}
                      onChange={(event) => {
                        if (event.target.value.replace(/\D/g, '').length >= 6) {
                          showLimitNotice();
                        }
                        setCapacidadKg(
                          sanitizePositiveIntegerInput(
                            event.target.value,
                            BODEGA_CAPACITY_MAX_KG,
                          ),
                        );
                        setBodegaFeedback(null);
                      }}
                      className={fieldInputClass}
                      placeholder="3000"
                    />
                  </label>

                  {bodegaEditando ? (
                    <div className="rounded-[12px] border border-slate-200 bg-[#f8fafc] px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950">
                      <p className="text-[0.58rem] font-black uppercase text-slate-500 dark:text-slate-400">
                        Café almacenado
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-950 dark:text-slate-100">
                        {loadingStock ? 'Cargando...' : `${formatKg(bodegaEditando.cafeAlmacenadoKg)} kg`}
                      </p>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setBodegaFormOpen(false);
                        setBodegaEditando(null);
                        setBodegaFeedback(null);
                      }}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 py-2.5 text-sm font-black text-[#334b85] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={guardarBodega}
                      disabled={guardandoBodega}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 py-2.5 text-sm font-black text-white disabled:cursor-wait disabled:opacity-70 dark:bg-blue-600"
                    >
                      {guardandoBodega ? (
                        <LoaderCircle size={15} className="animate-spin" />
                      ) : (
                        <Save size={15} />
                      )}
                      {bodegaEditando ? 'Guardar cambios' : 'Guardar bodega'}
                    </button>
                  </div>
                </div>
                <AppBottomNav />
              </section>
            </div>
          ) : null}

          {bodegaLimitesTarget || bodegaLimitesGeneralOpen ? (
            <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#0f172a]/50 px-5 py-6 backdrop-blur-sm">
              <section className="max-h-[88vh] w-full max-w-[390px] overflow-y-auto rounded-[20px] border border-[#e6e8f3] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-lg font-black text-slate-950 dark:text-slate-100">
                      {bodegaLimitesGeneralOpen
                        ? 'Límite general'
                        : 'Límites y alertas'}
                    </h4>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                      {bodegaLimitesGeneralOpen
                        ? 'Aplica una configuración a varias bodegas.'
                        : bodegaLimitesTarget?.nombre ?? 'Configura esta bodega.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBodegaLimitesTarget(null);
                      setBodegaLimitesGeneralOpen(false);
                      setBodegaLimitesConfirmOpen(false);
                      setBodegaLimitesFeedback(null);
                    }}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-200"
                    aria-label="Cerrar límites y alertas"
                  >
                    <X size={17} />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {bodegaLimitesLoading ? (
                    <p className="rounded-[14px] bg-[#f8faff] px-3 py-4 text-center text-sm font-bold text-slate-500 dark:bg-slate-950 dark:text-slate-300">
                      Cargando límites...
                    </p>
                  ) : null}
                  {bodegaLimitesFeedback ? (
                    <AppFeedbackMessage
                      variant={bodegaLimitesFeedback.variant}
                      description={bodegaLimitesFeedback.message}
                    />
                  ) : null}
                  {bodegaLimitesGeneralOpen ? (
                    <label className="block">
                      <span className={fieldLabelClass}>Aplicar a</span>
                      <SmartSelect
                        value={bodegaLimitesScope}
                        onChange={(event) =>
                          setBodegaLimitesScope(
                            event.target.value as 'todas' | 'activas',
                          )
                        }
                        className={fieldInputClass}
                      >
                        <option value="todas">Todas las bodegas</option>
                        <option value="activas">Solo bodegas activas</option>
                      </SmartSelect>
                    </label>
                  ) : null}
                  <label className="block">
                    <span className={fieldLabelClass}>Alertar cuando alcance (%)</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={bodegaLimitesForm.alertaPreventivaPct}
                      onChange={(event) =>
                        setBodegaLimitesForm((current) => ({
                          ...current,
                          alertaPreventivaPct: Number(event.target.value),
                        }))
                      }
                      className={fieldInputClass}
                    />
                  </label>
                  <label className="block">
                    <span className={fieldLabelClass}>Estado crítico (%)</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={bodegaLimitesForm.alertaCriticaPct}
                      onChange={(event) =>
                        setBodegaLimitesForm((current) => ({
                          ...current,
                          alertaCriticaPct: Number(event.target.value),
                        }))
                      }
                      className={fieldInputClass}
                    />
                  </label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bodegaLimitesForm.bloquearAlSuperarCapacidad}
                    onClick={() =>
                      setBodegaLimitesForm((current) => ({
                        ...current,
                        bloquearAlSuperarCapacidad:
                          !current.bloquearAlSuperarCapacidad,
                      }))
                    }
                    className="flex min-h-[44px] w-full items-center justify-between rounded-[14px] border border-[#d5deee] bg-white px-3 text-sm font-black text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    Bloquear movimientos al 100%
                    <span className="text-xs text-slate-500 dark:text-slate-300">
                      {bodegaLimitesForm.bloquearAlSuperarCapacidad
                        ? 'Activado'
                        : 'Desactivado'}
                    </span>
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bodegaLimitesForm.alertasActivas}
                    onClick={() =>
                      setBodegaLimitesForm((current) => ({
                        ...current,
                        alertasActivas: !current.alertasActivas,
                      }))
                    }
                    className="flex min-h-[44px] w-full items-center justify-between rounded-[14px] border border-[#d5deee] bg-white px-3 text-sm font-black text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    Alertas de espacio
                    <span className="text-xs text-slate-500 dark:text-slate-300">
                      {bodegaLimitesForm.alertasActivas ? 'Activadas' : 'Desactivadas'}
                    </span>
                  </button>
                  {bodegaLimitesGeneralOpen ? (
                    <p className="rounded-[12px] bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
                      Esta configuración reemplazará los límites individuales de las bodegas seleccionadas.
                    </p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setBodegaLimitesTarget(null);
                        setBodegaLimitesGeneralOpen(false);
                        setBodegaLimitesConfirmOpen(false);
                        setBodegaLimitesFeedback(null);
                      }}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#334b85] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        bodegaLimitesGeneralOpen
                          ? void aplicarLimitesGenerales()
                          : void guardarLimitesBodegaActual()
                      }
                      disabled={guardandoBodega || bodegaLimitesLoading}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white disabled:cursor-wait disabled:opacity-70 dark:bg-blue-600"
                    >
                      {guardandoBodega ? (
                        <LoaderCircle size={15} className="animate-spin" />
                      ) : (
                        <Save size={15} />
                      )}
                      {bodegaLimitesGeneralOpen ? 'Aplicar a todas' : 'Guardar límites'}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {bodegaLimitesConfirmOpen ? (
            <div className="fixed inset-0 z-[105] flex items-center justify-center bg-[#0f172a]/55 px-5 py-6 backdrop-blur-sm">
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirmar-limites-generales-title"
                className="w-full max-w-[360px] rounded-[20px] border border-[#dbe5f7] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900"
              >
                <h4
                  id="confirmar-limites-generales-title"
                  className="text-lg font-black text-slate-950 dark:text-slate-100"
                >
                  Aplicar límites a todas las bodegas
                </h4>
                <p className="mt-2 text-sm font-semibold leading-5 text-slate-600 dark:text-slate-300">
                  Esta configuración reemplazará los límites individuales de las bodegas seleccionadas.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBodegaLimitesConfirmOpen(false)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#334b85] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmarAplicarLimitesGenerales()}
                    disabled={guardandoBodega}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white disabled:cursor-wait disabled:opacity-70 dark:bg-blue-600"
                  >
                    {guardandoBodega ? (
                      <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                    ) : null}
                    Aplicar límites
                  </button>
                </div>
              </section>
            </div>
          ) : null}

          {bodegaDeleteTarget ? (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0f172a]/50 px-5 py-6 backdrop-blur-sm">
              <section className="w-full max-w-[360px] rounded-[20px] border border-[#fee2e2] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.28)] dark:border-rose-500/30 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-black text-slate-950 dark:text-slate-100">
                      ¿Eliminar bodega?
                    </h4>
                    <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                      ¿Estás seguro de eliminar esta bodega? Esta acción no se puede deshacer.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBodegaDeleteTarget(null)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-200"
                    aria-label="Cerrar confirmación"
                  >
                    <X size={17} />
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBodegaDeleteTarget(null)}
                    className="inline-flex min-h-[42px] items-center justify-center rounded-[13px] border border-[#d5deee] bg-white px-3 text-sm font-black text-[#334b85] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmarEliminarBodega}
                    disabled={guardandoBodega}
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[13px] bg-rose-600 px-3 text-sm font-black text-white disabled:cursor-wait disabled:opacity-70"
                  >
                    {guardandoBodega ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                    Eliminar bodega
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      ) : null}

      {isEditingLimites ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f172a]/45 px-5 py-6 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-[22px] border border-[#e6e8f3] bg-white px-5 pb-5 pt-3 shadow-[0_24px_60px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-[#cfd8e6] dark:bg-slate-700" />
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[1.25rem] font-semibold leading-tight text-[#111827] dark:text-slate-100">
                  Límites de Transacción
                </h3>
                <p className="mt-1 text-[0.82rem] font-medium text-slate-500 dark:text-slate-300">
                  Define los valores permitidos para compras y ventas.
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarEditorLimites}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500 dark:bg-slate-800 dark:text-slate-200"
                aria-label="Cerrar límites de transacción"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 flex rounded-[14px] border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
              {[
                ['todos', 'Todos'],
                ['compra', 'Compra'],
                ['venta', 'Venta'],
              ].map(([value, label]) => {
                const active = limitesTab === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLimitesTab(value as LimitesTab)}
                    className={`min-h-[36px] flex-1 rounded-[11px] px-2 text-[0.82rem] font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/15 ${
                      active
                        ? 'bg-[#102d92] text-white shadow-sm dark:bg-blue-600 dark:text-white'
                        : 'border border-transparent text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
                    }`}
                    aria-pressed={active}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-4">
              {limitesTab === 'todos' || limitesTab === 'compra' ? (
                <section className="space-y-3">
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-300">
                    Compra
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className={fieldLabelClass}>
                        Peso mínimo en compra (kg)
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={5}
                        value={limitMinPesoCompraKg}
                        onChange={(event) => {
                          const raw = event.target.value.replace(/\D/g, '').slice(0, 5);
                          setLimitMinPesoCompraKg(raw);
                          clearFeedback();
                        }}
                        className={fieldInputClass}
                        placeholder="5"
                      />
                    </label>

                    <label className="block">
                      <span className={fieldLabelClass}>
                        Peso máximo en compra (kg)
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={5}
                        value={limitMaxPesoKg}
                        onChange={(event) => {
                          const raw = event.target.value.replace(/\D/g, '').slice(0, 5);
                          setLimitMaxPesoKg(raw);
                          clearFeedback();
                        }}
                        className={fieldInputClass}
                        placeholder={PESO_MAXIMO_OPERATIVO_DEFAULT_LABEL}
                      />
                    </label>

                    <label className="block">
                      <span className={fieldLabelClass}>
                        Precio mínimo x kg (Compra)
                      </span>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-slate-400">
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={limitMinPrecioCompraKg}
                          onChange={(event) => {
                            const raw = event.target.value.replace(/\D/g, '').slice(0, 6);
                            setLimitMinPrecioCompraKg(raw);
                            clearFeedback();
                          }}
                          className={`${fieldInputClass} pl-8 pr-4`}
                          placeholder="1000"
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className={fieldLabelClass}>
                        Precio máximo x kg (Compra)
                      </span>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-slate-400">
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={limitMaxPrecioKg}
                          onChange={(event) => {
                            const raw = event.target.value.replace(/\D/g, '').slice(0, 6);
                            setLimitMaxPrecioKg(raw);
                            clearFeedback();
                          }}
                          className={`${fieldInputClass} pl-8 pr-4`}
                          placeholder="100000"
                        />
                      </div>
                    </label>
                  </div>
                </section>
              ) : null}

              {limitesTab === 'todos' || limitesTab === 'venta' ? (
                <section className="space-y-3">
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-300">
                    Venta
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className={fieldLabelClass}>
                        Precio mínimo x kg (Venta)
                      </span>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-slate-400">
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={limitMinPrecioVentaKg}
                          onChange={(event) => {
                            const raw = event.target.value.replace(/\D/g, '').slice(0, 6);
                            setLimitMinPrecioVentaKg(raw);
                            clearFeedback();
                          }}
                          className={`${fieldInputClass} pl-8 pr-4`}
                          placeholder="1000"
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className={fieldLabelClass}>
                        Precio máximo x kg (Venta)
                      </span>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-slate-400">
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={limitMaxPrecioVentaKg}
                          onChange={(event) => {
                            const raw = event.target.value.replace(/\D/g, '').slice(0, 6);
                            setLimitMaxPrecioVentaKg(raw);
                            clearFeedback();
                          }}
                          className={`${fieldInputClass} pl-8 pr-4`}
                          placeholder="100000"
                        />
                      </div>
                    </label>
                  </div>
                </section>
              ) : null}

              {error ? (
                <InlineGuidedError message={getAjustesGuidance(error)} />
              ) : null}
              {success === 'Límites actualizados.' ? (
                <AppFeedbackMessage
                  variant="success"
                  description="Límites actualizados correctamente."
                />
              ) : null}

              <button
                type="button"
                onClick={guardarLimites}
                disabled={guardandoLimites}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 py-3 text-[0.9rem] font-semibold text-white disabled:opacity-70"
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
      ) : null}

      {peopleMode ? (
        <div className="fixed inset-0 z-[80] bg-[#f4f7fb] text-slate-950 dark:bg-slate-950 dark:text-slate-100">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="personas-admin-title"
            className="mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#f4f7fb] dark:bg-slate-950"
          >
            <header className="shrink-0 border-b border-slate-200 bg-white px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={cerrarModuloPersonas}
                    aria-label="Volver a ajustes"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-[#102d92] dark:bg-slate-800 dark:text-blue-100"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div className="min-w-0">
                  <h3 id="personas-admin-title" className="text-lg font-black text-slate-950 dark:text-slate-100">
                    Gestión de contactos
                  </h3>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-300">
                    Clientes y productores registrados
                  </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={iniciarRegistroPersona}
                  className="inline-flex min-h-10 shrink-0 items-center rounded-[13px] bg-[#102d92] px-3 text-xs font-black text-white"
                >
                  Nuevo
                </button>
              </div>
              <input
                type="text"
                value={peopleSearch}
                maxLength={60}
                onChange={(event) => {
                  if (event.target.value.length >= 60) showLimitNotice();
                  setPeopleSearch(sanitizeSearchInput(event.target.value));
                }}
                placeholder="Buscar por nombre, documento o teléfono"
                className={`${fieldInputClass} mt-3 h-11`}
              />

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="min-w-0 rounded-[14px] border border-[#dbe2f0] bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <span className="block text-[0.58rem] font-black uppercase tracking-[0.08em] text-slate-500 dark:text-slate-300">
                    Tipo de contacto
                  </span>
                  <SmartSelect
                    value={peopleMode ?? 'todos'}
                    onChange={(event) =>
                      void cargarPersonasAdmin(
                        event.target.value as Exclude<PeopleAdminMode, null>,
                        { resetSearch: false },
                      )
                    }
                    className="mt-1 min-h-[32px] border-0 bg-transparent px-0 py-0 text-sm font-black text-slate-950 shadow-none focus:ring-0 dark:bg-transparent dark:text-slate-50"
                    aria-label="Tipo de contacto"
                  >
                    <option value="todos">Todos</option>
                    <option value="clientes">Clientes</option>
                    <option value="productores">Productores</option>
                    <option value="multirol">Multirol</option>
                  </SmartSelect>
                </label>
                <label className="min-w-0 rounded-[14px] border border-[#dbe2f0] bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <span className="block text-[0.58rem] font-black uppercase tracking-[0.08em] text-slate-500 dark:text-slate-300">
                    Ordenar por
                  </span>
                  <SmartSelect
                    value={peopleSortMode}
                    onChange={(event) =>
                      setPeopleSortMode(event.target.value as PeopleSortMode)
                    }
                    className="mt-1 min-h-[32px] border-0 bg-transparent px-0 py-0 text-sm font-black text-slate-950 shadow-none focus:ring-0 dark:bg-transparent dark:text-slate-50"
                    aria-label="Ordenar contactos"
                  >
                    <option value="recent">Más reciente</option>
                    <option value="oldest">Más antiguo</option>
                    <option value="az">Nombre A-Z</option>
                    <option value="za">Nombre Z-A</option>
                  </SmartSelect>
                </label>
              </div>
              <p className="mt-3 text-xs font-black text-slate-500 dark:text-slate-300">
                {peopleError
                  ? 'Contactos no disponibles'
                  : `${peopleFiltered.length} contacto${peopleFiltered.length === 1 ? '' : 's'}`}
              </p>
              {peopleSearchResult.isSimilar ? (
                <AppFeedbackMessage
                  variant="info"
                  description="Mostrando resultados similares"
                  className="mt-2"
                />
              ) : null}
              {success && success.includes('Contacto') ? (
                <AppFeedbackMessage
                  variant="success"
                  description={success}
                  className="mt-3"
                  action={
                    <button type="button" onClick={() => setSuccess(null)} aria-label="Cerrar aviso">
                      <X size={14} />
                    </button>
                  }
                />
              ) : null}
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {peopleLoading ? (
                <p className="rounded-[16px] bg-[#f8faff] px-4 py-6 text-center text-sm font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                  Cargando registros...
                </p>
              ) : peopleError ? (
                <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-5 text-left shadow-sm dark:border-amber-400/30 dark:bg-amber-500/10">
                  <p className="text-sm font-black text-amber-900 dark:text-amber-100">
                    No pudimos cargar los contactos
                  </p>
                  <p className="mt-1 text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Revisa tu conexión e intenta nuevamente.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      peopleMode &&
                      void cargarPersonasAdmin(peopleMode, { resetSearch: false })
                    }
                    className="mt-4 rounded-[12px] border border-amber-300 bg-white px-4 py-2 text-xs font-black text-amber-900 shadow-sm transition hover:bg-amber-100 dark:border-amber-400/40 dark:bg-slate-900 dark:text-amber-100 dark:hover:bg-slate-800"
                  >
                    Reintentar
                  </button>
                </div>
              ) : peopleFiltered.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <p className="font-bold text-slate-800 dark:text-slate-100">
                    {peopleEmptyTitle}
                  </p>
                  <p className="mt-1 font-semibold text-slate-500 dark:text-slate-300">
                    {peopleEmptyDescription}
                  </p>
                  <button
                    type="button"
                    onClick={iniciarRegistroPersona}
                    className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-[12px] bg-[#1f3fa7] px-4 text-sm font-bold text-white"
                  >
                    Nuevo contacto
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {peopleFiltered.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-[16px] border border-[#e2e8f4] bg-[#fbfcff] px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-950 dark:text-slate-100">
                            {item.nombre}
                          </p>
                          <span
                            className="mt-1 inline-flex rounded-full bg-[#eef4ff] px-2 py-0.5 text-[0.62rem] font-black text-[#102d92] dark:bg-blue-500/20 dark:text-blue-100"
                            aria-label={
                              item.roles.includes('CLIENTE') && item.roles.includes('PRODUCTOR')
                                ? 'Contacto Multirol: cliente y productor'
                                : item.roles.includes('CLIENTE')
                                  ? 'Contacto cliente'
                                  : 'Contacto productor'
                            }
                          >
                            {item.roles.includes('CLIENTE') && item.roles.includes('PRODUCTOR')
                              ? 'Multirol'
                              : item.roles.includes('CLIENTE')
                                ? 'Cliente'
                                : 'Productor'}
                          </span>
                          {item.roles.includes('CLIENTE') && item.roles.includes('PRODUCTOR') ? (
                            <p className="mt-1 text-xs font-bold text-[#334b85] dark:text-blue-100">
                              Cliente y productor
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-300">
                            {item.tipoDocumento === 'NIT' ? 'NIT' : 'Cédula'}: {item.documento || 'Pendiente'}
                          </p>
                          <p className="text-xs font-bold text-slate-400 dark:text-slate-400">
                            {item.telefono ? formatPhoneNumber(item.telefono) : 'Teléfono no registrado'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPeopleDetail(item)}
                            aria-label={`Ver detalle de ${item.nombre}`}
                            title="Ver detalle"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#1f3fa7] shadow-sm dark:bg-slate-800 dark:text-blue-100"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirEdicionPersona(item)}
                            aria-label={`Editar ${item.nombre}`}
                            title="Editar"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#eef4ff] text-[#1f3fa7] dark:bg-blue-500/20 dark:text-blue-100"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPeopleDeleteTarget(item)}
                            aria-label={`Eliminar ${item.nombre}`}
                            title="Eliminar"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                  <button
                    type="button"
                    onClick={iniciarRegistroPersona}
                    className="inline-flex min-h-[42px] w-full items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#173ea6] dark:border-slate-700 dark:bg-slate-900 dark:text-blue-100"
                  >
                    Registrar contacto
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {peopleDetail ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0f172a]/45 px-3 pb-3 pt-3 backdrop-blur-sm sm:items-center">
          <section className="w-full max-w-[410px] rounded-[22px] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[#1f3fa7]">Detalle</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">{peopleDetail.nombre}</h3>
                <p className="mt-1 text-xs font-black text-slate-500">
                  {peopleDetail.roles.includes('CLIENTE') && peopleDetail.roles.includes('PRODUCTOR')
                    ? 'Multirol · Cliente y productor'
                    : peopleDetail.roles.includes('CLIENTE')
                      ? 'Cliente'
                      : 'Productor'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPeopleDetail(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                aria-label="Cerrar detalle"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm font-semibold text-slate-600">
              <p>Nombre: <span className="font-black text-slate-900">{peopleDetail.nombre}</span></p>
              <p>Rol: <span className="font-black text-slate-900">{peopleDetail.roles.includes('CLIENTE') && peopleDetail.roles.includes('PRODUCTOR') ? 'Multirol' : peopleDetail.roles.includes('CLIENTE') ? 'Cliente' : 'Productor'}</span></p>
              {peopleDetail.roles.includes('CLIENTE') && peopleDetail.roles.includes('PRODUCTOR') ? (
                <p>Descripción: <span className="font-black text-slate-900">Cliente y productor</span></p>
              ) : null}
              <p>Documento: <span className="font-black text-slate-900">{peopleDetail.documento || 'Pendiente'}</span></p>
              <p>Teléfono: <span className="font-black text-slate-900">{peopleDetail.telefono ? formatPhoneNumber(peopleDetail.telefono) : 'No registrado'}</span></p>
              <p>Fecha: <span className="font-black text-slate-900">{peopleDetail.createdAt ? formatDate(peopleDetail.createdAt) : 'No disponible'}</span></p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => abrirEdicionPersona(peopleDetail)}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white"
              >
                <Pencil size={15} />
                Editar
              </button>
              <button
                type="button"
                onClick={() => setPeopleDeleteTarget(peopleDetail)}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[14px] bg-rose-50 px-4 text-sm font-black text-rose-700 ring-1 ring-rose-100"
              >
                <Trash2 size={15} />
                Eliminar
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {peopleEditing ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0f172a]/45 px-3 pb-3 pt-3 backdrop-blur-sm sm:items-center">
          <section className="w-full max-w-[410px] rounded-[22px] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-slate-950">Editar registro</h3>
              <button
                type="button"
                onClick={cerrarEdicionPersona}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                aria-label="Cerrar edición"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {peopleFormError ? (
                <AppFeedbackMessage variant="error" description={peopleFormError} />
              ) : null}
              <div className="rounded-[18px] border border-[#dbe5f4] bg-[#f8fbff] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[#334b85]">
                      Datos del contacto
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Importa nombre y celular desde la agenda del celular.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void importarPersonaDesdeContactos()}
                    aria-label="Importar cliente o productor desde los contactos del dispositivo"
                    className="inline-flex min-h-[38px] shrink-0 items-center justify-center rounded-[13px] border border-[#c8d5eb] bg-white px-3 text-xs font-black text-[#102d92]"
                  >
                    Importar desde contactos
                  </button>
                </div>
                {peopleImportMessage ? (
                  <p role="status" aria-live="polite" className="mt-2 text-xs font-bold text-[#102d92]">
                    {peopleImportMessage}
                  </p>
                ) : null}
                {peopleImportedPendingDocument ? (
                  <div role="alert" className="mt-2 rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">
                    <p className="font-black">Documento pendiente</p>
                    <p className="mt-1">Completa el tipo y número de documento antes de guardar este contacto.</p>
                  </div>
                ) : null}
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-black text-slate-700">
                  Rol en el negocio
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['CLIENTE', 'Cliente'],
                    ['PRODUCTOR', 'Productor'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        const rol = value as ContactoRol;
                        setPeopleForm((prev) => {
                          const selected = prev.roles.includes(rol);
                          const roles = selected
                            ? prev.roles.filter((item) => item !== rol)
                            : [...prev.roles, rol];
                          setPeopleFormErrors((current) => ({
                            ...current,
                            roles:
                              roles.length === 0
                                ? 'Selecciona al menos un rol para el contacto.'
                                : undefined,
                          }));
                          return { ...prev, roles };
                        });
                      }}
                      aria-pressed={peopleForm.roles.includes(value as ContactoRol)}
                      className={`min-h-[40px] rounded-[13px] text-xs font-black ${
                        peopleForm.roles.includes(value as ContactoRol)
                          ? 'bg-[#102d92] text-white'
                          : 'border border-[#d5deee] bg-white text-[#334b85]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {peopleForm.roles.includes('CLIENTE') && peopleForm.roles.includes('PRODUCTOR') ? (
                  <p className="mt-2 rounded-[12px] bg-[#eef4ff] px-3 py-2 text-xs font-bold text-[#102d92]">
                    Este contacto será Multirol y podrá participar en compras y ventas.
                  </p>
                ) : null}
              </label>
              {peopleFormErrors.roles ? <p className={fieldErrorClass}>{peopleFormErrors.roles}</p> : null}
              <label className="block">
                <span className={fieldLabelClass}>
                  Tipo de documento
                </span>
              <SmartSelect
                value={peopleForm.tipoDocumento}
                onChange={(event) =>
                  setPeopleForm((prev) => {
                    setPeopleImportedPendingDocument(false);
                    setPeopleFormError(null);
                    return {
                      ...prev,
                      tipoDocumento: event.target.value as DocumentType,
                      documento: '',
                    };
                  })
                }
                className="text-sm"
                aria-label="Tipo de documento"
              >
                <option value="">Selecciona el tipo de documento</option>
                <option value="CEDULA">Cédula</option>
                <option value="NIT">NIT</option>
                <option value="TI">Tarjeta de identidad</option>
                <option value="CE">Cédula de extranjería</option>
                <option value="PASAPORTE">Pasaporte</option>
                <option value="PEP">PEP</option>
                <option value="OTRO">Otro</option>
              </SmartSelect>
              </label>
              {peopleFormErrors.tipoDocumento ? <p className={fieldErrorClass}>{peopleFormErrors.tipoDocumento}</p> : null}
              <label className="block">
                <span className={fieldLabelClass}>
                  {peopleForm.tipoDocumento === 'NIT'
                    ? 'Nombre del negocio'
                    : 'Nombre completo'}
                </span>
              <input
                type="text"
                value={peopleForm.nombre}
                onChange={(event) =>
                  setPeopleForm((prev) => ({
                    ...prev,
                    nombre: event.target.value.replace(/\s{2,}/g, ' '),
                  }))
                }
                disabled={!peopleForm.tipoDocumento && !peopleImportedPendingDocument}
                className={`${fieldInputClass} disabled:bg-slate-100 disabled:text-slate-400`}
                placeholder={
                  peopleForm.tipoDocumento
                    ? peopleForm.tipoDocumento === 'NIT'
                      ? 'Nombre del negocio'
                      : 'Nombre completo'
                    : 'Primero selecciona el tipo de documento'
                }
              />
              </label>
              {peopleFormErrors.nombre ? <p className={fieldErrorClass}>{peopleFormErrors.nombre}</p> : null}
              <label className="block">
                <span className={fieldLabelClass}>
                  Número de documento
                </span>
              <input
                type="text"
                value={peopleForm.documento}
                onChange={(event) => {
                  setPeopleForm((prev) => {
                    setPeopleImportedPendingDocument(false);
                    const next = {
                      ...prev,
                      documento: prev.tipoDocumento
                        ? sanitizeDocumentInput(event.target.value, prev.tipoDocumento)
                        : '',
                    };
                    validarPersonaEnTiempoReal(next);
                    return next;
                  });
                }}
                disabled={!peopleForm.tipoDocumento}
                className={`${fieldInputClass} disabled:bg-slate-100 disabled:text-slate-400`}
                placeholder={
                  peopleForm.tipoDocumento
                    ? peopleForm.tipoDocumento === 'NIT'
                      ? '900123456-7'
                      : '1234567890'
                    : 'Luego podrás ingresar el documento'
                }
              />
              </label>
              {peopleFormErrors.documento ? <p className={fieldErrorClass}>{peopleFormErrors.documento}</p> : null}
              <label className="block">
                <span className={fieldLabelClass}>
                  Teléfono
                </span>
              <input
                type="text"
                value={peopleForm.telefono}
                onChange={(event) => {
                  setPeopleForm((prev) => {
                    const next = {
                      ...prev,
                      telefono: formatPhoneNumber(event.target.value),
                    };
                    validarPersonaEnTiempoReal(next);
                    return next;
                  });
                }}
                disabled={!peopleForm.tipoDocumento && !peopleImportedPendingDocument}
                className={`${fieldInputClass} disabled:bg-slate-100 disabled:text-slate-400`}
                placeholder={peopleForm.tipoDocumento ? '300 123 4567' : 'Opcional después del documento'}
              />
              </label>
              {peopleFormErrors.telefono ? <p className={fieldErrorClass}>{peopleFormErrors.telefono}</p> : null}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void guardarPersona()}
                  disabled={peopleLoading}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white disabled:opacity-70"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={cerrarEdicionPersona}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#334b85]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {peoplePhoneChoice ? (
        <div className="fixed inset-0 z-[96] flex items-end justify-center bg-[#0f172a]/45 px-3 pb-3 pt-3 backdrop-blur-sm sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="people-phone-choice-title"
            className="w-full max-w-[410px] rounded-[22px] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.24)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[#334b85]">
                  Selecciona un número
                </p>
                <h3 id="people-phone-choice-title" className="mt-1 text-lg font-black text-slate-950">
                  {peoplePhoneChoice.contact.name || 'Contacto'}
                </h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Este contacto tiene varios números guardados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPeoplePhoneChoice(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                aria-label="Cerrar selección de número"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {peoplePhoneChoice.phones.map((phone, index) => (
                <button
                  key={`${phone.number}-${index}`}
                  type="button"
                  onClick={() => aplicarContactoImportadoPersona(peoplePhoneChoice.contact, phone)}
                  className="flex w-full items-center justify-between gap-3 rounded-[16px] border border-[#dbe5f4] bg-[#f8fbff] p-3 text-left"
                >
                  <span>
                    <span className="block text-xs font-black uppercase tracking-[0.08em] text-slate-500">
                      {phone.label || 'Número'}
                    </span>
                    <span className="mt-1 block text-sm font-black text-slate-950">
                      {phone.number}
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-[#102d92]" aria-hidden="true" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPeoplePhoneChoice(null)}
              className="mt-4 inline-flex min-h-[42px] w-full items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#334b85]"
            >
              Cancelar
            </button>
          </section>
        </div>
      ) : null}

      {showPeopleDraftModal && peopleDraft ? (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-[#0f172a]/45 px-3 pb-3 pt-3 backdrop-blur-sm sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="people-draft-title"
            className="w-full max-w-[390px] rounded-[22px] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.24)] dark:border dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[#1f3fa7]">
                  Edición sin finalizar
                </p>
                <h3 id="people-draft-title" className="mt-1 text-lg font-black text-slate-950">
                  Encontramos cambios que no fueron guardados.
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPeopleDraftModal(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                aria-label="Cerrar aviso"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPeopleEditing(peopleDraft.editing);
                  setPeopleForm(peopleDraft.form);
                  setPeopleFormErrors({});
                  setPeopleFormError(null);
                  setShowPeopleDraftModal(false);
                }}
                className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white"
              >
                Continuar edición
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeopleDraft(null);
                  setShowPeopleDraftModal(false);
                }}
                className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#334b85]"
              >
                Descartar cambios
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {peopleDeleteTarget ? (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-[#0f172a]/45 px-3 pb-3 pt-3 backdrop-blur-sm sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-contact-title"
            className="w-full max-w-[390px] rounded-[22px] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.24)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-rose-600">
                  ¿Eliminar contacto?
                </p>
                <h3 id="delete-contact-title" className="mt-1 text-lg font-black text-slate-950 dark:text-slate-100">
                  {peopleDeleteTarget.nombre}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPeopleDeleteTarget(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500 dark:bg-slate-800 dark:text-slate-200"
                aria-label="Cerrar eliminación"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
              Esta acción no se puede deshacer. El contacto se eliminará permanentemente.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPeopleDeleteTarget(null)}
                className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#334b85] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                No eliminar
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = peopleDeleteTarget;
                  setPeopleDeleteTarget(null);
                  void eliminarPersona(target);
                }}
                className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] bg-rose-600 px-4 text-sm font-black text-white ring-1 ring-rose-500/30"
              >
                Eliminar
              </button>
            </div>
          </section>
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
