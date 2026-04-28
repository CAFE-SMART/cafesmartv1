import React, { useEffect, useMemo, useState } from 'react';
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
  Meh,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Save,
  ShoppingBag,
  Smile,
  SunMedium,
  Trash2,
  Warehouse,
  X,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import {
  FormattedPhoneInput,
  isValidColombianPhone,
} from '../components/FormattedPhoneInput';
import { useUser } from '../context/UserContext';
import { useFormPersistence } from '../hooks/useFormPersistence';
import {
  formatDateLabel,
  getTodayLocalDateValue,
  toIsoDateAtUtcNoon,
} from '../utils/date';
import {
  crearCompra,
  listarCompras,
  obtenerCatalogosCompra,
  type CatalogoItem,
  type CatalogosCompra,
  type CompraListadoItem,
} from '../services/comprasService';

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
    subtotal: number;
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
type CompraDraft = {
  fecha: string;
  sublotes: SubloteForm[];
  productorSeleccionado: ProductorOption | null;
  busquedaProductor: string;
  busquedaAplicada: string;
  step: Step;
};

const DEVICE_STORAGE_KEY = 'cafesmart-device-id';
const PRODUCTORES_STORAGE_KEY = 'cafesmart-productores-locales-v1';
const COMPRA_DRAFT_STORAGE_KEY = 'cafesmart-compra-draft-v1';
const ORDEN_TIPOS = ['VERDE', 'SECO', 'TRILLADO', 'PASILLA'];
const ORDEN_CALIDADES = ['BUENO', 'REGULAR', 'MALO'];
const PRODUCTOR_GENERAL: ProductorOption = {
  id: 'general',
  nombre: 'Productor General',
  documento: 'Compra rápida',
  detalle: 'Para compras rápidas o productores ocasionales no registrados en el sistema.',
  rapido: true,
};
const PRODUCTORES_RECIENTES: ProductorOption[] = [
  {
    id: 'reciente-1',
    nombre: 'Juan Arango Montoya',
    documento: 'C.C. 1.054.882.XXX',
    detalle: 'Finca La Esperanza',
  },
  {
    id: 'reciente-2',
    nombre: 'Maria Elena Giraldo',
    documento: 'C.C. 24.331.XXX',
    detalle: 'Finca El Oasis',
  },
  {
    id: 'reciente-3',
    nombre: 'Humberto de J. Castro',
    documento: 'C.C. 70.122.XXX',
    detalle: 'Finca San José',
  },
];
const LIMITE_PRODUCTORES_RECIENTES = 5;

function generarId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function obtenerDeviceId() {
  const existente = window.localStorage.getItem(DEVICE_STORAGE_KEY);
  if (existente) return existente;
  const nuevo = generarId();
  window.localStorage.setItem(DEVICE_STORAGE_KEY, nuevo);
  return nuevo;
}

function cargarProductoresLocales() {
  if (typeof window === 'undefined') return [] as ProductorOption[];

  try {
    const raw = window.localStorage.getItem(PRODUCTORES_STORAGE_KEY);
    if (!raw) return [] as ProductorOption[];

    const parsed = JSON.parse(raw) as ProductorOption[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as ProductorOption[];
  }
}

function guardarProductoresLocales(productores: ProductorOption[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PRODUCTORES_STORAGE_KEY, JSON.stringify(productores));
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

function formatoHoraBorrador(value: string | null) {
  if (!value) return null;

  return new Date(value).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function construirMensajeAmigableCompra(error: unknown) {
  const fallback =
    'No pudimos registrar la compra en este momento. Revisa la información e inténtalo nuevamente.';

  if (!(error instanceof Error)) return fallback;

  const mensaje = error.message.trim();
  const mensajeNormalizado = normalizeSearchText(mensaje);

  if (
    mensajeNormalizado.includes('fecha') ||
    mensajeNormalizado.includes('iso 8601') ||
    mensajeNormalizado.includes('invalid date')
  ) {
    return 'No pudimos registrar la fecha de la compra. Verifica que la fecha exista, vuelve a seleccionarla en el calendario y luego intenta guardar de nuevo.';
  }

  if (mensajeNormalizado.includes('token')) {
    return 'Tu sesión ya no está activa. Ingresa nuevamente para poder registrar la compra.';
  }

  return mensaje || fallback;
}

function esCompraDraftVacio(draft: CompraDraft) {
  const subloteUnicoVacio =
    draft.sublotes.length === 1 &&
    !draft.sublotes[0].tipoCafeId &&
    !draft.sublotes[0].calidadId &&
    !draft.sublotes[0].pesoInicial &&
    !draft.sublotes[0].precioKg;

  return (
    draft.step === 1 &&
    draft.fecha === hoyLocal() &&
    !draft.productorSeleccionado &&
    !draft.busquedaProductor &&
    !draft.busquedaAplicada &&
    subloteUnicoVacio
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
      titulo: 'Registro de Compra',
      descripcion: 'Seleccione el productor para iniciar el pesaje del café.',
      progreso: 33,
    };
  }
  if (step === 2) {
    return {
      chip: 'Paso 2 de 3',
      titulo: 'Agregar Producto',
      descripcion: 'Completa tipo de café, calidad, peso y precio por kilo.',
      progreso: 66,
    };
  }
  return {
    chip: 'Paso 3 de 3',
    titulo: 'Revisión Final',
    descripcion: 'Confirma el resumen antes de registrar la compra.',
    progreso: 100,
  };
}

export default function Compras() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [catalogos, setCatalogos] = useState<CatalogosCompra>({ tiposCafe: [], calidades: [] });
  const [compras, setCompras] = useState<CompraListadoItem[]>([]);
  const [fecha, setFecha] = useState(hoyLocal());
  const [sublotes, setSublotes] = useState<SubloteForm[]>([crearSubloteVacio()]);
  const [productorSeleccionado, setProductorSeleccionado] = useState<ProductorOption | null>(null);
  const [productoresLocales, setProductoresLocales] = useState<ProductorOption[]>(() => cargarProductoresLocales());
  const [busquedaProductor, setBusquedaProductor] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [mostrarModalProductor, setMostrarModalProductor] = useState(false);
  const [productorForm, setProductorForm] = useState<ProductorForm>({ nombre: '', telefono: '', documento: '' });
  const [productorFormError, setProductorFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [compraGuardada, setCompraGuardada] = useState<CompraGuardadaResumen | null>(null);
  const [editingProductorId, setEditingProductorId] = useState<string | null>(null);
  const [highlightedSubloteId, setHighlightedSubloteId] = useState<string | null>(null);
  const compraDraft = useMemo<CompraDraft>(
    () => ({
      fecha,
      sublotes,
      productorSeleccionado,
      busquedaProductor,
      busquedaAplicada,
      step,
    }),
    [busquedaAplicada, busquedaProductor, fecha, productorSeleccionado, step, sublotes],
  );
  const { clearDraft: clearCompraDraft, lastSavedAt } = useFormPersistence<CompraDraft>({
    key: COMPRA_DRAFT_STORAGE_KEY,
    value: compraDraft,
    isEmpty: esCompraDraftVacio,
    onRestore: (draft) => {
      setFecha(draft.fecha || hoyLocal());
      setSublotes(Array.isArray(draft.sublotes) && draft.sublotes.length > 0 ? draft.sublotes : [crearSubloteVacio()]);
      setProductorSeleccionado(draft.productorSeleccionado ?? null);
      setBusquedaProductor(draft.busquedaProductor ?? '');
      setBusquedaAplicada(draft.busquedaAplicada ?? '');
      setStep([1, 2, 3].includes(draft.step) ? draft.step : 1);
    },
  });

  const cargarTodo = async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalogosData, comprasData] = await Promise.all([
        obtenerCatalogosCompra(),
        listarCompras(),
      ]);
      setCatalogos(catalogosData);
      setCompras(comprasData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la informacion de compras.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarTodo();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    guardarProductoresLocales(productoresLocales);
  }, [productoresLocales]);

  const tiposCafe = useMemo(() => ordenarCatalogos(catalogos.tiposCafe, ORDEN_TIPOS), [catalogos.tiposCafe]);
  const calidades = useMemo(() => ordenarCatalogos(catalogos.calidades, ORDEN_CALIDADES), [catalogos.calidades]);
  const nombreTipoCafePorId = useMemo(() => new Map(catalogos.tiposCafe.map((item) => [item.id, item.nombre])), [catalogos.tiposCafe]);
  const nombreCalidadPorId = useMemo(() => new Map(catalogos.calidades.map((item) => [item.id, item.nombre])), [catalogos.calidades]);
  const resumen = useMemo(() => {
    const totalKg = sublotes.reduce((acc, sublote) => acc + (Number(sublote.pesoInicial) || 0), 0);
    const totalCompra = sublotes.reduce((acc, sublote) => acc + (Number(sublote.pesoInicial) || 0) * (Number(sublote.precioKg) || 0), 0);
    return { totalKg, totalCompra };
  }, [sublotes]);
  const comprasHoy = useMemo(() => {
    const hoy = hoyLocal();
    return compras.filter((compra) => compra.fecha.slice(0, 10) === hoy).length;
  }, [compras]);
  const productoresRecientes = useMemo(() => {
    const base = productoresLocales.length > 0 ? [...productoresLocales] : [...PRODUCTORES_RECIENTES];
    const termino = normalizeSearchText(busquedaAplicada.trim());

    if (!termino) {
      return base.slice(0, LIMITE_PRODUCTORES_RECIENTES);
    }

    return base.filter((productor) =>
      [productor.nombre, productor.documento, productor.detalle].some((valor) =>
        normalizeSearchText(valor).includes(termino),
      ),
    );
  }, [busquedaAplicada, productoresLocales]);
  const busquedaAplicadaActiva = busquedaAplicada.trim().length > 0;
  const busquedaPendiente = busquedaProductor.trim() !== busquedaAplicada.trim();
  const pasoActual = datosPaso(step);
  const inicialesUsuario = useMemo(() => {
    const nombreBase = user?.name?.trim() ?? '';
    if (!nombreBase) return 'PC';
    return nombreBase
      .split(/\s+/)
      .slice(0, 2)
      .map((segmento) => segmento[0]?.toUpperCase() ?? '')
      .join('');
  }, [user?.name]);

  const actualizarSublote = (id: string, campo: keyof Omit<SubloteForm, 'id'>, valor: string) => {
    if (highlightedSubloteId === id) {
      setHighlightedSubloteId(null);
    }
    setSublotes((actual) => actual.map((sublote) => (sublote.id === id ? { ...sublote, [campo]: valor } : sublote)));
  };

  const agregarSublote = () => setSublotes((actual) => [...actual, crearSubloteVacio()]);

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

  const abrirModalProductor = (productor?: ProductorOption) => {
    setError(null);
    setProductorFormError(null);
    setEditingProductorId(productor?.id ?? null);
    setProductorForm(
      productor
        ? {
            nombre: productor.nombre,
            telefono: productor.telefono ?? '',
            documento: productor.documento === 'Documento pendiente' ? '' : productor.documento,
          }
        : { nombre: '', telefono: '', documento: '' },
    );
    setMostrarModalProductor(true);
  };

  const cerrarModalProductor = () => {
    setMostrarModalProductor(false);
    setEditingProductorId(null);
    setProductorForm({ nombre: '', telefono: '', documento: '' });
    setProductorFormError(null);
  };

  const buscarProductor = () => {
    setBusquedaAplicada(busquedaProductor.trim());
  };

  const seleccionarProductor = (productor: ProductorOption) => {
    setProductorSeleccionado(productor);
    setError(null);
  };

  const guardarProductorLocal = () => {
    const nombre = productorForm.nombre.trim();
    const documento = productorForm.documento.trim();

    if (!nombre) {
      setProductorFormError('Escribe el nombre del productor para guardarlo.');
      return;
    }

    if (productorForm.telefono && !isValidColombianPhone(productorForm.telefono, true)) {
      setProductorFormError('El celular parece incompleto. Escribe los 10 digitos o dejalo vacio.');
      return;
    }

    const productorBase: ProductorOption = {
      id: editingProductorId ?? generarId(),
      nombre,
      telefono: productorForm.telefono.trim(),
      documento: documento || 'Documento pendiente',
      detalle: productorForm.telefono.trim() || 'Productor agregado manualmente',
    };

    const siguientes = editingProductorId
      ? productoresLocales.map((productor) =>
          productor.id === editingProductorId ? productorBase : productor,
        )
      : [productorBase, ...productoresLocales];

    guardarProductoresLocales(siguientes);
    setProductoresLocales(siguientes);
    setProductorSeleccionado(productorBase);
    setBusquedaProductor(nombre);
    setBusquedaAplicada(nombre);
    setMostrarModalProductor(false);
    setEditingProductorId(null);
    setProductorForm({ nombre: '', telefono: '', documento: '' });
    setProductorFormError(null);
    setError(null);
  };

  const resetFormulario = () => {
    setFecha(hoyLocal());
    setSublotes([crearSubloteVacio()]);
    setProductorSeleccionado(null);
    setBusquedaProductor('');
    setBusquedaAplicada('');
    setProductorFormError(null);
    setEditingProductorId(null);
    setHighlightedSubloteId(null);
    setStep(1);
    setError(null);
    setWarning(null);
  };

  const editarSubloteDesdeRevision = (id: string) => {
    setHighlightedSubloteId(id);
    setStep(2);
    setError(null);
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
    if (catalogos.tiposCafe.length === 0 || catalogos.calidades.length === 0) {
      return 'Aun no hay catalogos disponibles para registrar la compra.';
    }
    for (const [index, sublote] of sublotes.entries()) {
        if (!sublote.tipoCafeId) return `Selecciona el tipo de café del sublote ${index + 1}.`;
      if (!sublote.calidadId) return `Selecciona la calidad del sublote ${index + 1}.`;
      if (!Number.isFinite(Number(sublote.pesoInicial)) || Number(sublote.pesoInicial) <= 0) {
        return `Ingresa un peso valido para el sublote ${index + 1}.`;
      }
      if (!Number.isFinite(Number(sublote.precioKg)) || Number(sublote.precioKg) <= 0) {
        return `Ingresa un precio valido para el sublote ${index + 1}.`;
      }
    }
    return null;
  };

  const irSiguientePaso = () => {
    setError(null);
    if (step === 1) {
      if (!productorSeleccionado) {
        setError(
          'Selecciona un productor o usa Productor genérico para continuar con una compra rápida.',
        );
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

  const guardarCompra = async () => {
    const mensajeValidacion = validarSublotes();
    if (mensajeValidacion) {
      setError(mensajeValidacion);
      return;
    }
    setSaving(true);
    setError(null);
    setWarning(null);
    try {
      const compraLocalId = generarId();
      const deviceId = obtenerDeviceId();
      const fechaActual = fecha.trim() || hoyLocal();
      setFecha(fechaActual);
      const fechaNormalizada = toIsoDateAtUtcNoon(fechaActual);
      const payload = {
        ...(fechaNormalizada ? { fecha: fechaNormalizada } : {}),
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
        fecha: respuesta.compra?.fecha ?? fechaNormalizada ?? new Date().toISOString(),
        productorNombre: productorSeleccionado?.nombre ?? PRODUCTOR_GENERAL.nombre,
        productorDocumento: productorSeleccionado?.documento ?? PRODUCTOR_GENERAL.documento,
        totalKg: resumen.totalKg,
        totalCompra: Number(respuesta.compra.totalCompra),
        sublotes: sublotes.map((sublote) => {
          const peso = Number(sublote.pesoInicial) || 0;
          const precio = Number(sublote.precioKg) || 0;
          return {
            id: sublote.id,
            tipoCafe: nombreTipoCafePorId.get(sublote.tipoCafeId) ?? 'Café',
            calidad: nombreCalidadPorId.get(sublote.calidadId) ?? 'Calidad',
            pesoInicial: peso,
            subtotal: peso * precio,
          };
        }),
      });
      const comprasActualizadas = await listarCompras();
      setCompras(comprasActualizadas);
      clearCompraDraft();
      resetFormulario();
    } catch (err) {
      setError(construirMensajeAmigableCompra(err));
    } finally {
      setSaving(false);
    }
  };

  if (compraGuardada) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 pb-[150px] text-slate-900">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setCompraGuardada(null)} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#102d92] shadow-sm" title="Volver atrás">
                <ArrowLeft size={18} />
              </button>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Café Smart</p>
                <p className="text-base font-black text-[#102d92]">Compra registrada</p>
              </div>
            </div>
            <CloudStatusBadge />
          </div>

          <section className="px-4 pt-2 text-center">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-[0_16px_40px_rgba(16,45,146,0.08)]">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#102d92] text-white">
                <Check size={28} strokeWidth={3} />
              </div>
            </div>
            <h1 className="mt-8 text-[1.85rem] font-black uppercase tracking-[0.03em] text-[#102d92]">Compra registrada</h1>
            <p className="mt-3 text-base leading-7 text-slate-600">Tu compra fue registrada correctamente. Ahora puedes verla reflejada en el inventario.</p>
          </section>

          <section className="rounded-[28px] border border-[#e6e8f3] bg-[#f7f8ff] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Productor</p>
            <p className="mt-3 text-[1.6rem] font-black leading-tight text-[#102d92]">{compraGuardada.productorNombre}</p>
            <p className="mt-1 text-sm text-slate-500">{compraGuardada.productorDocumento}</p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-[22px] bg-white p-4 shadow-sm">
                <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">Total kg</p>
                <p className="mt-3 text-[1.75rem] font-black text-slate-900">{Math.round(compraGuardada.totalKg)}</p>
                <p className="text-lg font-semibold text-slate-500">kg</p>
              </div>
              <div className="rounded-[22px] bg-white p-4 shadow-sm">
                <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">Total pagado</p>
                <p className="mt-3 text-[1.35rem] font-black leading-tight text-slate-900">{formatoMoneda(compraGuardada.totalCompra)}</p>
              </div>
            </div>
          </section>

          <div className="grid gap-3">
            <button type="button" onClick={() => setCompraGuardada(null)} className="inline-flex items-center justify-center gap-3 rounded-[22px] bg-[#102d92] px-5 py-4 text-sm font-black uppercase tracking-[0.03em] text-white shadow-[0_18px_45px_rgba(16,45,146,0.22)]">
              <ShoppingBag size={20} />
              Registrar nueva compra
            </button>
            <button type="button" onClick={() => navigate('/inventario')} className="inline-flex items-center justify-center gap-3 rounded-[22px] bg-[#8ee7e3] px-5 py-4 text-sm font-black uppercase tracking-[0.03em] text-[#0b565d]">
              <Warehouse size={20} />
              Ir a inventario
            </button>
            <button type="button" onClick={() => navigate('/inicio')} className="inline-flex items-center justify-center gap-3 px-5 py-3 text-lg font-black text-[#102d92]">
              Volver al inicio
            </button>
          </div>
        </div>
      <AppBottomNav />
    </div>
  );
}

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 pb-[180px] text-slate-900">
      <header className="border-b border-white/80 bg-[rgba(247,245,255,0.86)] px-4 py-4 backdrop-blur">
        <div className="mx-auto w-full max-w-[520px]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#173ea6] text-sm font-black text-white">
              {inicialesUsuario}
            </div>
            <div className="min-w-0">
              <p className="text-[1.2rem] font-black leading-tight text-[#111827]">Gestión de Café</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Registro de compra</p>
            </div>
          </div>
          <div>
            <CloudStatusBadge compact className="max-w-[220px]" />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[520px] flex-col gap-5 py-6">
        <section className="space-y-3 px-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.55rem] font-black leading-[1.02] text-[#102d92]">{pasoActual.titulo}</h1>
              <p className="mt-2 text-[0.92rem] leading-6 text-slate-600">{pasoActual.descripcion}</p>
            </div>
            <div className="inline-flex rounded-full bg-[#86e7e2] px-3 py-2 text-[11px] font-black text-[#0b565d]">{pasoActual.chip}</div>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#dfe6f4]">
          <div 
            className="h-full rounded-full bg-[#173ea6] transition-all duration-300"
            style={{ width: `${pasoActual.progreso}%` }}
          />
          </div>
          {lastSavedAt ? (
            <p className="text-xs font-semibold text-slate-500">
              Borrador guardado automaticamente a las {formatoHoraBorrador(lastSavedAt)}.
            </p>
          ) : null}
        </section>

        {step === 1 ? (
          <section className="flex flex-col gap-4">
            <div className="order-2 flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={busquedaProductor}
                  onChange={(event) => {
                    const value = event.target.value;
                    setBusquedaProductor(value);
                    if (!value.trim()) {
                      setBusquedaAplicada('');
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      buscarProductor();
                    }
                  }}
                  placeholder="Buscar por nombre, cédula o código..."
                  className="w-full rounded-[18px] border border-[#e3e7f2] bg-white px-12 py-3.5 text-base text-slate-900 outline-none transition focus:border-[#173ea6]"
                />
              </div>
              <button
                type="button"
                onClick={buscarProductor}
                className="inline-flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[18px] border border-[#dfe5f2] bg-white text-[#102d92] shadow-sm"
                title="Buscar productor"
              >
                <Search size={18} />
              </button>
            </div>
            {busquedaPendiente ? (
              <p className="order-3 text-sm text-slate-500">Pulsa la lupa para buscar el productor escrito.</p>
            ) : null}

            <button
              type="button"
              onClick={() => seleccionarProductor(PRODUCTOR_GENERAL)}
              className={`order-1 w-full rounded-[20px] border px-4 py-4 text-left shadow-sm transition ${
                productorSeleccionado?.id === PRODUCTOR_GENERAL.id
                  ? 'border-[#173ea6] bg-[#eef3ff] text-[#102d92] shadow-[0_0_0_2px_rgba(23,62,166,0.08)]'
                  : 'border-[#d6e2ff] bg-[#eef3ff] text-[#102d92]'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[1.08rem] font-black leading-tight">Productor General</p>
                  <p className="mt-2 max-w-[260px] text-[0.9rem] leading-6 text-slate-600">
                    Úsalo cuando la persona no tiene tiempo de registrar sus datos en este momento.
                  </p>
                </div>
                <div className="rounded-full bg-[#dce8ff] px-3 py-1 text-[11px] font-black text-[#173ea6]">
                  {productorSeleccionado?.id === PRODUCTOR_GENERAL.id ? 'Seleccionado' : 'Rápido'}
                </div>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#102d92]">
                Compra rápida sin registrar productor
                <ArrowRight size={16} />
              </div>
            </button>

            <button
              type="button"
              onClick={() => abrirModalProductor()}
              className="order-4 inline-flex w-full items-center justify-center gap-3 rounded-[18px] border border-dashed border-[#b7c6ef] bg-white px-5 py-3.5 text-[0.95rem] font-black text-[#102d92]"
            >
              <Plus size={18} />
              Registrar Productor
            </button>

            <div className="order-5">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-400">Productores recientes</p>
              <div className="mt-4 space-y-3">
                {productoresRecientes.map((productor) => {
                  const esLocal = productoresLocales.some((item) => item.id === productor.id);

                  return (
                    <div key={productor.id} className="flex items-center gap-3 rounded-[22px] border border-[#eceffa] bg-[#f8f8ff] px-4 py-4 shadow-sm">
                      <button type="button" onClick={() => seleccionarProductor(productor)} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-[#102d92] shadow-sm">
                            {productor.nombre.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[1.05rem] font-black leading-tight text-[#102d92]">{productor.nombre}</p>
                            <p className="mt-1 text-sm text-slate-600">{productor.documento}</p>
                            <p className="text-sm text-slate-500">{productor.detalle}</p>
                          </div>
                        </div>
                        <ArrowRight size={18} className="shrink-0 text-slate-400" />
                      </button>

                      {esLocal ? (
                        <button
                          type="button"
                          onClick={() => abrirModalProductor(productor)}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#102d92] shadow-sm"
                          title="Editar productor"
                        >
                          <Pencil size={16} />
                        </button>
                      ) : null}
                    </div>
                  );
                })}

                {productoresRecientes.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-[#d7dcec] bg-white px-4 py-10 text-center text-sm text-slate-500">
                    {busquedaAplicadaActiva
                      ? 'No encontré productores con esa búsqueda. Prueba con otro dato o registra uno nuevo.'
                      : 'Aún no hay productores recientes para mostrar. Puedes usar Productor General o registrar uno nuevo.'}
                  </div>
                ) : null}
              </div>
            </div>

            <article className="order-6 rounded-[24px] border border-[#eceffa] bg-[#f4f5ff] p-5 shadow-sm">
              <div className="mb-5 rounded-[18px] border border-[#d9e4ff] bg-white px-4 py-4">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                  Productor seleccionado
                </p>
                {productorSeleccionado ? (
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-[#102d92]">{productorSeleccionado.nombre}</p>
                      <p className="mt-1 text-sm text-slate-500">{productorSeleccionado.documento}</p>
                      <p className="mt-1 text-sm text-slate-500">{productorSeleccionado.detalle}</p>
                    </div>
                    <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-[11px] font-black text-[#173ea6]">
                      Listo
                    </span>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Selecciona un productor, usa Productor genérico o registra uno nuevo para continuar.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Total productores</p>
                  <p className="mt-3 text-[2rem] font-black leading-none text-[#102d92]">{productoresLocales.length + 1}</p>
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Compras hoy</p>
                  <p className="mt-3 text-[2rem] font-black leading-none text-[#102d92]">{loading ? '...' : comprasHoy}</p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 rounded-[18px] bg-white px-4 py-3">
                <div>
                  <p className="text-base font-black text-[#0f766e]">Base de datos actualizada</p>
                  <p className="text-sm text-slate-500">Catalogos y compras recientes listos.</p>
                </div>
                <button type="button" onClick={() => void cargarTodo()} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#eef2ff] text-[#102d92]" title="Actualizar base de datos">
                  <RefreshCcw size={16} />
                </button>
              </div>
            </article>

            {error ? (
              <div className="order-7 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={irSiguientePaso}
              className="order-8 inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[20px] bg-[#102d92] px-5 py-4 text-sm font-black text-white shadow-[0_18px_40px_rgba(16,45,146,0.2)]"
            >
              Siguiente paso
              <ArrowRight size={18} />
            </button>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={irPasoAnterior} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#102d92] shadow-sm" title="Ir al paso anterior">
                <ArrowLeft size={18} />
              </button>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Productor seleccionado</p>
                <p className="text-[1.05rem] font-semibold text-slate-600">
                  {productorSeleccionado?.nombre ?? 'Sin productor seleccionado'}
                </p>
              </div>
            </div>

            {sublotes.map((sublote, index) => {
              const tipoNombre = nombreTipoCafePorId.get(sublote.tipoCafeId) ?? `Producto ${index + 1}`;
              const calidadNombre = nombreCalidadPorId.get(sublote.calidadId) ?? 'Sin calidad';
              const subtotal = (Number(sublote.pesoInicial) || 0) * (Number(sublote.precioKg) || 0);

              return (
                <article
                  key={sublote.id}
                  className={`rounded-[26px] border bg-[#f6f7ff] p-5 shadow-sm ${
                    highlightedSubloteId === sublote.id
                      ? 'border-[#173ea6] shadow-[0_0_0_2px_rgba(23,62,166,0.08)]'
                      : 'border-[#eceffa]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[1.6rem] font-black leading-tight text-[#102d92]">Producto {index + 1}</p>
                      <p className="mt-1 text-base text-slate-500">Carga de la compra</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => eliminarSublote(sublote.id)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#fff0f2] text-[#e24c5a]"
                      title={sublotes.length === 1 ? 'Limpiar producto' : 'Eliminar producto'}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="mt-5 rounded-[20px] border border-[#dfe5f2] bg-white px-4 py-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Fecha de compra</p>
                    <div className="mt-3 flex items-center gap-3 rounded-[16px] border border-[#dfe5f2] bg-[#f8f9ff] px-3 py-3">
                      <CalendarDays size={18} className="text-[#102d92]" />
                      <label className="block text-sm font-bold text-slate-600">
                        Fecha de compra
                      </label>
                      <input
                        type="date"
                        value={fecha}
                        max={hoyLocal()}
                        onChange={(event) => setFecha(event.target.value)}
                        className="w-full bg-transparent text-sm font-black text-[#102d92] outline-none"
                        aria-label="Fecha de compra"
                      />
                    </div>
                  </div>

                  <div className="mt-6">
                    <p className="mb-3 text-[1.05rem] font-black text-slate-900">Tipo de Café</p>
                    <div className="grid grid-cols-2 gap-3">
                      {tiposCafe.map((tipoCafe) => {
                        const activo = sublote.tipoCafeId === tipoCafe.id;
                        const visualTipo = iconoTipoCafe(tipoCafe.nombre);
                        return (
                          <button
                            key={tipoCafe.id}
                            type="button"
                            onClick={() =>
                              actualizarSublote(sublote.id, 'tipoCafeId', tipoCafe.id)
                            }
                            className={`rounded-[18px] border px-3 py-3 text-sm font-black transition ${
                              activo
                                ? 'border-[#173ea6] bg-white text-[#173ea6] shadow-[0_8px_20px_rgba(16,45,146,0.1)]'
                                : `${visualTipo.borde} bg-white/85 text-slate-700 hover:bg-white`
                            }`}
                          >
                            <span className="flex flex-col items-center gap-1.5">
                              <span
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${
                                  activo ? 'bg-[#e8efff] text-[#173ea6]' : visualTipo.fondo
                                }`}
                              >
                                {visualTipo.icono}
                              </span>
                              <span className="text-xs font-black uppercase tracking-[0.08em]">
                                {tipoCafe.nombre}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6">
                    <p className="mb-3 text-[1.05rem] font-black text-slate-900">Calidad</p>
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
                            className={`rounded-[18px] border px-2 py-3 text-sm font-black transition ${
                              activo
                                ? 'border-[#173ea6] bg-white text-[#173ea6] shadow-[0_8px_20px_rgba(16,45,146,0.1)]'
                                : `${visual.borde} bg-white/85 text-slate-700 hover:bg-white`
                            }`}
                          >
                            <span className="flex flex-col items-center gap-1.5">
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                                  activo ? 'bg-[#e8efff] text-[#173ea6]' : visual.fondo
                                }`}
                              >
                                {visual.icono}
                              </span>
                              <span className="text-[11px] font-black uppercase tracking-[0.08em]">
                                {calidad.nombre}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

<div className="mt-6 rounded-[22px] bg-white p-5">
  <label className="block text-base font-black text-slate-900">Peso (kg)</label>
  <input 
    type="number" 
    min="0.01" 
    step="0.01" 
    value={sublote.pesoInicial} 
    onChange={(event) => actualizarSublote(sublote.id, 'pesoInicial', event.target.value)} 
    className="mt-3 w-full rounded-[18px] border border-[#e4e8f3] bg-[#fbfcff] px-4 py-4 text-[1.8rem] font-black text-slate-900 outline-none focus:border-[#102d92]" 
    placeholder="0.00 kg" 
    title="Ingresa el peso en kilogramos"
    aria-label="Peso en kilogramos" 
  />

                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <div>
                        <p className="mb-2 text-sm font-black uppercase tracking-[0.16em] text-slate-400">Tipo elegido</p>
                        <div className="rounded-[16px] bg-[#f5f6fb] px-4 py-4 text-lg font-black text-slate-700">{tipoNombre}</div>
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-black uppercase tracking-[0.16em] text-slate-400">Calidad</p>
                        <div className="rounded-[16px] bg-[#f5f6fb] px-4 py-4 text-lg font-black text-slate-700">{calidadNombre}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[22px] bg-white p-5">
                    <div>
                      <p className="text-base font-black text-slate-900">Precio a pagar (kg)</p>
                      <p className="mt-1 text-sm text-slate-500">Precio sugerido: $14.500</p>
                    </div>
                    <input 
                      type="number" 
                      min="0.1" 
                      step="0.01" 
                      value={sublote.precioKg} 
                      onChange={(event) => actualizarSublote(sublote.id, 'precioKg', event.target.value)} 
                      className="mt-4 w-full rounded-[18px] border-2 border-[#173ea6] bg-white px-4 py-4 text-[1.85rem] font-black text-[#173ea6] outline-none focus:border-[#102d92]" 
                      placeholder="14500" 
                      title="Ingresa el precio en pesos por kilogramo"
                      aria-label="Precio a pagar por kilogramo" 
                    />
                  </div>

                  <div className="mt-5 rounded-[22px] border border-[#d6e2ff] bg-[#eef3ff] p-5 text-[#102d92]">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-[#5b6f9d]">Subtotal del producto</p>
                    <p className="mt-3 text-[2rem] font-black leading-none">{formatoMoneda(subtotal)}</p>
                  </div>
                </article>
              );
            })}

            <button type="button" onClick={agregarSublote} className="inline-flex w-full min-h-[56px] items-center justify-center gap-3 rounded-[22px] border border-dashed border-[#ccd4e8] bg-white px-5 py-4 text-sm font-black text-[#102d92]">
              <Plus size={20} />
              Agregar Producto
            </button>

            <article className="rounded-[24px] border border-[#d6e2ff] bg-[#eef3ff] p-5 text-[#102d92] shadow-sm">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#5b6f9d]">Resumen de peso</p>
              <p className="mt-4 text-[2.1rem] font-black leading-none">{resumen.totalKg.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
              <p className="mt-2 text-lg font-semibold text-[#5b6f9d]">kg totales</p>
              <div className="mt-6 border-t border-[#d6e2ff] pt-5">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#5b6f9d]">Total estimado</p>
                <p className="mt-3 text-[1.9rem] font-black leading-none">{formatoMoneda(resumen.totalCompra)}</p>
              </div>
            </article>

            {error ? <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{error}</div> : null}

            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={irPasoAnterior} className="inline-flex min-h-[56px] items-center justify-center rounded-[20px] bg-[#edf1fa] px-5 py-4 text-sm font-black text-slate-500">Atrás</button>
              <button type="button" onClick={irSiguientePaso} className="inline-flex min-h-[56px] items-center justify-center gap-3 rounded-[20px] bg-[#102d92] px-5 py-4 text-sm font-black text-white shadow-[0_18px_40px_rgba(16,45,146,0.2)]">
                Siguiente paso
                <ArrowRight size={18} />
              </button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={irPasoAnterior} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#102d92] shadow-sm" title="Ir al paso anterior">
                <ArrowLeft size={18} />
              </button>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Paso 3 de 3</p>
                <p className="text-[1.05rem] font-semibold text-slate-600">Finalizar registro</p>
              </div>
            </div>

            <article className="rounded-[24px] border border-[#e6e8f3] bg-white p-5 shadow-sm">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Datos del productor</p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Nombre</p>
                  <p className="mt-1 text-[1.45rem] font-black leading-tight text-slate-900">
                    {productorSeleccionado?.nombre ?? 'Sin productor seleccionado'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-500">Cédula / ID</p>
                  <p className="mt-1 text-[1.45rem] font-black leading-tight text-slate-900">
                    {productorSeleccionado?.documento ?? 'Sin documento'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-500">Fecha</p>
                  <div className="mt-2 flex items-center gap-3 rounded-[18px] border border-[#dfe5f2] bg-[#f8f9ff] px-4 py-3">
                    <CalendarDays size={18} className="text-[#102d92]" />
                    <input
                      type="date"
                      value={fecha}
                      max={hoyLocal()}
                      onChange={(event) => setFecha(event.target.value)}
                      className="w-full bg-transparent text-[1rem] font-black text-[#102d92] outline-none"
                      title="Seleccionar fecha de compra"
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">Se registra por defecto con la fecha de hoy, pero puedes corregirla si es una compra anterior.</p>
                </div>
              </div>
            </article>

            <div>
              <p className="px-1 text-sm font-black uppercase tracking-[0.24em] text-slate-400">Carrito de compra</p>
              <div className="mt-4 space-y-3">
                {sublotes.map((sublote) => {
                  const tipoCafe = nombreTipoCafePorId.get(sublote.tipoCafeId) ?? 'Café';
                  const calidad = nombreCalidadPorId.get(sublote.calidadId) ?? 'Calidad';
                  const subtotal = (Number(sublote.pesoInicial) || 0) * (Number(sublote.precioKg) || 0);
                  const visual = iconoTipoCafe(tipoCafe);

                  return (
                    <article key={sublote.id} className="rounded-[22px] border border-[#e6e8f3] bg-white px-4 py-4 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className={`rounded-2xl p-3 ${visual.fondo}`}>{visual.icono}</div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#173ea6]">{tipoCafe}</p>
                            <p className="mt-1 text-[1.2rem] font-black leading-tight text-slate-900">Calidad: {calidad}</p>
                            <p className="mt-2 text-base font-semibold text-slate-700">Peso: {Number(sublote.pesoInicial || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg</p>
                            <p className="mt-1 text-base font-black text-[#173ea6]">Subtotal: {formatoMoneda(subtotal)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => editarSubloteDesdeRevision(sublote.id)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#eef2ff] text-[#102d92]"
                            title="Editar producto"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarSubloteDesdeRevision(sublote.id)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#fff0f2] text-[#e24c5a]"
                            title="Eliminar producto"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <article className="rounded-[24px] border border-[#d9e2f5] bg-white p-5 shadow-sm">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Resumen financiero</p>
              <div className="mt-4 flex items-center justify-between gap-3 text-[1.02rem] font-bold text-slate-700">
                <span>Total kg ({resumen.totalKg.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })})</span>
                <span>{formatoMoneda(resumen.totalCompra)}</span>
              </div>
              <div className="mt-5 rounded-[20px] bg-[#f7f8ff] px-4 py-4">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Total final a recibir</p>
                <p className="mt-2 text-[2rem] font-black text-[#173ea6]">{formatoMoneda(resumen.totalCompra)}</p>
              </div>
            </article>

            {error ? <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{error}</div> : null}
            {warning ? <div className="flex items-start gap-3 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><span>{warning}</span></div> : null}

            <div className="grid gap-3">
              <button type="button" onClick={() => void guardarCompra()} disabled={saving || loading || catalogos.tiposCafe.length === 0 || catalogos.calidades.length === 0} className="inline-flex items-center justify-center gap-3 rounded-[20px] bg-[#102d92] px-5 py-4 text-sm font-black uppercase tracking-[0.03em] text-white shadow-[0_18px_40px_rgba(16,45,146,0.2)] disabled:cursor-not-allowed disabled:opacity-60">
                <Save size={20} />
                {saving ? 'Guardando compra...' : 'Finalizar compra'}
              </button>
              <button type="button" onClick={irPasoAnterior} className="inline-flex items-center justify-center gap-3 rounded-[20px] border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-700">
                <ArrowLeft size={18} />
                Atrás
              </button>
            </div>
          </section>
        ) : null}
      </main>

      {mostrarModalProductor ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/45 px-4 py-8 backdrop-blur-sm">
          <div className="mx-auto mt-12 w-full max-w-[430px] overflow-hidden rounded-[30px] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.2)]">
            <div className="px-6 pb-6 pt-4">
              <div className="mx-auto h-2 w-16 rounded-full bg-[#cfd8e6]" />
              <div className="mt-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[1.7rem] font-black leading-tight text-[#111827]">
                    {editingProductorId ? 'Editar Productor' : 'Registrar Productor'}
                  </h2>
                </div>
                <button type="button" onClick={cerrarModalProductor} className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500" title="Cerrar modal">
                  <X size={24} />
                </button>
              </div>

              <div className="mt-8 space-y-5">
                <div>
                  <label className="mb-2 block text-base font-black text-slate-900">Nombre completo</label>
                  <input type="text" value={productorForm.nombre} onChange={(event) => setProductorForm((actual) => ({ ...actual, nombre: event.target.value }))} placeholder="Ej. Juan Pérez Rodríguez" className="w-full rounded-[20px] border border-[#dde4f1] bg-[#f7f9fd] px-5 py-4 text-base text-slate-900 outline-none focus:border-[#173ea6]" />
                </div>
                <div>
                  <FormattedPhoneInput
                    label="Telefono"
                    optional
                    value={productorForm.telefono}
                    onChange={(telefono) =>
                      setProductorForm((actual) => ({ ...actual, telefono }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-base font-black text-slate-900">Documento o NIT</label>
                  <input type="text" value={productorForm.documento} onChange={(event) => setProductorForm((actual) => ({ ...actual, documento: event.target.value }))} placeholder="1029384756" className="w-full rounded-[20px] border border-[#dde4f1] bg-[#f7f9fd] px-5 py-4 text-base text-slate-900 outline-none focus:border-[#173ea6]" />
                </div>

                {productorFormError ? <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{productorFormError}</div> : null}
              </div>
            </div>

            <div className="border-t border-[#eef2f7] bg-[#fbfcff] px-6 py-5">
              <button type="button" onClick={guardarProductorLocal} className="inline-flex w-full items-center justify-center rounded-[20px] bg-[#102d92] px-5 py-4 text-base font-black text-white">
                {editingProductorId ? 'Guardar cambios' : 'Guardar productor'}
              </button>
              <button type="button" onClick={cerrarModalProductor} className="mt-4 inline-flex w-full items-center justify-center px-5 py-2 text-base font-semibold text-slate-500">
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
