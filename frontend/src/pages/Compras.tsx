import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeAlert,
  CalendarDays,
  Check,
  Coffee,
  Frown,
  Leaf,
  LoaderCircle,
  Meh,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Smile,
  SunMedium,
  Trash2,
  User,
  UserPlus,
  Warehouse,
  X,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import {
  createGuidedError,
  InlineGuidedError,
  type GuidedErrorMessage,
} from '../components/forms/GuidedError';
import {
  BUSINESS_MIN_DATE_VALUE,
  formatDateLabel,
  getTodayLocalDateValue,
  toIsoDateAtUtcNoon,
  validateBusinessDateRange,
} from '../utils/date';
import { obtenerDeviceId } from '../utils/deviceId';
import { formatCoffeeLabel } from '../utils/uiMessages';
import { ApiRequestError } from '../services/apiService';
import {
  guardarConfiguracionBodega,
  obtenerConfiguracionBodega,
} from '../services/bodegaApi';
import {
  crearCompra,
  obtenerCatalogosCompra,
  validarCapacidadCompra,
  type CatalogoItem,
  type CatalogosCompra,
  type CreateCompraPayload,
  type EstadoCapacidadCompra,
} from '../services/comprasService';
import {
  actualizarProductor,
  crearProductor,
  listarProductores,
  type ProductorItem,
} from '../services/productoresService';
import {
  PESO_MAXIMO_ENTRADA_KG,
  PESO_MAXIMO_OPERATIVO_DEFAULT_KG,
  PESO_MINIMO_KG,
  PRECIO_MAXIMO_KG,
  PRECIO_MINIMO_KG,
} from '../utils/businessRules';
import {
  type DocumentType,
  PERSON_NAME_MAX_LENGTH,
  normalizeDocumentValue,
  sanitizeDocumentInput,
  sanitizeDigits as sanitizePersonDigits,
  sanitizeProducerNameInput,
  validateDocumentNumber,
  validatePhoneNumber,
  validateProducerName,
} from '../utils/personValidation';

type Step = 1 | 2 | 3;
type SubloteForm = {
  id: string;
  tipoCafeId: string;
  calidadId: string;
  pesoInicial: string;
  precioKg: string;
};
type CompraGuardadaResumen = {
  fecha: string;
  productorNombre: string;
  productorDocumento: string;
  totalKg: number;
  totalCompra: number;
  capacidad?: EstadoCapacidadCompra;
  sublotes: Array<{
    id: string;
    tipoCafe: string;
    calidad: string;
    pesoInicial: number;
  }>;
};
type ProductorOption = {
  id: string;
  nombre: string;
  tipoDocumento: DocumentType | null;
  documento: string;
  detalle: string;
  createdAt: string;
  telefono?: string;
  rapido?: boolean;
};
type ProductorForm = {
  nombre: string;
  tipoDocumento: DocumentType;
  telefono: string;
  documento: string;
};
type ProductorFormErrors = Partial<Record<keyof ProductorForm, string>>;
type ProductorSelectionMode = 'buscar' | 'generico' | null;
type ProductorOrden = 'recientes' | 'antiguos' | 'az';

const ORDEN_TIPOS = ['VERDE', 'SECO', 'TRILLADO', 'PASILLA'];
const ORDEN_CALIDADES = ['BUENO', 'REGULAR', 'MALO'];
const PRODUCTOR_GENERAL: ProductorOption = {
  id: 'general',
  nombre: 'Productor Generico',
  tipoDocumento: null,
  documento: 'Compra rapida',
  detalle:
    'Para compras rápidas o productores ocasionales no registrados en el sistema.',
  createdAt: '',
  rapido: true,
};
const LIMITE_PRODUCTORES_RECIENTES = 2;
const LIMITE_PRODUCTORES_MODAL = 100;
const CAPACIDAD_BODEGA_MAX_KG = 999999;
const CAPACIDAD_BODEGA_MAX_LABEL = '999.999';
const MAX_PESO_ENTRADA_KG = PESO_MAXIMO_ENTRADA_KG;
const MAX_PESO_OPERATIVO_DEFAULT_KG = PESO_MAXIMO_OPERATIVO_DEFAULT_KG;
const CAPACIDAD_BODEGA_INVALIDA = 'Ingresa una capacidad de bodega válida.';
const CAPACIDAD_BODEGA_MENOR_INVENTARIO =
  'La capacidad no puede ser menor al café almacenado actualmente.';
const TIPOS_DOCUMENTO_PRODUCTOR: Array<{
  value: DocumentType;
  label: string;
}> = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'NIT', label: 'NIT' },
];

const PRODUCTOR_FORM_INICIAL: ProductorForm = {
  nombre: '',
  tipoDocumento: 'CC',
  documento: '',
  telefono: '',
};

function generarId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function soloDigitos(value: string) {
  return value.replace(/\D/g, '');
}

function sanitizeCapacidadBodegaInput(value: string) {
  return soloDigitos(value).slice(0, 6);
}

function normalizarDocumentoClave(value: string) {
  return normalizeSearchText(value).replace(/[^a-z0-9]/g, '');
}

function crearSubloteVacio(): SubloteForm {
  return {
    id: generarId(),
    tipoCafeId: '',
    calidadId: '',
    pesoInicial: '',
    precioKg: '',
  };
}

function hoyLocal() {
  return getTodayLocalDateValue();
}

function formatoFecha(fechaIso: string) {
  return formatDateLabel(fechaIso);
}

function formatoMoneda(valor: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatoKg(valor: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(valor)} kg`;
}

function claseValorResumen(valor: string) {
  if (valor.length >= 17) return 'text-[0.78rem] sm:text-[1.25rem]';
  if (valor.length >= 14) return 'text-[0.9rem] sm:text-[1.4rem]';
  return 'text-[1.12rem] sm:text-[1.65rem]';
}

function estiloCapacidad(capacidad?: EstadoCapacidadCompra) {
  if (!capacidad || capacidad.nivel === 'normal') {
    return {
      contenedor: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]',
      icono: 'bg-[#dbeafe] text-[#1d4ed8]',
    };
  }

  if (capacidad.nivel === 'exceso') {
    return {
      contenedor: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]',
      icono: 'bg-[#ffedd5] text-[#ea580c]',
    };
  }

  if (capacidad.nivel === 'alerta') {
    return {
      contenedor: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
      icono: 'bg-[#fef3c7] text-[#d97706]',
    };
  }

  return {
    contenedor: 'border-[#e5e7eb] bg-[#f8fafc] text-slate-700',
    icono: 'bg-[#e2e8f0] text-slate-600',
  };
}

function getSubloteFieldErrors(
  sublote: SubloteForm,
  minPesoKg: number,
  maxPesoKg: number,
  minPrecioKg: number,
  maxPrecioKg: number,
) {
  const pesoText = sublote.pesoInicial.trim();
  const precioText = sublote.precioKg.trim();
  const peso = Number(pesoText.replace(',', '.'));
  const precio = Number(precioText);

  const errors = {
    tipoCafe: !sublote.tipoCafeId ? 'Selecciona el tipo de café.' : null,
    calidad: !sublote.calidadId ? 'Selecciona la calidad.' : null,
    peso: null as string | null,
    precio: null as string | null,
  };

  if (!pesoText) {
    errors.peso = 'Ingresa el peso.';
  } else if (!Number.isFinite(peso) || peso < minPesoKg) {
    errors.peso = `El peso mínimo es ${new Intl.NumberFormat('es-CO').format(minPesoKg)} kg.`;
  } else if (peso > maxPesoKg) {
    errors.peso = `El peso no puede superar ${new Intl.NumberFormat('es-CO').format(maxPesoKg)} kg.`;
  }

  if (!precioText) {
    errors.precio = 'Ingresa el precio por kilo.';
  } else if (!Number.isFinite(precio) || precio < minPrecioKg) {
    errors.precio = `El precio mínimo es $${new Intl.NumberFormat('es-CO').format(minPrecioKg)}/kg.`;
  } else if (precio > maxPrecioKg) {
    errors.precio = `El precio no puede superar $${new Intl.NumberFormat('es-CO').format(maxPrecioKg)}/kg.`;
  }

  return errors;
}

function countSubloteErrors(errors: ReturnType<typeof getSubloteFieldErrors>) {
  return Object.values(errors).filter(Boolean).length;
}

function getSingleSubloteErrorMessage(
  errors: ReturnType<typeof getSubloteFieldErrors>,
) {
  if (errors.tipoCafe) return 'Selecciona el tipo de café para continuar.';
  if (errors.calidad) return 'Selecciona la calidad del café para continuar.';
  if (errors.peso === 'Ingresa el peso.') {
    return 'Ingresa el peso para continuar.';
  }
  if (errors.precio === 'Ingresa el precio por kilo.') {
    return 'Ingresa el precio por kilo para continuar.';
  }

  return errors.peso ?? errors.precio ?? null;
}

function isSubloteCompletado(
  sublote: SubloteForm,
  minPesoKg: number,
  maxPesoKg: number,
  minPrecioKg: number,
  maxPrecioKg: number,
) {
  const errors = getSubloteFieldErrors(
    sublote,
    minPesoKg,
    maxPesoKg,
    minPrecioKg,
    maxPrecioKg,
  );
  return countSubloteErrors(errors) === 0;
}

function productorFieldClass(hasError?: boolean) {
  return `w-full rounded-[14px] border bg-[#f7f9fd] px-4 py-3 text-[0.95rem] text-slate-900 outline-none transition ${
    hasError
      ? 'border-rose-300 bg-rose-50/40 focus:border-rose-400'
      : 'border-[#dde4f1] focus:border-[#173ea6]'
  }`;
}

function ProducerFieldError({ message }: { message: string }) {
  return (
    <p className="mt-1.5 text-[0.78rem] font-semibold leading-5 text-rose-600">
      {message}
    </p>
  );
}

function getProducerNameLabel(type: DocumentType) {
  if (type === 'NIT') {
    return 'Nombre de la empresa';
  }

  if (type === 'OTRO') {
    return 'Nombre del productor';
  }

  return 'Nombre completo';
}

function getProducerNamePlaceholder(type: DocumentType) {
  if (type === 'NIT') {
    return 'Ej: Café Los Alpes';
  }

  if (type === 'OTRO') {
    return 'Ej: Productor Los Andes';
  }

  return 'Ej: Juan Pérez Rodríguez';
}

function getCompraErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return 'Revisa la conexión a internet y vuelve a intentarlo.';
    }

    if (error.status >= 500) {
      return 'Puede ser una falla temporal. Revisa tu conexión e intenta de nuevo.';
    }

    if (error.code === 'COMPRA_CANTIDAD_INVALIDA') {
      return `La cantidad minima de compra es ${PESO_MINIMO_KG} kg.`;
    }

    if (error.code === 'COMPRA_CAPACIDAD_EXCEDIDA') {
      return 'La compra supera el espacio disponible en bodega. Reduce kilos o vende cafe para liberar espacio.';
    }

    if (error.code === 'COMPRA_PRECIO_INVALIDO') {
      return 'El precio por kg debe ser mínimo $1,000.';
    }

    if (error.code === 'COMPRA_TIPO_CAFE_INVALIDO') {
      return 'El tipo de cafe seleccionado no es valido.';
    }

    if (error.code === 'COMPRA_CALIDAD_INVALIDA') {
      return 'La calidad seleccionada no es valida.';
    }
  }

  return error instanceof Error
    ? error.message
    : 'No se pudo guardar la compra.';
}

function esperarPintadoInterfaz() {
  return new Promise<void>((resolve) => {
    if (
      typeof window === 'undefined' ||
      typeof window.requestAnimationFrame !== 'function'
    ) {
      resolve();
      return;
    }

    window.requestAnimationFrame(() => resolve());
  });
}

function mapProductorToOption(productor: ProductorItem): ProductorOption {
  return {
    id: productor.id,
    nombre: productor.nombre,
    tipoDocumento: productor.tipoDocumento,
    documento: productor.documento?.trim() || 'Documento pendiente',
    detalle: productor.telefono?.trim() || 'Productor registrado en sistema',
    createdAt: productor.createdAt,
    telefono: productor.telefono ?? undefined,
  };
}

function clavePersona(
  nombre: string,
  documento: string,
  tipoDocumento?: DocumentType | null,
) {
  const documentoNormalizado = normalizarDocumentoClave(documento);
  return documentoNormalizado
    ? `documento:${tipoDocumento ?? 'CC'}:${documentoNormalizado}`
    : `nombre:${normalizeSearchText(nombre.trim())}`;
}

function dedupeProductorOptions(productores: ProductorOption[]) {
  const vistos = new Set<string>();

  return productores.filter((productor) => {
    const key = clavePersona(
      productor.nombre,
      productor.documento,
      productor.tipoDocumento,
    );

    if (vistos.has(key)) {
      return false;
    }

    vistos.add(key);
    return true;
  });
}

function findProductorExistente(
  productores: ProductorOption[],
  nombre: string,
  documento: string,
  tipoDocumento: DocumentType,
  productorIdActual?: string | null,
) {
  const key = clavePersona(nombre, documento, tipoDocumento);
  return productores.find(
    (productor) =>
      productor.id !== productorIdActual &&
      clavePersona(
        productor.nombre,
        productor.documento,
        productor.tipoDocumento,
      ) === key,
  );
}

function filtrarProductoresPorBusqueda(
  productores: ProductorOption[],
  busqueda: string,
) {
  const termino = normalizeSearchText(busqueda.trim());

  if (!termino) {
    return productores;
  }

  return productores.filter((productor) =>
    [productor.nombre, productor.documento, productor.detalle].some((valor) =>
      normalizeSearchText(valor).includes(termino),
    ),
  );
}

function ordenarProductores(
  productores: ProductorOption[],
  orden: ProductorOrden,
) {
  const items = [...productores];

  if (orden === 'az') {
    return items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  return items.sort((a, b) => {
    const fechaA = Date.parse(a.createdAt || '');
    const fechaB = Date.parse(b.createdAt || '');
    const safeA = Number.isFinite(fechaA) ? fechaA : 0;
    const safeB = Number.isFinite(fechaB) ? fechaB : 0;

    return orden === 'antiguos' ? safeA - safeB : safeB - safeA;
  });
}

function clave(nombre: string) {
  return nombre.trim().toUpperCase();
}

function ordenarCatalogos(items: CatalogoItem[], ordenBase: string[]) {
  return [...items].sort((a, b) => {
    const indexA = ordenBase.indexOf(clave(a.nombre));
    const indexB = ordenBase.indexOf(clave(b.nombre));
    if (indexA !== -1 || indexB !== -1) {
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    }
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

function iconoTipoCafe(nombre: string) {
  const tipo = clave(nombre);
  if (tipo === 'VERDE') {
    return {
      icono: <Leaf size={18} />,
      fondo: 'bg-[#eff9f1] text-[#185d31]',
      borde: 'border-[#d4efde]',
      texto: 'text-[#1f7f46]',
    };
  }
  if (tipo === 'SECO') {
    return {
      icono: <SunMedium size={18} />,
      fondo: 'bg-[#fff4e9] text-[#9d4a12]',
      borde: 'border-[#f8dfc7]',
      texto: 'text-[#9d4a12]',
    };
  }
  if (tipo === 'PASILLA') {
    return {
      icono: <BadgeAlert size={18} />,
      fondo: 'bg-[#fff0f4] text-[#a31d3e]',
      borde: 'border-[#ffd4e1]',
      texto: 'text-[#a31d3e]',
    };
  }
  return {
    icono: <Coffee size={18} />,
    fondo: 'bg-[#eef2ff] text-[#1D4ED8]',
    borde: 'border-[#d9e4ff]',
    texto: 'text-[#1D4ED8]',
  };
}

function visualCalidad(nombre: string) {
  const calidad = clave(nombre);
  if (calidad === 'BUENO') {
    return {
      icono: <Smile size={16} />,
      fondo: 'bg-[#f0fdf4] text-[#166534]',
      borde: 'border-[#166534]',
      texto: 'text-[#166534]',
    };
  }
  if (calidad === 'REGULAR') {
    return {
      icono: <Meh size={16} />,
      fondo: 'bg-[#fffbeb] text-[#b45309]',
      borde: 'border-[#b45309]',
      texto: 'text-[#b45309]',
    };
  }
  return {
    icono: <Frown size={16} />,
    fondo: 'bg-[#fef2f2] text-[#b91c1c]',
    borde: 'border-[#b91c1c]',
    texto: 'text-[#b91c1c]',
  };
}

function datosPaso(step: Step) {
  if (step === 1) {
    return {
      chip: 'Paso 1 de 3',
      titulo: 'Elige un productor',
      descripcion: 'Selecciona el productor con el que realizarás la compra.',
      progreso: 33,
    };
  }
  if (step === 2) {
    return {
      chip: 'Paso 2 de 3',
      titulo: 'Registra el café',
      descripcion: 'Indica el tipo de café, calidad, peso y precio por kilo.',
      progreso: 66,
    };
  }
  return {
    chip: 'Paso 3 de 3',
    titulo: 'Revisa y confirma',
    descripcion: 'Verifica los datos antes de registrar la compra.',
    progreso: 100,
  };
}

function getComprasGuidance(message: string): GuidedErrorMessage {
  if (message.includes('nombre')) {
    return createGuidedError(
      message,
      'Revisa el nombre.',
      'El nombre debe escribirse con letras, sin números.',
      'Corrige el nombre para continuar.',
    );
  }

  if (message.includes('teléfono') || message.includes('telefono')) {
    return createGuidedError(
      message,
      'Revisa el teléfono.',
      'Debe ser un celular colombiano de 10 dígitos que empieza por 3.',
      'Corrige el número o deja el campo vacío.',
    );
  }

  if (
    message.includes('cédula') ||
    message.includes('identificación') ||
    message.includes('documento') ||
    message.includes('NIT')
  ) {
    return createGuidedError(
      message,
      'Revisa el documento.',
      'Para cédula usa solo números. Para NIT puedes usar números y guion.',
      'Corrige el número de documento para continuar.',
    );
  }

  if (message.includes('fecha')) {
    return createGuidedError(
      message,
      'Revisa la fecha.',
      'Solo puedes registrar compras desde 2026 hasta hoy.',
      'Elige una fecha valida para continuar.',
    );
  }

  if (message.includes('nombre del productor')) {
    return createGuidedError(
      message,
      'Falta identificar al productor.',
      'Necesitamos el nombre para registrar la compra.',
      'Toca la casilla y escribe al menos su nombre.',
    );
  }

  if (message.includes('al menos un producto')) {
    return createGuidedError(
      message,
      'No hay productos.',
      'La compra debe tener café.',
      'Agrega un producto para continuar.',
    );
  }

  if (message.includes('Completa este cafe')) {
    return createGuidedError(
      message,
      'Producto incompleto.',
      'Antes de agregar otro cafe, termina los datos actuales.',
      'Completa tipo, calidad, peso y precio.',
    );
  }

  if (message.includes('catalogos disponibles')) {
    return createGuidedError(
      message,
      'Faltan datos base en tu celular.',
      'No logramos cargar los tipos de café.',
      'Recarga la aplicación e intenta de nuevo.',
    );
  }

  if (message.includes('tipo de cafe')) {
    return createGuidedError(
      message,
      'Selecciona el tipo de café.',
      'Necesitamos clasificar el café antes de registrar la compra.',
      'Elige una opción en Tipo de café.',
    );
  }

  if (message.includes('calidad')) {
    return createGuidedError(
      message,
      'Selecciona la calidad del café.',
      'La calidad ayuda a registrar bien el inventario.',
      'Elige Bueno, Regular o Malo.',
    );
  }

  if (message.includes('peso valido')) {
    return createGuidedError(
      message,
      'El peso está vacío o en cero.',
      'Necesitamos saber cuántos kilos entraron.',
      'Ingresa el peso exacto del café.',
    );
  }

  if (
    message.includes('precio valido') ||
    message.includes('precio por kilo') ||
    message.includes('mínimo')
  ) {
    return createGuidedError(
      message,
      'Falta el precio por kilo.',
      'El precio minimo permitido es $1,000 por kg.',
      'Toca la casilla e ingresa un valor desde $1,000.',
    );
  }

  if (message.includes('Selecciona un productor')) {
    return createGuidedError(
      message,
      'Falta seleccionar el productor.',
      'Debemos saber a quién corresponde la compra.',
      'Selecciona Productor Generico o uno de la lista.',
    );
  }

  return createGuidedError(
    message,
    'Revisa los campos marcados.',
    'Hay un dato pendiente o fuera de rango.',
    'Corrige el dato e inténtalo nuevamente.',
  );
}

export default function Compras() {
  const navigate = useNavigate();
  const savingRef = useRef(false);
  const compraLocalIdRef = useRef<string | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosCompra>({
    tiposCafe: [],
    calidades: [],
  });
  const [fecha, setFecha] = useState(hoyLocal());
  const [sublotes, setSublotes] = useState<SubloteForm[]>([
    crearSubloteVacio(),
  ]);
  const [subloteActivoId, setSubloteActivoId] = useState<string | null>(null);
  const [productorSeleccionado, setProductorSeleccionado] =
    useState<ProductorOption | null>(null);
  const [productorSelectionMode, setProductorSelectionMode] =
    useState<ProductorSelectionMode>(null);
  const [productores, setProductores] = useState<ProductorOption[]>([]);
  const [busquedaProductor, setBusquedaProductor] = useState('');
  const [mostrarModalSelectorProductor, setMostrarModalSelectorProductor] =
    useState(false);
  const [busquedaSelectorProductor, setBusquedaSelectorProductor] =
    useState('');
  const [ordenSelectorProductor, setOrdenSelectorProductor] =
    useState<ProductorOrden>('recientes');
  const [limiteSelectorProductor, setLimiteSelectorProductor] = useState(
    LIMITE_PRODUCTORES_MODAL,
  );
  const [productoresSelector, setProductoresSelector] = useState<
    ProductorOption[]
  >([]);
  const [cargandoProductoresSelector, setCargandoProductoresSelector] =
    useState(false);
  const [hayMasProductoresSelector, setHayMasProductoresSelector] =
    useState(false);
  const [mostrarModalProductor, setMostrarModalProductor] = useState(false);
  const [productorForm, setProductorForm] = useState<ProductorForm>(
    PRODUCTOR_FORM_INICIAL,
  );
  const [productorEditando, setProductorEditando] =
    useState<ProductorOption | null>(null);
  const [productorPendienteEditar, setProductorPendienteEditar] =
    useState<ProductorOption | null>(null);
  const [productorFormErrors, setProductorFormErrors] =
    useState<ProductorFormErrors>({});
  const [productorFormError, setProductorFormError] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingConfirmacion, setCheckingConfirmacion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarErrorFormulario, setMostrarErrorFormulario] = useState(false);
  const [capacidadPrevia, setCapacidadPrevia] =
    useState<EstadoCapacidadCompra | null>(null);
  const [mostrarModalCancelar, setMostrarModalCancelar] = useState(false);
  const [mostrarModalConfirmar, setMostrarModalConfirmar] = useState(false);
  const [mostrarModalCapacidad, setMostrarModalCapacidad] = useState(false);
  const [mostrarModalAlerta80, setMostrarModalAlerta80] = useState(false);
  const [mostrarModalConfigurarCapacidad, setMostrarModalConfigurarCapacidad] =
    useState(false);
  const [nombreBodegaNueva, setNombreBodegaNueva] =
    useState('Bodega principal');
  const [capacidadNuevaKg, setCapacidadNuevaKg] = useState('');
  const [capacidadNuevaError, setCapacidadNuevaError] = useState<string | null>(
    null,
  );
  const [guardandoCapacidad, setGuardandoCapacidad] = useState(false);
  const [datosCapacidad, setDatosCapacidad] = useState<{
    capacidadKg: number;
    inventarioActual: number;
    nuevoTotal: number;
  } | null>(null);
  const [datosAlerta80, setDatosAlerta80] = useState<{
    capacidadKg: number;
    inventarioActual: number;
    nuevoTotal: number;
    porcentaje: number;
  } | null>(null);
  const [minPesoKg, setMinPesoKg] = useState(PESO_MINIMO_KG);
  const [maxPesoKg, setMaxPesoKg] = useState(PESO_MAXIMO_OPERATIVO_DEFAULT_KG);
  const [minPrecioKg, setMinPrecioKg] = useState(PRECIO_MINIMO_KG);
  const [maxPrecioKg, setMaxPrecioKg] = useState(PRECIO_MAXIMO_KG);

  const [step, setStep] = useState<Step>(1);
  const [compraGuardada, setCompraGuardada] =
    useState<CompraGuardadaResumen | null>(null);
  const [botonGuardarProductorPresionado, setBotonGuardarProductorPresionado] =
    useState(false);
  const [productorCreadoToast, setProductorCreadoToast] =
    useState<ProductorOption | null>(null);

  const cargarTodo = async () => {
    setLoading(true);
    setError(null);
    setMostrarErrorFormulario(false);
    try {
      const [catalogosData, productoresData, bodegaConfig] = await Promise.all([
        obtenerCatalogosCompra(),
        listarProductores({
          limit: LIMITE_PRODUCTORES_RECIENTES,
          orden: 'recientes',
        }),
        obtenerConfiguracionBodega().catch(() => null),
      ]);
      setCatalogos(catalogosData);
      setProductores(
        dedupeProductorOptions(productoresData.map(mapProductorToOption)),
      );
      if (bodegaConfig) {
        const pesoMaximoConfig = Number(bodegaConfig.maxPesoKg);
        const maximoConfigurado =
          Number.isFinite(pesoMaximoConfig) &&
          pesoMaximoConfig > 0 &&
          pesoMaximoConfig <= MAX_PESO_ENTRADA_KG
            ? pesoMaximoConfig
            : MAX_PESO_OPERATIVO_DEFAULT_KG;
        setMinPesoKg(bodegaConfig.minPesoKg ?? PESO_MINIMO_KG);
        setMaxPesoKg(maximoConfigurado);
        setMinPrecioKg(bodegaConfig.minPrecioKg ?? PRECIO_MINIMO_KG);
        setMaxPrecioKg(bodegaConfig.maxPrecioKg ?? PRECIO_MAXIMO_KG);
      }
    } catch (err) {
      console.warn('No se pudo cargar toda la informacion de compras:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarTodo();
  }, []);

  useEffect(() => {
    if (!productorCreadoToast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setProductorCreadoToast(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [productorCreadoToast]);

  const tiposCafe = useMemo(
    () => ordenarCatalogos(catalogos.tiposCafe, ORDEN_TIPOS),
    [catalogos.tiposCafe],
  );
  const calidades = useMemo(
    () => ordenarCatalogos(catalogos.calidades, ORDEN_CALIDADES),
    [catalogos.calidades],
  );
  const nombreTipoCafePorId = useMemo(
    () => new Map(catalogos.tiposCafe.map((item) => [item.id, item.nombre])),
    [catalogos.tiposCafe],
  );
  const nombreCalidadPorId = useMemo(
    () => new Map(catalogos.calidades.map((item) => [item.id, item.nombre])),
    [catalogos.calidades],
  );
  const resumen = useMemo(() => {
    const totalKg = sublotes.reduce(
      (acc, sublote) =>
        acc + (Number(sublote.pesoInicial.replace(',', '.')) || 0),
      0,
    );
    const totalCompra = sublotes.reduce(
      (acc, sublote) =>
        acc +
        (Number(sublote.pesoInicial.replace(',', '.')) || 0) *
          (Number(sublote.precioKg) || 0),
      0,
    );
    return { totalKg, totalCompra };
  }, [sublotes]);
  const fechaCompraValidacion = useMemo(
    () => validateBusinessDateRange(fecha),
    [fecha],
  );
  const paso2Completo = useMemo(() => {
    if (!fechaCompraValidacion.isValid) {
      return false;
    }

    return sublotes.every((sublote) => {
      const peso = Number(sublote.pesoInicial.replace(',', '.'));
      const precio = Number(sublote.precioKg);
      return (
        Boolean(sublote.tipoCafeId) &&
        Boolean(sublote.calidadId) &&
        Number.isFinite(peso) &&
        peso >= minPesoKg &&
        peso <= maxPesoKg &&
        Number.isFinite(precio) &&
        precio >= minPrecioKg &&
        precio <= maxPrecioKg
      );
    });
  }, [
    fechaCompraValidacion.isValid,
    minPesoKg,
    maxPesoKg,
    minPrecioKg,
    maxPrecioKg,
    sublotes,
  ]);
  const puedeRegistrarCompra =
    Boolean(productorSeleccionado) &&
    paso2Completo &&
    sublotes.length > 0 &&
    catalogos.tiposCafe.length > 0 &&
    catalogos.calidades.length > 0 &&
    !saving &&
    !checkingConfirmacion &&
    !loading;
  const estadoBodegaCompra = useMemo(() => {
    if (!capacidadPrevia?.validada) return null;

    const capacidadKg = capacidadPrevia.capacidadBodegaKg ?? 0;
    const inventarioActual = capacidadPrevia.inventarioActualKg ?? 0;

    if (capacidadKg <= 0) return null;

    const libreActual = Math.max(0, capacidadKg - inventarioActual);
    const libreDespues = Math.max(
      0,
      capacidadPrevia.capacidadRestanteKg ?? libreActual - resumen.totalKg,
    );
    const porcentajeProyectado = Math.min(
      100,
      Math.max(0, capacidadPrevia.porcentajeOcupacion ?? 0),
    );
    const superaEspacio = resumen.totalKg > libreActual;
    const bodegaYaLlena = libreActual <= 0;
    const bodegaLlena = !superaEspacio && libreDespues <= 0;

    if (!superaEspacio && porcentajeProyectado < 80) return null;

    const nivel =
      superaEspacio || bodegaLlena || capacidadPrevia.nivel === 'exceso'
        ? 'critico'
        : porcentajeProyectado >= 90
          ? 'alto'
          : 'alerta';
    const kgReferencia = superaEspacio ? libreActual : libreDespues;

    return {
      kgReferencia,
      porcentajeProyectado,
      nivel,
      borde:
        nivel === 'critico'
          ? 'border-rose-200'
          : nivel === 'alto'
            ? 'border-orange-200'
            : 'border-amber-200',
      fondo:
        nivel === 'critico'
          ? 'bg-rose-50'
          : nivel === 'alto'
            ? 'bg-orange-50'
            : 'bg-amber-50',
      barra:
        nivel === 'critico'
          ? 'bg-rose-500'
          : nivel === 'alto'
            ? 'bg-orange-500'
            : 'bg-amber-500',
      texto:
        nivel === 'critico'
          ? 'text-rose-700'
          : nivel === 'alto'
            ? 'text-orange-700'
            : 'text-amber-700',
      mensaje: superaEspacio
        ? bodegaYaLlena
          ? 'Bodega llena. Vende cafe para seguir comprando.'
          : `La compra supera el espacio disponible. Hay ${formatoKg(libreActual)} libres.`
        : bodegaLlena
          ? 'La bodega quedaria llena. Vende cafe para seguir comprando.'
          : nivel === 'alto'
            ? 'La bodega quedaria muy cerca del limite.'
            : 'La bodega quedaria cerca del limite.',
    };
  }, [capacidadPrevia, resumen.totalKg]);
  const productoresFiltrados = useMemo(() => {
    const base = ordenarProductores(
      dedupeProductorOptions([...productores]),
      'recientes',
    );

    return filtrarProductoresPorBusqueda(base, busquedaProductor).slice(
      0,
      LIMITE_PRODUCTORES_RECIENTES,
    );
  }, [busquedaProductor, productores]);
  const productoresSelectorFiltrados = useMemo(() => {
    return productoresSelector;
  }, [productoresSelector]);
  const productoresSelectorVisibles = productoresSelectorFiltrados.slice(
    0,
    limiteSelectorProductor,
  );
  const quedanProductoresPorCargar =
    hayMasProductoresSelector ||
    productoresSelectorFiltrados.length > limiteSelectorProductor;
  const busquedaSelectorActiva = busquedaSelectorProductor.trim().length > 0;
  const sinProductoresRegistrados = productores.length === 0;
  const subloteActual =
    sublotes.find((sublote) => sublote.id === subloteActivoId) ??
    sublotes[sublotes.length - 1] ??
    null;
  const subloteActualListo = subloteActual
    ? isSubloteCompletado(
        subloteActual,
        minPesoKg,
        maxPesoKg,
        minPrecioKg,
        maxPrecioKg,
      )
    : false;
  const sublotesVisibles = sublotes;
  const sublotesAgregados = sublotesVisibles.filter(
    (sublote) => sublote.id !== subloteActual?.id,
  );
  const sublotesGuardados = Math.max(0, sublotes.length - 1);
  const pasoActual = datosPaso(step);

  const volverPasoAnterior = () => {
    if (step > 1) {
      irPasoAnterior();
      return;
    }

    navigate('/inicio');
  };

  const invalidarValidacionCapacidad = () => {
    setCapacidadPrevia(null);
    setDatosAlerta80(null);
    setDatosCapacidad(null);
    setCapacidadNuevaError(null);
  };

  const actualizarSublote = (
    id: string,
    campo: keyof Omit<SubloteForm, 'id'>,
    valor: string,
  ) => {
    setMostrarErrorFormulario(false);
    setError(null);
    invalidarValidacionCapacidad();
    setSublotes((actual) =>
      actual.map((sublote) =>
        sublote.id === id ? { ...sublote, [campo]: valor } : sublote,
      ),
    );
  };

  const agregarSublote = () => {
    const actual = sublotes[sublotes.length - 1];
    if (!actual) return;

    if (
      !actual.tipoCafeId ||
      !actual.calidadId ||
      !Number.isFinite(Number(actual.pesoInicial.replace(',', '.'))) ||
      Number(actual.pesoInicial.replace(',', '.')) < minPesoKg ||
      !Number.isFinite(Number(actual.precioKg)) ||
      Number(actual.precioKg) < minPrecioKg
    ) {
      setMostrarErrorFormulario(true);
      setError('Completa este cafe antes de agregar otro.');
      return;
    }

    const nuevoSublote = crearSubloteVacio();
    setError(null);
    setMostrarErrorFormulario(false);
    invalidarValidacionCapacidad();
    setSubloteActivoId(nuevoSublote.id);
    setSublotes((items) => [...items, nuevoSublote]);
  };

  const abrirModalProductor = () => {
    setError(null);
    setProductorFormError(null);
    setProductorFormErrors({});
    setProductorEditando(null);
    setProductorForm(PRODUCTOR_FORM_INICIAL);
    setMostrarModalProductor(true);
  };

  const cerrarModalProductor = () => {
    setMostrarModalProductor(false);
    setProductorEditando(null);
    setProductorForm(PRODUCTOR_FORM_INICIAL);
    setProductorFormError(null);
    setProductorFormErrors({});
  };

  const pedirConfirmacionEditarProductor = (productor: ProductorOption) => {
    setProductorPendienteEditar(productor);
  };

  const cancelarEditarProductor = () => {
    setProductorPendienteEditar(null);
  };

  const confirmarEditarProductor = () => {
    if (!productorPendienteEditar) {
      return;
    }

    abrirEditarProductor(productorPendienteEditar);
    setProductorPendienteEditar(null);
  };

  const abrirSelectorProductor = () => {
    setProductorSelectionMode('buscar');
    setProductorSeleccionado(null);
    setBusquedaSelectorProductor(busquedaProductor);
    setOrdenSelectorProductor('recientes');
    setLimiteSelectorProductor(LIMITE_PRODUCTORES_MODAL);
    setProductoresSelector([]);
    setHayMasProductoresSelector(false);
    setMostrarModalSelectorProductor(true);
  };

  const cerrarSelectorProductor = () => {
    setMostrarModalSelectorProductor(false);
    setBusquedaSelectorProductor('');
    setLimiteSelectorProductor(LIMITE_PRODUCTORES_MODAL);
    setProductoresSelector([]);
    setHayMasProductoresSelector(false);
    setProductorPendienteEditar(null);
  };

  const abrirEditarProductor = (productor: ProductorOption) => {
    const tipoDocumento = productor.tipoDocumento ?? 'CC';
    setProductorEditando(productor);
    setProductorForm({
      nombre: productor.nombre,
      tipoDocumento,
      documento:
        productor.documento === 'Documento pendiente'
          ? ''
          : productor.documento,
      telefono: productor.telefono ?? '',
    });
    setProductorFormError(null);
    setProductorFormErrors({});
    setMostrarModalProductor(true);
  };

  const seleccionarProductor = (productor: ProductorOption) => {
    setProductorSeleccionado(productor);
    setProductorSelectionMode(productor.rapido ? 'generico' : 'buscar');
    setBusquedaProductor('');
    setMostrarModalSelectorProductor(false);
    setError(null);
    setMostrarErrorFormulario(false);
  };

  const refrescarProductores = async () => {
    try {
      const productoresData = await listarProductores({
        limit: LIMITE_PRODUCTORES_RECIENTES,
        orden: 'recientes',
      });
      setProductores(
        dedupeProductorOptions(productoresData.map(mapProductorToOption)),
      );
    } catch {
      // No interrumpe el flujo si falla la recarga del autocomplete.
    }
  };

  const cargarProductoresSelector = async (reset = false) => {
    const offset = reset ? 0 : productoresSelector.length;
    setCargandoProductoresSelector(true);

    try {
      const productoresData = await listarProductores({
        q: busquedaSelectorProductor,
        limit: LIMITE_PRODUCTORES_MODAL + 1,
        offset,
        orden: ordenSelectorProductor,
      });
      const mapped = productoresData.map(mapProductorToOption);
      const nextItems = mapped.slice(0, LIMITE_PRODUCTORES_MODAL);

      setProductoresSelector((actual) =>
        dedupeProductorOptions(reset ? nextItems : [...actual, ...nextItems]),
      );
      setLimiteSelectorProductor((actual) =>
        reset
          ? LIMITE_PRODUCTORES_MODAL
          : Math.max(actual, offset + nextItems.length),
      );
      setHayMasProductoresSelector(mapped.length > LIMITE_PRODUCTORES_MODAL);
      setProductores((actual) =>
        dedupeProductorOptions([...nextItems, ...actual]).slice(
          0,
          LIMITE_PRODUCTORES_RECIENTES,
        ),
      );
    } catch {
      setHayMasProductoresSelector(false);
    } finally {
      setCargandoProductoresSelector(false);
    }
  };

  useEffect(() => {
    if (!mostrarModalSelectorProductor) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void cargarProductoresSelector(true);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [
    busquedaSelectorProductor,
    mostrarModalSelectorProductor,
    ordenSelectorProductor,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      try {
        const productoresData = await listarProductores({
          q: busquedaProductor,
          limit: LIMITE_PRODUCTORES_RECIENTES,
          orden: 'recientes',
        });
        setProductores(
          dedupeProductorOptions(productoresData.map(mapProductorToOption)),
        );
      } catch {
        // La busqueda rapida no debe bloquear la compra.
      }
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [busquedaProductor]);

  const seleccionarBusqueda = () => {
    setProductorSelectionMode('buscar');
    setProductorSeleccionado(null);
    void refrescarProductores();
    setError(null);
    setMostrarErrorFormulario(false);
  };

  const seleccionarGenerico = () => {
    setProductorSelectionMode('generico');
    setProductorSeleccionado(PRODUCTOR_GENERAL);
    setError(null);
    setMostrarErrorFormulario(false);
  };

  const validarProductorForm = () => {
    const errores: ProductorFormErrors = {};
    const nombre = validateProducerName(
      productorForm.nombre,
      productorForm.tipoDocumento,
    );
    const documento = validateDocumentNumber(
      productorForm.documento,
      'El documento',
      { documentType: productorForm.tipoDocumento },
    );
    const telefono = validatePhoneNumber(
      productorForm.telefono,
      'El teléfono',
      {
        optional: true,
      },
    );

    if (!nombre.isValid) errores.nombre = nombre.message;
    if (!documento.isValid) errores.documento = documento.message;
    if (!telefono.isValid) errores.telefono = telefono.message;

    return errores;
  };

  const guardarProductorLocal = async () => {
    if (botonGuardarProductorPresionado) {
      return;
    }

    const nombre = productorForm.nombre.trim();
    const documento = normalizeDocumentValue(
      productorForm.documento,
      productorForm.tipoDocumento,
    );
    const telefono = sanitizePersonDigits(productorForm.telefono, 15);
    const errores = validarProductorForm();

    setProductorFormErrors(errores);
    setProductorFormError(null);

    if (Object.keys(errores).length > 0) {
      return;
    }

    const productorExistente = findProductorExistente(
      productores,
      nombre,
      documento,
      productorForm.tipoDocumento,
      productorEditando?.id,
    );
    if (productorExistente) {
      const mensajeDuplicado =
        productorForm.tipoDocumento === 'NIT'
          ? 'Esta empresa ya está registrada.'
          : 'Este productor ya está registrado.';
      const accionDuplicado =
        productorForm.tipoDocumento === 'NIT'
          ? 'Puedes seleccionarla desde la lista de productores.'
          : 'Puedes seleccionarlo desde la lista de productores.';

      setProductorFormErrors((actual) => ({
        ...actual,
        documento: `${mensajeDuplicado} ${accionDuplicado}`,
      }));
      setProductorFormError(null);
      return;
    }

    setBotonGuardarProductorPresionado(true);

    try {
      const payload = {
        nombre,
        documento,
        tipoDocumento: productorForm.tipoDocumento,
        telefono: telefono || undefined,
      };
      const productorGuardado = productorEditando
        ? await actualizarProductor(productorEditando.id, payload)
        : await crearProductor(payload);

      const productorBase = mapProductorToOption(productorGuardado);

      setProductores((actual) =>
        dedupeProductorOptions([
          productorBase,
          ...actual.filter((productor) => productor.id !== productorBase.id),
        ]),
      );
      setProductoresSelector((actual) =>
        dedupeProductorOptions([
          productorBase,
          ...actual.filter((productor) => productor.id !== productorBase.id),
        ]),
      );
      setProductorSeleccionado(productorBase);
      setProductorSelectionMode('buscar');
      setBusquedaProductor('');
      setMostrarModalProductor(false);
      if (!productorEditando) {
        setMostrarModalSelectorProductor(false);
      }
      setProductorEditando(null);
      setProductorForm(PRODUCTOR_FORM_INICIAL);
      setProductorFormErrors({});
      setProductorFormError(null);
      if (!productorEditando) {
        setProductorCreadoToast(productorBase);
      }
      setError(null);
      setMostrarErrorFormulario(false);
    } catch (err) {
      if (
        err instanceof ApiRequestError &&
        err.code === 'PRODUCTOR_DOCUMENTO_DUPLICADO'
      ) {
        setProductorFormErrors((actual) => ({
          ...actual,
          documento: [err.message, err.action].filter(Boolean).join(' '),
        }));
        setProductorFormError(null);
        return;
      }

      setProductorFormError(
        err instanceof Error ? err.message : 'No se pudo guardar el productor.',
      );
    } finally {
      setBotonGuardarProductorPresionado(false);
    }
  };

  const resetFormulario = () => {
    savingRef.current = false;
    compraLocalIdRef.current = null;
    setFecha(hoyLocal());
    setSublotes([crearSubloteVacio()]);
    setSubloteActivoId(null);
    setProductorSeleccionado(null);
    setProductorSelectionMode(null);
    setBusquedaProductor('');
    setMostrarModalSelectorProductor(false);
    setBusquedaSelectorProductor('');
    setOrdenSelectorProductor('recientes');
    setLimiteSelectorProductor(LIMITE_PRODUCTORES_MODAL);
    setProductorEditando(null);
    setProductorPendienteEditar(null);
    setProductorFormError(null);
    setProductorFormErrors({});
    setProductorCreadoToast(null);
    setMostrarModalCancelar(false);
    setMostrarModalConfirmar(false);
    setCheckingConfirmacion(false);
    setMostrarModalAlerta80(false);
    setMostrarModalConfigurarCapacidad(false);
    setNombreBodegaNueva('Bodega principal');
    setCapacidadNuevaKg('');
    setCapacidadNuevaError(null);
    setGuardandoCapacidad(false);
    setDatosAlerta80(null);
    setStep(1);
    setError(null);
    setMostrarErrorFormulario(false);
    setCapacidadPrevia(null);
  };

  const iniciarNuevaCompra = () => {
    setCompraGuardada(null);
    resetFormulario();
  };

  const eliminarSubloteDesdeRevision = (id: string) => {
    if (sublotes.length === 1) {
      setMostrarErrorFormulario(true);
      setError(
        'Debe quedar al menos un producto antes de finalizar la compra.',
      );
      return;
    }

    setSublotes((actual) => actual.filter((sublote) => sublote.id !== id));
    invalidarValidacionCapacidad();
    if (subloteActivoId === id) {
      setSubloteActivoId(null);
    }
    setError(null);
    setMostrarErrorFormulario(false);
  };

  const editarSubloteDesdeRevision = (id: string) => {
    setSubloteActivoId(id);
    setError(null);
    setMostrarErrorFormulario(false);
    setStep(2);
  };

  const validarSublotes = () => {
    if (!fechaCompraValidacion.isValid) {
      return fechaCompraValidacion.message ?? 'Selecciona la fecha de compra.';
    }

    for (const [index, sublote] of sublotes.entries()) {
      const errors = getSubloteFieldErrors(
        sublote,
        minPesoKg,
        maxPesoKg,
        minPrecioKg,
        maxPrecioKg,
      );
      const errorCount = countSubloteErrors(errors);

      if (errorCount === 1) {
        return getSingleSubloteErrorMessage(errors);
      }

      if (errorCount > 1) {
        return sublotes.length > 1
          ? `Completa los datos del café ${index + 1} para continuar.`
          : 'Completa los datos del café para continuar.';
      }
    }

    return null;
  };

  const irSiguientePaso = () => {
    setError(null);
    setMostrarErrorFormulario(false);
    if (step === 1) {
      if (!productorSeleccionado) {
        setMostrarErrorFormulario(true);
        setError('Selecciona un productor para continuar.');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      const mensajeValidacion = validarSublotes();
      if (mensajeValidacion) {
        setMostrarErrorFormulario(true);
        setError(mensajeValidacion);
        return;
      }
      setStep(3);
    }
  };

  const irPasoAnterior = () => {
    setError(null);
    setMostrarErrorFormulario(false);
    setStep((actual) => Math.max(1, actual - 1) as Step);
  };

  const construirPayloadCompra = async (): Promise<CreateCompraPayload> => {
    const compraLocalId = compraLocalIdRef.current ?? generarId();
    compraLocalIdRef.current = compraLocalId;
    const deviceId = await obtenerDeviceId();
    const fechaActual = fecha.trim() || hoyLocal();
    setFecha(fechaActual);
    const fechaNormalizada = toIsoDateAtUtcNoon(fechaActual);

    const payload: CreateCompraPayload = {
      ...(fechaNormalizada ? { fecha: fechaNormalizada } : {}),
      deviceId,
      localId: compraLocalId,
      sublotes: sublotes.map((sublote) => ({
        tipoCafeId: sublote.tipoCafeId,
        calidadId: sublote.calidadId,
        pesoInicial: Number(sublote.pesoInicial.replace(',', '.')),
        precioKg: Number(sublote.precioKg),
        deviceId,
        localId: sublote.id,
      })),
    };

    if (productorSeleccionado && !productorSeleccionado.rapido) {
      payload.productorId = productorSeleccionado.id;
    }

    return payload;
  };

  useEffect(() => {
    if ((step !== 2 && step !== 3) || !paso2Completo || resumen.totalKg <= 0) {
      return;
    }

    let cancelado = false;

    const timer = window.setTimeout(async () => {
      try {
        const payload = await construirPayloadCompra();
        const capacidad = await validarCapacidadCompra(payload);

        if (!cancelado) {
          setCapacidadPrevia(capacidad);
        }
      } catch {
        if (!cancelado) {
          setCapacidadPrevia(null);
        }
      }
    }, 500);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [fecha, paso2Completo, resumen.totalKg, step, sublotes]);

  const validarCapacidadBodega = async (): Promise<boolean> => {
    try {
      const payload = await construirPayloadCompra();
      const capacidad = await validarCapacidadCompra(payload);
      setCapacidadPrevia(capacidad);

      if (capacidad.nivel === 'requiere_configuracion') {
        setMostrarModalConfigurarCapacidad(true);
        return false;
      }

      if (!capacidad.validada) {
        return true;
      }

      const capacidadKg = capacidad.capacidadBodegaKg ?? 0;
      const inventarioActual = capacidad.inventarioActualKg ?? 0;
      const nuevoTotal = inventarioActual + resumen.totalKg;
      const porcentaje =
        capacidadKg > 0 ? Math.round((nuevoTotal / capacidadKg) * 100) : 0;

      if (capacidad.nivel === 'exceso') {
        setDatosCapacidad({
          capacidadKg,
          inventarioActual,
          nuevoTotal,
        });
        setMostrarModalCapacidad(true);
        return false;
      }

      if (porcentaje >= 80) {
        setDatosAlerta80({
          capacidadKg,
          inventarioActual,
          nuevoTotal,
          porcentaje,
        });
        setMostrarModalAlerta80(true);
        return false;
      }

      return true;
    } catch (error) {
      console.error('No se pudo validar capacidad:', error);

      if (
        error instanceof ApiRequestError &&
        (error.status === 401 || error.status === 403)
      ) {
        setError(error.message);
        setMostrarErrorFormulario(true);
        return false;
      }

      const mensajeValidacion = 'No se pudo validar la capacidad de la bodega';

      setCapacidadPrevia({
        validada: false,
        nivel: 'sin_validacion',
        mensaje: mensajeValidacion,
      });
      setMostrarModalCapacidad(false);
      return true;
    }
  };

  const guardarCapacidadDesdeCompra = async () => {
    const nombreBodega = nombreBodegaNueva.trim();
    const capacidad = Number(capacidadNuevaKg);
    const inventarioActualKg = Math.max(
      capacidadPrevia?.inventarioActualKg ?? 0,
      datosCapacidad?.inventarioActual ?? 0,
      datosAlerta80?.inventarioActual ?? 0,
    );
    setCapacidadNuevaError(null);

    if (!nombreBodega) {
      setCapacidadNuevaError('Ingresa el nombre de la bodega.');
      return;
    }

    if (
      !Number.isFinite(capacidad) ||
      capacidad <= 0 ||
      capacidad > CAPACIDAD_BODEGA_MAX_KG
    ) {
      setCapacidadNuevaError(CAPACIDAD_BODEGA_INVALIDA);
      return;
    }

    if (capacidad < inventarioActualKg) {
      setCapacidadNuevaError(CAPACIDAD_BODEGA_MENOR_INVENTARIO);
      return;
    }

    setGuardandoCapacidad(true);

    try {
      await guardarConfiguracionBodega({
        nombreBodega,
        capacidadKg: capacidad,
      });

      setMostrarModalConfigurarCapacidad(false);
      setNombreBodegaNueva('Bodega principal');
      setCapacidadNuevaKg('');
      setCapacidadPrevia(null);
      await abrirConfirmacionCompra();
    } catch (error) {
      setCapacidadNuevaError(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar la capacidad de bodega.',
      );
    } finally {
      setGuardandoCapacidad(false);
    }
  };

  const abrirConfirmacionCompra = async () => {
    setError(null);
    setMostrarErrorFormulario(false);

    if (!productorSeleccionado) {
      setMostrarErrorFormulario(true);
      setError('Selecciona un productor para continuar.');
      setStep(1);
      return;
    }

    const mensajeValidacion = validarSublotes();
    if (mensajeValidacion) {
      setMostrarErrorFormulario(true);
      setError(mensajeValidacion);
      return;
    }

    setCheckingConfirmacion(true);
    try {
      const puedeContinuar = await validarCapacidadBodega();
      if (puedeContinuar) {
        setMostrarModalConfirmar(true);
      }
    } finally {
      setCheckingConfirmacion(false);
    }
  };

  const guardarCompra = async () => {
    if (savingRef.current) {
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError(null);
    setMostrarErrorFormulario(false);

    if (!productorSeleccionado) {
      savingRef.current = false;
      setSaving(false);
      setMostrarErrorFormulario(true);
      setError('Selecciona un productor para continuar.');
      setStep(1);
      return;
    }
    const mensajeValidacion = validarSublotes();
    if (mensajeValidacion) {
      savingRef.current = false;
      setSaving(false);
      setMostrarErrorFormulario(true);
      setError(mensajeValidacion);
      return;
    }

    await esperarPintadoInterfaz();

    try {
      const payload = await construirPayloadCompra();
      const respuesta = await crearCompra(payload);
      setCompraGuardada({
        fecha: respuesta.compra.fecha,
        productorNombre: productorSeleccionado.nombre,
        productorDocumento: productorSeleccionado.documento,
        totalKg: resumen.totalKg,
        totalCompra: Number(respuesta.compra.totalCompra),
        capacidad: respuesta.capacidad ?? capacidadPrevia ?? undefined,
        sublotes: sublotes.map((sublote) => {
          const peso = Number(sublote.pesoInicial.replace(',', '.')) || 0;
          return {
            id: sublote.id,
            tipoCafe: nombreTipoCafePorId.get(sublote.tipoCafeId) ?? 'Café',
            calidad: nombreCalidadPorId.get(sublote.calidadId) ?? 'Calidad',
            pesoInicial: peso,
          };
        }),
      });
      setMostrarModalConfirmar(false);
    } catch (err) {
      if (
        err instanceof ApiRequestError &&
        err.code === 'COMPRA_CAPACIDAD_REQUERIDA'
      ) {
        setMostrarModalConfirmar(false);
        setMostrarModalConfigurarCapacidad(true);
        setCapacidadPrevia({
          validada: false,
          nivel: 'requiere_configuracion',
          mensaje: err.message,
        });
        savingRef.current = false;
        setSaving(false);
        return;
      }

      const mensaje = getCompraErrorMessage(err);
      setError(mensaje);
      setMostrarErrorFormulario(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const cerrarModalConfirmar = () => {
    setMostrarModalConfirmar(false);
  };

  const confirmarCancelarCompra = () => {
    resetFormulario();
    navigate('/inicio');
  };

  if (compraGuardada) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 text-slate-900">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[430px] items-center">
          <div className="w-full rounded-[28px] border border-[#dfe5f3] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
            <div className="text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#edf3ff]">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#19b881] text-white">
                  <Check size={30} strokeWidth={3} />
                </div>
              </div>
              <h1 className="mt-6 text-[2rem] font-semibold text-[#1f3f97]">
                Compra registrada
              </h1>
              <p className="mt-2 text-[1.04rem] text-slate-500">
                La compra se guardó correctamente.
              </p>
            </div>

            {compraGuardada.capacidad &&
            compraGuardada.capacidad.nivel !== 'normal' ? (
              <section
                className={`mt-6 rounded-[16px] border p-4 ${estiloCapacidad(compraGuardada.capacidad).contenedor}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${estiloCapacidad(compraGuardada.capacidad).icono}`}
                  >
                    <AlertTriangle size={18} />
                  </span>
                  <div>
                    <p className="text-[0.95rem] font-semibold">
                      {compraGuardada.capacidad.validada
                        ? 'Capacidad de bodega validada'
                        : 'Sin validación de capacidad'}
                    </p>
                    <p className="mt-1 text-sm leading-5">
                      {compraGuardada.capacidad.mensaje}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="mt-7 rounded-[18px] border border-[#dfe5f3] bg-[#fbfcff] p-4">
              <p className="text-[0.92rem] font-semibold text-slate-600">
                Resumen de compra
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between rounded-[12px] bg-white px-3 py-2.5">
                  <span className="text-[0.98rem] text-slate-600">
                    Productor
                  </span>
                  <span className="text-[1.02rem] font-semibold text-slate-900">
                    {compraGuardada.productorNombre}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-[12px] bg-white px-3 py-2.5">
                  <span className="text-[0.98rem] text-slate-600">
                    Total kg
                  </span>
                  <span className="text-[1.02rem] font-semibold text-slate-900">
                    {Math.round(compraGuardada.totalKg)} kg
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-[12px] bg-[#eef3ff] px-3 py-2.5">
                  <span className="text-[0.98rem] font-bold text-slate-700">
                    Total pagado
                  </span>
                  <span className="text-[1.8rem] font-bold text-[#1f3f97]">
                    {formatoMoneda(compraGuardada.totalCompra)}
                  </span>
                </div>
              </div>
            </section>

            <div className="mt-7 grid gap-3">
              <button
                type="button"
                onClick={iniciarNuevaCompra}
                className="inline-flex min-h-[54px] items-center justify-center gap-3 rounded-full bg-[#1D4ED8] px-5 py-4 text-[1.08rem] font-medium text-white shadow-[0_8px_20px_rgba(29,78,216,0.2)] transition hover:bg-[#1e40af] active:scale-[0.99]"
              >
                Registrar nueva compra
              </button>
              <button
                type="button"
                onClick={() => navigate('/inventario')}
                className="inline-flex min-h-[54px] items-center justify-center gap-3 rounded-full bg-[#edf1f8] px-5 py-4 text-[1.08rem] font-medium text-[#1f3f97] transition hover:bg-[#e2eafd] active:scale-[0.99]"
              >
                Ir a inventario
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 pb-[180px] text-slate-900">
      <header className="mx-auto w-full max-w-[430px] px-4 py-4 pt-6">
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={volverPasoAnterior}
            className="absolute left-0 inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-900 transition hover:bg-white/70 hover:opacity-75"
            aria-label={step > 1 ? 'Volver al paso anterior' : 'Salir a inicio'}
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-[1.35rem] font-semibold text-slate-900">
            Registro de Compra
          </h1>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between text-[0.95rem] font-medium text-slate-600">
            <span>
              Paso {step}: {pasoActual.titulo}
            </span>
            <span className="text-slate-400">{step} de 3</span>
          </div>
          <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#d0dbeb]">
            <div
              className="h-full rounded-full bg-[#1D4ED8] transition-all duration-300"
              style={{ width: `${pasoActual.progreso}%` }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-5 py-2">
        {step === 1 ? (
          <section className="flex flex-col gap-4">
            <button
              type="button"
              onClick={seleccionarBusqueda}
              className={`w-full rounded-[20px] border bg-white px-4 py-3.5 text-left transition ${
                productorSelectionMode === 'buscar'
                  ? 'border-[#1D4ED8]'
                  : 'border-[#e3e7f3]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                    productorSelectionMode === 'buscar'
                      ? 'bg-[#1D4ED8] text-white'
                      : 'bg-[#eef2f7] text-slate-500'
                  }`}
                >
                  <Search size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.95rem] font-medium text-slate-900">
                    Buscar productor
                  </p>
                  <p className="text-[0.82rem] text-slate-400">
                    Selecciona un productor registrado
                  </p>
                </div>
                <span
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    productorSelectionMode === 'buscar'
                      ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
                      : 'border-[#cad2e2] bg-white text-transparent'
                  }`}
                >
                  <Check size={12} />
                </span>
              </div>
            </button>

            {/* Panel de búsqueda — animación suave de expansión */}
            <div
              className="overflow-hidden transition-all duration-300 ease-in-out"
              style={{
                maxHeight:
                  productorSelectionMode === 'buscar' ? '420px' : '0px',
                opacity: productorSelectionMode === 'buscar' ? 1 : 0,
                marginTop: productorSelectionMode === 'buscar' ? '12px' : '0px',
              }}
            >
              <div className="space-y-2.5 px-1 pt-1">
                <p className="px-1 text-xs font-bold text-slate-500">
                  Recientes
                </p>

                {productoresFiltrados.length === 0 &&
                sinProductoresRegistrados ? (
                  <div className="rounded-[14px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-3 py-5 text-center text-sm text-slate-500">
                    <p className="font-medium text-slate-600">
                      Aún no tienes productores registrados.
                    </p>
                    <p className="mt-1 text-[0.82rem]">
                      Registra uno para iniciar la compra.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {productoresFiltrados.map((productor) => {
                      const activo = productorSeleccionado?.id === productor.id;
                      return (
                        <button
                          key={productor.id}
                          type="button"
                          onClick={() => seleccionarProductor(productor)}
                          className={`flex w-full flex-col rounded-[14px] border px-3 py-2.5 text-left transition ${
                            activo
                              ? 'border-[#1D4ED8] bg-[#f4f7ff]'
                              : 'border-[#e6ebf5] bg-white hover:border-[#ccd6ea]'
                          }`}
                        >
                          <p className="truncate text-[0.88rem] font-medium text-slate-900">
                            {productor.nombre}
                          </p>
                          <p className="mt-0.5 truncate text-[0.75rem] text-slate-400">
                            {productor.documento}
                          </p>
                          {activo ? (
                            <span className="mt-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#1D4ED8] text-white">
                              <Check size={10} />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={abrirSelectorProductor}
                  className="inline-flex min-h-[38px] w-full items-center justify-center rounded-[12px] border border-[#dbe2f0] bg-white px-4 text-[0.82rem] font-medium text-[#1D4ED8]"
                >
                  Ver más productores
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={seleccionarGenerico}
              className={`w-full rounded-[20px] border px-4 py-3.5 text-left transition ${
                productorSelectionMode === 'generico'
                  ? 'border-[#1D4ED8] bg-[#f4f7ff]'
                  : 'border-[#e3e7f3] bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                    productorSelectionMode === 'generico'
                      ? 'bg-[#1D4ED8] text-white'
                      : 'bg-[#eef2f7] text-slate-500'
                  }`}
                >
                  <User size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.95rem] font-medium text-slate-900">
                    Productor genérico
                  </p>
                  <p className="text-[0.82rem] text-slate-400">
                    Compra rápida sin registrar productor
                  </p>
                </div>
                <span
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    productorSelectionMode === 'generico'
                      ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
                      : 'border-[#cad2e2] bg-white text-transparent'
                  }`}
                >
                  <Check size={12} />
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={abrirModalProductor}
              className="w-full rounded-[20px] border border-[#e3e7f3] bg-white px-4 py-3.5 text-left transition hover:border-[#ccd6ea]"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef2f7] text-slate-500">
                  <UserPlus size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.95rem] font-medium text-slate-900">
                    Registrar productor
                  </p>
                  <p className="text-[0.82rem] text-slate-400">
                    Crear un nuevo productor
                  </p>
                </div>
              </div>
            </button>

            {/* ── Zona de acción: separada visualmente de las opciones ── */}
            <div className="mt-6 rounded-[20px] border border-[#e4e9f5] bg-white p-4 shadow-[0_4px_14px_rgba(20,35,85,0.05)]">
              {productorSeleccionado ? (
                <div className="mb-4 flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1D4ED8] text-white">
                    <User size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-500">
                      Productor seleccionado
                    </p>
                    <p className="truncate text-[0.98rem] font-semibold text-slate-900">
                      {productorSeleccionado.nombre}
                    </p>
                    <p className="text-[0.82rem] text-slate-500">
                      {productorSeleccionado.rapido
                        ? 'Compra rápida'
                        : productorSeleccionado.documento}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mb-4 rounded-[12px] border border-dashed border-[#d8dfee] px-4 py-3 text-center text-[0.88rem] text-slate-400">
                  Ningún productor seleccionado
                </div>
              )}

              {error &&
              mostrarErrorFormulario &&
              error.includes('Selecciona un productor') ? (
                <p className="mb-3 rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-[0.82rem] font-semibold leading-5 text-rose-600">
                  Selecciona un productor para continuar.
                </p>
              ) : null}

              <div className="grid gap-2.5">
                <button
                  type="button"
                  onClick={irSiguientePaso}
                  className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-[#1D4ED8] px-5 py-4 text-[1rem] font-medium text-white shadow-[0_8px_20px_rgba(29,78,216,0.22)] transition hover:bg-[#1e40af] active:scale-[0.99]"
                >
                  Siguiente paso
                </button>
                <button
                  type="button"
                  onClick={volverPasoAnterior}
                  className="inline-flex min-h-[46px] w-full items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-[0.95rem] font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Regresar
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4">
            <div className="rounded-[24px] border border-[#dce4f5] bg-white px-5 py-4 shadow-[0_4px_12px_rgba(20,35,85,0.03)]">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <CalendarDays size={15} className="shrink-0 text-slate-400" />
                  <span className="text-[0.85rem] font-semibold text-slate-800">
                    Fecha de compra
                  </span>
                </div>
                <input
                  type="date"
                  value={fecha}
                  min={BUSINESS_MIN_DATE_VALUE}
                  max={hoyLocal()}
                  onChange={(event) => {
                    setFecha(event.target.value);
                    invalidarValidacionCapacidad();
                  }}
                  className="bg-transparent text-[0.95rem] font-semibold text-slate-900 outline-none"
                />
              </div>
              {mostrarErrorFormulario &&
              step === 2 &&
              !fechaCompraValidacion.isValid ? (
                <p className="mt-2 text-[0.85rem] font-semibold text-rose-500">
                  {fechaCompraValidacion.message ??
                    'Selecciona la fecha de compra.'}
                </p>
              ) : null}
            </div>

            {sublotesAgregados.length > 0 ? (
              <section className="rounded-[20px] border border-[#dce4f5] bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-3 px-1">
                  <p className="text-[0.85rem] font-bold text-[#5b6f9d]">
                    Cafés agregados
                  </p>
                  <p className="shrink-0 text-[0.7rem] font-semibold text-slate-400">
                    {sublotesGuardados} guardados
                  </p>
                </div>
                <div className="max-h-[168px] space-y-1.5 overflow-y-auto pr-[6px] [scrollbar-color:#c5ccda_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-[8px] [&::-webkit-scrollbar-thumb]:bg-[#c5ccda]">
                  {sublotesAgregados.map((sublote) => {
                    const index = sublotes.findIndex(
                      (item) => item.id === sublote.id,
                    );
                    const tipoCafe =
                      nombreTipoCafePorId.get(sublote.tipoCafeId) ??
                      'Café por definir';
                    const calidad =
                      nombreCalidadPorId.get(sublote.calidadId) ??
                      'Calidad por definir';
                    const peso =
                      Number(sublote.pesoInicial.replace(',', '.')) || 0;
                    const totalItem = peso * Number(sublote.precioKg || 0);
                    const visual = iconoTipoCafe(tipoCafe);

                    return (
                      <article
                        key={sublote.id}
                        onClick={() => {
                          setSubloteActivoId(sublote.id);
                          setError(null);
                          setMostrarErrorFormulario(false);
                        }}
                        className="cursor-pointer rounded-[14px] border border-[#e6e8f3] bg-white px-3 py-2 shadow-sm transition hover:border-[#173ea6]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex items-start gap-2">
                            <div
                              className={`shrink-0 rounded-xl p-2 ${visual.fondo}`}
                            >
                              {visual.icono}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#5b6f9d]">
                                Café {index + 1}
                              </p>
                              <p className="mt-0.5 truncate text-[0.84rem] font-semibold leading-tight text-slate-900">
                                {tipoCafe} · {calidad}
                              </p>
                              <p className="mt-0.5 truncate text-[0.72rem] font-semibold text-slate-700">
                                Peso: {formatoKg(peso)}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end justify-between self-stretch">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  editarSubloteDesdeRevision(sublote.id);
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#eef3ff] text-[#1D4ED8] shadow-sm transition hover:bg-[#dfe8ff]"
                                title="Editar café"
                                aria-label={`Editar café ${index + 1}`}
                              >
                                <Pencil size={13} />
                              </button>
                              {sublotes.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    eliminarSubloteDesdeRevision(sublote.id);
                                  }}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#fff0f2] text-[#e24c5a] shadow-sm transition hover:bg-[#ffe0e4]"
                                  title="Eliminar café"
                                  aria-label={`Eliminar café ${index + 1}`}
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                            <p className="mt-2 whitespace-nowrap text-right text-[0.68rem] font-bold leading-tight text-[#173ea6]">
                              {formatoMoneda(totalItem)}
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {sublotesVisibles.map((sublote, index) => {
              const isActivo = subloteActual?.id === sublote.id;

              if (!isActivo) {
                return null;
                const tipoCafe =
                  nombreTipoCafePorId.get(sublote.tipoCafeId) ??
                  'Café por definir';
                const calidad =
                  nombreCalidadPorId.get(sublote.calidadId) ??
                  'Calidad por definir';
                const peso = Number(sublote.pesoInicial.replace(',', '.')) || 0;
                const totalItem = peso * Number(sublote.precioKg || 0);
                const visual = iconoTipoCafe(tipoCafe);
                return (
                  <article
                    key={sublote.id}
                    onClick={() => {
                      setSubloteActivoId(sublote.id);
                      setError(null);
                      setMostrarErrorFormulario(false);
                    }}
                    className="cursor-pointer rounded-[26px] border border-[#e6e8f3] bg-white px-5 py-4 shadow-sm hover:border-[#173ea6] transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`rounded-2xl p-3 ${visual.fondo}`}>
                          {visual.icono}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#5b6f9d]">
                            Café {index + 1}
                          </p>
                          <p className="mt-1 text-[1.1rem] font-semibold leading-tight text-slate-900">
                            {tipoCafe} • {calidad}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">
                            Peso:{' '}
                            {peso.toLocaleString('es-CO', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })}{' '}
                            kg
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between self-stretch">
                        {sublotes.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              eliminarSubloteDesdeRevision(sublote.id);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#fff0f2] text-[#e24c5a] shadow-sm hover:bg-[#ffe0e4] transition"
                            title="Eliminar café"
                            aria-label={`Eliminar café ${index + 1}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <div className="mt-auto text-right">
                          <p className="text-[0.95rem] font-bold text-[#173ea6]">
                            {formatoMoneda(totalItem)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              }

              const mostrarErroresSublote =
                mostrarErrorFormulario && step === 2;
              const subloteErrors = getSubloteFieldErrors(
                sublote,
                minPesoKg,
                maxPesoKg,
                minPrecioKg,
                maxPrecioKg,
              );
              const subloteErrorCount = countSubloteErrors(subloteErrors);
              const tipoCafeError =
                mostrarErroresSublote && subloteErrors.tipoCafe
                  ? subloteErrorCount === 1
                    ? 'Selecciona el tipo de café para continuar.'
                    : subloteErrors.tipoCafe
                  : null;
              const calidadError =
                mostrarErroresSublote && subloteErrors.calidad
                  ? subloteErrorCount === 1
                    ? 'Selecciona la calidad del café para continuar.'
                    : subloteErrors.calidad
                  : null;
              const pesoError =
                mostrarErroresSublote && subloteErrors.peso
                  ? subloteErrorCount === 1 &&
                    subloteErrors.peso === 'Ingresa el peso.'
                    ? 'Ingresa el peso para continuar.'
                    : subloteErrors.peso
                  : null;
              const precioError =
                mostrarErroresSublote && subloteErrors.precio
                  ? subloteErrorCount === 1 &&
                    subloteErrors.precio === 'Ingresa el precio por kilo.'
                    ? 'Ingresa el precio por kilo para continuar.'
                    : subloteErrors.precio
                  : null;

              return (
                <article
                  key={sublote.id}
                  className="rounded-[26px] border border-[#e6e8f3] bg-white p-5 shadow-sm"
                >
                  {sublotes.length > 1 && (
                    <div className="mb-4 flex items-center justify-between px-1">
                      <span className="text-sm font-semibold text-[#5b6f9d]">
                        Café {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => eliminarSubloteDesdeRevision(sublote.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#fff0f2] text-[#e24c5a] shadow-sm"
                        title="Eliminar café"
                        aria-label={`Eliminar café ${index + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  <div>
                    <p className="mb-2 text-[0.85rem] font-semibold text-slate-800">
                      Tipo de café
                    </p>
                    <div className="relative">
                      <select
                        value={sublote.tipoCafeId}
                        onChange={(event) =>
                          actualizarSublote(
                            sublote.id,
                            'tipoCafeId',
                            event.target.value,
                          )
                        }
                        className={`w-full appearance-none rounded-[18px] border bg-white px-4 py-4 pr-12 text-base outline-none transition focus:border-[#173ea6] ${
                          sublote.tipoCafeId
                            ? 'border-[#dfe5f2] font-semibold text-slate-900'
                            : 'border-[#dfe5f2] font-medium text-slate-400'
                        }`}
                      >
                        <option value="">Seleccionar tipo de café</option>
                        {tiposCafe.map((tipoCafe) => (
                          <option key={tipoCafe.id} value={tipoCafe.id}>
                            {tipoCafe.nombre}
                          </option>
                        ))}
                      </select>
                      <ArrowRight
                        size={18}
                        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-slate-400"
                      />
                    </div>
                    {tipoCafeError ? (
                      <p className="mt-1.5 text-[0.8rem] font-semibold text-rose-500">
                        {tipoCafeError}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-5">
                    <p className="mb-2.5 text-[0.85rem] font-semibold text-slate-800">
                      Calidad
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {calidades.map((calidad) => {
                        const activo = sublote.calidadId === calidad.id;
                        const visual = visualCalidad(calidad.nombre);
                        return (
                          <button
                            key={calidad.id}
                            type="button"
                            onClick={() =>
                              actualizarSublote(
                                sublote.id,
                                'calidadId',
                                calidad.id,
                              )
                            }
                            className={`rounded-[18px] border-2 px-2 py-3 text-sm font-semibold transition ${
                              activo
                                ? `${visual.borde} ${visual.texto} bg-white shadow-sm`
                                : 'border-[#cbd5e1] bg-white text-slate-700 hover:border-slate-400'
                            }`}
                          >
                            <span className="flex flex-col items-center gap-1.5">
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition ${
                                  activo
                                    ? visual.fondo
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {visual.icono}
                              </span>
                              <span
                                className={`text-[12px] font-semibold ${activo ? visual.texto : 'text-slate-800'}`}
                              >
                                {calidad.nombre}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {calidadError ? (
                      <p className="mt-1.5 text-[0.8rem] font-semibold text-rose-500">
                        {calidadError}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-5 rounded-[22px] bg-[#f8f9ff] p-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-[0.85rem] font-semibold text-slate-800">
                          Peso (kg)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          maxLength={8}
                          value={sublote.pesoInicial}
                          onChange={(event) => {
                            const raw = event.target.value.replace(
                              /[^0-9.,]/g,
                              '',
                            );
                            if (raw.length > 8) {
                              return;
                            }
                            const numeric = Number(raw.replace(',', '.'));
                            if (
                              raw !== '' &&
                              Number.isFinite(numeric) &&
                              numeric > maxPesoKg
                            ) {
                              return;
                            }
                            actualizarSublote(sublote.id, 'pesoInicial', raw);
                          }}
                          className={`mt-2.5 w-full rounded-[18px] border bg-[#fbfcff] px-4 py-4 text-[1.6rem] font-semibold text-slate-900 outline-none placeholder:text-slate-300 ${
                            pesoError
                              ? 'border-rose-400 focus:border-rose-500'
                              : 'border-[#e4e8f3] focus:border-[#1D4ED8]'
                          }`}
                          placeholder="ej. 25"
                        />
                        <p className="mt-1 text-[0.62rem] font-semibold text-slate-400">
                          Max. por entrada: {formatoKg(maxPesoKg)}
                        </p>
                        {pesoError ? (
                          <p className="mt-1 text-[0.8rem] font-semibold text-rose-500">
                            {pesoError}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label className="block text-[0.85rem] font-semibold text-slate-800">
                          Precio por kg
                        </label>
                        <div className="mt-2.5 flex items-center rounded-[18px] border border-[#e4e8f3] bg-[#fbfcff] px-4 py-4">
                          <span className="mr-3 text-[1.6rem] font-semibold text-slate-500">
                            $
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={sublote.precioKg}
                            onChange={(event) => {
                              const digits = soloDigitos(event.target.value);
                              const numeric = Number(digits);
                              if (
                                digits !== '' &&
                                Number.isFinite(numeric) &&
                                numeric > maxPrecioKg
                              ) {
                                return;
                              }
                              actualizarSublote(sublote.id, 'precioKg', digits);
                            }}
                            className="w-full bg-transparent text-[1.6rem] font-semibold text-slate-900 outline-none placeholder:text-slate-300"
                            placeholder="ej. 14000"
                          />
                        </div>
                        <p className="mt-1 text-[0.62rem] font-semibold text-slate-400">
                          Máx. $
                          {new Intl.NumberFormat('es-CO').format(maxPrecioKg)}
                          /kg
                        </p>
                        {precioError ? (
                          <p className="mt-1 text-[0.8rem] font-semibold text-rose-500">
                            {precioError}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            <button
              type="button"
              onClick={agregarSublote}
              disabled={!subloteActualListo}
              className={`inline-flex w-full min-h-[56px] items-center justify-center gap-3 rounded-[22px] border border-dashed px-5 py-4 text-sm font-semibold transition ${
                subloteActualListo
                  ? 'border-[#ccd4e8] bg-white text-[#1D4ED8]'
                  : 'cursor-not-allowed border-[#e5e7eb] bg-slate-50 text-slate-400'
              }`}
            >
              <Plus size={20} />
              Agregar más café
            </button>
            {!subloteActualListo ? (
              <p className="px-1 text-xs font-semibold text-slate-500">
                Completa el café actual antes de agregar otro.
              </p>
            ) : null}

            {estadoBodegaCompra ? (
              <article
                className={`rounded-[20px] border ${estadoBodegaCompra.borde} ${estadoBodegaCompra.fondo} p-4 shadow-sm`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      Espacio en bodega
                    </p>
                    <p
                      className={`mt-1 text-[1.35rem] font-bold leading-tight ${estadoBodegaCompra.texto}`}
                    >
                      {formatoKg(estadoBodegaCompra.kgReferencia)} libres
                    </p>
                  </div>
                  <p className="shrink-0 text-xs font-bold text-slate-500">
                    {Math.round(estadoBodegaCompra.porcentajeProyectado)}%
                    ocupado
                  </p>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/80">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${estadoBodegaCompra.barra}`}
                    style={{
                      width: `${Math.min(100, estadoBodegaCompra.porcentajeProyectado)}%`,
                    }}
                  />
                </div>
                <p
                  className={`mt-2 text-[0.78rem] font-semibold ${estadoBodegaCompra.texto}`}
                >
                  {estadoBodegaCompra.mensaje}
                </p>
              </article>
            ) : null}

            <article className="rounded-[18px] border border-[#d6e2ff] bg-[#eef3ff] p-4 text-[#1D4ED8] shadow-sm">
              <p className="text-[0.85rem] font-semibold text-[#1e3a8a]">
                Resumen de peso
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#d6e2ff] pt-3">
                <div className="min-w-0 rounded-[14px] bg-white/50 px-3 py-2.5">
                  <p className="text-[0.76rem] font-semibold text-slate-800">
                    Total kg
                  </p>
                  <p
                    className={`mt-1 max-w-full overflow-hidden whitespace-nowrap font-bold leading-[1.1] text-[#1D4ED8] ${claseValorResumen(
                      formatoKg(resumen.totalKg),
                    )}`}
                  >
                    {formatoKg(resumen.totalKg)}
                  </p>
                </div>
                <div className="min-w-0 rounded-[14px] bg-white/50 px-3 py-2.5 text-right">
                  <p className="text-[0.76rem] font-semibold text-slate-800">
                    Total estimado
                  </p>
                  <p
                    className={`mt-1 max-w-full overflow-hidden whitespace-nowrap font-bold leading-[1.1] text-[#1D4ED8] ${claseValorResumen(
                      formatoMoneda(resumen.totalCompra),
                    )}`}
                  >
                    {formatoMoneda(resumen.totalCompra)}
                  </p>
                </div>
              </div>
            </article>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={irSiguientePaso}
                className="inline-flex min-h-[56px] w-full items-center justify-center rounded-full bg-[#1D4ED8] px-5 py-4 text-[1rem] font-medium text-white shadow-[0_8px_20px_rgba(29,78,216,0.22)] transition hover:bg-[#1e40af] active:scale-[0.99]"
              >
                Siguiente paso
              </button>
              <button
                type="button"
                onClick={irPasoAnterior}
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-[1rem] font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Regresar
              </button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-4">
            <article className="rounded-[24px] border border-[#e2e8f4] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-[#5b6f9d]">
                <CalendarDays size={14} />
                <span>Datos de la compra</span>
              </div>
              <div className="space-y-4 rounded-[16px] border border-[#e6eaf3] bg-[#fbfcff] px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-slate-500">
                    Productor
                  </span>
                  <span className="text-[1.05rem] font-semibold text-slate-900">
                    {productorSeleccionado?.nombre ?? 'Sin productor'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-slate-500">
                    Fecha
                  </span>
                  <span className="text-[1.05rem] font-semibold text-slate-900">
                    {formatoFecha(fecha)}
                  </span>
                </div>
              </div>
            </article>

            <section>
              <div className="mb-2 flex items-center gap-2 px-1 text-sm font-bold text-[#5b6f9d]">
                <ShoppingBag size={14} />
                <span>Historial de la compra</span>
              </div>
              <p className="px-1 text-[0.85rem] text-slate-500">
                Si necesitas editar la información de un sublote, regresa al
                paso anterior
              </p>
              <div className="mt-3 max-h-[330px] space-y-2 overflow-y-auto pr-[6px] [scrollbar-color:#c5ccda_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-[8px] [&::-webkit-scrollbar-thumb]:bg-[#c5ccda]">
                {sublotes.map((sublote) => {
                  const tipoCafe =
                    nombreTipoCafePorId.get(sublote.tipoCafeId) ?? 'Café';
                  const calidad =
                    nombreCalidadPorId.get(sublote.calidadId) ?? 'Calidad';
                  const peso =
                    Number(sublote.pesoInicial.replace(',', '.')) || 0;
                  const totalItem = peso * Number(sublote.precioKg || 0);
                  const visual = iconoTipoCafe(tipoCafe);

                  return (
                    <article
                      key={sublote.id}
                      className="rounded-[18px] border border-[#e6e8f3] bg-white px-3 py-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex items-start gap-3">
                          <div
                            className={`shrink-0 rounded-xl p-2.5 ${visual.fondo}`}
                          >
                            {visual.icono}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#1D4ED8]">
                              {formatCoffeeLabel(tipoCafe)}
                            </p>
                            <p className="mt-1 truncate text-[1rem] font-semibold leading-tight text-slate-900">
                              Calidad: {calidad}
                            </p>
                            <p className="mt-1 whitespace-nowrap text-sm font-semibold text-slate-700">
                              Peso:{' '}
                              {peso.toLocaleString('es-CO', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })}{' '}
                              kg
                            </p>
                            <p className="mt-1 overflow-hidden whitespace-nowrap text-sm font-semibold text-slate-700">
                              Total: {formatoMoneda(totalItem)}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              editarSubloteDesdeRevision(sublote.id)
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eef2ff] text-[#173ea6]"
                            title="Editar producto"
                            aria-label={`Editar ${tipoCafe}`}
                          >
                            <Pencil size={14} />
                          </button>
                          {sublotes.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                eliminarSubloteDesdeRevision(sublote.id)
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#fff0f2] text-[#e24c5a]"
                              title="Eliminar producto"
                              aria-label={`Eliminar ${tipoCafe}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <article className="rounded-[24px] border border-[#d9e2f5] bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-[#5b6f9d]">
                Resumen de compra
              </p>
              <div className="mt-4 space-y-4 rounded-[16px] bg-[#f7f8ff] px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-slate-600">
                    Total kg
                  </span>
                  <span className="text-[2rem] font-bold text-[#173ea6]">
                    {resumen.totalKg.toLocaleString('es-CO', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{' '}
                    kg
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-slate-600">
                    Total a pagar
                  </span>
                  <span className="text-[2rem] font-bold text-[#173ea6]">
                    {formatoMoneda(resumen.totalCompra)}
                  </span>
                </div>
              </div>
            </article>

            {error && mostrarErrorFormulario ? (
              <p className="rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-[0.82rem] font-semibold leading-5 text-rose-600">
                {error}
              </p>
            ) : null}

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => void abrirConfirmacionCompra()}
                disabled={saving || checkingConfirmacion || loading}
                className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-[#1D4ED8] px-5 py-4 text-[1rem] font-medium text-white shadow-[0_8px_20px_rgba(29,78,216,0.22)] transition hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkingConfirmacion ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : null}
                {checkingConfirmacion
                  ? 'Revisando bodega...'
                  : 'Registrar compra'}
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalCancelar(true)}
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-[1rem] font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </section>
        ) : null}
      </main>

      {mostrarModalCancelar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
            <div className="mt-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ffecef] text-[#b12937]">
                <AlertTriangle size={24} />
              </div>
              <h2 className="mt-5 text-[2rem] font-semibold leading-tight text-slate-900">
                ¿Cancelar compra?
              </h2>
              <p className="mt-3 text-[1.05rem] leading-7 text-slate-500">
                Se perderán los datos ingresados y tendrás que iniciar el
                proceso nuevamente.
              </p>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={confirmarCancelarCompra}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] bg-[#ffe1e5] px-5 py-3 text-[1.15rem] font-semibold text-[#b12937]"
              >
                Sí, cancelar
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalCancelar(false)}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] px-5 py-3 text-[1.15rem] font-semibold text-[#1f56dd]"
              >
                Seguir editando
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModalConfigurarCapacidad ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
            <div className="mt-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eef3ff] text-[#1D4ED8]">
                <Warehouse size={24} />
              </div>
              <h2 className="mt-5 text-[1.65rem] font-semibold leading-tight text-slate-900">
                Registra la capacidad de la bodega
              </h2>
              <p className="mt-3 text-[1rem] leading-7 text-slate-500">
                Antes de registrar una compra necesitamos saber cuál es el
                máximo de café que almacena tu bodega. También puedes cambiarlo
                luego en Ajustes.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-[0.86rem] font-semibold text-slate-700">
                  Nombre de la bodega
                </label>
                <input
                  type="text"
                  value={nombreBodegaNueva}
                  maxLength={50}
                  onChange={(event) => {
                    setNombreBodegaNueva(event.target.value.slice(0, 50));
                    setCapacidadNuevaError(null);
                  }}
                  className="mt-2 w-full rounded-[16px] border border-[#dde4f1] bg-[#f8faff] px-4 py-4 text-[1.05rem] font-semibold text-slate-900 outline-none focus:border-[#1D4ED8]"
                  placeholder="Ej. Bodega principal"
                />
              </div>

              <div>
                <label className="block text-[0.86rem] font-semibold text-slate-700">
                  Capacidad total (kg)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={capacidadNuevaKg}
                  onChange={(event) => {
                    setCapacidadNuevaKg(
                      sanitizeCapacidadBodegaInput(event.target.value),
                    );
                    setCapacidadNuevaError(null);
                  }}
                  className="mt-2 w-full rounded-[16px] border border-[#dde4f1] bg-[#f8faff] px-4 py-4 text-[1.2rem] font-semibold text-slate-900 outline-none focus:border-[#1D4ED8]"
                  placeholder="Ej. 6000"
                />
                <p className="mt-1 text-[0.72rem] font-semibold text-slate-400">
                  Máx. {CAPACIDAD_BODEGA_MAX_LABEL} kg
                </p>
              </div>

              {capacidadNuevaError ? (
                <p className="mt-2 text-sm font-semibold text-rose-600">
                  {capacidadNuevaError}
                </p>
              ) : null}
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => void guardarCapacidadDesdeCompra()}
                disabled={guardandoCapacidad}
                className="inline-flex min-h-[54px] items-center justify-center rounded-full bg-[#1D4ED8] px-5 py-3 text-[1.08rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {guardandoCapacidad ? 'Guardando...' : 'Guardar y validar'}
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalConfigurarCapacidad(false)}
                disabled={guardandoCapacidad}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] px-5 py-3 text-[1.05rem] font-semibold text-[#1f56dd]"
              >
                Volver a la compra
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModalCapacidad && datosCapacidad ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
            <div className="mt-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff7ed] text-[#ea580c]">
                <AlertTriangle size={24} />
              </div>
              <h2 className="mt-5 text-[1.8rem] font-semibold leading-tight text-slate-900">
                Capacidad superada
              </h2>
              <p className="mt-3 text-[1rem] leading-7 text-slate-500">
                Esta compra supera la capacidad registrada de tu bodega. Puedes
                revisar los datos o continuar bajo tu criterio.
              </p>
            </div>

            <div className="mt-5 rounded-[16px] border border-[#fed7aa] bg-[#fff7ed] p-4">
              <div className="flex items-center justify-between gap-3 text-[0.95rem] text-slate-600">
                <span>Capacidad máxima</span>
                <span className="font-semibold text-slate-900">
                  {datosCapacidad.capacidadKg.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  kg
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[0.95rem] text-slate-600">
                <span>Después de la compra</span>
                <span className="font-semibold text-[#ea580c]">
                  {datosCapacidad.nuevoTotal.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  kg
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalCapacidad(false);
                  setMostrarModalConfirmar(true);
                }}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] bg-[#ea580c] px-5 py-3 text-[1.15rem] font-semibold text-white"
              >
                Continuar
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalCapacidad(false)}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] px-5 py-3 text-[1.05rem] font-semibold text-[#c2410c]"
              >
                Revisar compra
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModalAlerta80 && datosAlerta80 ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
            <div className="mt-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff7ed] text-[#ea580c]">
                <AlertTriangle size={24} />
              </div>
              <h2 className="mt-5 text-[1.8rem] font-semibold leading-tight text-slate-900">
                Bodega en nivel de alerta
              </h2>
              <p className="mt-3 text-[1rem] leading-7 text-slate-500">
                La compra dejará la bodega al {datosAlerta80.porcentaje}% de su
                capacidad.
              </p>
              <p className="mt-2 text-[0.95rem] leading-6 text-slate-600">
                Es recomendable considerar vender parte del inventario para
                evitar problemas de almacenamiento.
              </p>
            </div>

            <div className="mt-5 rounded-[16px] border border-[#fed7aa] bg-[#fff7ed] p-4">
              <div className="flex items-center justify-between gap-3 text-[0.95rem] text-slate-600">
                <span>Capacidad total</span>
                <span className="font-semibold text-slate-900">
                  {datosAlerta80.capacidadKg.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  kg
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[0.95rem] text-slate-600">
                <span>Antes de la compra</span>
                <span className="font-semibold text-slate-900">
                  {datosAlerta80.inventarioActual.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  kg
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[0.95rem] text-slate-600">
                <span>Después de la compra</span>
                <span className="font-semibold text-[#ea580c]">
                  {datosAlerta80.nuevoTotal.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  kg
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalAlerta80(false);
                  setMostrarModalConfirmar(true);
                }}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] bg-[#ea580c] px-5 py-3 text-[1.15rem] font-semibold text-white"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModalConfirmar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
            <div className="mt-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f1ff] text-[#1D4ED8]">
                <Check size={24} />
              </div>
              <h2 className="mt-5 text-[2rem] font-semibold leading-tight text-slate-900">
                ¿Registrar compra?
              </h2>
              <p className="mt-3 text-[1.05rem] leading-7 text-slate-500">
                Verifica la información antes de continuar.
              </p>
            </div>

            <div className="mt-5 rounded-[16px] border border-[#e2e8f4] bg-[#f8faff] p-4">
              <div className="flex items-center justify-between gap-3 text-[0.95rem] text-slate-600">
                <span>Productor</span>
                <span className="font-semibold text-slate-900">
                  {productorSeleccionado?.nombre ?? '-'}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[0.95rem] text-slate-600">
                <span>Total kg</span>
                <span className="font-semibold text-slate-900">
                  {resumen.totalKg.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  kg
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[0.95rem] text-slate-600">
                <span>Total a pagar</span>
                <span className="text-[1.4rem] font-black text-[#1D4ED8]">
                  {formatoMoneda(resumen.totalCompra)}
                </span>
              </div>
            </div>

            {mostrarErrorFormulario && error ? (
              <div className="mt-4">
                <InlineGuidedError message={getComprasGuidance(error)} />
              </div>
            ) : null}

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => void guardarCompra()}
                disabled={!puedeRegistrarCompra || saving}
                className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full bg-[#1D4ED8] px-5 py-3 text-[1.15rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-80"
              >
                {saving ? (
                  <>
                    <LoaderCircle size={20} className="animate-spin" />
                    Guardando compra...
                  </>
                ) : (
                  'Confirmar compra'
                )}
              </button>
              <button
                type="button"
                onClick={cerrarModalConfirmar}
                disabled={saving}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] px-5 py-3 text-[1.15rem] font-semibold text-[#1f56dd]"
              >
                Cancelar
              </button>
            </div>
          </div>
          {saving ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10 px-4">
              <div className="rounded-[18px] bg-white px-5 py-4 text-center shadow-[0_18px_42px_rgba(15,23,42,0.22)]">
                <LoaderCircle
                  size={28}
                  className="mx-auto animate-spin text-[#1D4ED8]"
                />
                <p className="mt-2 text-sm font-black text-slate-900">
                  Guardando compra
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Espera un momento...
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {mostrarModalSelectorProductor ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 px-4 pb-4 pt-8 backdrop-blur-sm sm:items-center">
          <div className="flex h-[75vh] max-h-[75vh] w-full max-w-[430px] flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.28)]">
            <div className="shrink-0 border-b border-[#eef2f7] px-5 pb-4 pt-3">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-[#cfd8e6]" />
              <div className="mt-4 flex items-center justify-between gap-4">
                <h2 className="text-[1.35rem] font-semibold leading-tight text-[#111827]">
                  Seleccionar productor
                </h2>
                <button
                  type="button"
                  onClick={cerrarSelectorProductor}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                  aria-label="Cerrar selector de productores"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="relative mt-4">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={busquedaSelectorProductor}
                  maxLength={60}
                  onChange={(event) => {
                    const busqueda = event.target.value.slice(0, 60);
                    setBusquedaSelectorProductor(busqueda);
                    setLimiteSelectorProductor(LIMITE_PRODUCTORES_MODAL);
                    setProductoresSelector([]);
                  }}
                  placeholder="Buscar por nombre o documento..."
                  className="w-full rounded-[16px] border border-[#dbe2f0] bg-[#f8faff] px-11 py-3 text-[0.98rem] text-slate-900 outline-none transition focus:border-[#1D4ED8]"
                />
              </div>

              <div className="mt-3 rounded-[14px] bg-[#f4f7fb] p-1">
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { value: 'recientes', label: 'Recientes' },
                    { value: 'antiguos', label: 'Antiguos' },
                    { value: 'az', label: 'A-Z' },
                  ].map((orden) => {
                    const activo = ordenSelectorProductor === orden.value;

                    return (
                      <button
                        key={orden.value}
                        type="button"
                        onClick={() => {
                          setOrdenSelectorProductor(
                            orden.value as ProductorOrden,
                          );
                          setLimiteSelectorProductor(LIMITE_PRODUCTORES_MODAL);
                          setProductoresSelector([]);
                        }}
                        className={`min-h-[38px] rounded-[11px] px-2 text-sm font-black transition ${
                          activo
                            ? 'bg-white text-[#1D4ED8] shadow-[0_6px_14px_rgba(31,63,167,0.12)]'
                            : 'text-slate-500'
                        }`}
                      >
                        {orden.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-scroll px-5 py-4 pr-[6px] [scrollbar-color:#c5ccda_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-[8px] [&::-webkit-scrollbar-thumb]:bg-[#c5ccda]"
              onScroll={(event) => {
                const target = event.currentTarget;
                const cercaDelFinal =
                  target.scrollTop + target.clientHeight >=
                  target.scrollHeight - 80;

                if (
                  cercaDelFinal &&
                  quedanProductoresPorCargar &&
                  !cargandoProductoresSelector
                ) {
                  if (
                    productoresSelectorFiltrados.length >
                    limiteSelectorProductor
                  ) {
                    setLimiteSelectorProductor(
                      (actual) => actual + LIMITE_PRODUCTORES_MODAL,
                    );
                    return;
                  }

                  void cargarProductoresSelector(false);
                }
              }}
            >
              {cargandoProductoresSelector &&
              productoresSelectorVisibles.length === 0 ? (
                <div className="rounded-[16px] border border-[#e6ebf5] bg-[#fafbff] px-4 py-8 text-center">
                  <LoaderCircle
                    size={24}
                    className="mx-auto animate-spin text-[#1D4ED8]"
                  />
                  <p className="mt-3 text-sm font-black text-slate-700">
                    Cargando productores...
                  </p>
                </div>
              ) : productoresSelectorFiltrados.length === 0 &&
                !busquedaSelectorActiva ? (
                <div className="rounded-[16px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-8 text-center">
                  <p className="text-[1rem] font-black text-slate-800">
                    Aún no tienes productores registrados.
                  </p>
                  <p className="mt-2 text-sm leading-5 text-slate-500">
                    Registra uno para iniciar la compra.
                  </p>
                  <button
                    type="button"
                    onClick={abrirModalProductor}
                    className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-full bg-[#1D4ED8] px-4 text-sm font-black text-white"
                  >
                    Registrar productor
                  </button>
                </div>
              ) : productoresSelectorFiltrados.length === 0 &&
                busquedaSelectorActiva ? (
                <div className="rounded-[16px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-8 text-center">
                  <p className="text-[1rem] font-black text-slate-800">
                    No se encontraron resultados
                  </p>
                  <p className="mt-2 text-sm leading-5 text-slate-500">
                    Intenta con otro nombre o documento.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3 px-1">
                    <p className="text-[0.85rem] font-semibold text-slate-800">
                      {busquedaSelectorActiva
                        ? 'Resultados encontrados'
                        : 'Recientes'}
                    </p>
                    <p className="text-xs font-semibold text-slate-400">
                      {productoresSelectorVisibles.length} resultados
                    </p>
                  </div>
                  <div className="space-y-2">
                    {productoresSelectorVisibles.map((productor) => {
                      const activo = productorSeleccionado?.id === productor.id;

                      return (
                        <div
                          key={productor.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => seleccionarProductor(productor)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              seleccionarProductor(productor);
                            }
                          }}
                          className={`flex cursor-pointer items-center gap-3 rounded-[14px] border px-3 py-3 transition ${
                            activo
                              ? 'border-[#1D4ED8] bg-[#f4f7ff]'
                              : 'border-[#e6ebf5] bg-white hover:border-[#cbd7ef] hover:bg-[#fbfcff]'
                          }`}
                        >
                          <span
                            className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              activo
                                ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
                                : 'border-[#aebbd1] bg-white text-transparent'
                            }`}
                            aria-hidden="true"
                          >
                            {activo ? (
                              <Check size={11} strokeWidth={3} />
                            ) : null}
                          </span>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="truncate text-[0.98rem] font-black text-slate-900">
                              {productor.nombre}
                            </p>
                            <p className="mt-0.5 truncate text-[0.84rem] font-semibold text-slate-500">
                              {productor.documento}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              pedirConfirmacionEditarProductor(productor);
                            }}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef2f7] text-slate-600"
                            aria-label={`Editar ${productor.nombre}`}
                          >
                            <Pencil size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModalProductor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-5 py-6 backdrop-blur-sm">
          <div className="flex max-h-[78vh] w-full max-w-[360px] flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_24px_56px_rgba(15,23,42,0.26)]">
            <div className="shrink-0 px-4 pb-3 pt-3">
              <div className="mx-auto h-1 w-9 rounded-full bg-[#cfd8e6]" />
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[1.05rem] font-semibold leading-tight text-[#111827]">
                    {productorEditando
                      ? 'Editar productor'
                      : 'Registrar productor'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={cerrarModalProductor}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pr-[10px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-[0.78rem] font-semibold text-slate-900">
                    Tipo de documento
                  </label>
                  <select
                    value={productorForm.tipoDocumento}
                    translate="no"
                    onChange={(event) => {
                      const tipoDocumento =
                        event.target.value === 'NIT' ? 'NIT' : 'CC';
                      setProductorForm((actual) => ({
                        ...actual,
                        tipoDocumento,
                        nombre: sanitizeProducerNameInput(
                          actual.nombre,
                          tipoDocumento,
                        ),
                        documento: sanitizeDocumentInput(
                          actual.documento,
                          tipoDocumento,
                        ),
                      }));
                      setProductorFormErrors((actual) => ({
                        ...actual,
                        nombre: undefined,
                        documento: undefined,
                      }));
                      setProductorFormError(null);
                    }}
                    className={productorFieldClass(false)}
                  >
                    {TIPOS_DOCUMENTO_PRODUCTOR.map((tipo) => (
                      <option
                        key={tipo.value}
                        value={tipo.value}
                        translate="no"
                      >
                        {tipo.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[0.78rem] font-semibold text-slate-900">
                    {getProducerNameLabel(productorForm.tipoDocumento)}
                  </label>
                  <input
                    type="text"
                    value={productorForm.nombre}
                    maxLength={PERSON_NAME_MAX_LENGTH}
                    onChange={(event) => {
                      setProductorForm((actual) => ({
                        ...actual,
                        nombre: sanitizeProducerNameInput(
                          event.target.value,
                          actual.tipoDocumento,
                        ).slice(0, PERSON_NAME_MAX_LENGTH),
                      }));
                      setProductorFormErrors((actual) => ({
                        ...actual,
                        nombre: undefined,
                      }));
                      setProductorFormError(null);
                    }}
                    placeholder={getProducerNamePlaceholder(
                      productorForm.tipoDocumento,
                    )}
                    className={productorFieldClass(
                      Boolean(productorFormErrors.nombre),
                    )}
                  />
                  {productorFormErrors.nombre ? (
                    <ProducerFieldError message={productorFormErrors.nombre} />
                  ) : null}
                </div>
                <div>
                  <label className="mb-1.5 block text-[0.78rem] font-semibold text-slate-900">
                    Número de documento
                  </label>
                  <input
                    type="text"
                    inputMode={
                      productorForm.tipoDocumento === 'CC' ||
                      productorForm.tipoDocumento === 'NIT'
                        ? 'numeric'
                        : 'text'
                    }
                    maxLength={40}
                    value={productorForm.documento}
                    onChange={(event) => {
                      setProductorForm((actual) => ({
                        ...actual,
                        documento: sanitizeDocumentInput(
                          event.target.value,
                          actual.tipoDocumento,
                        ),
                      }));
                      setProductorFormErrors((actual) => ({
                        ...actual,
                        documento: undefined,
                      }));
                      setProductorFormError(null);
                    }}
                    placeholder={
                      productorForm.tipoDocumento === 'NIT'
                        ? 'Ej. 900123456-7'
                        : 'Ej. 123456789'
                    }
                    className={productorFieldClass(
                      Boolean(productorFormErrors.documento),
                    )}
                  />
                  {productorFormErrors.documento ? (
                    <ProducerFieldError
                      message={productorFormErrors.documento}
                    />
                  ) : null}
                </div>
                <div>
                  <label className="mb-1.5 block text-[0.78rem] font-semibold text-slate-900">
                    Teléfono (opcional)
                  </label>
                  <input
                    type="text"
                    inputMode="tel"
                    maxLength={20}
                    value={productorForm.telefono}
                    onChange={(event) => {
                      setProductorForm((actual) => ({
                        ...actual,
                        telefono: sanitizePersonDigits(event.target.value, 15),
                      }));
                      setProductorFormErrors((actual) => ({
                        ...actual,
                        telefono: undefined,
                      }));
                      setProductorFormError(null);
                    }}
                    placeholder="Ej. +57 300 123 4567"
                    className={productorFieldClass(
                      Boolean(productorFormErrors.telefono),
                    )}
                  />
                  {productorFormErrors.telefono ? (
                    <ProducerFieldError
                      message={productorFormErrors.telefono}
                    />
                  ) : null}
                </div>

                {productorFormError ? (
                  <InlineGuidedError
                    message={getComprasGuidance(productorFormError)}
                  />
                ) : null}
              </div>
            </div>

            <div className="shrink-0 border-t border-[#eef2f7] bg-[#fbfcff] px-4 py-3">
              <button
                type="button"
                onClick={guardarProductorLocal}
                disabled={botonGuardarProductorPresionado}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#1D4ED8] px-4 py-3 text-[0.82rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {botonGuardarProductorPresionado
                  ? 'Guardando productor...'
                  : productorEditando
                    ? 'Guardar cambios'
                    : 'Guardar productor'}
              </button>
              <button
                type="button"
                onClick={cerrarModalProductor}
                className="mt-2 inline-flex w-full items-center justify-center px-4 py-1.5 text-[0.78rem] font-semibold text-slate-500"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {productorPendienteEditar ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 px-5 py-6 backdrop-blur-sm">
          <div className="w-full max-w-[400px] rounded-[22px] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-[#cfd8e6]" />
            <div className="mt-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eef3ff] text-[#1D4ED8]">
                <Pencil size={22} />
              </div>
              <h2 className="mt-4 text-[1.35rem] font-black leading-tight text-slate-900">
                ¿Modificar productor?
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Vas a editar los datos de este productor.
              </p>
            </div>

            <div className="mt-5 rounded-[16px] border border-[#e4e9f5] bg-[#f8faff] p-4">
              <p className="truncate text-[1rem] font-black text-slate-900">
                {productorPendienteEditar.nombre}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                Documento: {productorPendienteEditar.documento}
              </p>
            </div>

            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={confirmarEditarProductor}
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#1D4ED8] px-4 text-sm font-black text-white"
              >
                Sí, modificar
              </button>
              <button
                type="button"
                onClick={cancelarEditarProductor}
                className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] px-4 text-sm font-black text-slate-500"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {productorCreadoToast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-6 z-40 px-4"
        >
          <div className="mx-auto flex w-full max-w-[430px] items-center justify-between gap-3 rounded-[18px] border border-[#d9e2f5] bg-white px-4 py-3 text-sm text-slate-700 shadow-[0_18px_46px_rgba(15,23,42,0.18)]">
            <div className="min-w-0">
              <p className="font-bold text-slate-900">Productor creado</p>
              <p className="truncate text-xs text-slate-500">
                {productorCreadoToast.nombre}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                seleccionarProductor(productorCreadoToast);
                setProductorCreadoToast(null);
              }}
              className="shrink-0 rounded-full bg-[#eef2ff] px-3 py-2 text-xs font-bold text-[#1D4ED8] transition hover:bg-[#dfe7ff]"
            >
              Usar este
            </button>
          </div>
        </div>
      ) : null}

      <AppBottomNav
        hidden={
          mostrarModalSelectorProductor || mostrarModalProductor || step >= 1
        }
      />
    </div>
  );
}
