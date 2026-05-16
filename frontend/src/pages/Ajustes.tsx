import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronRight,
  Droplets,
  Eye,
  FlaskConical,
  LifeBuoy,
  ListChecks,
  Lock,
  LogOut,
  Pencil,
  PlayCircle,
  ScanSearch,
  Save,
  Settings,
  Shield,
  Trash2,
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
import { applySecadoToLots } from '../utils/secadoFlow';
import { ENABLE_SECADO_PROTOTYPE } from '../config/features';
import {
  BUSINESS_NAME_MAX_LENGTH,
  validateBusinessName,
} from '../utils/registerValidators';
import {
  formatPhoneNumber,
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
type ProfileErrors = Partial<Record<keyof ProfileSettings, string>>;
type PeopleAdminMode = 'todos' | 'clientes' | 'productores' | null;
type PeopleSortMode = 'recent' | 'oldest' | 'az' | 'za' | 'doc-asc' | 'doc-desc';
type PeopleAdminItem = {
  id: string;
  contactType: 'cliente' | 'productor';
  nombre: string;
  documento: string;
  tipoDocumento: DocumentType;
  telefono: string;
  createdAt?: string;
};
type PeopleAdminForm = {
  nombre: string;
  tipoDocumento: DocumentType | '';
  documento: string;
  telefono: string;
};

const PROFILE_NAME_MAX_LENGTH = 60;
const PROFILE_EMAIL_MAX_LENGTH = 60;

function validateProfileName(value: string) {
  const result = validatePersonName(value, 'El nombre');
  return result.isValid ? null : result.message ?? 'Corrige el nombre para continuar.';
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
  const raw = value.trim();
  const digits = sanitizeDigits(raw, 10);
  if (!raw) return null;
  if (/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(raw)) {
    return 'No uses letras ni símbolos.';
  }
  if (/[^\d\s]/.test(raw)) return 'No uses letras ni símbolos.';
  if (digits.length !== 10) return 'El celular debe tener 10 números.';
  if (!digits.startsWith('3')) return 'El celular debe empezar por 3.';
  return null;
}

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('') || 'CS';
}

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
    message === 'Ingresa un celular colombiano válido.' ||
    message === 'El celular debe tener 10 números.' ||
    message === 'El celular debe empezar por 3.' ||
    message === 'No uses letras ni símbolos.'
  ) {
    return 'profile';
  }

  if (
    message === 'Escribe el nombre de la empresa.' ||
    message === 'Selecciona el tipo de empresa.' ||
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
    message === 'Ingresa un celular colombiano válido.' ||
    message === 'El celular debe tener 10 números.' ||
    message === 'El celular debe empezar por 3.' ||
    message === 'No uses letras ni símbolos.'
  ) {
    return createGuidedError(
      message,
      'Revisa el celular.',
      'Debe ser un celular colombiano.',
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
    telefono: formatPhoneNumber(user?.telefono ?? ''),
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
  const [isViewingPublicProfile, setIsViewingPublicProfile] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isEditingBodega, setIsEditingBodega] = useState(false);
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({});
  const [nombreLimitNotice, setNombreLimitNotice] = useState(false);
  const [peopleMode, setPeopleMode] = useState<PeopleAdminMode>(null);
  const [clientesAdmin, setClientesAdmin] = useState<PeopleAdminItem[]>([]);
  const [productoresAdmin, setProductoresAdmin] = useState<PeopleAdminItem[]>([]);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [peopleSortMode, setPeopleSortMode] = useState<PeopleSortMode>('recent');
  const [peopleSortOpen, setPeopleSortOpen] = useState(false);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [peopleDetail, setPeopleDetail] = useState<PeopleAdminItem | null>(null);
  const [peopleEditing, setPeopleEditing] = useState<PeopleAdminItem | null>(null);
  const [peopleDeleteTarget, setPeopleDeleteTarget] =
    useState<PeopleAdminItem | null>(null);
  const [secadoActionsOpen, setSecadoActionsOpen] = useState(false);
  const [peopleForm, setPeopleForm] = useState<PeopleAdminForm>({
    nombre: '',
    tipoDocumento: '',
    documento: '',
    telefono: '',
  });
  const [peopleFormErrors, setPeopleFormErrors] = useState<
    Partial<Record<keyof PeopleAdminForm, string>>
  >({});

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
    setIsViewingPublicProfile(false);
  };

  const abrirEditorPerfil = () => {
    clearFeedback();
    setIsEditingProfile(true);
    setIsViewingPublicProfile(false);
    setIsEditingCompany(false);
    setIsEditingBodega(false);
  };

  const cerrarEditorPerfil = () => {
    clearFeedback();
    setIsEditingProfile(false);
  };

  const abrirPerfilPublico = () => {
    clearFeedback();
    setIsViewingPublicProfile(true);
    setIsEditingProfile(false);
    setIsEditingCompany(false);
    setIsEditingBodega(false);
  };

  const cerrarEditorBodega = () => {
    clearFeedback();
    setIsEditingBodega(false);
  };

  const mapClienteAdmin = (cliente: ClienteItem): PeopleAdminItem => ({
    id: cliente.id,
    contactType: 'cliente',
    nombre: cliente.nombre,
    documento: cliente.documento ?? '',
    tipoDocumento:
      cliente.tipoDocumento ?? (cliente.documento?.includes('-') ? 'NIT' : 'CEDULA'),
    telefono: cliente.telefono ?? '',
    createdAt: cliente.createdAt,
  });

  const mapProductorAdmin = (productor: ProductorItem): PeopleAdminItem => ({
    id: productor.id,
    contactType: 'productor',
    nombre: productor.nombre,
    documento: productor.documento ?? '',
    tipoDocumento: productor.tipoDocumento ?? 'CEDULA',
    telefono: productor.telefono ?? '',
    createdAt: productor.createdAt,
  });

  const cargarPersonasAdmin = async (mode: Exclude<PeopleAdminMode, null>) => {
    setPeopleMode(mode);
    setPeopleSearch('');
    setPeopleError(null);
    setPeopleLoading(true);
    try {
      const [clientesData, productoresData] = await Promise.all([
        mode === 'productores' ? Promise.resolve(null) : listarClientes(),
        mode === 'clientes' ? Promise.resolve(null) : listarProductores(),
      ]);
      if (clientesData) setClientesAdmin(clientesData.map(mapClienteAdmin));
      if (productoresData) {
        setProductoresAdmin(productoresData.map(mapProductorAdmin));
      }
    } catch {
      setPeopleError('No pudimos cargar los registros. Intenta nuevamente.');
    } finally {
      setPeopleLoading(false);
    }
  };

  useEffect(() => {
    const nextNombre = profile.nombre || user?.name || '';
    const nextCorreo = profile.correo || user?.email || '';
    const nextTelefono = profile.telefono || formatPhoneNumber(user?.telefono ?? '');
    const nextTipo =
      company.tipoEmpresa ||
      (user?.tipoOrganizacion
        ? user.tipoOrganizacion.charAt(0) +
          user.tipoOrganizacion.slice(1).toLowerCase()
        : 'Compraventa');

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
    profile.telefono,
    user?.name,
    user?.email,
    user?.telefono,
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

  const peopleItems =
    peopleMode === 'clientes'
      ? clientesAdmin
      : peopleMode === 'productores'
        ? productoresAdmin
        : [...clientesAdmin, ...productoresAdmin];
  const peopleFiltered = peopleItems
    .filter((item) => {
    const term = peopleSearch.trim().toLowerCase();
    if (!term) return true;
    return [item.nombre, item.documento, item.telefono]
      .join(' ')
      .toLowerCase()
      .includes(term);
    })
    .sort((a, b) => {
      if (peopleSortMode === 'oldest') {
        return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
      }
      if (peopleSortMode === 'az') return a.nombre.localeCompare(b.nombre, 'es');
      if (peopleSortMode === 'za') return b.nombre.localeCompare(a.nombre, 'es');
      if (peopleSortMode === 'doc-asc') return a.documento.localeCompare(b.documento);
      if (peopleSortMode === 'doc-desc') return b.documento.localeCompare(a.documento);
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });

  const abrirEdicionPersona = (item: PeopleAdminItem) => {
    setPeopleEditing(item);
    setPeopleDetail(null);
    setPeopleForm({
      nombre: item.nombre,
      tipoDocumento: item.tipoDocumento,
      documento: item.documento,
      telefono: item.telefono ? formatPhoneNumber(item.telefono) : '',
    });
    setPeopleFormErrors({});
  };

  const guardarPerfil = () => {
    clearFeedback();
    const telefono = sanitizeDigits(profile.telefono, 10);
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
        'Ingresa un celular colombiano válido.';
      setProfileErrors(nextErrors);
      setError(message);
      setFloatingError(getAjustesGuidance(message));
      return;
    }

    setProfile((prev) => ({
      ...prev,
      nombre: normalizeHumanName(prev.nombre),
      correo: prev.correo.trim().slice(0, PROFILE_EMAIL_MAX_LENGTH),
      telefono,
    }));
    setProfileErrors({});
    setSuccess('Perfil actualizado correctamente.');
    setIsEditingProfile(false);
    setIsViewingPublicProfile(true);
  };

  const guardarEmpresa = () => {
    clearFeedback();
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
      const message = 'Selecciona el tipo de empresa.';
      setError(message);
      setFloatingError(getAjustesGuidance(message));
      return;
    }
    setCompany((prev) => ({
      ...prev,
      nombreEmpresa: normalizeCompanyName(prev.nombreEmpresa),
    }));
    setSuccess('Información de la empresa actualizada.');
    setIsEditingCompany(false);
  };

  const guardarPersonaAdmin = async () => {
    if (!peopleMode || !peopleEditing) return;
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
    const telefono = sanitizeDigits(peopleForm.telefono, 10);
    const telefonoError = validateColombianPhone(peopleForm.telefono);
    const duplicates = [...clientesAdmin, ...productoresAdmin].some(
      (item) =>
        !(item.id === peopleEditing.id && item.contactType === peopleEditing.contactType) &&
        sanitizeDigits(item.documento, 10) === sanitizeDigits(documento, 10),
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
      setSuccess('Registro actualizado correctamente.');
      setPeopleEditing(null);
      setPeopleFormErrors({});
    } catch {
      setPeopleError('No pudimos guardar los cambios. Intenta otra vez.');
    } finally {
      setPeopleLoading(false);
    }
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
      const message = 'No pudimos guardar la bodega. Intenta nuevamente.';
      setError(message);
    }
  };

  const activePeopleItems =
    peopleMode === 'clientes'
      ? clientesAdmin
      : peopleMode === 'productores'
        ? productoresAdmin
        : [...clientesAdmin, ...productoresAdmin];
  const activePeopleLabel =
    peopleMode === 'clientes'
      ? 'Clientes registrados'
      : peopleMode === 'productores'
        ? 'Productores registrados'
        : 'Gestión de contactos';
  const activePeopleSingular =
    peopleEditing?.contactType === 'productor' ? 'productor' : 'cliente';
  const filteredPeopleItems = activePeopleItems.filter((item) => {
    const term = peopleSearch.trim().toLowerCase();
    if (!term) return true;
    return [item.nombre, item.documento, item.telefono]
      .join(' ')
      .toLowerCase()
      .includes(term);
  });
  const recentPeopleItems = filteredPeopleItems.slice(0, 4);

  const cargarPersonas = async (mode: Exclude<PeopleAdminMode, null>) => {
    setPeopleLoading(true);
    setPeopleError(null);
    try {
      const [clientes, productores] = await Promise.all([
        mode === 'productores' ? Promise.resolve(null) : listarClientes(),
        mode === 'clientes' ? Promise.resolve(null) : listarProductores(),
      ]);
      if (clientes) setClientesAdmin(clientes.map(mapClienteAdmin));
      if (productores) setProductoresAdmin(productores.map(mapProductorAdmin));
    } catch {
      setPeopleError(`No pudimos cargar los ${mode}. Intenta nuevamente.`);
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

  const iniciarEdicionPersona = (item: PeopleAdminItem) => {
    setPeopleDetail(null);
    setPeopleEditing(item);
    setPeopleForm({
      nombre: item.nombre,
      tipoDocumento: item.tipoDocumento,
      documento: item.documento,
      telefono: formatPhoneNumber(item.telefono),
    });
    setPeopleFormErrors({});
    setPeopleFormError(null);
  };

  const iniciarRegistroPersona = () => {
    setPeopleDetail(null);
    setPeopleEditing({
      id: '',
      contactType: peopleMode === 'productores' ? 'productor' : 'cliente',
      nombre: '',
      tipoDocumento: 'CEDULA',
      documento: '',
      telefono: '',
    });
    setPeopleForm({
      nombre: '',
      tipoDocumento: 'CEDULA',
      documento: '',
      telefono: '',
    });
    setPeopleFormErrors({});
    setPeopleFormError(null);
  };

  const [peopleFormError, setPeopleFormError] = useState<string | null>(null);

  const guardarPersona = async () => {
    if (!peopleMode || !peopleEditing) return;

    const tipoDocumento = peopleForm.tipoDocumento || 'CEDULA';
    const nombreNormalizado =
      tipoDocumento === 'NIT'
        ? normalizeCompanyName(peopleForm.nombre)
        : normalizeHumanName(peopleForm.nombre);
    const documentoNormalizado = normalizeDocumentForStorage(
      peopleForm.documento,
      tipoDocumento,
    );
    const telefonoNormalizado = sanitizeDigits(peopleForm.telefono, 10);
    const nextErrors: Partial<Record<keyof PeopleAdminForm, string>> = {};
    const nombreValidation =
      tipoDocumento === 'NIT'
        ? validateCompanyName(peopleForm.nombre)
        : validatePersonName(peopleForm.nombre, 'El nombre');
    const documentoValidation = validateDocumentNumber(peopleForm.documento, 'El documento', {
      type: tipoDocumento,
    });
    const telefonoValidation = validatePhoneNumber(peopleForm.telefono, 'El celular', {
      optional: true,
    });

    if (!peopleForm.tipoDocumento) nextErrors.tipoDocumento = 'Selecciona el tipo de documento.';
    if (!nombreValidation.isValid) nextErrors.nombre = nombreValidation.message;
    if (!documentoValidation.isValid) nextErrors.documento = documentoValidation.message;
    if (!telefonoValidation.isValid) nextErrors.telefono = telefonoValidation.message;

    const duplicated = [...clientesAdmin, ...productoresAdmin].find(
      (item) =>
        !(item.id === peopleEditing.id && item.contactType === peopleEditing.contactType) &&
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

    try {
      const payload = {
        nombre: nombreNormalizado,
        tipoDocumento,
        documento: documentoNormalizado,
        telefono: telefonoNormalizado || undefined,
      };
      const saved =
        peopleEditing.contactType === 'cliente'
          ? peopleEditing.id
            ? mapClienteAdmin(await actualizarCliente(peopleEditing.id, payload))
            : mapClienteAdmin(await crearCliente(payload))
          : peopleEditing.id
            ? mapProductorAdmin(await actualizarProductor(peopleEditing.id, payload))
            : mapProductorAdmin(await crearProductor(payload));

      if (peopleEditing.contactType === 'cliente') {
        setClientesAdmin((items) => [
          saved,
          ...items.filter((item) => item.id !== saved.id),
        ]);
      } else {
        setProductoresAdmin((items) => [
          saved,
          ...items.filter((item) => item.id !== saved.id),
        ]);
      }
      setPeopleEditing(null);
      setPeopleFormErrors({});
      setPeopleFormError(null);
      setSuccess(`${peopleEditing.contactType === 'cliente' ? 'Cliente' : 'Productor'} guardado correctamente.`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `No pudimos guardar el ${activePeopleSingular}.`;
      setPeopleFormError(message);
    }
  };

  const eliminarPersona = async (item: PeopleAdminItem) => {
    setPeopleError(null);
    setPeopleLoading(true);
    try {
      if (item.contactType === 'cliente') {
        await eliminarCliente(item.id);
        setClientesAdmin((items) => items.filter((current) => current.id !== item.id));
      } else {
        await eliminarProductor(item.id);
        setProductoresAdmin((items) => items.filter((current) => current.id !== item.id));
      }
      setPeopleDetail(null);
      setSuccess(
        `${item.contactType === 'cliente' ? 'Cliente' : 'Productor'} eliminado correctamente.`,
      );
    } catch {
      setPeopleError('No pudimos eliminar el contacto. Intenta nuevamente.');
    } finally {
      setPeopleLoading(false);
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
      onClick: () => setSecadoActionsOpen(true),
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
      onClick: abrirPerfilPublico,
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
      id: 'gestion-contactos',
      title: 'Gestión de contactos',
      description: 'Clientes y productores registrados',
      icon: Users2,
      iconStyle: 'bg-[#f3f6ff] text-[#5b6f9d]',
      onClick: () => void cargarPersonasAdmin('todos'),
    },
    {
      id: 'usuarios-sistema',
      title: 'Usuarios del sistema',
      description: 'Roles y permisos',
      icon: Shield,
      iconStyle: 'bg-[#f3f6ff] text-[#5b6f9d]',
      onClick: undefined,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 pb-[150px] text-slate-900">
      <div className="mx-auto flex w-full max-w-[430px] flex-col gap-4">
        <header className="relative flex items-center justify-center py-1">
          <button
            type="button"
            onClick={() => navigate('/inicio')}
            aria-label="Volver al inicio"
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
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={abrirEditorPerfil}
                aria-label="Editar perfil"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[13px] border border-[#d6deef] bg-[#f9fbff] text-[#102d92]"
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={() => void cerrarSesion()}
                disabled={cerrandoSesion}
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[13px] border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut size={15} />
                {cerrandoSesion ? 'Saliendo...' : 'Cerrar sesión'}
              </button>
            </div>
          </div>

          {isViewingPublicProfile ? (
            <div className="mt-4 rounded-[18px] border border-[#dbe5f7] bg-[#f8fbff] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#102d92] text-base font-black text-white">
                  {getInitials(profile.nombre || company.nombreEmpresa)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-slate-900">
                    {company.nombreEmpresa || profile.nombre || 'CaféSmart'}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">
                    {company.tipoEmpresa || 'Compraventa'}
                  </p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                  Activo
                </span>
              </div>
              <div className="mt-4 grid gap-2 text-sm">
                <p className="rounded-[14px] bg-white px-3 py-2 font-semibold text-slate-700">
                  {profile.correo || 'Correo no registrado'}
                </p>
                <p className="rounded-[14px] bg-white px-3 py-2 font-semibold text-slate-700">
                  {profile.telefono
                    ? formatPhoneNumber(profile.telefono)
                    : 'Teléfono no registrado'}
                </p>
              </div>
              <button
                type="button"
                onClick={abrirEditorPerfil}
                className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center rounded-[14px] border border-[#cdd8ef] bg-white px-4 text-sm font-black text-[#102d92]"
              >
                Editar perfil
              </button>
            </div>
          ) : null}

          {isEditingProfile ? (
            <div className="mt-4 space-y-3 rounded-[18px] border border-[#e7ebf6] bg-[#fbfcff] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-black text-slate-950">
                  Editar perfil
                </h3>
                <button
                  type="button"
                  onClick={cerrarEditorPerfil}
                  aria-label="Cerrar edición de perfil"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm"
                >
                  <X size={18} />
                </button>
              </div>
              <div>
              <label className="mb-2 block text-sm font-black text-slate-900">
                Nombre completo
              </label>
              <input
                type="text"
                value={profile.nombre}
                maxLength={PROFILE_NAME_MAX_LENGTH}
                onChange={(event) => {
                  const next = event.target.value
                    .replace(/\s{2,}/g, ' ')
                    .slice(0, PROFILE_NAME_MAX_LENGTH);
                  if (event.target.value.length >= PROFILE_NAME_MAX_LENGTH) {
                    setNombreLimitNotice(true);
                  }
                  setProfile((prev) => ({
                    ...prev,
                    nombre: next,
                  }));
                  setProfileErrors((prev) => ({
                    ...prev,
                    nombre: validateProfileName(next) ?? undefined,
                  }));
                  clearFeedback();
                }}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
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
                <p className="mt-1 text-xs font-bold text-rose-600">
                  {profileErrors.nombre}
                </p>
              ) : null}
              </div>
              <div>
              <label className="mb-2 block text-sm font-black text-slate-900">
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
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
                placeholder="Correo electrónico"
              />
              {profileErrors.correo ? (
                <p className="mt-1 text-xs font-bold text-rose-600">
                  {profileErrors.correo}
                </p>
              ) : null}
              </div>
              <div>
              <label className="mb-2 block text-sm font-black text-slate-900">
                Número de teléfono
              </label>
              <p className="mb-2 text-xs font-semibold leading-5 text-slate-500">
                Número celular colombiano.
              </p>
              <input
                type="tel"
                value={profile.telefono}
                inputMode="numeric"
                maxLength={12}
                onChange={(event) => {
                  const raw = event.target.value;
                  const hasInvalid = /[^\d\s]/.test(raw);
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
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
                placeholder="Ej. 300 123 4567"
              />
              {profileErrors.telefono ? (
                <p className="mt-1 text-xs font-bold text-rose-600">
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
                  onClick={guardarPerfil}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 py-2.5 text-sm font-black text-white"
                >
                  <Save size={15} />
                  Guardar perfil
                </button>
                <button
                  type="button"
                  onClick={cerrarEditorPerfil}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 py-2.5 text-sm font-black text-[#334b85]"
                >
                  Cancelar
                </button>
              </div>
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
                  onClick={item.onClick}
                  disabled={!item.onClick}
                  className={`flex w-full items-start gap-2.5 rounded-[12px] border border-[#e5e9f5] bg-white px-3 py-3 text-left shadow-sm ${!item.onClick ? 'opacity-80' : ''}`}
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
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f172a]/45 px-5 py-6 backdrop-blur-sm">
            <section className="max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-[22px] border border-[#e6e8f3] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[1.2rem] font-black text-slate-900">
                  Editar empresa
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditingCompany(false)}
                  aria-label="Cerrar edición de empresa"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-4 space-y-3">
              <input
                type="text"
                value={company.nombreEmpresa}
                onChange={(event) => {
                  setCompany((prev) => ({
                    ...prev,
                    nombreEmpresa: event.target.value.slice(
                      0,
                      BUSINESS_NAME_MAX_LENGTH,
                    ),
                  }));
                  clearFeedback();
                }}
                maxLength={BUSINESS_NAME_MAX_LENGTH}
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#102d92]"
                placeholder="Nombre de la empresa"
              />
              <div className="-mt-1 flex justify-end">
                <span
                  className={`text-xs font-bold ${
                    company.nombreEmpresa.length >= BUSINESS_NAME_MAX_LENGTH
                      ? 'text-amber-600'
                      : 'text-slate-500'
                  }`}
                >
                  {company.nombreEmpresa.length}/{BUSINESS_NAME_MAX_LENGTH}
                </span>
              </div>
              <select
                aria-label="Tipo de empresa"
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={guardarEmpresa}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 py-2.5 text-sm font-black text-white"
                >
                  <Save size={15} />
                  Guardar empresa
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingCompany(false)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 py-2.5 text-sm font-black text-[#334b85]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </section>
        </div>
        ) : null}

        {error && !activeErrorSection && !isEditingBodega ? (
          <InlineGuidedError message={getAjustesGuidance(error)} />
        ) : null}

        {success ? (
          <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

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

      {peopleMode ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#0f172a]/45 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="personas-admin-title"
            className="flex max-h-[88dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.24)]"
          >
            <header className="shrink-0 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 id="personas-admin-title" className="text-lg font-black text-slate-950">
                    Gestión de contactos
                  </h3>
                  <p className="text-xs font-bold text-slate-500">
                    Clientes y productores registrados
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPeopleMode(null);
                    setPeopleDetail(null);
                    setPeopleEditing(null);
                  }}
                  aria-label="Cerrar listado"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                >
                  <X size={18} />
                </button>
              </div>
              <input
                type="text"
                value={peopleSearch}
                onChange={(event) => setPeopleSearch(event.target.value)}
                placeholder="Buscar por nombre, documento o teléfono"
                className="mt-3 h-11 w-full rounded-[14px] border border-[#dbe2f0] bg-[#f8faff] px-4 text-sm font-semibold text-slate-900 outline-none focus:border-[#1f3fa7]"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {[
                  { value: 'todos', label: 'Todos' },
                  { value: 'clientes', label: 'Clientes' },
                  { value: 'productores', label: 'Productores' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPeopleMode(option.value as Exclude<PeopleAdminMode, null>)}
                    className={`min-h-[34px] rounded-full px-3 text-xs font-black ${
                      peopleMode === option.value
                        ? 'bg-[#102d92] text-white'
                        : 'border border-[#dbe2f0] bg-white text-[#334b85]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                <div className="relative ml-auto">
                  <button
                    type="button"
                    onClick={() => setPeopleSortOpen((open) => !open)}
                    className="min-h-[34px] rounded-full border border-[#dbe2f0] bg-white px-3 text-xs font-black text-[#334b85]"
                  >
                    Filtrar
                  </button>
                  {peopleSortOpen ? (
                    <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-[14px] border border-[#dbe2f0] bg-white p-1.5 shadow-[0_18px_42px_rgba(15,23,42,0.16)]">
                      {[
                        ['recent', 'Más recientes'],
                        ['oldest', 'Más antiguos'],
                        ['az', 'A-Z'],
                        ['za', 'Z-A'],
                        ['doc-asc', 'Número menor a mayor'],
                        ['doc-desc', 'Número mayor a menor'],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setPeopleSortMode(value as PeopleSortMode);
                            setPeopleSortOpen(false);
                          }}
                          className={`block w-full rounded-[10px] px-3 py-2 text-left text-xs font-black ${
                            peopleSortMode === value
                              ? 'bg-[#eef4ff] text-[#102d92]'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 text-xs font-black text-slate-500">
                {peopleFiltered.length} contacto{peopleFiltered.length === 1 ? '' : 's'}
              </p>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {peopleLoading ? (
                <p className="rounded-[16px] bg-[#f8faff] px-4 py-6 text-center text-sm font-bold text-slate-500">
                  Cargando registros...
                </p>
              ) : peopleError ? (
                <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-bold text-rose-700">
                  <p>{peopleError}</p>
                  <button
                    type="button"
                    onClick={() => peopleMode && void cargarPersonasAdmin(peopleMode)}
                    className="mt-3 rounded-[12px] bg-[#102d92] px-4 py-2 text-xs font-black text-white"
                  >
                    Reintentar
                  </button>
                </div>
              ) : peopleFiltered.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-8 text-center text-sm text-slate-500">
                  <p className="font-bold text-slate-800">
                    Aún no hay contactos registrados
                  </p>
                  <button
                    type="button"
                    onClick={iniciarRegistroPersona}
                    className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-[12px] bg-[#1f3fa7] px-4 text-sm font-bold text-white"
                  >
                    Registrar contacto
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {peopleFiltered.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-[16px] border border-[#e2e8f4] bg-[#fbfcff] px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-950">
                            {item.nombre}
                          </p>
                          <span className="mt-1 inline-flex rounded-full bg-[#eef4ff] px-2 py-0.5 text-[0.62rem] font-black text-[#102d92]">
                            {item.contactType === 'cliente' ? 'Cliente' : 'Productor'}
                          </span>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            {item.tipoDocumento === 'NIT' ? 'NIT' : 'Cédula'}: {item.documento || 'Pendiente'}
                          </p>
                          <p className="text-xs font-bold text-slate-400">
                            {item.telefono ? formatPhoneNumber(item.telefono) : 'Teléfono no registrado'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPeopleDetail(item)}
                            aria-label={`Ver detalle de ${item.nombre}`}
                            title="Ver detalle"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#1f3fa7] shadow-sm"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirEdicionPersona(item)}
                            aria-label={`Editar ${item.nombre}`}
                            title="Editar"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#eef4ff] text-[#1f3fa7]"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPeopleDeleteTarget(item)}
                            aria-label={`Eliminar ${item.nombre}`}
                            title="Eliminar"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-700"
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
                    className="inline-flex min-h-[42px] w-full items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#173ea6]"
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
                  {peopleDetail.contactType === 'cliente' ? 'Cliente' : 'Productor'}
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
              <p>Tipo: <span className="font-black text-slate-900">{peopleDetail.contactType === 'cliente' ? 'Cliente' : 'Productor'}</span></p>
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
                onClick={() => setPeopleEditing(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                aria-label="Cerrar edición"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-black text-slate-700">
                  Tipo de documento
                </span>
              <select
                value={peopleForm.tipoDocumento}
                onChange={(event) =>
                  setPeopleForm((prev) => ({
                    ...prev,
                    tipoDocumento: event.target.value as DocumentType,
                    documento: '',
                  }))
                }
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none"
                aria-label="Tipo de documento"
              >
                <option value="CEDULA">Cédula</option>
                <option value="NIT">NIT</option>
              </select>
              </label>
              {peopleFormErrors.tipoDocumento ? <p className="text-xs font-bold text-rose-700">{peopleFormErrors.tipoDocumento}</p> : null}
              <label className="block">
                <span className="mb-1.5 block text-xs font-black text-slate-700">
                  {peopleForm.tipoDocumento === 'NIT'
                    ? 'Nombre completo / Nombre de la empresa'
                    : 'Nombre completo / Nombre de la empresa'}
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
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none"
                placeholder={peopleForm.tipoDocumento === 'NIT' ? 'Nombre de la empresa' : 'Nombre completo'}
              />
              </label>
              {peopleFormErrors.nombre ? <p className="text-xs font-bold text-rose-700">{peopleFormErrors.nombre}</p> : null}
              <label className="block">
                <span className="mb-1.5 block text-xs font-black text-slate-700">
                  Número de documento
                </span>
              <input
                type="text"
                value={peopleForm.documento}
                onChange={(event) =>
                  setPeopleForm((prev) => ({
                    ...prev,
                    documento: sanitizeDocumentInput(
                      event.target.value,
                      prev.tipoDocumento || 'CEDULA',
                    ),
                  }))
                }
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none"
                placeholder={peopleForm.tipoDocumento === 'NIT' ? '900123456-7' : '1234567890'}
              />
              </label>
              {peopleFormErrors.documento ? <p className="text-xs font-bold text-rose-700">{peopleFormErrors.documento}</p> : null}
              <label className="block">
                <span className="mb-1.5 block text-xs font-black text-slate-700">
                  Número celular colombiano
                </span>
              <input
                type="text"
                value={peopleForm.telefono}
                onChange={(event) =>
                  setPeopleForm((prev) => ({
                    ...prev,
                    telefono: formatPhoneNumber(event.target.value),
                  }))
                }
                className="w-full rounded-[14px] border border-[#dfe5f2] bg-white px-4 py-3 text-sm font-semibold outline-none"
                placeholder="300 123 4567"
              />
              </label>
              {peopleFormErrors.telefono ? <p className="text-xs font-bold text-rose-700">{peopleFormErrors.telefono}</p> : null}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void guardarPersonaAdmin()}
                  disabled={peopleLoading}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white disabled:opacity-70"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setPeopleEditing(null)}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#334b85]"
                >
                  Cancelar
                </button>
              </div>
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
                <h3 id="delete-contact-title" className="mt-1 text-lg font-black text-slate-950">
                  {peopleDeleteTarget.nombre}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPeopleDeleteTarget(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                aria-label="Cerrar eliminación"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              Esta acción no se puede deshacer. El contacto se eliminará permanentemente.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPeopleDeleteTarget(null)}
                className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#334b85]"
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
                className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] bg-rose-50 px-4 text-sm font-black text-rose-700 ring-1 ring-rose-100"
              >
                Eliminar
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {secadoActionsOpen ? (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-[#0f172a]/45 px-3 pb-3 pt-3 backdrop-blur-sm sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="secado-actions-title"
            className="w-full max-w-[390px] rounded-[22px] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.24)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[#1f3fa7]">
                  Proceso de secado
                </p>
                <h3 id="secado-actions-title" className="mt-1 text-lg font-black text-slate-950">
                  ¿Qué deseas hacer?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSecadoActionsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                aria-label="Cerrar proceso de secado"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => {
                  setSecadoActionsOpen(false);
                  navigate('/inventario/secado/inicio');
                }}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white"
              >
                <PlayCircle size={16} />
                Iniciar secado
              </button>
              <button
                type="button"
                onClick={() => {
                  setSecadoActionsOpen(false);
                  navigate('/inventario/secados');
                }}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#334b85]"
              >
                <ListChecks size={16} />
                Ver secados activos
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
