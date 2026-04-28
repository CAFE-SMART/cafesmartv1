import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeAlert,
  CalendarDays,
  Check,
  ChevronDown,
  Coffee,
  Frown,
  Leaf,
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
  X,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import {
  createGuidedError,
  InlineGuidedError,
  type GuidedErrorMessage,
} from '../components/forms/GuidedError';
import {
  formatDateLabel,
  getTodayLocalDateValue,
  toIsoDateAtUtcNoon,
} from '../utils/date';
import { obtenerDeviceId } from '../utils/deviceId';
import {
  crearCompra,
  listarCompras,
  obtenerCatalogosCompra,
  type CatalogoItem,
  type CatalogosCompra,
  type CompraListadoItem,
} from '../services/comprasService';
import { obtenerInventarioResumen } from '../services/inventarioService';
import {
  actualizarProductor,
  crearProductor,
  listarProductores,
  type ProductorItem,
} from '../services/productoresService';

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
};
type ProductorSelectionMode = 'buscar' | 'generico' | null;

const ORDEN_TIPOS = ['VERDE', 'SECO', 'TRILLADO', 'PASILLA'];
const ORDEN_CALIDADES = ['BUENO', 'REGULAR', 'MALO'];
const PRODUCTOR_GENERAL: ProductorOption = {
  id: 'general',
  nombre: 'Productor Generico',
  documento: 'Compra rapida',
  detalle: 'Para compras rápidas o productores ocasionales no registrados en el sistema.',
  rapido: true,
};
const LIMITE_PRODUCTORES_RECIENTES = 5;

function generarId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
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

function crearSubloteVacio(): SubloteForm {
  return { id: generarId(), tipoCafeId: '', calidadId: '', pesoInicial: '', precioKg: '' };
}

function hoyLocal() {
  return getTodayLocalDateValue();
}

function formatoFecha(fechaIso: string) {
  return formatDateLabel(fechaIso);
}

function formatoKg(valor: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: valor % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(valor)} kg`;
}

function formatoMoneda(valor: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(valor);
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

  if (message.includes('precio valido')) {
    return createGuidedError(
      message,
      'Falta el precio por kilo.',
      'El precio es necesario para dar el total.',
      'Toca la casilla e ingresa el valor a pagar.',
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
    'Problema guardando.',
    'Hubo un fallo con los datos o la conexión.',
    'Revisa si marcaste algún campo mal, o intenta de nuevo.',
  );
}

export default function Compras() {
  const navigate = useNavigate();
  const [catalogos, setCatalogos] = useState<CatalogosCompra>({ tiposCafe: [], calidades: [] });
  const [compras, setCompras] = useState<CompraListadoItem[]>([]);
  const [fecha, setFecha] = useState(hoyLocal());
  const [sublotes, setSublotes] = useState<SubloteForm[]>([crearSubloteVacio()]);
  const [productorSeleccionado, setProductorSeleccionado] = useState<ProductorOption | null>(null);
  const [productorSelectionMode, setProductorSelectionMode] = useState<ProductorSelectionMode>(null);
  const [productores, setProductores] = useState<ProductorOption[]>([]);
  const [busquedaProductor, setBusquedaProductor] = useState('');
  const busquedaProductorRef = useRef<HTMLInputElement | null>(null);
  const [mostrarModalProductor, setMostrarModalProductor] = useState(false);
  const [productorEditandoId, setProductorEditandoId] = useState<string | null>(null);
  const [productorForm, setProductorForm] = useState<ProductorForm>({ nombre: '', telefono: '', documento: '' });
  const [productorFormError, setProductorFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [mostrarModalCancelar, setMostrarModalCancelar] = useState(false);
  const [mostrarModalConfirmar, setMostrarModalConfirmar] = useState(false);
  const [mostrarModalCapacidad, setMostrarModalCapacidad] = useState(false);
  const [mostrarModalAlerta80, setMostrarModalAlerta80] = useState(false);
  const [alerta80Mostrada, setAlerta80Mostrada] = useState(false);
  const [registroErrorMensaje, setRegistroErrorMensaje] = useState<string | null>(null);
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

  const [step, setStep] = useState<Step>(1);
  const [compraGuardada, setCompraGuardada] = useState<CompraGuardadaResumen | null>(null);
  const [botonRegistrarPresionado, setBotonRegistrarPresionado] = useState(false);
  const [botonGuardarProductorPresionado, setBotonGuardarProductorPresionado] = useState(false);

  const cargarTodo = async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalogosData, comprasData, productoresData] = await Promise.all([
        obtenerCatalogosCompra(),
        listarCompras(),
        listarProductores(),
      ]);
      setCatalogos(catalogosData);
      setCompras(comprasData);
      setProductores(productoresData.map(mapProductorToOption));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la informacion de compras.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarTodo();
  }, []);

  const tiposCafe = useMemo(() => ordenarCatalogos(catalogos.tiposCafe, ORDEN_TIPOS), [catalogos.tiposCafe]);
  const calidades = useMemo(() => ordenarCatalogos(catalogos.calidades, ORDEN_CALIDADES), [catalogos.calidades]);
  const nombreTipoCafePorId = useMemo(() => new Map(catalogos.tiposCafe.map((item) => [item.id, item.nombre])), [catalogos.tiposCafe]);
  const nombreCalidadPorId = useMemo(() => new Map(catalogos.calidades.map((item) => [item.id, item.nombre])), [catalogos.calidades]);
  const resumen = useMemo(() => {
    const totalKg = sublotes.reduce((acc, sublote) => acc + (Number(sublote.pesoInicial) || 0), 0);
    const totalCompra = sublotes.reduce((acc, sublote) => acc + (Number(sublote.pesoInicial) || 0) * (Number(sublote.precioKg) || 0), 0);
    return { totalKg, totalCompra };
  }, [sublotes]);
  const paso2Completo = useMemo(() => {
    if (!fecha.trim()) {
      return false;
    }

    return sublotes.every((sublote) => {
      const peso = Number(sublote.pesoInicial);
      const precio = Number(sublote.precioKg);
      return (
        Boolean(sublote.tipoCafeId) &&
        Boolean(sublote.calidadId) &&
        Number.isFinite(peso) &&
        peso > 0 &&
        Number.isFinite(precio) &&
        precio > 0
      );
    });
  }, [fecha, sublotes]);
  const puedeRegistrarCompra =
    Boolean(productorSeleccionado) &&
    paso2Completo &&
    sublotes.length > 0 &&
    catalogos.tiposCafe.length > 0 &&
    catalogos.calidades.length > 0 &&
    !saving &&
    !loading;
  const productoresFiltrados = useMemo(() => {
    const base = [...productores];
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
  const pasoActual = datosPaso(step);
  const hayBusquedaProductor = busquedaProductor.trim().length > 0;
  const subloteActual = sublotes[sublotes.length - 1] ?? crearSubloteVacio();

  const volverPasoAnterior = () => {
    if (step > 1) {
      irPasoAnterior();
      return;
    }

    navigate(-1);
  };

  const actualizarSublote = (id: string, campo: keyof Omit<SubloteForm, 'id'>, valor: string) => {
    setSublotes((actual) => actual.map((sublote) => (sublote.id === id ? { ...sublote, [campo]: valor } : sublote)));
  };

  const agregarSublote = () => {
    const ultimo = sublotes[sublotes.length - 1];

    if (ultimo) {
      if (!ultimo.tipoCafeId) {
        setError('Elige si el café es verde o seco antes de agregar otro.');
        return;
      }

      if (!ultimo.calidadId) {
        setError('Elige la calidad del café antes de agregar otro.');
        return;
      }

      if (!Number.isFinite(Number(ultimo.pesoInicial)) || Number(ultimo.pesoInicial) <= 0) {
        setError('Escribe el peso en kilos antes de agregar otro café.');
        return;
      }

      if (!Number.isFinite(Number(ultimo.precioKg)) || Number(ultimo.precioKg) < 1000) {
        setError('Escribe el precio por kilo antes de agregar otro café.');
        return;
      }
    }

    setError(null);
    setSublotes((actual) => [...actual, crearSubloteVacio()]);
  };

  const editarSubloteDesdeRevision = (id: string) => {
    const index = sublotes.findIndex((sublote) => sublote.id === id);
    if (index <= -1) return;

    setSublotes((actual) => {
      const seleccionado = actual[index];
      return [...actual.filter((sublote) => sublote.id !== id), seleccionado];
    });
    setError(null);
    setStep(2);
  };

  const eliminarSublote = (id: string) => {
    setSublotes((actual) => {
      if (actual.length === 1) {
        return actual.map((sublote) =>
          sublote.id === id ? { ...crearSubloteVacio(), id } : sublote,
        );
      }

      return actual.filter((sublote) => sublote.id !== id);
    });
  };

  const abrirModalProductor = () => {
    setError(null);
    setProductorFormError(null);
    setProductorEditandoId(null);
    setProductorForm({ nombre: '', telefono: '', documento: '' });
    setMostrarModalProductor(true);
  };

  const abrirEditarProductor = (productor: ProductorOption) => {
    if (productor.rapido) return;
    setError(null);
    setProductorFormError(null);
    setProductorEditandoId(productor.id);
    setProductorForm({
      nombre: productor.nombre,
      telefono: productor.telefono ?? '',
      documento: productor.documento === 'Documento pendiente' ? '' : productor.documento,
    });
    setMostrarModalProductor(true);
  };

  const cerrarModalProductor = () => {
    setMostrarModalProductor(false);
    setProductorEditandoId(null);
    setProductorForm({ nombre: '', telefono: '', documento: '' });
    setProductorFormError(null);
  };

  const seleccionarProductor = (productor: ProductorOption) => {
    setProductorSeleccionado(productor);
    setProductorSelectionMode(productor.rapido ? 'generico' : null);
    setError(null);
  };

  const refrescarProductores = async () => {
    try {
      const productoresData = await listarProductores();
      setProductores(productoresData.map(mapProductorToOption));
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
    window.setTimeout(() => busquedaProductorRef.current?.focus(), 0);
    setError(null);
  };

  const seleccionarGenerico = () => {
    setProductorSelectionMode('generico');
    setProductorSeleccionado(PRODUCTOR_GENERAL);
    setError(null);
  };

  const guardarProductorLocal = async () => {
    const nombre = productorForm.nombre.trim();
    const documento = productorForm.documento.trim();
    const telefono = productorForm.telefono.trim();

    if (!nombre) {
      setProductorFormError('Escribe al menos el nombre del productor.');
      return;
    }

    if (!documento) {
      setProductorFormError('La Cedula o NIT es obligatoria.');
      return;
    }

    setBotonGuardarProductorPresionado(true);

    try {
      const productorGuardado = productorEditandoId
        ? await actualizarProductor(productorEditandoId, {
            nombre,
            documento,
            telefono: telefono || undefined,
          })
        : await crearProductor({
            nombre,
            documento,
            telefono: telefono || undefined,
          });

      const productorBase = mapProductorToOption(productorGuardado);

      setProductores((actual) => [
        productorBase,
        ...actual.filter((productor) => productor.id !== productorBase.id),
      ]);
      setProductorSeleccionado(productorBase);
      setProductorSelectionMode(null);
      setBusquedaProductor(nombre);
      setMostrarModalProductor(false);
      setProductorEditandoId(null);
      setProductorForm({ nombre: '', telefono: '', documento: '' });
      setProductorFormError(null);
      setError(null);
    } catch (err) {
      setProductorFormError(
        err instanceof Error ? err.message : 'No se pudo guardar el productor.',
      );
    } finally {
      setBotonGuardarProductorPresionado(false);
    }
  };

  const resetFormulario = () => {
    setFecha(hoyLocal());
    setSublotes([crearSubloteVacio()]);
    setProductorSeleccionado(null);
    setProductorSelectionMode(null);
    setBusquedaProductor('');
    setProductorFormError(null);
    setRegistroErrorMensaje(null);
    setMostrarModalCancelar(false);
    setMostrarModalConfirmar(false);
    setMostrarModalAlerta80(false);
    setAlerta80Mostrada(false);
    setDatosAlerta80(null);
    setStep(1);
    setError(null);
    setWarning(null);
  };

  const eliminarSubloteDesdeRevision = (id: string) => {
    if (sublotes.length === 1) {
      setError('Debe quedar al menos un producto antes de finalizar la compra.');
      return;
    }

    setSublotes((actual) => actual.filter((sublote) => sublote.id !== id));
    setError(null);
  };

  const validarSublotes = () => {
    if (!fecha.trim()) {
      return 'Selecciona la fecha de compra.';
    }

    if (catalogos.tiposCafe.length === 0 || catalogos.calidades.length === 0) {
      return 'Aun no hay catalogos disponibles para registrar la compra.';
    }
    for (const [index, sublote] of sublotes.entries()) {
        if (!sublote.tipoCafeId) return `Selecciona el tipo de café del sublote ${index + 1}.`;
      if (!sublote.calidadId) return `Selecciona la calidad del sublote ${index + 1}.`;
      if (!Number.isFinite(Number(sublote.pesoInicial)) || Number(sublote.pesoInicial) <= 0) {
        return `Ingresa un peso valido para el sublote ${index + 1}.`;
      }
      if (!Number.isFinite(Number(sublote.precioKg)) || Number(sublote.precioKg) < 1000) {
        return `El precio por kilo debe ser mínimo $1,000 para el sublote ${index + 1}.`;
      }
    }
    return null;
  };

  const irSiguientePaso = () => {
    setError(null);
    if (step === 1) {
      if (!productorSeleccionado) {
        setError('Selecciona un productor para continuar.');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      const mensajeValidacion = validarSublotes();
      if (mensajeValidacion) {
        setError(mensajeValidacion);
        return;
      }
      setStep(3);
    }
  };

  const irPasoAnterior = () => {
    setError(null);
    setWarning(null);
    setStep((actual) => Math.max(1, actual - 1) as Step);
  };

  const validarCapacidadBodega = async (): Promise<boolean> => {
    try {
      const inventarioResumen = await obtenerInventarioResumen();
      const capacidadKg = inventarioResumen.kgCapacidad;
      const inventarioActual = inventarioResumen.kgActual;
      const nuevoTotal = inventarioActual + resumen.totalKg;
      const limiteWarning = capacidadKg * 0.8;
      
      if (nuevoTotal > capacidadKg) {
        setDatosCapacidad({
          capacidadKg,
          inventarioActual,
          nuevoTotal,
        });
        setMostrarModalCapacidad(true);
        return false; // No continuar automáticamente
      }
      
      // Warning informativo al 80% - mostrar modal y bloquear solo si no se ha mostrado antes
      if (nuevoTotal >= limiteWarning && !alerta80Mostrada) {
        setDatosAlerta80({
          capacidadKg,
          inventarioActual,
          nuevoTotal,
          porcentaje: Math.round((nuevoTotal / capacidadKg) * 100),
        });
        setMostrarModalAlerta80(true);
        setAlerta80Mostrada(true);
        return false; // No continuar automáticamente hasta cerrar modal
      }
      
      return true; // Puede continuar directamente
    } catch (error) {
      // Si falla la validación, permitir continuar (offline-first)
      console.warn('No se pudo validar capacidad, permitiendo continuar:', error);
      return true;
    }
  };

  const guardarCompra = async () => {
    setRegistroErrorMensaje(null);
    if (!productorSeleccionado) {
      setError('Selecciona un productor para continuar.');
      setStep(1);
      return;
    }
    const mensajeValidacion = validarSublotes();
    if (mensajeValidacion) {
      setError(mensajeValidacion);
      return;
    }
    
    // Validar capacidad antes de mostrar modal de confirmación
    const puedeContinuar = await validarCapacidadBodega();
    if (!puedeContinuar) {
      return; // El modal de capacidad se mostrará
    }
    
    setSaving(true);
    setBotonRegistrarPresionado(true);
    setError(null);
    setWarning(null);
    try {
      const compraLocalId = generarId();
      const deviceId = await obtenerDeviceId();
      const fechaActual = fecha.trim() || hoyLocal();
      setFecha(fechaActual);
      const fechaNormalizada = toIsoDateAtUtcNoon(fechaActual);
      const payload = {
        ...(fechaNormalizada ? { fecha: fechaNormalizada } : {}),
        ...(!productorSeleccionado.rapido ? { productorId: productorSeleccionado.id } : {}),
        deviceId,
        localId: compraLocalId,
        sublotes: sublotes.map((sublote) => ({
          tipoCafeId: sublote.tipoCafeId,
          calidadId: sublote.calidadId,
          pesoInicial: Number(sublote.pesoInicial),
          precioKg: Number(sublote.precioKg),
          deviceId,
          localId: generarId(),
        })),
      };
      const respuesta = await crearCompra(payload);
      if (respuesta.warning) setWarning(respuesta.warning);
      setCompraGuardada({
        fecha: respuesta.compra.fecha,
        productorNombre: productorSeleccionado.nombre,
        productorDocumento: productorSeleccionado.documento,
        totalKg: resumen.totalKg,
        totalCompra: Number(respuesta.compra.totalCompra),
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
      const comprasActualizadas = await listarCompras();
      setCompras(comprasActualizadas);
      resetFormulario();
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo guardar la compra.';
      setRegistroErrorMensaje(mensaje);
      setError(null);
    } finally {
      setSaving(false);
      setBotonRegistrarPresionado(false);
      setMostrarModalConfirmar(false);
    }
  };

  const confirmarCompraConAdvertencia = async () => {
    setMostrarModalCapacidad(false);
    setMostrarModalConfirmar(true);
  };

  const cerrarModalConfirmar = () => {
    setMostrarModalConfirmar(false);
    setBotonRegistrarPresionado(false);
  };

  const confirmarCancelarCompra = () => {
    resetFormulario();
    navigate(-1);
  };

  const volverDesdeError = () => {
    setRegistroErrorMensaje(null);
    setStep(3);
  };

  if (compraGuardada) {
    return (
      <div className="min-h-screen bg-[#f7f7f8] px-4 py-6 text-slate-900">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[340px] items-center">
          <div className="w-full bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#d9f7ef]">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#19b881] text-white">
                  <Check size={22} strokeWidth={3} />
                </div>
              </div>
              <h1 className="mt-5 text-[1rem] font-black text-[#1f3f97]">Compra registrada</h1>
              <p className="mt-1 text-[0.72rem] text-slate-500">La compra se guardo correctamente.</p>
            </div>

            <section className="mt-5 rounded-[8px] border border-[#dfe5f3] bg-[#fbfcff] p-3">
              <p className="text-[0.72rem] font-semibold text-slate-600">Resumen de compra</p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-[6px] bg-white px-3 py-2">
                  <span className="text-[0.68rem] text-slate-600">Productor</span>
                  <span className="truncate text-[0.72rem] font-semibold text-slate-900">{compraGuardada.productorNombre}</span>
                </div>
                <div className="flex items-center justify-between rounded-[6px] bg-white px-3 py-2">
                  <span className="text-[0.68rem] text-slate-600">Total kg</span>
                  <span className="text-[0.72rem] font-semibold text-slate-900">{Math.round(compraGuardada.totalKg)} kg</span>
                </div>
                <div className="flex items-center justify-between rounded-[6px] bg-[#eef3ff] px-3 py-2">
                  <span className="text-[0.68rem] font-black uppercase text-slate-700">Total pagado</span>
                  <span className="text-[0.95rem] font-black text-[#1f3f97]">{formatoMoneda(compraGuardada.totalCompra)}</span>
                </div>
              </div>
            </section>

            <div className="mt-5 grid gap-2">
              <button type="button" onClick={() => setCompraGuardada(null)} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[8px] bg-[#1f3fa7] px-4 py-3 text-[0.72rem] font-semibold text-white shadow-[0_10px_22px_rgba(16,45,146,0.2)]">
                Registrar nueva compra
              </button>
              <button type="button" onClick={() => navigate('/inventario')} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[8px] bg-[#edf1f8] px-4 py-3 text-[0.72rem] font-semibold text-[#1f3f97]">
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
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[340px] items-center">
          <div className="w-full rounded-[14px] border border-[#f0d6da] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fff0f2]">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e24c5a] text-white">
                  <AlertTriangle size={16} strokeWidth={2.8} />
                </div>
              </div>
              <h1 className="mt-3 text-[0.95rem] font-black text-[#a02936]">No se guardo la compra</h1>
              <p className="mt-1 text-[0.68rem] leading-5 text-slate-500">Revisa los datos o intenta otra vez.</p>
              <p className="mt-2 rounded-[8px] bg-[#fff5f6] px-2.5 py-2 text-[0.66rem] leading-5 text-[#a02936]">{registroErrorMensaje}</p>
            </div>

            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => void guardarCompra()} disabled={saving} className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-[8px] bg-[#1f3fa7] px-4 py-2 text-[0.68rem] font-black text-white shadow-[0_10px_22px_rgba(16,45,146,0.18)] disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? 'Reintentando...' : 'Reintentar'}
              </button>
              <button type="button" onClick={volverDesdeError} className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-[8px] bg-[#edf1f8] px-4 py-2 text-[0.68rem] font-black text-[#1f3f97]">
                Volver a editar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] px-4 py-4 pb-[92px] text-slate-900">
      <header className="mx-auto w-full max-w-[340px] bg-white px-4 pb-3 pt-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={volverPasoAnterior}
            className="absolute left-0 text-slate-900 transition hover:opacity-75"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-[0.78rem] font-black text-slate-950">Registro de Compra</h1>
        </div>

        <div className="mt-7">
          <div className="flex items-center justify-between text-[0.66rem] font-bold text-slate-900">
            <span>{step === 2 ? 'Paso 2: Seleccionar café' : `Paso ${step}: ${pasoActual.titulo}`}</span>
            <span>{step} de 3</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#d0dbeb]">
            <div
              className="h-full rounded-full bg-[#04337b] transition-all duration-300"
              style={{ width: `${pasoActual.progreso}%` }}
            />
          </div>
          {step === 1 ? (
            <p className="mt-3 text-[0.62rem] text-slate-500">Selecciona como deseas elegir el productor</p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[340px] flex-col gap-4 bg-white px-4 py-4">

        {step === 1 ? (
          <section className="flex flex-col gap-3">
            <button
              type="button"
              onClick={seleccionarBusqueda}
              className={`w-full rounded-[8px] border px-3 py-3 text-left transition ${
                productorSelectionMode === 'buscar'
                  ? 'border-[#1f3fa7] bg-[#f4f7ff]'
                  : 'border-[#e3e7f3] bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    productorSelectionMode === 'buscar'
                      ? 'bg-[#1f3fa7] text-white'
                      : 'bg-[#eef2f7] text-slate-500'
                  }`}
                >
                  <Search size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.78rem] font-semibold leading-tight text-slate-900">Buscar productor</p>
                  <p className="mt-0.5 text-[0.62rem] text-slate-500">Selecciona un productor registrado</p>
                </div>
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                    productorSelectionMode === 'buscar'
                      ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white'
                      : 'border-[#cad2e2] bg-white text-transparent'
                  }`}
                >
                  <Check size={11} />
                </span>
              </div>
            </button>

            {productorSelectionMode === 'buscar' ? (
              <div className="space-y-2 rounded-[8px] border border-[#e4e9f5] bg-white p-2.5">
                <div className="flex items-center gap-2">
                  <input
                    ref={busquedaProductorRef}
                    type="text"
                    value={busquedaProductor}
                    onChange={(event) => setBusquedaProductor(event.target.value)}
                    placeholder="Nombre o identificacion..."
                    className="min-w-0 flex-1 rounded-[999px] border border-[#dbe2f0] bg-[#f8faff] px-4 py-2.5 text-[0.72rem] text-slate-900 outline-none transition focus:border-[#1f3fa7]"
                  />
                  <button
                    type="button"
                    onClick={() => busquedaProductorRef.current?.focus()}
                    aria-label="Buscar productor"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1f3fa7] text-white shadow-[0_6px_14px_rgba(31,63,167,0.18)]"
                  >
                    <Search size={14} strokeWidth={2.5} />
                  </button>
                </div>

                <div className="max-h-[190px] space-y-2 overflow-y-auto pr-1">
                  {productoresFiltrados.map((productor) => {
                    const activo = productorSeleccionado?.id === productor.id;

                    return (
                      <div
                        key={productor.id}
                        className={`flex w-full items-start justify-between gap-3 rounded-[8px] border px-3 py-2.5 text-left transition ${
                          activo
                            ? 'border-[#1f3fa7] bg-[#f4f7ff]'
                            : 'border-[#e6ebf5] bg-white hover:border-[#ccd6ea]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => seleccionarProductor(productor)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-[0.72rem] font-medium text-slate-900">{productor.nombre}</p>
                          <p className="mt-0.5 text-[0.62rem] text-slate-500">{productor.documento}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirEditarProductor(productor)}
                          aria-label={`Editar productor ${productor.nombre}`}
                          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f3f6fb] text-[#1f3fa7]"
                        >
                          <Pencil size={12} strokeWidth={2.3} />
                        </button>
                        <button
                          type="button"
                          onClick={() => seleccionarProductor(productor)}
                          className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            activo
                              ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white'
                              : 'border-[#cad2e2] bg-white text-transparent'
                          }`}
                          aria-label={`Seleccionar productor ${productor.nombre}`}
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    );
                  })}

                  {hayBusquedaProductor && productoresFiltrados.length === 0 ? (
                    <div className="rounded-[8px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-3 py-3 text-center text-[0.68rem] font-semibold text-slate-600">
                      Sin resultados para "{busquedaProductor.trim()}". Verifica o registra el productor.
                    </div>
                  ) : null}
                  {!hayBusquedaProductor && productores.length === 0 ? (
                    <div className="rounded-[8px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-3 py-3 text-center text-[0.68rem] font-semibold text-slate-600">
                      Aun no hay productores registrados.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={seleccionarGenerico}
              className={`w-full rounded-[8px] border px-3 py-3 text-left transition ${
                productorSelectionMode === 'generico'
                  ? 'border-[#1f3fa7] bg-[#f4f7ff]'
                  : 'border-[#e3e7f3] bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    productorSelectionMode === 'generico'
                      ? 'bg-[#1f3fa7] text-white'
                      : 'bg-[#eef2f7] text-slate-500'
                  }`}
                >
                  <User size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.78rem] font-semibold leading-tight text-slate-900">Productor generico</p>
                  <p className="mt-0.5 text-[0.62rem] text-slate-500">Compra rapida sin registrar productor</p>
                </div>
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                    productorSelectionMode === 'generico'
                      ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white'
                      : 'border-[#cad2e2] bg-white text-transparent'
                  }`}
                >
                  <Check size={11} />
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={abrirModalProductor}
              className="w-full rounded-[8px] border border-[#e3e7f3] bg-white px-3 py-3 text-left transition hover:border-[#ccd6ea]"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef2f7] text-slate-600">
                  <UserPlus size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.78rem] font-semibold leading-tight text-slate-900">Registrar productor</p>
                  <p className="mt-0.5 text-[0.62rem] text-slate-500">Crear un nuevo productor</p>
                </div>
              </div>
            </button>

            {!productorSeleccionado ? (
              <article className="mt-5 border-t border-[#eef1f6] pt-4">
                <p className="text-[0.55rem] font-black uppercase tracking-[0.08em] text-[#7a8699]">
                  Productor seleccionado
                </p>
                <p className="mt-3 text-[0.62rem] text-slate-500">
                  Selecciona a quién le harás la compra
                </p>
              </article>
            ) : null}

            {productorSeleccionado ? (
              <article className="mt-2 rounded-[8px] border border-[#e4e9f5] bg-[#fafafa] px-3 py-2.5">
                <p className="text-[0.55rem] font-semibold uppercase text-slate-500">
                  Productor seleccionado
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1f3fa7] text-white">
                    <User size={13} />
                  </span>
                  <div>
                    <p className="text-[0.72rem] font-semibold text-slate-900">{productorSeleccionado.nombre}</p>
                    <p className="text-[0.62rem] text-slate-500">
                      {productorSeleccionado.rapido ? 'Compra rápida' : productorSeleccionado.documento}
                    </p>
                  </div>
                </div>
              </article>
            ) : null}

            {error ? (
              <InlineGuidedError message={getComprasGuidance(error)} />
            ) : null}

            <button
              type="button"
              onClick={irSiguientePaso}
              disabled={!productorSeleccionado}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#1f3fa7] px-4 py-3 text-[0.72rem] font-semibold text-white shadow-[0_12px_28px_rgba(16,45,146,0.22)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente paso
              <ArrowRight size={14} />
            </button>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-3">
            {[subloteActual].map((sublote) => {
              return (
                <article
                  key={sublote.id}
                  className="rounded-[8px] border border-[#eceffa] bg-white p-0"
                >

                  <div className="rounded-[8px] bg-white px-0 py-0">
                    <p className="text-[0.62rem] font-semibold tracking-[0.02em] text-slate-600">Fecha de compra</p>
                    <div className="mt-2 flex items-center gap-2 rounded-[8px] border border-[#dfe5f2] bg-[#f8f9ff] px-3 py-2.5">
                      <CalendarDays size={14} className="text-[#102d92]" />
                      <input
                        type="date"
                        value={fecha}
                        max={hoyLocal()}
                        onChange={(event) => setFecha(event.target.value)}
                        className="w-full bg-transparent text-[0.78rem] font-semibold text-[#102d92] outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-[0.62rem] font-semibold text-slate-600">Tipo de café</p>
                    <label className="relative block">
                      <select
                        value={sublote.tipoCafeId}
                        onChange={(event) =>
                          actualizarSublote(sublote.id, 'tipoCafeId', event.target.value)
                        }
                        className="min-h-[42px] w-full appearance-none rounded-[8px] border border-[#dfe5f2] bg-white px-3 py-2.5 pr-9 text-[0.68rem] font-semibold text-slate-900 outline-none transition focus:border-[#1f3fa7] focus:ring-2 focus:ring-[#1f3fa7]/10"
                      >
                        <option value="">Seleccione tipo (ej. Verde, Seco)</option>
                        {tiposCafe.map((tipoCafe) => (
                          <option key={tipoCafe.id} value={tipoCafe.id}>
                            {tipoCafe.nombre}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={15}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                    </label>
                    {tiposCafe.length === 0 ? (
                      <div className="mt-2 rounded-[8px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-3 py-3 text-center text-[0.68rem] text-slate-500">
                        No hay tipos de café disponibles.
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-[0.62rem] font-semibold text-slate-600">Calidad</p>
                    <div className="grid grid-cols-3 gap-3">
                      {calidades.map((calidad) => {
                        const activo = sublote.calidadId === calidad.id;
                        const visual = visualCalidad(calidad.nombre);
                        return (
                          <button
                            key={calidad.id}
                            type="button"
                            onClick={() =>
                              actualizarSublote(sublote.id, 'calidadId', calidad.id)
                            }
                            className={`rounded-[8px] border px-2 py-2.5 text-sm font-semibold transition ${
                              activo
                                ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white shadow-[0_8px_20px_rgba(16,45,146,0.18)]'
                                : `${visual.borde} bg-white/85 text-slate-700 hover:bg-white`
                            }`}
                          >
                            <span className="flex flex-col items-center gap-1.5">
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                                  activo ? 'bg-white/20 text-white' : visual.fondo
                                }`}
                              >
                                {visual.icono}
                              </span>
                              <span className={`text-[0.55rem] font-black uppercase ${activo ? 'text-white' : ''}`}>
                                {calidad.nombre}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 rounded-[8px] bg-white p-0">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[0.62rem] font-semibold text-slate-600">Peso (kg)</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={sublote.pesoInicial}
                          onChange={(event) => actualizarSublote(sublote.id, 'pesoInicial', event.target.value)}
                          className="mt-2 w-full rounded-[8px] border border-[#e4e8f3] bg-[#fbfcff] px-3 py-3 text-[0.86rem] font-semibold text-slate-900 outline-none focus:border-[#102d92] placeholder:text-slate-300"
                          placeholder="ej. 25"
                        />
                      </div>

                      <div>
                        <label className="block text-[0.62rem] font-semibold text-slate-600">Precio x kg</label>
                        <div className="mt-2 flex items-center rounded-[8px] border border-[#173ea6] bg-white px-3 py-3">
                          <span className="mr-2 text-[0.86rem] font-semibold text-[#173ea6]">$</span>
                          <input
                            type="number"
                            min="0.1"
                            step="0.01"
                            value={sublote.precioKg}
                            onChange={(event) => actualizarSublote(sublote.id, 'precioKg', event.target.value)}
                            className="w-full bg-transparent text-[0.86rem] font-semibold text-[#173ea6] outline-none placeholder:text-slate-300"
                            placeholder="ej. 14.000"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            <button type="button" onClick={agregarSublote} className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-[8px] border border-dashed border-[#1f3fa7]/40 bg-white px-4 py-2 text-[0.64rem] font-semibold text-[#102d92]">
              <Plus size={14} />
              Agregar más café
            </button>

            {sublotes.length > 1 ? (
              <p className="text-center text-[0.62rem] font-semibold text-[#5b6f9d]">
                Ya guardaste {sublotes.length - 1} café{sublotes.length - 1 === 1 ? '' : 's'} para esta compra.
              </p>
            ) : null}

            <article className="rounded-[8px] border border-[#d6e2ff] bg-[#eef3ff] p-3 text-[#102d92]">
              <p className="text-[0.62rem] font-black text-[#5b6f9d]">Resumen de peso</p>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#d6e2ff] pt-3">
                <div>
                  <p className="text-[0.62rem] font-black text-[#5b6f9d]">Total kg:</p>
                  <p className="mt-1 text-[0.9rem] font-black leading-none text-[#102d92]">
                    {resumen.totalKg.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[0.62rem] font-black text-[#5b6f9d]">Total estimado:</p>
                  <p className="mt-1 text-[0.9rem] font-black leading-none text-[#102d92]">{formatoMoneda(resumen.totalCompra)}</p>
                </div>
              </div>
            </article>

            {error ? <InlineGuidedError message={getComprasGuidance(error)} /> : null}

            <div className="grid gap-3">
              <button type="button" onClick={irSiguientePaso} disabled={!paso2Completo} className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#1f3fa7] px-4 py-3 text-[0.72rem] font-semibold text-white shadow-[0_12px_28px_rgba(16,45,146,0.22)] disabled:cursor-not-allowed disabled:opacity-50">
                Siguiente Paso
                <ArrowRight size={14} />
              </button>
              <button type="button" onClick={irPasoAnterior} className="inline-flex min-h-[36px] w-full items-center justify-center rounded-[8px] bg-white px-4 py-2 text-[0.68rem] font-semibold text-slate-500">Regresar</button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-3">
            <article className="rounded-[8px] border border-[#e2e8f4] bg-white p-3">
              <div className="mb-3 flex items-center gap-2 text-[0.58rem] font-black uppercase text-[#6a7c98]">
                <CalendarDays size={11} />
                <span>Datos de la compra</span>
              </div>
              <div className="space-y-2 rounded-[6px] border border-[#e6eaf3] bg-[#fbfcff] px-3 py-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[0.55rem] font-black uppercase text-[#6f809a]">Productor</span>
                  <span className="truncate text-[0.68rem] font-semibold text-slate-900">{productorSeleccionado?.nombre ?? 'Sin productor'}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[0.55rem] font-black uppercase text-[#6f809a]">Fecha</span>
                  <span className="text-[0.68rem] font-semibold text-slate-900">{formatoFecha(fecha)}</span>
                </div>
              </div>
            </article>

            <section>
              <div className="mb-1.5 flex items-center gap-2 px-1 text-[0.58rem] font-black uppercase text-[#6a7c98]">
                <ShoppingBag size={11} />
                <span>Historial de la compra</span>
              </div>
              <p className="px-1 text-[0.58rem] text-slate-500">
                Si necesitas editar la información de un sublote, regresa al paso anterior
              </p>
              <div className="mt-2 space-y-2">
                {sublotes.map((sublote) => {
                  const tipoCafe = nombreTipoCafePorId.get(sublote.tipoCafeId) ?? 'Café';
                  const calidad = nombreCalidadPorId.get(sublote.calidadId) ?? 'Calidad';
                  const peso = Number(sublote.pesoInicial || 0);
                  const totalItem = peso * (Number(sublote.precioKg || 0));
                  const visual = iconoTipoCafe(tipoCafe);

                  return (
                    <article key={sublote.id} className="rounded-[8px] border border-[#e6e8f3] bg-white px-3 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`rounded-full p-2 ${visual.fondo}`}>{visual.icono}</div>
                          <div>
                            <p className="text-[0.58rem] font-black uppercase text-[#173ea6]">{tipoCafe}</p>
                            <p className="mt-0.5 text-[0.72rem] font-semibold leading-tight text-slate-900">Calidad: {calidad}</p>
                            <p className="mt-0.5 text-[0.64rem] font-semibold text-slate-700">Peso: {peso.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg</p>
                            <p className="mt-0.5 text-[0.64rem] font-semibold text-slate-700">Total: {formatoMoneda(totalItem)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => editarSubloteDesdeRevision(sublote.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#edf3ff] text-[#173ea6]"
                            title="Editar producto"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarSubloteDesdeRevision(sublote.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#fff0f2] text-[#e24c5a]"
                            title="Eliminar producto"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <article className="rounded-[8px] border border-[#d9e2f5] bg-white p-3">
              <p className="text-[0.58rem] font-black uppercase text-[#6a7c98]">Resumen financiero</p>
              <div className="mt-3 space-y-2 rounded-[6px] bg-[#f7f8ff] px-3 py-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[0.64rem] font-black uppercase text-slate-700">Total kg</span>
                  <span className="text-[1rem] font-black text-[#173ea6]">
                    {resumen.totalKg.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[0.64rem] font-black uppercase text-slate-700">Total a pagar</span>
                  <span className="text-[1rem] font-black text-[#173ea6]">{formatoMoneda(resumen.totalCompra)}</span>
                </div>
              </div>
            </article>

            {error ? <InlineGuidedError message={getComprasGuidance(error)} /> : null}

            <div className="grid gap-3">
              <button type="button" onClick={() => setMostrarModalConfirmar(true)} disabled={!puedeRegistrarCompra} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[8px] bg-[#102d92] px-4 py-3 text-[0.72rem] font-semibold text-white shadow-[0_12px_26px_rgba(16,45,146,0.2)] disabled:cursor-not-allowed disabled:opacity-60">
                <Save size={14} />
                Registrar compra
              </button>
              <button type="button" onClick={() => setMostrarModalCancelar(true)} className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-2 text-[0.68rem] font-semibold text-slate-700">
                Cancelar
              </button>
            </div>
          </section>
        ) : null}
      </main>

      {mostrarModalCancelar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[340px] overflow-y-auto rounded-[14px] bg-white p-4 shadow-[0_20px_44px_rgba(15,23,42,0.2)]">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-[#d7deeb]" />
            <div className="mt-4 text-center">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#ffecef] text-[#b12937]">
                <AlertTriangle size={16} />
              </div>
              <h2 className="mt-3 text-[0.95rem] font-black leading-tight text-slate-900">Cancelar compra</h2>
              <p className="mt-2 text-[0.68rem] leading-5 text-slate-500">
                Se perderan los datos ingresados.
              </p>
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={confirmarCancelarCompra}
                className="inline-flex min-h-[38px] items-center justify-center rounded-[8px] bg-[#ffe1e5] px-4 py-2 text-[0.68rem] font-black text-[#b12937]"
              >
                Si, cancelar
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalCancelar(false)}
                className="inline-flex min-h-[38px] items-center justify-center rounded-[8px] px-4 py-2 text-[0.68rem] font-black text-[#1f56dd]"
              >
                Seguir editando
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModalCapacidad && datosCapacidad ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[340px] overflow-y-auto rounded-[14px] bg-white p-4 shadow-[0_20px_44px_rgba(15,23,42,0.2)]">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-[#d7deeb]" />
            <div className="mt-4 text-center">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#fff7ed] text-[#ea580c]">
                <AlertTriangle size={16} />
              </div>
              <h2 className="mt-3 text-[0.95rem] font-black leading-tight text-slate-900">
                Bodega sin espacio
              </h2>
              <p className="mt-2 text-[0.68rem] leading-5 text-slate-500">
                Esta compra supera la capacidad.
              </p>
            </div>

            <div className="mt-4 rounded-[10px] border border-[#fed7aa] bg-[#fff7ed] p-4">
              <div className="flex items-center justify-between gap-3 text-[0.68rem] text-slate-600">
                <span>Capacidad</span>
                <span className="font-semibold text-slate-900">
                  {datosCapacidad.capacidadKg.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[0.68rem] text-slate-600">
                <span>Con compra</span>
                <span className="font-semibold text-[#ea580c]">
                  {datosCapacidad.nuevoTotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={confirmarCompraConAdvertencia}
                className="inline-flex min-h-[38px] items-center justify-center rounded-[8px] bg-[#ea580c] px-4 py-2 text-[0.68rem] font-black text-white"
              >
                Continuar
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalCapacidad(false)}
                className="inline-flex min-h-[38px] items-center justify-center rounded-[8px] px-4 py-2 text-[0.68rem] font-black text-[#1f56dd]"
              >
                Revisar compra
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModalAlerta80 && datosAlerta80 ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[340px] overflow-y-auto rounded-[14px] bg-white p-4 shadow-[0_20px_44px_rgba(15,23,42,0.2)]">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-[#d7deeb]" />
            <div className="mt-4 text-center">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#fff7ed] text-[#ea580c]">
                <AlertTriangle size={16} />
              </div>
              <h2 className="mt-3 text-[0.95rem] font-black leading-tight text-slate-900">
                Bodega al {datosAlerta80.porcentaje}%
              </h2>
              <p className="mt-2 text-[0.68rem] leading-5 text-slate-500">
                Revisa el espacio disponible.
              </p>
            </div>

            <div className="mt-4 rounded-[10px] border border-[#fed7aa] bg-[#fff7ed] p-4">
              <div className="flex items-center justify-between gap-3 text-[0.68rem] text-slate-600">
                <span>Capacidad total</span>
                <span className="font-semibold text-slate-900">
                  {datosAlerta80.capacidadKg.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[0.68rem] text-slate-600">
                <span>Antes de la compra</span>
                <span className="font-semibold text-slate-900">
                  {datosAlerta80.inventarioActual.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[0.68rem] text-slate-600">
                <span>Con compra</span>
                <span className="font-semibold text-[#ea580c]">
                  {datosAlerta80.nuevoTotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => setMostrarModalAlerta80(false)}
                className="inline-flex min-h-[38px] items-center justify-center rounded-[8px] bg-[#ea580c] px-4 py-2 text-[0.68rem] font-black text-white"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModalConfirmar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[340px] overflow-y-auto rounded-[14px] bg-white p-4 shadow-[0_18px_38px_rgba(15,23,42,0.18)]">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-[#d7deeb]" />
            {saving ? (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#dce5f7]">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-[#1f3fa7]" />
              </div>
            ) : null}
            <div className="mt-3 text-center">
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f1ff] text-[#1f3fa7]">
                <Check size={14} />
              </div>
              <h2 className="mt-2.5 text-[0.88rem] font-black leading-tight text-slate-900">Registrar compra</h2>
              <p className="mt-1.5 text-[0.64rem] leading-5 text-slate-500">
                {saving ? 'Guardando la compra...' : 'Revisa antes de guardar.'}
              </p>
            </div>

            <div className="mt-3 rounded-[8px] border border-[#e2e8f4] bg-[#f8faff] p-3">
              <div className="flex items-center justify-between gap-3 text-[0.64rem] text-slate-600">
                <span>Productor</span>
                <span className="font-semibold text-slate-900">{productorSeleccionado?.nombre ?? '-'}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3 text-[0.64rem] text-slate-600">
                <span>Total kg</span>
                <span className="font-semibold text-slate-900">
                  {resumen.totalKg.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3 text-[0.64rem] text-slate-600">
                <span>Total a pagar</span>
                <span className="text-[0.82rem] font-black text-[#1f3fa7]">{formatoMoneda(resumen.totalCompra)}</span>
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={() => void guardarCompra()}
                disabled={!puedeRegistrarCompra || saving}
                className="inline-flex min-h-[36px] items-center justify-center rounded-[8px] bg-[#1f3fa7] px-4 py-2 text-[0.66rem] font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Guardando compra...' : 'Confirmar compra'}
              </button>
              <button
                type="button"
                onClick={cerrarModalConfirmar}
                disabled={saving}
                className="inline-flex min-h-[34px] items-center justify-center rounded-[8px] px-4 py-2 text-[0.64rem] font-black text-[#1f56dd] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModalProductor ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 px-3 pt-8 backdrop-blur-sm">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[340px] overflow-y-auto rounded-t-[14px] bg-white shadow-[0_16px_38px_rgba(15,23,42,0.16)]">
            <div className="px-3.5 pb-3 pt-2.5">
              <div className="mx-auto h-1.5 w-10 rounded-full bg-[#cfd8e6]" />
              <div className="mt-3 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-[0.84rem] font-black leading-tight text-[#111827]">
                    {productorEditandoId ? 'Editar productor' : 'Registrar productor'}
                  </h2>
                </div>
                <button type="button" onClick={cerrarModalProductor} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500">
                  <X size={13} />
                </button>
              </div>

              <div className="mt-3 space-y-2.5">
                <div>
                  <label className="mb-1 block text-[0.58rem] font-black text-slate-900">Nombre completo</label>
                  <input type="text" value={productorForm.nombre} onChange={(event) => setProductorForm((actual) => ({ ...actual, nombre: event.target.value }))} placeholder="Ej. Juan Perez Rodriguez" className="w-full rounded-[8px] border border-[#dde4f1] bg-[#f7f9fd] px-3 py-2 text-[0.64rem] text-slate-900 outline-none focus:border-[#173ea6]" />
                </div>
                <div>
                  <label className="mb-1 block text-[0.58rem] font-black text-slate-900">Cedula o NIT</label>
                  <input type="text" value={productorForm.documento} onChange={(event) => setProductorForm((actual) => ({ ...actual, documento: event.target.value }))} placeholder="Ej. 123456789 o 900123456" className="w-full rounded-[8px] border border-[#dde4f1] bg-[#f7f9fd] px-3 py-2 text-[0.64rem] text-slate-900 outline-none focus:border-[#173ea6]" />
                </div>
                <div>
                  <label className="mb-1 block text-[0.58rem] font-black text-slate-900">Telefono (opcional)</label>
                  <input type="text" value={productorForm.telefono} onChange={(event) => setProductorForm((actual) => ({ ...actual, telefono: event.target.value }))} placeholder="Ej. 3001234567" className="w-full rounded-[8px] border border-[#dde4f1] bg-[#f7f9fd] px-3 py-2 text-[0.64rem] text-slate-900 outline-none focus:border-[#173ea6]" />
                </div>

                {productorFormError ? (
                  <InlineGuidedError message={getComprasGuidance(productorFormError)} />
                ) : null}
              </div>
            </div>

            <div className="border-t border-[#eef2f7] bg-[#fbfcff] px-3.5 py-3">
              <button type="button" onClick={guardarProductorLocal} disabled={botonGuardarProductorPresionado} className="inline-flex min-h-[36px] w-full items-center justify-center rounded-[8px] bg-[#102d92] px-4 py-2 text-[0.64rem] font-black text-white disabled:cursor-not-allowed disabled:opacity-60">
                {botonGuardarProductorPresionado
                  ? 'Guardando...'
                  : productorEditandoId
                    ? 'Guardar cambios'
                    : 'Guardar productor'}
              </button>
              <button type="button" onClick={cerrarModalProductor} className="mt-2 inline-flex w-full items-center justify-center px-4 py-1.5 text-[0.6rem] font-semibold text-slate-500">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}



      <AppBottomNav hidden={mostrarModalProductor} />
    </div>
  );
}




