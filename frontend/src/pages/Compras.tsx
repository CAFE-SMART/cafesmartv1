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
  Save,
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
import { ApiRequestError } from '../services/apiService';
import { guardarConfiguracionBodega } from '../services/bodegaApi';
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
  crearProductor,
  listarProductores,
  type ProductorItem,
} from '../services/productoresService';
import { PRECIO_MINIMO_KG } from '../utils/businessRules';
import {
  formatPhoneNumber,
  normalizeDocumentForStorage,
  sanitizeDocumentInput,
  sanitizeDigits as sanitizePersonDigits,
  sanitizeNameInput,
  type DocumentType,
  validateDocumentNumber,
  validatePersonName,
  validatePhoneNumber,
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
  documento: string;
  detalle: string;
  telefono?: string;
  rapido?: boolean;
};
type ProductorForm = {
  nombre: string;
  telefono: string;
  documento: string;
  tipoDocumento: DocumentType | '';
};
type ProductorFormErrors = Partial<Record<keyof ProductorForm, string>>;
type ProductorSelectionMode = 'buscar' | 'generico' | null;

const ORDEN_TIPOS = ['VERDE', 'SECO', 'TRILLADO', 'PASILLA'];
const ORDEN_CALIDADES = ['BUENO', 'REGULAR', 'MALO'];
const PRODUCTOR_GENERAL: ProductorOption = {
  id: 'general',
  nombre: 'Productor Generico',
  documento: 'Compra rapida',
  detalle:
    'Para compras rápidas o productores ocasionales no registrados en el sistema.',
  rapido: true,
};
const LIMITE_PRODUCTORES_RECIENTES = 5;

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
  return valor.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function leerCantidadCompra(valor: string) {
  const texto = valor.trim();
  if (!texto) {
    return { valor: 0, error: 'Ingresa la cantidad en kilogramos.' };
  }

  if (!/^\d+([.,]\d{1,2})?$/.test(texto)) {
    return { valor: 0, error: 'Ingresa solo números.' };
  }

  const numero = Number(texto.replace(',', '.'));
  if (!Number.isFinite(numero)) {
    return { valor: 0, error: 'Ingresa solo números.' };
  }

  if (numero <= 0) {
    return { valor: numero, error: 'La cantidad debe ser mayor a cero.' };
  }

  return { valor: numero, error: null };
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

function getCompraErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return 'Revisa la conexión a internet y vuelve a intentarlo.';
    }

    if (error.status >= 500) {
      return 'Puede ser una falla temporal. Revisa tu conexión e intenta de nuevo.';
    }

    if (error.code === 'COMPRA_CANTIDAD_INVALIDA') {
      return 'La cantidad debe ser mayor a cero.';
    }

    if (error.code === 'COMPRA_CANTIDAD_NO_NUMERICA') {
      return 'Ingresa solo números.';
    }

    if (error.code === 'COMPRA_CANTIDAD_DEMASIADO_ALTA') {
      return 'Revisa la cantidad ingresada. Parece demasiado alta.';
    }

    if (error.code === 'COMPRA_CAPACIDAD_INSUFICIENTE') {
      return 'No hay espacio suficiente en la bodega.';
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
    documento: productor.documento?.trim() || 'Documento pendiente',
    detalle: productor.telefono?.trim() || 'Productor registrado en sistema',
    telefono: productor.telefono ?? undefined,
  };
}

function clavePersona(nombre: string, documento: string) {
  const documentoNormalizado = soloDigitos(documento);
  return documentoNormalizado
    ? `documento:${documentoNormalizado}`
    : `nombre:${normalizeSearchText(nombre.trim())}`;
}

function dedupeProductorOptions(productores: ProductorOption[]) {
  const vistos = new Set<string>();

  return productores.filter((productor) => {
    const key = clavePersona(productor.nombre, productor.documento);

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
) {
  const key = clavePersona(nombre, documento);
  return productores.find(
    (productor) => clavePersona(productor.nombre, productor.documento) === key,
  );
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
    fondo: 'bg-[#eef2ff] text-[#102d92]',
    borde: 'border-[#d9e4ff]',
    texto: 'text-[#102d92]',
  };
}

function visualCalidad(nombre: string) {
  const calidad = clave(nombre);
  if (calidad === 'BUENO') {
    return {
      icono: <Smile size={16} />,
      fondo: 'bg-[#ecf4ff] text-[#173ea6]',
      borde: 'border-[#d5e1ff]',
      texto: 'text-[#173ea6]',
    };
  }
  if (calidad === 'REGULAR') {
    return {
      icono: <Meh size={16} />,
      fondo: 'bg-[#fff6e7] text-[#8f5f08]',
      borde: 'border-[#f3ddb3]',
      texto: 'text-[#8f5f08]',
    };
  }
  return {
    icono: <Frown size={16} />,
    fondo: 'bg-[#fff0f4] text-[#a31d3e]',
    borde: 'border-[#ffd5e1]',
    texto: 'text-[#a31d3e]',
  };
}

function datosPaso(step: Step) {
  if (step === 1) {
    return {
      chip: 'Paso 1 de 3',
      titulo: 'Productor',
      descripcion: 'Seleccione el productor para iniciar el pesaje del café.',
      progreso: 33,
    };
  }
  if (step === 2) {
    return {
      chip: 'Paso 2 de 3',
      titulo: 'Seleccionar café',
      descripcion: 'Completa tipo de café, calidad, peso y precio por kilo.',
      progreso: 66,
    };
  }
  return {
    chip: 'Paso 3 de 3',
    titulo: 'Finalizar Registro',
    descripcion: 'Confirma el resumen antes de registrar la compra.',
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
      'Para cédula usa entre 6 y 10 dígitos. Para NIT usa 900123456-7.',
      'Corrige el documento para continuar.',
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
      'Falta seleccionar el tipo de café.',
      'Debes elegir una opción para poder pagar.',
      'Toca "Tipo de Café" y elige uno.',
    );
  }

  if (message.includes('calidad')) {
    return createGuidedError(
      message,
      'Falta la calidad.',
      'Saber la calidad ayuda a validar el precio.',
      'Toca las caritas para seleccionar la calidad.',
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
    'Ups, no se pudo guardar.',
    'Revisa los campos señalados.',
    'Vuelve a intentar.',
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
  const [mostrarModalProductor, setMostrarModalProductor] = useState(false);
  const [productorForm, setProductorForm] = useState<ProductorForm>({
    nombre: '',
    telefono: '',
    documento: '',
    tipoDocumento: '',
  });
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
  const [alerta80Mostrada, setAlerta80Mostrada] = useState(false);
  const [registroErrorMensaje, setRegistroErrorMensaje] = useState<
    string | null
  >(null);
  const [datosCapacidad, setDatosCapacidad] = useState<{
    capacidadKg: number;
    inventarioActual: number;
    nuevoTotal: number;
  } | null>(null);
  const [errorCapacidadCantidad, setErrorCapacidadCantidad] =
    useState<GuidedErrorMessage | null>(null);
  const [datosAlerta80, setDatosAlerta80] = useState<{
    capacidadKg: number;
    inventarioActual: number;
    nuevoTotal: number;
    porcentaje: number;
  } | null>(null);

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
      const [catalogosData, productoresData] = await Promise.all([
        obtenerCatalogosCompra(),
        listarProductores(),
      ]);
      setCatalogos(catalogosData);
      setProductores(
        dedupeProductorOptions(productoresData.map(mapProductorToOption)),
      );
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
      (acc, sublote) => acc + leerCantidadCompra(sublote.pesoInicial).valor,
      0,
    );
    const totalCompra = sublotes.reduce(
      (acc, sublote) =>
        acc +
        leerCantidadCompra(sublote.pesoInicial).valor *
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
      const peso = leerCantidadCompra(sublote.pesoInicial);
      const precio = Number(sublote.precioKg);
      return (
        Boolean(sublote.tipoCafeId) &&
        Boolean(sublote.calidadId) &&
        !peso.error &&
        Number.isFinite(precio) &&
        precio >= PRECIO_MINIMO_KG
      );
    });
  }, [fechaCompraValidacion.isValid, sublotes]);
  const puedeRegistrarCompra =
    Boolean(productorSeleccionado) &&
    paso2Completo &&
    sublotes.length > 0 &&
    catalogos.tiposCafe.length > 0 &&
    catalogos.calidades.length > 0 &&
    !errorCapacidadCantidad &&
    !saving &&
    !checkingConfirmacion &&
    !loading;
  const productoresFiltrados = useMemo(() => {
    const base = dedupeProductorOptions([...productores]);
    const termino = normalizeSearchText(busquedaProductor.trim());

    if (!termino) {
      return base.slice(0, LIMITE_PRODUCTORES_RECIENTES);
    }

    return base.filter((productor) =>
      [productor.nombre, productor.documento, productor.detalle].some((valor) =>
        normalizeSearchText(valor).includes(termino),
      ),
    );
  }, [busquedaProductor, productores]);
  const busquedaProductorActiva = busquedaProductor.trim().length > 0;
  const mostrarResultadosProductores =
    productorSelectionMode === 'buscar' &&
    (!productorSeleccionado || busquedaProductorActiva);
  const sinProductoresRegistrados = productores.length === 0;
  const subloteActual =
    sublotes.find((sublote) => sublote.id === subloteActivoId) ??
    sublotes[sublotes.length - 1] ??
    null;
  const sublotesVisibles = subloteActual ? [subloteActual] : [];
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
    setAlerta80Mostrada(false);
    setDatosAlerta80(null);
    setDatosCapacidad(null);
    setErrorCapacidadCantidad(null);
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
      Boolean(leerCantidadCompra(actual.pesoInicial).error) ||
      !Number.isFinite(Number(actual.precioKg)) ||
      Number(actual.precioKg) < PRECIO_MINIMO_KG
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
    setProductorForm({ nombre: '', telefono: '', documento: '', tipoDocumento: '' });
    setMostrarModalProductor(true);
  };

  const cerrarModalProductor = () => {
    setMostrarModalProductor(false);
    setProductorForm({ nombre: '', telefono: '', documento: '', tipoDocumento: '' });
    setProductorFormError(null);
    setProductorFormErrors({});
  };

  const seleccionarProductor = (productor: ProductorOption) => {
    setProductorSeleccionado(productor);
    setProductorSelectionMode(productor.rapido ? 'generico' : 'buscar');
    setBusquedaProductor('');
    setError(null);
    setMostrarErrorFormulario(false);
  };

  const refrescarProductores = async () => {
    try {
      const productoresData = await listarProductores();
      setProductores(
        dedupeProductorOptions(productoresData.map(mapProductorToOption)),
      );
    } catch {
      // No interrumpe el flujo si falla la recarga del autocomplete.
    }
  };

  const seleccionarBusqueda = () => {
    setProductorSelectionMode('buscar');
    if (productorSeleccionado?.id === PRODUCTOR_GENERAL.id) {
      setProductorSeleccionado(null);
    }
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
    const nombre = validatePersonName(
      productorForm.nombre,
      'El nombre del productor',
    );
    const documento = validateDocumentNumber(
      productorForm.documento,
      'El documento',
      { type: productorForm.tipoDocumento || null },
    );
    const telefono = validatePhoneNumber(
      productorForm.telefono,
      'El teléfono',
      {
        optional: true,
      },
    );

    if (!nombre.isValid) errores.nombre = nombre.message;
    if (!productorForm.tipoDocumento) {
      errores.tipoDocumento = 'Selecciona el tipo de documento.';
    }
    if (!documento.isValid) errores.documento = documento.message;
    if (!telefono.isValid) errores.telefono = telefono.message;

    return errores;
  };

  const guardarProductorLocal = async () => {
    const nombre = productorForm.nombre.trim();
    const tipoDocumento = productorForm.tipoDocumento || 'CEDULA';
    const documento = normalizeDocumentForStorage(
      productorForm.documento,
      tipoDocumento,
    );
    const telefono = sanitizePersonDigits(productorForm.telefono);
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
    );
    if (productorExistente) {
      setProductorSeleccionado(productorExistente);
      setProductorSelectionMode('buscar');
      setBusquedaProductor('');
      setMostrarModalProductor(false);
      setProductorForm({ nombre: '', telefono: '', documento: '', tipoDocumento: '' });
      setProductorFormErrors({});
      setError(null);
      setMostrarErrorFormulario(false);
      return;
    }

    setBotonGuardarProductorPresionado(true);

    try {
      const productorGuardado = await crearProductor({
        nombre,
        documento,
        tipoDocumento,
        telefono: telefono || undefined,
      });

      const productorBase = mapProductorToOption(productorGuardado);

      setProductores((actual) =>
        dedupeProductorOptions([
          productorBase,
          ...actual.filter((productor) => productor.id !== productorBase.id),
        ]),
      );
      setProductorSeleccionado(productorBase);
      setProductorSelectionMode('buscar');
      setBusquedaProductor('');
      setMostrarModalProductor(false);
      setProductorForm({ nombre: '', telefono: '', documento: '', tipoDocumento: '' });
      setProductorFormErrors({});
      setProductorFormError(null);
      setProductorCreadoToast(productorBase);
      setError(null);
      setMostrarErrorFormulario(false);
    } catch (err) {
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
    setProductorFormError(null);
    setProductorFormErrors({});
    setProductorCreadoToast(null);
    setRegistroErrorMensaje(null);
    setMostrarModalCancelar(false);
    setMostrarModalConfirmar(false);
    setCheckingConfirmacion(false);
    setMostrarModalAlerta80(false);
    setMostrarModalConfigurarCapacidad(false);
    setNombreBodegaNueva('Bodega principal');
    setCapacidadNuevaKg('');
    setCapacidadNuevaError(null);
    setGuardandoCapacidad(false);
    setAlerta80Mostrada(false);
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

    if (catalogos.tiposCafe.length === 0 || catalogos.calidades.length === 0) {
      return 'Aun no hay catalogos disponibles para registrar la compra.';
    }
    for (const [index, sublote] of sublotes.entries()) {
      if (!sublote.tipoCafeId)
        return `Selecciona el tipo de café del sublote ${index + 1}.`;
      if (!sublote.calidadId)
        return `Selecciona la calidad del sublote ${index + 1}.`;
      const cantidad = leerCantidadCompra(sublote.pesoInicial);
      if (cantidad.error) {
        return cantidad.error;
      }
      if (
        !Number.isFinite(Number(sublote.precioKg)) ||
        Number(sublote.precioKg) < PRECIO_MINIMO_KG
      ) {
        return `El precio por kilo debe ser mínimo $1,000 para el sublote ${index + 1}.`;
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
        pesoInicial: leerCantidadCompra(sublote.pesoInicial).valor,
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
      const nuevoTotal =
        capacidad.capacidadUsadaKg ?? inventarioActual + resumen.totalKg;

      if (capacidad.nivel === 'exceso') {
        const disponible = Math.max(0, capacidadKg - inventarioActual);
        setErrorCapacidadCantidad(
          createGuidedError(
            'No hay espacio suficiente.',
            `Disponible: ${formatoKg(disponible)} kg. Intentas registrar: ${formatoKg(resumen.totalKg)} kg.`,
            'Ajusta la cantidad para continuar.',
          ),
        );
        setDatosCapacidad({
          capacidadKg,
          inventarioActual,
          nuevoTotal,
        });
        return false;
      }

      if (capacidad.nivel === 'alerta' && !alerta80Mostrada) {
        setDatosAlerta80({
          capacidadKg,
          inventarioActual,
          nuevoTotal,
          porcentaje: Math.round(capacidad.porcentajeOcupacion ?? 0),
        });
        setMostrarModalAlerta80(true);
        setAlerta80Mostrada(true);
        return false;
      }

      return true;
    } catch (error) {
      console.error('No se pudo validar capacidad:', error);

      if (
        error instanceof ApiRequestError &&
        (error.status === 401 || error.status === 403)
      ) {
        setRegistroErrorMensaje(error.message);
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
    setCapacidadNuevaError(null);

    if (!nombreBodega) {
      setCapacidadNuevaError('Ingresa el nombre de la bodega.');
      return;
    }

    if (!Number.isFinite(capacidad) || capacidad <= 0) {
      setCapacidadNuevaError('Ingresa la capacidad total de la bodega en kg.');
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
      setAlerta80Mostrada(false);
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
    setRegistroErrorMensaje(null);
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
    setRegistroErrorMensaje(null);
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
          const peso = Number(sublote.pesoInicial) || 0;
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
      const mensaje = getCompraErrorMessage(err);
      if (
        err instanceof ApiRequestError &&
        err.code === 'COMPRA_CAPACIDAD_INSUFICIENTE'
      ) {
        const details = err.details as
          | { disponibleKg?: number; cantidadIntentadaKg?: number }
          | null;
        setErrorCapacidadCantidad(
          createGuidedError(
            'No hay espacio suficiente.',
            `Disponible: ${formatoKg(details?.disponibleKg ?? 0)} kg. Intentas registrar: ${formatoKg(details?.cantidadIntentadaKg ?? resumen.totalKg)} kg.`,
            'Ajusta la cantidad para continuar.',
          ),
        );
      }
      setRegistroErrorMensaje(mensaje);
      setError(null);
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

  const volverDesdeError = () => {
    setRegistroErrorMensaje(null);
    setStep(3);
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
                  <span className="text-[0.98rem] font-black uppercase tracking-[0.03em] text-slate-700">
                    Total pagado
                  </span>
                  <span className="text-[1.8rem] font-black text-[#1f3f97]">
                    {formatoMoneda(compraGuardada.totalCompra)}
                  </span>
                </div>
              </div>
            </section>

            <div className="mt-7 grid gap-3">
              <button
                type="button"
                onClick={iniciarNuevaCompra}
                className="inline-flex min-h-[54px] items-center justify-center gap-3 rounded-[16px] bg-[#1f3fa7] px-5 py-4 text-[1.08rem] font-semibold text-white shadow-[0_14px_30px_rgba(16,45,146,0.2)]"
              >
                Registrar nueva compra
              </button>
              <button
                type="button"
                onClick={() => navigate('/inventario')}
                className="inline-flex min-h-[54px] items-center justify-center gap-3 rounded-[16px] bg-[#edf1f8] px-5 py-4 text-[1.08rem] font-semibold text-[#1f3f97]"
              >
                Ir a inventario
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (registroErrorMensaje) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 text-slate-900">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[420px] items-center">
          <div className="w-full rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
            <div className="text-center">
              <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#fff0f2] text-[#e24c5a]">
                <AlertTriangle size={24} strokeWidth={2.8} />
              </div>
              <h1 className="mt-5 text-[1.45rem] font-semibold text-slate-900">
                No se pudo guardar la compra
              </h1>
              <p className="mt-3 text-[0.98rem] leading-6 text-slate-500">
                {registroErrorMensaje}
              </p>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => void guardarCompra()}
                disabled={saving}
                className="inline-flex min-h-[54px] items-center justify-center gap-3 rounded-[14px] bg-[#1f3fa7] px-5 py-3 text-[1.05rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Reintentando...' : 'Reintentar'}
              </button>
              <button
                type="button"
                onClick={volverDesdeError}
                className="inline-flex min-h-[54px] items-center justify-center gap-3 rounded-[14px] px-5 py-3 text-[1.05rem] font-semibold text-[#1f56dd]"
              >
                Volver a editar
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
          <div className="flex items-center justify-between text-[1.05rem] font-medium text-slate-900">
            <span>
              {step === 2
                ? 'Paso 2: Seleccionar café'
                : `Paso ${step}: ${pasoActual.titulo}`}
            </span>
            <span>{step} de 3</span>
          </div>
          <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#d0dbeb]">
            <div
              className="h-full rounded-full bg-[#04337b] transition-all duration-300"
              style={{ width: `${pasoActual.progreso}%` }}
            />
          </div>
          {step === 1 ? (
            <p className="mt-3 text-[0.98rem] text-slate-500">
              Selecciona cómo deseas elegir el productor
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-5 py-2">
        {step === 1 ? (
          <section className="flex flex-col gap-4">
            <button
              type="button"
              onClick={seleccionarBusqueda}
              className={`w-full rounded-[20px] border px-4 py-3.5 text-left transition ${
                productorSelectionMode === 'buscar'
                  ? 'border-[#1f3fa7] bg-[#f4f7ff]'
                  : 'border-[#e3e7f3] bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                    productorSelectionMode === 'buscar'
                      ? 'bg-[#1f3fa7] text-white'
                      : 'bg-[#eef2f7] text-slate-500'
                  }`}
                >
                  <Search size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[1.15rem] font-semibold leading-tight text-slate-900">
                    Buscar productor
                  </p>
                  <p className="mt-1 text-[0.95rem] text-slate-500">
                    Selecciona un productor registrado
                  </p>
                </div>
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                    productorSelectionMode === 'buscar'
                      ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white'
                      : 'border-[#cad2e2] bg-white text-transparent'
                  }`}
                >
                  <Check size={14} />
                </span>
              </div>
            </button>

            {productorSelectionMode === 'buscar' ? (
              <div className="space-y-3 rounded-[18px] border border-[#e4e9f5] bg-white p-3">
                <div className="relative">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={busquedaProductor}
                    onChange={(event) =>
                      setBusquedaProductor(event.target.value)
                    }
                    placeholder="Nombre o identificación..."
                    className="w-full rounded-[16px] border border-[#dbe2f0] bg-[#f8faff] px-11 py-3 text-[0.98rem] text-slate-900 outline-none transition focus:border-[#1f3fa7]"
                  />
                </div>

                {mostrarResultadosProductores ? (
                  <div className="max-h-[230px] space-y-2 overflow-y-auto pr-1">
                    {productoresFiltrados.map((productor) => {
                      const activo = productorSeleccionado?.id === productor.id;

                      return (
                        <button
                          key={productor.id}
                          type="button"
                          onClick={() => seleccionarProductor(productor)}
                          className={`flex w-full items-start justify-between gap-3 rounded-[14px] border px-3 py-3 text-left transition ${
                            activo
                              ? 'border-[#1f3fa7] bg-[#f4f7ff]'
                              : 'border-[#e6ebf5] bg-white hover:border-[#ccd6ea]'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[0.98rem] font-medium text-slate-900">
                              {productor.nombre}
                            </p>
                            <p className="mt-0.5 text-[0.86rem] text-slate-500">
                              {productor.documento}
                            </p>
                          </div>
                          <span
                            className={`mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                              activo
                                ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white'
                                : 'border-[#cad2e2] bg-white text-transparent'
                            }`}
                          >
                            <Check size={12} />
                          </span>
                        </button>
                      );
                    })}

                    {productoresFiltrados.length === 0 &&
                    sinProductoresRegistrados ? (
                      <div className="rounded-[14px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-3 py-6 text-center text-sm text-slate-500">
                        <p className="font-semibold text-slate-700">
                          Aun no hay productores registrados
                        </p>
                        <p className="mt-1">Registra uno para comenzar.</p>
                      </div>
                    ) : null}

                    {productoresFiltrados.length === 0 &&
                    !sinProductoresRegistrados &&
                    busquedaProductorActiva ? (
                      <div className="rounded-[14px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-3 py-6 text-center text-sm text-slate-500">
                        <p className="font-semibold text-slate-700">
                          No se encontraron resultados
                        </p>
                        <p className="mt-1">
                          Intenta con otro nombre o identificacion.
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              onClick={seleccionarGenerico}
              className={`w-full rounded-[20px] border px-4 py-3.5 text-left transition ${
                productorSelectionMode === 'generico'
                  ? 'border-[#1f3fa7] bg-[#f4f7ff]'
                  : 'border-[#e3e7f3] bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                    productorSelectionMode === 'generico'
                      ? 'bg-[#1f3fa7] text-white'
                      : 'bg-[#eef2f7] text-slate-500'
                  }`}
                >
                  <User size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[1.15rem] font-semibold leading-tight text-slate-900">
                    Productor genérico
                  </p>
                  <p className="mt-1 text-[0.95rem] text-slate-500">
                    Compra rápida sin registrar productor
                  </p>
                </div>
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                    productorSelectionMode === 'generico'
                      ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white'
                      : 'border-[#cad2e2] bg-white text-transparent'
                  }`}
                >
                  <Check size={14} />
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={abrirModalProductor}
              className="w-full rounded-[20px] border border-[#e3e7f3] bg-white px-4 py-3.5 text-left transition hover:border-[#ccd6ea]"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eef2f7] text-slate-600">
                  <UserPlus size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[1.15rem] font-semibold leading-tight text-slate-900">
                    Registrar productor
                  </p>
                  <p className="mt-1 text-[0.95rem] text-slate-500">
                    Crear un nuevo productor
                  </p>
                </div>
              </div>
            </button>

            {productorSeleccionado ? (
              <article className="mt-2 rounded-[16px] border border-[#e4e9f5] bg-white px-4 py-3.5">
                <p className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Productor seleccionado
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1f3fa7] text-white">
                    <User size={16} />
                  </span>
                  <div>
                    <p className="text-[1rem] font-semibold text-slate-900">
                      {productorSeleccionado.nombre}
                    </p>
                    <p className="text-[0.88rem] text-slate-500">
                      {productorSeleccionado.rapido
                        ? 'Compra rápida'
                        : productorSeleccionado.documento}
                    </p>
                  </div>
                </div>
              </article>
            ) : null}

            {error && mostrarErrorFormulario ? (
              <InlineGuidedError message={getComprasGuidance(error)} />
            ) : null}

            <button
              type="button"
              onClick={irSiguientePaso}
              className="inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[16px] bg-[#1f3fa7] px-5 py-4 text-[1.1rem] font-semibold text-white shadow-[0_12px_28px_rgba(16,45,146,0.26)]"
            >
              Siguiente paso
              <ArrowRight size={20} />
            </button>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4">
            {sublotesGuardados > 0 ? (
              <div className="rounded-[18px] border border-[#d6e2ff] bg-[#eef3ff] px-4 py-3 text-sm font-semibold text-[#102d92]">
                {sublotesGuardados} cafe{sublotesGuardados === 1 ? '' : 's'}{' '}
                agregado{sublotesGuardados === 1 ? '' : 's'} a esta compra.
              </div>
            ) : null}

            {sublotesVisibles.map((sublote) => {
              const mostrarErroresSublote =
                mostrarErrorFormulario && step === 2;
              const peso = Number(sublote.pesoInicial);
              const precio = Number(sublote.precioKg);
              const fechaError =
                mostrarErroresSublote && !fechaCompraValidacion.isValid
                  ? fechaCompraValidacion.message
                  : null;
              const tipoCafeError =
                mostrarErroresSublote && !sublote.tipoCafeId
                  ? 'Selecciona el tipo de café de este sublote.'
                  : null;
              const calidadError =
                mostrarErroresSublote && !sublote.calidadId
                  ? 'Selecciona la calidad de este sublote.'
                  : null;
              const pesoError =
                mostrarErroresSublote && (!Number.isFinite(peso) || peso <= 0)
                  ? 'Ingresa un peso valido para este sublote.'
                  : null;
              const precioError =
                mostrarErroresSublote &&
                (!Number.isFinite(precio) || precio < PRECIO_MINIMO_KG)
                  ? 'El precio por kilo debe ser mínimo $1,000 para este sublote.'
                  : null;

              return (
                <article
                  key={sublote.id}
                  className="rounded-[26px] border border-[#eceffa] bg-[#f6f7ff] p-5 shadow-sm"
                >
                  <div className="rounded-[20px] border border-[#dfe5f2] bg-white px-4 py-4">
                    <p className="text-[0.9rem] font-semibold tracking-[0.04em] text-slate-500">
                      Fecha de compra
                    </p>
                    <div className="mt-2.5 flex items-center gap-3 rounded-[16px] border border-[#dfe5f2] bg-[#f8f9ff] px-3 py-3">
                      <CalendarDays size={18} className="text-[#102d92]" />
                      <input
                        type="date"
                        value={fecha}
                        min={BUSINESS_MIN_DATE_VALUE}
                        max={hoyLocal()}
                        onChange={(event) => {
                          setFecha(event.target.value);
                          invalidarValidacionCapacidad();
                        }}
                        className="w-full bg-transparent text-[1.05rem] font-semibold text-[#102d92] outline-none"
                      />
                    </div>
                    {fechaError ? (
                      <InlineGuidedError
                        message={getComprasGuidance(fechaError)}
                        className="mt-2"
                      />
                    ) : null}
                  </div>

                  <div className="mt-5">
                    <p className="mb-2.5 text-[0.95rem] font-semibold text-slate-600">
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
                        <option value="">
                          Seleccione tipo (ej. Verde, Seco)
                        </option>
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
                      <InlineGuidedError
                        message={getComprasGuidance(tipoCafeError)}
                        className="mt-2"
                      />
                    ) : null}
                  </div>

                  <div className="mt-5">
                    <p className="mb-2.5 text-[0.95rem] font-semibold text-slate-600">
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
                            className={`rounded-[18px] border px-2 py-3 text-sm font-semibold transition ${
                              activo
                                ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white shadow-[0_8px_20px_rgba(16,45,146,0.18)]'
                                : `${visual.borde} bg-white/85 text-slate-700 hover:bg-white`
                            }`}
                          >
                            <span className="flex flex-col items-center gap-1.5">
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                                  activo
                                    ? 'bg-white/20 text-white'
                                    : visual.fondo
                                }`}
                              >
                                {visual.icono}
                              </span>
                              <span
                                className={`text-[11px] font-semibold ${activo ? 'text-white' : ''}`}
                              >
                                {calidad.nombre}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {calidadError ? (
                      <InlineGuidedError
                        message={getComprasGuidance(calidadError)}
                        className="mt-2"
                      />
                    ) : null}
                  </div>

                  <div className="mt-5 rounded-[22px] bg-white p-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-[0.95rem] font-semibold text-slate-600">
                          Peso (kg)
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={sublote.pesoInicial}
                          onChange={(event) =>
                            actualizarSublote(
                              sublote.id,
                              'pesoInicial',
                              event.target.value,
                            )
                          }
                          className="mt-2.5 w-full rounded-[18px] border border-[#e4e8f3] bg-[#fbfcff] px-4 py-4 text-[1.6rem] font-semibold text-slate-900 outline-none focus:border-[#102d92] placeholder:text-slate-300"
                          placeholder="ej. 25"
                        />
                        {pesoError ? (
                          <InlineGuidedError
                            message={getComprasGuidance(pesoError)}
                            className="mt-2"
                          />
                        ) : null}
                        {errorCapacidadCantidad ? (
                          <InlineGuidedError
                            message={errorCapacidadCantidad}
                            className="mt-2"
                          />
                        ) : null}
                      </div>

                      <div>
                        <label className="block text-[0.95rem] font-semibold text-slate-600">
                          Precio x kg
                        </label>
                        <div className="mt-2.5 flex items-center rounded-[18px] border border-[#e4e8f3] bg-[#fbfcff] px-4 py-4">
                          <span className="mr-3 text-[1.6rem] font-semibold text-slate-500">
                            $
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={sublote.precioKg}
                            onChange={(event) =>
                              actualizarSublote(
                                sublote.id,
                                'precioKg',
                                soloDigitos(event.target.value),
                              )
                            }
                            className="w-full bg-transparent text-[1.6rem] font-semibold text-slate-900 outline-none placeholder:text-slate-300"
                            placeholder="ej. 14000"
                          />
                        </div>
                        {precioError ? (
                          <InlineGuidedError
                            message={getComprasGuidance(precioError)}
                            className="mt-2"
                          />
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
              className="inline-flex w-full min-h-[56px] items-center justify-center gap-3 rounded-[22px] border border-dashed border-[#ccd4e8] bg-white px-5 py-4 text-sm font-semibold text-[#102d92]"
            >
              <Plus size={20} />
              Agregar más café
            </button>

            <article className="rounded-[24px] border border-[#d6e2ff] bg-[#eef3ff] p-5 text-[#102d92] shadow-sm">
              <p className="text-sm font-black text-[#5b6f9d]">
                Resumen de peso
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[#d6e2ff] pt-5">
                <div>
                  <p className="text-sm font-black text-[#5b6f9d]">Total kg:</p>
                  <p className="mt-2 text-[1.9rem] font-black leading-none text-[#102d92]">
                    {resumen.totalKg.toLocaleString('es-CO', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{' '}
                    kg
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-[#5b6f9d]">
                    Total estimado:
                  </p>
                  <p className="mt-2 text-[1.9rem] font-black leading-none text-[#102d92]">
                    {formatoMoneda(resumen.totalCompra)}
                  </p>
                </div>
              </div>
            </article>

            {error && mostrarErrorFormulario ? (
              <InlineGuidedError message={getComprasGuidance(error)} />
            ) : null}

            <div className="grid gap-3">
              <button
                type="button"
                onClick={irSiguientePaso}
                className="inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[16px] bg-[#1f3fa7] px-5 py-4 text-[1.2rem] font-semibold text-white shadow-[0_12px_28px_rgba(16,45,146,0.26)]"
              >
                Siguiente Paso
                <ArrowRight size={22} />
              </button>
              <button
                type="button"
                onClick={irPasoAnterior}
                className="inline-flex min-h-[56px] w-full items-center justify-center rounded-[20px] bg-[#edf1fa] px-5 py-4 text-sm font-semibold text-slate-500"
              >
                Regresar
              </button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-4">
            <article className="rounded-[24px] border border-[#e2e8f4] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-[0.86rem] font-black uppercase tracking-[0.12em] text-[#6a7c98]">
                <CalendarDays size={14} />
                <span>Datos de la compra</span>
              </div>
              <div className="space-y-4 rounded-[16px] border border-[#e6eaf3] bg-[#fbfcff] px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[0.82rem] font-black uppercase tracking-[0.08em] text-[#6f809a]">
                    Productor
                  </span>
                  <span className="text-[1.25rem] font-semibold text-slate-900">
                    {productorSeleccionado?.nombre ?? 'Sin productor'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[0.82rem] font-black uppercase tracking-[0.08em] text-[#6f809a]">
                    Fecha
                  </span>
                  <span className="text-[1.25rem] font-semibold text-slate-900">
                    {formatoFecha(fecha)}
                  </span>
                </div>
              </div>
            </article>

            <section>
              <div className="mb-2 flex items-center gap-2 px-1 text-[0.86rem] font-black uppercase tracking-[0.12em] text-[#6a7c98]">
                <ShoppingBag size={14} />
                <span>Historial de la compra</span>
              </div>
              <p className="px-1 text-[0.85rem] text-slate-500">
                Si necesitas editar la información de un sublote, regresa al
                paso anterior
              </p>
              <div className="mt-3 space-y-3">
                {sublotes.map((sublote) => {
                  const tipoCafe =
                    nombreTipoCafePorId.get(sublote.tipoCafeId) ?? 'Café';
                  const calidad =
                    nombreCalidadPorId.get(sublote.calidadId) ?? 'Calidad';
                  const peso = Number(sublote.pesoInicial || 0);
                  const totalItem = peso * Number(sublote.precioKg || 0);
                  const visual = iconoTipoCafe(tipoCafe);

                  return (
                    <article
                      key={sublote.id}
                      className="rounded-[22px] border border-[#e6e8f3] bg-white px-4 py-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className={`rounded-2xl p-3 ${visual.fondo}`}>
                            {visual.icono}
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.08em] text-[#173ea6]">
                              {tipoCafe}
                            </p>
                            <p className="mt-1 text-[1.2rem] font-semibold leading-tight text-slate-900">
                              Calidad: {calidad}
                            </p>
                            <p className="mt-1 text-base font-semibold text-slate-700">
                              Peso:{' '}
                              {peso.toLocaleString('es-CO', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })}{' '}
                              kg
                            </p>
                            <p className="mt-1 text-base font-semibold text-slate-700">
                              Total: {formatoMoneda(totalItem)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              editarSubloteDesdeRevision(sublote.id)
                            }
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#eef2ff] text-[#173ea6]"
                            title="Editar producto"
                            aria-label={`Editar ${tipoCafe}`}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              eliminarSubloteDesdeRevision(sublote.id)
                            }
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#fff0f2] text-[#e24c5a]"
                            title="Eliminar producto"
                            aria-label={`Eliminar ${tipoCafe}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <article className="rounded-[24px] border border-[#d9e2f5] bg-white p-5 shadow-sm">
              <p className="text-[0.86rem] font-black uppercase tracking-[0.12em] text-[#6a7c98]">
                Resumen financiero
              </p>
              <div className="mt-4 space-y-4 rounded-[16px] bg-[#f7f8ff] px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[1.05rem] font-black uppercase tracking-[0.04em] text-slate-700">
                    Total kg
                  </span>
                  <span className="text-[2rem] font-black text-[#173ea6]">
                    {resumen.totalKg.toLocaleString('es-CO', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{' '}
                    kg
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[1.05rem] font-black uppercase tracking-[0.04em] text-slate-700">
                    Total a pagar
                  </span>
                  <span className="text-[2rem] font-black text-[#173ea6]">
                    {formatoMoneda(resumen.totalCompra)}
                  </span>
                </div>
              </div>
            </article>

            {error && mostrarErrorFormulario ? (
              <InlineGuidedError message={getComprasGuidance(error)} />
            ) : null}

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => void abrirConfirmacionCompra()}
                disabled={saving || checkingConfirmacion || loading}
                className="inline-flex items-center justify-center gap-3 rounded-[20px] bg-[#102d92] px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(16,45,146,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkingConfirmacion ? (
                  <LoaderCircle size={20} className="animate-spin" />
                ) : (
                  <Save size={20} />
                )}
                {checkingConfirmacion
                  ? 'Revisando bodega...'
                  : 'Registrar compra'}
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalCancelar(true)}
                className="inline-flex items-center justify-center gap-3 rounded-[20px] border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700"
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
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eef3ff] text-[#1f3fa7]">
                <Warehouse size={24} />
              </div>
              <h2 className="mt-5 text-[1.65rem] font-semibold leading-tight text-slate-900">
                Registra la capacidad de la bodega
              </h2>
              <p className="mt-3 text-[1rem] leading-7 text-slate-500">
                Necesitamos la capacidad total para validar esta compra. También
                puedes cambiarla luego en Ajustes.
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
                  onChange={(event) => {
                    setNombreBodegaNueva(event.target.value);
                    setCapacidadNuevaError(null);
                  }}
                  className="mt-2 w-full rounded-[16px] border border-[#dde4f1] bg-[#f8faff] px-4 py-4 text-[1.05rem] font-semibold text-slate-900 outline-none focus:border-[#1f3fa7]"
                  placeholder="Ej. Bodega principal"
                />
              </div>

              <div>
                <label className="block text-[0.86rem] font-semibold text-slate-700">
                  Capacidad total (kg)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={capacidadNuevaKg}
                  onChange={(event) => {
                    setCapacidadNuevaKg(event.target.value);
                    setCapacidadNuevaError(null);
                  }}
                  className="mt-2 w-full rounded-[16px] border border-[#dde4f1] bg-[#f8faff] px-4 py-4 text-[1.2rem] font-semibold text-slate-900 outline-none focus:border-[#1f3fa7]"
                  placeholder="Ej. 6000"
                />
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
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] bg-[#1f3fa7] px-5 py-3 text-[1.08rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f1ff] text-[#1f3fa7]">
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
                <span className="text-[1.4rem] font-black text-[#1f3fa7]">
                  {formatoMoneda(resumen.totalCompra)}
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => void guardarCompra()}
                disabled={!puedeRegistrarCompra || saving}
                className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[14px] bg-[#1f3fa7] px-5 py-3 text-[1.15rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-80"
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
                  className="mx-auto animate-spin text-[#1f3fa7]"
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

      {mostrarModalProductor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-5 py-6 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-[430px] overflow-hidden rounded-[22px] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.28)]">
            <div className="px-5 pb-5 pt-3">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-[#cfd8e6]" />
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[1.35rem] font-semibold leading-tight text-[#111827]">
                    Registrar Productor
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={cerrarModalProductor}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={productorForm.nombre}
                    onChange={(event) => {
                      setProductorForm((actual) => ({
                        ...actual,
                        nombre: sanitizeNameInput(event.target.value),
                      }));
                      setProductorFormErrors((actual) => ({
                        ...actual,
                        nombre: undefined,
                      }));
                      setProductorFormError(null);
                    }}
                    placeholder="Ej. Juan Pérez Rodríguez"
                    className="w-full rounded-[14px] border border-[#dde4f1] bg-[#f7f9fd] px-4 py-3 text-[0.95rem] text-slate-900 outline-none focus:border-[#173ea6]"
                  />
                  {productorFormErrors.nombre ? (
                    <InlineGuidedError
                      message={getComprasGuidance(productorFormErrors.nombre)}
                      className="mt-2"
                    />
                  ) : null}
                </div>
                <div>
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    Tipo de documento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'CEDULA', label: 'Cédula' },
                      { value: 'NIT', label: 'NIT' },
                    ].map((item) => {
                      const active = productorForm.tipoDocumento === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            setProductorForm((actual) => ({
                              ...actual,
                              tipoDocumento: item.value as DocumentType,
                              documento: '',
                            }));
                            setProductorFormErrors((actual) => ({
                              ...actual,
                              tipoDocumento: undefined,
                              documento: undefined,
                            }));
                            setProductorFormError(null);
                          }}
                          className={`rounded-[14px] border px-3 py-3 text-sm font-black ${
                            active
                              ? 'border-[#102d92] bg-[#eef3ff] text-[#102d92]'
                              : 'border-[#dde4f1] bg-white text-slate-600'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                  {productorFormErrors.tipoDocumento ? (
                    <InlineGuidedError
                      message={getComprasGuidance(
                        productorFormErrors.tipoDocumento,
                      )}
                      className="mt-2"
                    />
                  ) : null}
                </div>
                <div>
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    Número de documento
                  </label>
                  <input
                    type="text"
                    inputMode={
                      productorForm.tipoDocumento === 'NIT' ? 'text' : 'numeric'
                    }
                    maxLength={productorForm.tipoDocumento === 'NIT' ? 11 : 10}
                    value={productorForm.documento}
                    onChange={(event) => {
                      setProductorForm((actual) => ({
                        ...actual,
                        documento: sanitizeDocumentInput(
                          event.target.value,
                          actual.tipoDocumento || 'CEDULA',
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
                        : 'Ej. 1234567890'
                    }
                    className="w-full rounded-[14px] border border-[#dde4f1] bg-[#f7f9fd] px-4 py-3 text-[0.95rem] text-slate-900 outline-none focus:border-[#173ea6]"
                  />
                  {productorFormErrors.documento ? (
                    <InlineGuidedError
                      message={getComprasGuidance(
                        productorFormErrors.documento,
                      )}
                      className="mt-2"
                    />
                  ) : null}
                </div>
                <div>
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    Teléfono (opcional)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={12}
                    value={productorForm.telefono}
                    onChange={(event) => {
                      setProductorForm((actual) => ({
                        ...actual,
                        telefono: formatPhoneNumber(event.target.value),
                      }));
                      setProductorFormErrors((actual) => ({
                        ...actual,
                        telefono: undefined,
                      }));
                      setProductorFormError(null);
                    }}
                    placeholder="Ej. 300 123 4567"
                    className="w-full rounded-[14px] border border-[#dde4f1] bg-[#f7f9fd] px-4 py-3 text-[0.95rem] text-slate-900 outline-none focus:border-[#173ea6]"
                  />
                  {productorFormErrors.telefono ? (
                    <InlineGuidedError
                      message={getComprasGuidance(productorFormErrors.telefono)}
                      className="mt-2"
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

            <div className="border-t border-[#eef2f7] bg-[#fbfcff] px-5 py-4">
              <button
                type="button"
                onClick={guardarProductorLocal}
                disabled={botonGuardarProductorPresionado}
                className="inline-flex w-full items-center justify-center rounded-[14px] bg-[#102d92] px-5 py-3.5 text-[0.95rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {botonGuardarProductorPresionado
                  ? 'Guardando productor...'
                  : 'Guardar Productor'}
              </button>
              <button
                type="button"
                onClick={cerrarModalProductor}
                className="mt-3 inline-flex w-full items-center justify-center px-5 py-2 text-[0.9rem] font-semibold text-slate-500"
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
              className="shrink-0 rounded-full bg-[#eef2ff] px-3 py-2 text-xs font-bold text-[#102d92] transition hover:bg-[#dfe7ff]"
            >
              Usar este
            </button>
          </div>
        </div>
      ) : null}

      <AppBottomNav hidden={mostrarModalProductor || step >= 1} />
    </div>
  );
}
