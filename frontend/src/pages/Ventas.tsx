import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  IdCard,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppBottomNav } from '../components/AppBottomNav';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import {
  createGuidedError,
  FloatingGuidedNotice,
  InlineGuidedError,
  type GuidedErrorMessage,
} from '../components/forms/GuidedError';
import { obtenerDeviceId } from '../utils/deviceId';
import {
  actualizarCliente,
  crearCliente,
  listarClientes,
  type ClienteItem,
} from '../services/clientesService';
import { LoteResumen, obtenerDetalleLote, obtenerLotes } from '../services/lotesService';
import { CreateVentaResponse, crearVenta } from '../services/ventasService';

type ModoVenta = 'PARCIAL' | 'TOTAL';
type Step = 1 | 2 | 3;

type ClienteOption = {
  id: string;
  nombre: string;
  documento: string;
  detalle: string;
  telefono?: string;
  rapido?: boolean;
};

type ClienteForm = { nombre: string; telefono: string; documento: string };
type ClienteSelectionMode = 'buscar' | 'general' | null;
type LoteVenta = {
  id: string;
  codigo: string;
  tipoCafeId: string;
  tipoCafe: string;
  calidadId: string;
  calidad: string;
  disponibleKg: number;
  cantidadKg: string;
  precioKg: string;
};
type VentaGuardadaResumen = {
  referenciaId: string;
  clienteNombre: string;
  clienteDocumento: string;
  totalKg: number;
  totalVenta: number;
  items: Array<{
    codigo: string;
    tipoCafe: string;
    calidad: string;
    cantidadKg: number;
    subtotal: number;
  }>;
};

const LIMITE = 6;

const CLIENTE_GENERAL: ClienteOption = {
  id: 'general',
  nombre: 'Cliente General',
  documento: 'Venta rapida',
  detalle: 'Para ventas rapidas o clientes ocasionales no registrados en el sistema.',
  rapido: true,
};

const kg = (v: number) => `${v.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`;
const money = (v: number) => `$${v.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
const toNum = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const displayTipo = (value: string) => value.replace(/^cafe\s+/i, '').trim();

function mkLotes(lotes: LoteResumen[]): LoteVenta[] {
  return lotes
    .filter((l) => l.pesoActual > 0)
    .map((l) => ({
      id: l.id,
      codigo: l.codigo,
      tipoCafeId: l.tipoCafeId,
      tipoCafe: l.tipoCafe,
      calidadId: l.calidadId,
      calidad: l.calidad,
      disponibleKg: l.pesoActual,
      cantidadKg: '',
      precioKg: String(Math.round(l.precioPromedioKg || 0)),
    }));
}

const uid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function mapClienteToOption(cliente: ClienteItem): ClienteOption {
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    documento: cliente.documento?.trim() || 'Documento pendiente',
    detalle: cliente.telefono?.trim() || 'Cliente registrado en sistema',
    telefono: cliente.telefono ?? undefined,
  };
}

function crearResumenVentaGuardada(respuesta: CreateVentaResponse): VentaGuardadaResumen {
  const ventaTotalKg = respuesta.detalles.reduce((total, item) => total + item.pesoVendido, 0);
  return {
    referenciaId: respuesta.venta.id,
    clienteNombre: 'Cliente registrado',
    clienteDocumento: 'Sin detalle',
    totalKg: ventaTotalKg,
    totalVenta: respuesta.detalles.reduce((total, item) => total + item.subtotal, 0),
    items: [],
  };
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function datosPasoVenta(step: Step) {
  if (step === 1) {
    return {
      titulo: 'Identificar cliente',
      progreso: 33,
    };
  }
  if (step === 2) {
    return {
      titulo: 'Seleccionar cafe',
      progreso: 66,
    };
  }
  return {
    titulo: 'Finalizar registro',
    progreso: 100,
  };
}

function getVentasGuidance(message: string): GuidedErrorMessage {
  if (message.includes('nombre del cliente')) {
    return createGuidedError(
      message,
      'Falta identificar al cliente.',
      'Necesitamos su nombre para registrar la venta.',
      'Toca la casilla y escribe su nombre.',
    );
  }

  if (message.includes('Selecciona un cliente')) {
    return createGuidedError(
      message,
      'Falta el cliente.',
      'La venta requiere que indiques el comprador.',
      'Elige un cliente de la lista.',
    );
  }

  if (message.includes('modo de venta')) {
    return createGuidedError(
      message,
      'Falta el modo de venta.',
      'Debemos saber si vendes todo o solo una parte.',
      'Selecciona una de las dos opciones de venta.',
    );
  }

  if (message.includes('precio por kg')) {
    return createGuidedError(
      message,
      'Falta el precio por kilo.',
      'El precio es esencial para calcular el total.',
      'Ingresa el valor por kilo a cobrar.',
    );
  }

  if (message.includes('supera') || message.includes('disponible')) {
    return createGuidedError(
      message,
      'Cantidad no disponible.',
      'No puedes vender más de lo que tienes.',
      'Corrige el kg.',
    );
  }

  if (message.includes('cantidad')) {
    return createGuidedError(
      message,
      'Falta cantidad.',
      'Indica cuantos kg vas a vender.',
      'Escribe los kg.',
    );
  }

  return createGuidedError(
    message,
    'Problema guardando.',
    'Hubo un fallo con los datos o en la conexión.',
    'Revisa los datos e intenta de nuevo.',
  );
}

export default function Ventas() {
  const navigate = useNavigate();
  const [cargando, setCargando] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [guardandoVenta, setGuardandoVenta] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [ventaGuardada, setVentaGuardada] = React.useState<VentaGuardadaResumen | null>(null);
  const [paso, setPaso] = React.useState<Step>(1);
  const [botonConfirmarPresionado, setBotonConfirmarPresionado] = React.useState(false);
  const [intentoPaso1, setIntentoPaso1] = React.useState(false);
  const [intentoPaso2, setIntentoPaso2] = React.useState(false);
  const [modoVenta, setModoVenta] = React.useState<ModoVenta | null>(null);
  const [precioGlobal, setPrecioGlobal] = React.useState('');
  const [partialTipoCafeId, setPartialTipoCafeId] = React.useState('');
  const [partialCalidadId, setPartialCalidadId] = React.useState('');
  const [partialCantidadKg, setPartialCantidadKg] = React.useState('');
  const [partialPrecioKg, setPartialPrecioKg] = React.useState('');
  const [partialSearchTouched, setPartialSearchTouched] = React.useState(false);
  const [lotesVenta, setLotesVenta] = React.useState<LoteVenta[]>([]);
  const [clientes, setClientes] = React.useState<ClienteOption[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = React.useState<ClienteOption | null>(null);
  const [clienteSelectionMode, setClienteSelectionMode] = React.useState<ClienteSelectionMode>(null);
  const [busquedaCliente, setBusquedaCliente] = React.useState('');
  const [busquedaAplicada, setBusquedaAplicada] = React.useState('');
  const [mostrarModal, setMostrarModal] = React.useState(false);
  const [clienteEditandoId, setClienteEditandoId] = React.useState<string | null>(null);
  const [mostrarConfirmarVenta, setMostrarConfirmarVenta] = React.useState(false);
  const [mostrarCancelarVenta, setMostrarCancelarVenta] = React.useState(false);
  const [clienteForm, setClienteForm] = React.useState<ClienteForm>({ nombre: '', telefono: '', documento: '' });
  const [clienteFormError, setClienteFormError] = React.useState<string | null>(null);
  const [floatingError, setFloatingError] = React.useState<GuidedErrorMessage | null>(null);
  const ventaLocalIdRef = React.useRef(uid());

  const cargarLotes = React.useCallback(async () => {
    try {
      setCargando(true);
      setLoadError(null);
      const [lotes, clientesData] = await Promise.all([
        obtenerLotes(),
        listarClientes(),
      ]);
      setLotesVenta(mkLotes(lotes));
      setClientes(clientesData.map(mapClienteToOption));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'No fue posible cargar el inventario para venta.');
    } finally {
      setCargando(false);
    }
  }, []);

  React.useEffect(() => {
    void cargarLotes();
  }, [cargarLotes]);

  React.useEffect(() => {
    if (partialTipoCafeId && lotesVenta.some((lote) => lote.tipoCafeId === partialTipoCafeId && lote.disponibleKg > 0)) {
      return;
    }

    const first = lotesVenta.find((lote) => lote.disponibleKg > 0);
    setPartialTipoCafeId(first?.tipoCafeId ?? '');
    setPartialCalidadId(first?.calidadId ?? '');
  }, [lotesVenta, partialTipoCafeId]);

  React.useEffect(() => {
    if (!partialTipoCafeId) {
      setPartialCalidadId('');
      return;
    }

    const hasQuality = lotesVenta.some(
      (lote) =>
        lote.tipoCafeId === partialTipoCafeId &&
        lote.calidadId === partialCalidadId &&
        lote.disponibleKg > 0,
    );
    if (hasQuality) return;

    const first = lotesVenta.find((lote) => lote.tipoCafeId === partialTipoCafeId && lote.disponibleKg > 0);
    setPartialCalidadId(first?.calidadId ?? '');
  }, [lotesVenta, partialCalidadId, partialTipoCafeId]);

  const clientesRecientes = React.useMemo(() => {
    const base = [...clientes];
    const term = norm(busquedaAplicada.trim());
    if (!term) return base.slice(0, LIMITE);
    return base.filter((c) => [c.nombre, c.documento, c.detalle].some((v) => norm(v).includes(term)));
  }, [busquedaAplicada, clientes]);

  const tiposCafeDisponibles = React.useMemo(() => {
    const map = new Map<string, string>();
    lotesVenta.forEach((lote) => {
      if (lote.disponibleKg > 0 && !map.has(lote.tipoCafeId)) {
        map.set(lote.tipoCafeId, displayTipo(lote.tipoCafe));
      }
    });
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [lotesVenta]);

  const calidadesDisponibles = React.useMemo(() => {
    const map = new Map<string, string>();
    lotesVenta
      .filter((lote) => lote.disponibleKg > 0 && (!partialTipoCafeId || lote.tipoCafeId === partialTipoCafeId))
      .forEach((lote) => {
        if (!map.has(lote.calidadId)) {
          map.set(lote.calidadId, lote.calidad);
        }
      });
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [lotesVenta, partialTipoCafeId]);

  const loteParcialActivo = React.useMemo(() => {
    if (!partialTipoCafeId || !partialCalidadId) return null;
    return (
      lotesVenta.find(
        (lote) =>
          lote.tipoCafeId === partialTipoCafeId &&
          lote.calidadId === partialCalidadId &&
          lote.disponibleKg > 0,
      ) ?? null
    );
  }, [lotesVenta, partialCalidadId, partialTipoCafeId]);

  const resumenTotalPorTipo = React.useMemo(() => {
    const map = new Map<string, { nombre: string; kg: number }>();
    lotesVenta
      .filter((lote) => lote.disponibleKg > 0)
      .forEach((lote) => {
        const key = lote.tipoCafeId;
        const current = map.get(key) ?? { nombre: displayTipo(lote.tipoCafe), kg: 0 };
        current.kg += lote.disponibleKg;
        map.set(key, current);
      });
    return Array.from(map.values());
  }, [lotesVenta]);

  const lotesConCantidad = React.useMemo(() => {
    if (modoVenta === 'TOTAL') {
      return lotesVenta.filter((l) => l.disponibleKg > 0).map((l) => ({ ...l, cantidad: l.disponibleKg, precio: toNum(precioGlobal) }));
    }
    if (modoVenta !== 'PARCIAL') {
      return [];
    }
    return lotesVenta
      .map((l) => ({ ...l, cantidad: toNum(l.cantidadKg), precio: toNum(l.precioKg) }))
      .filter((l) => l.cantidad > 0);
  }, [lotesVenta, modoVenta, precioGlobal]);

  const totalKg = React.useMemo(() => lotesConCantidad.reduce((a, l) => a + l.cantidad, 0), [lotesConCantidad]);
  const totalEstimado = React.useMemo(() => lotesConCantidad.reduce((a, l) => a + l.cantidad * l.precio, 0), [lotesConCantidad]);

  const validarPasoVenta = React.useCallback(() => {
    if (!lotesVenta.length) return 'No hay lotes disponibles para vender.';
    if (!modoVenta) return 'Selecciona como deseas realizar la venta.';
    if (modoVenta === 'TOTAL') {
      if (toNum(precioGlobal) <= 0) return 'Ingresa un precio por kg valido para venta total.';
      return null;
    }
    if (!lotesConCantidad.length) return 'Ingresa al menos una cantidad para continuar.';
    for (const l of lotesConCantidad) {
      if (l.cantidad > l.disponibleKg) return `La cantidad supera el disponible en ${l.codigo}.`;
      if (l.precio <= 0) return `Ingresa un precio por kg valido en ${l.codigo}.`;
    }
    return null;
  }, [lotesVenta.length, modoVenta, precioGlobal, lotesConCantidad]);

  const hayCantidadParcial = React.useMemo(
    () => lotesVenta.some((l) => toNum(l.cantidadKg) > 0),
    [lotesVenta],
  );
  const parcialConErrores = React.useMemo(() => {
    if (modoVenta !== 'PARCIAL') return false;
    return lotesVenta.some((lote) => {
      const cantidadIngresada = lote.cantidadKg.trim() !== '';
      if (!cantidadIngresada) return false;
      const cantidad = toNum(lote.cantidadKg);
      return cantidad <= 0 || cantidad > lote.disponibleKg || toNum(lote.precioKg) <= 0;
    });
  }, [lotesVenta, modoVenta]);
  const puedeAvanzarPaso2 =
    modoVenta === null
      ? false
      : modoVenta === 'TOTAL'
        ? lotesVenta.some((lote) => lote.disponibleKg > 0)
        : hayCantidadParcial && !parcialConErrores;

  const siguiente = React.useCallback(() => {
    if (paso === 1) {
      setIntentoPaso1(true);
      if (!clienteSeleccionado) return;
      setSubmitError(null);
      setIntentoPaso2(false);
      return setPaso(2);
    }
    if (paso === 2) {
      setIntentoPaso2(true);
      if (!puedeAvanzarPaso2) return;
      setSubmitError(null);
      return setPaso(3);
    }
  }, [paso, clienteSeleccionado, puedeAvanzarPaso2]);

  const anterior = React.useCallback(() => {
    setSubmitError(null);
    setPaso((p) => Math.max(1, p - 1) as Step);
  }, []);

  const editarLoteDesdeRevision = React.useCallback(() => {
    setSubmitError(null);
    setIntentoPaso2(false);
    setPaso(2);
  }, []);

  const eliminarLoteDesdeRevision = React.useCallback((loteId: string) => {
    setSubmitError(null);
    setIntentoPaso2(false);
    setPaso(2);

    setLotesVenta((prev) =>
      prev.map((lote) => {
        if (modoVenta === 'TOTAL') {
          return {
            ...lote,
            cantidadKg: lote.id === loteId ? '' : String(lote.disponibleKg),
            precioKg: precioGlobal || lote.precioKg,
          };
        }

        if (lote.id !== loteId) {
          return lote;
        }

        return {
          ...lote,
          cantidadKg: '',
        };
      }),
    );

    if (modoVenta === 'TOTAL') {
      setModoVenta('PARCIAL');
      setPrecioGlobal('');
    }
  }, [modoVenta, precioGlobal]);

  const confirmar = React.useCallback(async () => {
    if (!clienteSeleccionado) {
      setPaso(1);
      setIntentoPaso1(true);
      return;
    }
    const m = validarPasoVenta();
    if (m) {
      setPaso(2);
      setIntentoPaso2(true);
      return;
    }
    if (guardandoVenta) return;

    setMostrarConfirmarVenta(false);
    setGuardandoVenta(true);
    setBotonConfirmarPresionado(true);
    setSubmitError(null);

    try {
      type PoolEntry = {
        subloteId: string;
        disponibleKg: number;
      };

      const pools = new Map<string, PoolEntry[]>();
      const detalles = [] as Array<{ subloteId: string; pesoVendido: number; precioKg: number }>;

      for (const lote of lotesConCantidad) {
        const poolKey = `${lote.tipoCafeId}::${lote.calidadId}`;

        if (!pools.has(poolKey)) {
          const detalle = await obtenerDetalleLote(lote.tipoCafeId, lote.calidadId);
          const pool = detalle.sublotes
            .filter((sublote) => sublote.pesoActual > 0)
            .sort((a, b) => new Date(a.fechaIngreso).getTime() - new Date(b.fechaIngreso).getTime())
            .map((sublote) => ({
              subloteId: sublote.id,
              disponibleKg: round2(sublote.pesoActual),
            }));

          pools.set(poolKey, pool);
        }

        const pool = pools.get(poolKey) ?? [];
        let restante = round2(lote.cantidad);

        for (const entry of pool) {
          if (restante <= 0) break;
          if (entry.disponibleKg <= 0) continue;

          const asignado = round2(Math.min(restante, entry.disponibleKg));
          if (asignado <= 0) continue;

          detalles.push({
            subloteId: entry.subloteId,
            pesoVendido: asignado,
            precioKg: round2(lote.precio),
          });

          entry.disponibleKg = round2(entry.disponibleKg - asignado);
          restante = round2(restante - asignado);
        }

        if (restante > 0.001) {
          throw new Error(`La cantidad supera el disponible en ${lote.codigo}.`);
        }
      }

      const respuesta = await crearVenta({
        ...(!clienteSeleccionado.rapido ? { clienteId: clienteSeleccionado.id } : {}),
        deviceId: await obtenerDeviceId(),
        localId: ventaLocalIdRef.current,
        detalles,
      });

      setVentaGuardada({
        ...crearResumenVentaGuardada(respuesta),
        clienteNombre: clienteSeleccionado.nombre,
        clienteDocumento: clienteSeleccionado.documento,
        totalKg,
        totalVenta: totalEstimado,
        items: lotesConCantidad.map((item) => ({
          codigo: item.codigo,
          tipoCafe: item.tipoCafe,
          calidad: item.calidad,
          cantidadKg: item.cantidad,
          subtotal: item.cantidad * item.precio,
        })),
      });
      await cargarLotes();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No fue posible registrar la venta.');
    } finally {
      setGuardandoVenta(false);
      setBotonConfirmarPresionado(false);
    }
  }, [
    cargarLotes,
    clienteSeleccionado,
    guardandoVenta,
    lotesConCantidad,
    totalEstimado,
    totalKg,
    validarPasoVenta,
  ]);

  const reiniciar = React.useCallback(() => {
    setPaso(1);
    setGuardandoVenta(false);
    setSubmitError(null);
    setVentaGuardada(null);
    setClienteSeleccionado(null);
    setClienteSelectionMode(null);
    setBusquedaCliente('');
    setBusquedaAplicada('');
    setModoVenta(null);
    setPrecioGlobal('');
    setPartialTipoCafeId('');
    setPartialCalidadId('');
    setPartialCantidadKg('');
    setPartialPrecioKg('');
    setPartialSearchTouched(false);
    setIntentoPaso1(false);
    setIntentoPaso2(false);
    setLoadError(null);
    ventaLocalIdRef.current = uid();
    void cargarLotes();
  }, [cargarLotes]);

  const cancelarVenta = React.useCallback(() => {
    setMostrarCancelarVenta(false);
    reiniciar();
  }, [reiniciar]);

  const updateLote = (id: string, campo: 'cantidadKg' | 'precioKg', valor: string) =>
    setLotesVenta((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));

  const buscarCafeParcial = React.useCallback(() => {
    setPartialSearchTouched(true);
    setSubmitError(null);

    if (!loteParcialActivo) {
      setSubmitError('No hay cafe disponible con esa seleccion.');
      return;
    }

    const cantidad = toNum(partialCantidadKg);
    const precio = toNum(partialPrecioKg || loteParcialActivo.precioKg);
    if (cantidad <= 0) {
      setSubmitError('Ingresa al menos una cantidad para continuar.');
      return;
    }
    if (cantidad > loteParcialActivo.disponibleKg) {
      setSubmitError(`La cantidad supera el disponible en ${loteParcialActivo.codigo}.`);
      return;
    }
    if (precio <= 0) {
      setSubmitError(`Ingresa un precio por kg valido en ${loteParcialActivo.codigo}.`);
      return;
    }

    setLotesVenta((prev) =>
      prev.map((lote) =>
        lote.id === loteParcialActivo.id
          ? { ...lote, cantidadKg: String(round2(cantidad)), precioKg: String(round2(precio)) }
          : lote,
      ),
    );
  }, [loteParcialActivo, partialCantidadKg, partialPrecioKg]);

  const seleccionarCliente = React.useCallback((cliente: ClienteOption) => {
    setClienteSeleccionado(cliente);
    setClienteSelectionMode(cliente.rapido ? 'general' : null);
    setIntentoPaso1(false);
    setSubmitError(null);
  }, []);

  const seleccionarBusquedaCliente = React.useCallback(() => {
    setClienteSelectionMode('buscar');
    if (clienteSeleccionado?.id === CLIENTE_GENERAL.id) {
      setClienteSeleccionado(null);
    }
    setIntentoPaso1(false);
    setSubmitError(null);
  }, [clienteSeleccionado]);

  const buscarCliente = () => {
    setClienteSelectionMode('buscar');
    setBusquedaAplicada(busquedaCliente.trim());
  };

  const abrirEditarCliente = React.useCallback((cliente: ClienteOption) => {
    if (cliente.rapido) return;
    setClienteEditandoId(cliente.id);
    setClienteForm({
      nombre: cliente.nombre,
      telefono: cliente.telefono ?? '',
      documento: cliente.documento === 'Documento pendiente' ? '' : cliente.documento,
    });
    setClienteFormError(null);
    setFloatingError(null);
    setMostrarModal(true);
  }, []);

  const cerrarModalCliente = React.useCallback(() => {
    setMostrarModal(false);
    setClienteEditandoId(null);
    setClienteForm({ nombre: '', telefono: '', documento: '' });
    setClienteFormError(null);
    setFloatingError(null);
  }, []);

  const pasoActual = React.useMemo(() => datosPasoVenta(paso), [paso]);
  const clienteSeleccionadoId = clienteSeleccionado?.id ?? null;
  const clienteInvalido = paso === 1 && intentoPaso1 && !clienteSeleccionado;
  const modoInvalido = paso === 2 && intentoPaso2 && !modoVenta;
  const precioTotalInvalido =
    paso === 3 &&
    modoVenta === 'TOTAL' &&
    (submitError?.includes('precio por kg') || precioGlobal.trim() !== '') &&
    toNum(precioGlobal) <= 0;
  const parcialSinSeleccion = paso === 2 && modoVenta === 'PARCIAL' && !hayCantidadParcial;

  const volverPasoAnterior = () => {
    if (paso > 1) {
      anterior();
      return;
    }

    navigate(-1);
  };

  React.useEffect(() => {
    if (clienteFormError) {
      setFloatingError(getVentasGuidance(clienteFormError));
      return;
    }

    if (clienteInvalido) {
      setFloatingError(getVentasGuidance('Selecciona un cliente para continuar.'));
      return;
    }

    if (submitError) {
      setFloatingError(getVentasGuidance(submitError));
      return;
    }

    if (modoInvalido) {
      setFloatingError(getVentasGuidance('Selecciona como deseas realizar la venta.'));
      return;
    }

    if (precioTotalInvalido) {
      setFloatingError(getVentasGuidance('Ingresa un precio por kg valido para venta total.'));
      return;
    }

    if (parcialSinSeleccion) {
      setFloatingError(
        getVentasGuidance('Ingresa una cantidad en al menos un lote para continuar.'),
      );
      return;
    }

    setFloatingError(null);
  }, [
    clienteFormError,
    clienteInvalido,
    modoInvalido,
    parcialSinSeleccion,
    precioTotalInvalido,
    submitError,
  ]);

  const guardarCliente = async () => {
    const nombre = clienteForm.nombre.trim();
    const telefono = clienteForm.telefono.trim();
    const documento = clienteForm.documento.trim();
    if (!nombre) return setClienteFormError('Escribe al menos el nombre del cliente.');

    try {
      const clienteGuardado = clienteEditandoId
        ? await actualizarCliente(clienteEditandoId, {
            nombre,
            documento: documento || undefined,
            telefono: telefono || undefined,
          })
        : await crearCliente({
            nombre,
            documento: documento || undefined,
            telefono: telefono || undefined,
          });
      const nuevo = mapClienteToOption(clienteGuardado);
      setClientes((actual) => [nuevo, ...actual.filter((cliente) => cliente.id !== nuevo.id)]);
      setClienteSeleccionado(nuevo);
      setClienteSelectionMode(null);
      setIntentoPaso1(false);
      setBusquedaCliente(nombre);
      setBusquedaAplicada(nombre);
      setMostrarModal(false);
      setClienteEditandoId(null);
      setClienteFormError(null);
      setSubmitError(null);
    } catch (error) {
      setClienteFormError(
        error instanceof Error ? error.message : 'No fue posible registrar el cliente.',
      );
    }
  };

  if (ventaGuardada) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] px-4 py-6 pb-10 text-slate-900">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[340px] items-center">
          <section className="w-full bg-white px-5 py-7 text-center shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e2e8f0]">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#20c997] text-white">
                <CheckCircle2 size={24} strokeWidth={3} />
              </div>
            </div>
            <h2 className="mt-8 text-[1.45rem] font-black text-[#1f2432]">Venta registrada</h2>
            <p className="mt-2 text-[0.9rem] font-medium text-slate-500">La venta se guardo correctamente.</p>

            <div className="mt-7 rounded-[10px] bg-white p-4 text-left shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.08em] text-slate-500">Resumen de venta</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[0.8rem] text-slate-600">Cliente</span>
                  <span className="truncate text-[0.82rem] font-semibold text-slate-900">{ventaGuardada.clienteNombre}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[0.8rem] text-slate-600">Total kg</span>
                  <span className="text-[0.82rem] font-semibold text-slate-900">{kg(ventaGuardada.totalKg)}</span>
                </div>
                <div className="mt-5 flex items-center justify-between rounded-[8px] bg-[#f5f7fb] px-3 py-4">
                  <span className="text-[0.7rem] font-black uppercase text-slate-700">Total recibido</span>
                  <span className="text-[1.1rem] font-black text-[#0b42c8]">{money(ventaGuardada.totalVenta)}</span>
                </div>
              </div>
            </div>

            <div className="mt-12 grid gap-3">
              <button type="button" onClick={reiniciar} className="min-h-[52px] rounded-[8px] bg-[#1f3fa7] px-4 text-[0.9rem] font-black text-white">Registrar nueva venta</button>
              <button type="button" onClick={() => navigate('/inventario')} className="min-h-[52px] rounded-[8px] bg-[#e5e7eb] px-4 text-[0.9rem] font-black text-[#1f3fa7]">Ir a inventario</button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] px-4 py-4 pb-[92px] text-slate-900">
      <div className="mx-auto max-w-[340px] space-y-0 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <header className="px-4 pb-3 pt-4">
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              onClick={volverPasoAnterior}
              className="absolute left-0 text-[#1f56dd] transition hover:opacity-75"
            >
              <ArrowLeft size={15} />
            </button>
            <h1 className="text-[0.78rem] font-black text-slate-950">
              {paso === 3 ? 'Resumen de venta' : 'Registro de Venta'}
            </h1>
          </div>

          <div className="mt-7">
            <div className="flex items-center justify-between text-[0.55rem] font-black uppercase tracking-[0.04em] text-[#6b7a99]">
              <span>Paso {paso}: {pasoActual.titulo}</span>
              <span className="text-[#002f6c]">{paso} de 3</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#d0dbeb]">
              <div
                className="h-full rounded-full bg-[#04337b] transition-all duration-300"
                style={{ width: `${pasoActual.progreso}%` }}
              />
            </div>
          </div>
        </header>
        {cargando ? (
          <CardMsg text="Cargando lotes para venta..." />
        ) : loadError ? (
          <section className="rounded-[22px] border border-[#ffd5d5] bg-[#fff6f6] p-4 shadow-sm">
            <p className="text-sm font-semibold text-[#a22424]">No se pudo cargar inventario de venta.</p>
            <p className="mt-1 text-sm text-[#8c3838]">{loadError}</p>
            <button
              type="button"
              onClick={() => void cargarLotes()}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#f4a7a7] bg-white px-3 py-2 text-xs font-semibold text-[#a22424]"
            >
              <RefreshCw size={14} />
              Reintentar
            </button>
          </section>
        ) : (
          <>
            {paso === 2 ? (
              <section className="px-4 pb-5 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModoVenta('PARCIAL')}
                    className={`min-h-[58px] rounded-[8px] border px-3 py-2 text-left ${
                      modoVenta === 'PARCIAL'
                        ? 'border-[#102d92] bg-[#eef2ff]'
                        : modoInvalido
                          ? 'border-[#f2c17b] bg-[#fff9ef]'
                        : 'border-[#e3e7f3] bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#e8eefc] text-[#102d92]">
                        <Pencil size={13} />
                      </span>
                      <span>
                        <p className="text-[0.68rem] font-black text-[#102d92]">Venta parcial</p>
                        <p className="mt-1 text-[0.52rem] font-semibold text-slate-500">Seleccionar cantidad a vender</p>
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModoVenta('TOTAL')}
                    className={`min-h-[58px] rounded-[8px] border px-3 py-2 text-left ${
                      modoVenta === 'TOTAL'
                        ? 'border-[#102d92] bg-[#eef2ff]'
                        : modoInvalido
                          ? 'border-[#f2c17b] bg-[#fff9ef]'
                        : 'border-[#e3e7f3] bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#e8eefc] text-[#102d92]">
                        <CheckCircle2 size={13} />
                      </span>
                      <span>
                        <p className="text-[0.68rem] font-black text-slate-900">Venta total</p>
                        <p className="mt-1 text-[0.52rem] font-semibold text-slate-500">Vender todo el inventario disponible</p>
                      </span>
                    </div>
                  </button>
                </div>
                {modoInvalido ? (
                  <InlineGuidedError
                    message={getVentasGuidance('Selecciona como deseas realizar la venta.')}
                    className="mt-2"
                  />
                ) : null}

                {modoVenta === 'TOTAL' ? (
                  <div className="mt-5 text-center">
                    <h2 className="text-[0.9rem] font-black leading-tight text-slate-900">
                      Se vendera todo el cafe disponible en inventario
                    </h2>
                    <p className="mt-1 text-[0.58rem] font-semibold text-slate-500">
                      Incluye todos los tipos y calidades disponibles
                    </p>

                    <article className="mt-5 rounded-[10px] border border-[#e6ebf5] bg-white p-4 text-left">
                      <p className="text-[0.56rem] font-black uppercase tracking-[0.08em] text-slate-500">Resumen por tipo</p>
                      <div className="mt-3 space-y-3">
                        {resumenTotalPorTipo.map((item) => (
                          <div key={item.nombre} className="flex items-center justify-between text-[0.66rem] font-semibold text-slate-700">
                            <span>Cafe {item.nombre}</span>
                            <span className="font-black text-slate-900">{kg(item.kg)}</span>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="mt-3 flex items-center justify-between rounded-[8px] border border-[#e6ebf5] bg-[#fbfcff] px-4 py-3 text-left">
                      <span className="text-[0.66rem] font-semibold text-slate-700">Total a vender</span>
                      <span className="text-[1rem] font-black text-slate-900">{kg(totalKg)}</span>
                    </article>
                  </div>
                ) : null}

                {modoVenta === 'PARCIAL' ? (
                  <div className="mt-4 rounded-[10px] border border-[#e6ebf5] bg-white p-3">
                    <p className="text-[0.56rem] font-black uppercase tracking-[0.08em] text-slate-500">Tipo de cafe</p>
                    <select
                      value={partialTipoCafeId}
                      onChange={(event) => {
                        setPartialTipoCafeId(event.target.value);
                        setPartialSearchTouched(false);
                      }}
                      className="mt-2 min-h-[42px] w-full rounded-[8px] border-0 bg-[#f4f7fb] px-3 text-[0.68rem] font-semibold text-slate-700 outline-none"
                    >
                      {tiposCafeDisponibles.map((tipo) => (
                        <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>
                      ))}
                    </select>

                    <p className="mt-3 text-[0.56rem] font-black uppercase tracking-[0.08em] text-slate-500">Calidad</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {calidadesDisponibles.map((calidad) => (
                        <button
                          key={calidad.id}
                          type="button"
                          onClick={() => {
                            setPartialCalidadId(calidad.id);
                            setPartialSearchTouched(false);
                          }}
                          className={`min-h-[34px] rounded-[8px] border px-2 text-[0.6rem] font-black ${
                            partialCalidadId === calidad.id
                              ? 'border-[#102d92] bg-[#f4f7ff] text-[#102d92]'
                              : 'border-[#e5e9f2] bg-white text-slate-600'
                          }`}
                        >
                          {calidad.nombre}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label>
                        <p className="text-[0.56rem] font-black uppercase tracking-[0.08em] text-slate-500">Kg a vender</p>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={loteParcialActivo?.disponibleKg ?? undefined}
                          value={partialCantidadKg}
                          onChange={(event) => {
                            setPartialCantidadKg(event.target.value);
                            setPartialSearchTouched(false);
                          }}
                          placeholder="ej. 25"
                          className="mt-2 min-h-[42px] w-full rounded-[8px] border-0 bg-[#f4f7fb] px-3 text-[0.68rem] font-semibold text-slate-900 outline-none"
                        />
                      </label>
                      <label>
                        <p className="text-[0.56rem] font-black uppercase tracking-[0.08em] text-slate-500">Precio/kg</p>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={partialPrecioKg}
                          onChange={(event) => setPartialPrecioKg(event.target.value)}
                          placeholder={loteParcialActivo?.precioKg || '0'}
                          className="mt-2 min-h-[42px] w-full rounded-[8px] border-0 bg-[#f4f7fb] px-3 text-[0.68rem] font-semibold text-slate-900 outline-none"
                        />
                      </label>
                    </div>

                    {loteParcialActivo ? (
                      <p className="mt-2 text-[0.58rem] font-semibold text-slate-500">
                        Disponible: <span className="text-[#102d92]">{kg(loteParcialActivo.disponibleKg)}</span>
                      </p>
                    ) : null}

                    <button
                      type="button"
                      onClick={buscarCafeParcial}
                      className="mt-3 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#1f3fa7] px-4 text-[0.68rem] font-black text-white shadow-[0_12px_26px_rgba(16,45,146,0.22)]"
                    >
                      <Search size={13} />
                      Buscar cafe disponible
                    </button>

                    {partialSearchTouched && loteParcialActivo ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-[0.56rem] font-black uppercase tracking-[0.08em] text-slate-500">Cafe disponible para esta venta</p>
                        <article className="flex items-center justify-between rounded-[8px] border border-[#e6ebf5] bg-[#fbfcff] p-3">
                          <div>
                            <p className="text-[0.68rem] font-black text-slate-900">{loteParcialActivo.codigo}</p>
                            <p className="mt-0.5 text-[0.54rem] font-semibold text-slate-500">
                              {displayTipo(loteParcialActivo.tipoCafe)} - {loteParcialActivo.calidad}
                            </p>
                          </div>
                          <p className="text-[0.68rem] font-black text-[#102d92]">{kg(loteParcialActivo.disponibleKg)}</p>
                        </article>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {modoVenta === 'PARCIAL' && lotesConCantidad.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-[0.56rem] font-black uppercase tracking-[0.08em] text-slate-500">Seleccionado</p>
                    {lotesConCantidad.map((lote) => (
                      <article key={lote.id} className="flex items-center justify-between rounded-[8px] border border-[#e5e8f3] bg-[#fcfcff] p-3">
                        <div>
                          <p className="text-[0.68rem] font-black text-slate-900">{lote.codigo}</p>
                          <p className="text-[0.56rem] font-semibold text-slate-500">{kg(lote.cantidad)} seleccionados</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateLote(lote.id, 'cantidadKg', '')}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f1f5f9] text-slate-400"
                          aria-label="Quitar cafe"
                        >
                          <X size={13} />
                        </button>
                      </article>
                    ))}
                  </div>
                ) : null}

                {parcialSinSeleccion ? (
                  <InlineGuidedError
                    message={getVentasGuidance('Ingresa una cantidad en al menos un lote para continuar.')}
                    className="mt-2"
                  />
                ) : null}

                <article className="mt-4 rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] p-3 text-[#102d92]">
                  <div className="flex items-center justify-between text-[0.62rem] font-black">
                    <span>Total seleccionado</span>
                    <span>{kg(totalKg)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[0.88rem] font-black">
                    <span>Total estimado</span>
                    <span>{money(totalEstimado)}</span>
                  </div>
                </article>

                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={siguiente}
                    disabled={!puedeAvanzarPaso2}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#1f3fa7] px-4 py-3 text-[0.68rem] font-black text-white shadow-[0_12px_28px_rgba(16,45,146,0.22)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente Paso
                    <ArrowRight size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={anterior}
                    className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[8px] bg-white px-4 py-2 text-[0.62rem] font-semibold text-slate-500"
                  >
                    <ArrowLeft size={12} />
                    Regresar
                  </button>
                </div>
              </section>
            ) : null}

            {paso === 1 ? (
              <section className="flex flex-col gap-3 px-4 pb-5 pt-2">
                <button
                  type="button"
                  onClick={seleccionarBusquedaCliente}
                  className={`w-full rounded-[8px] border px-3 py-3 text-left transition ${
                    clienteSelectionMode === 'buscar'
                      ? 'border-[#1f3fa7] bg-[#f4f7ff] shadow-[0_8px_18px_rgba(31,63,167,0.08)]'
                      : 'border-[#e3e7f3] bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        clienteSelectionMode === 'buscar'
                          ? 'bg-[#1f3fa7] text-white'
                          : 'bg-[#eef2f7] text-slate-500'
                      }`}
                    >
                      <Search size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.72rem] font-black leading-tight text-slate-900">Buscar cliente</p>
                      <p className="mt-0.5 text-[0.58rem] text-slate-500">Selecciona un cliente registrado</p>
                    </div>
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                        clienteSelectionMode === 'buscar'
                          ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white'
                          : 'border-[#cad2e2] bg-white text-transparent'
                      }`}
                    >
                      <Check size={11} />
                    </span>
                  </div>
                </button>

                {clienteSelectionMode === 'buscar' ? (
                  <div className="space-y-2 rounded-[8px] border border-[#e4e9f5] bg-white p-2.5">
                    <div className="flex items-center gap-2">
                      <label className="flex min-h-[34px] flex-1 items-center gap-2 rounded-full border border-[#d7dcec] bg-[#f8faff] px-3">
                        <Search size={12} className="text-slate-400" />
                        <input
                          type="text"
                          value={busquedaCliente}
                          onChange={(event) => setBusquedaCliente(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              buscarCliente();
                            }
                          }}
                          placeholder="Nombre o documento..."
                          className="w-full bg-transparent text-[0.62rem] font-semibold text-slate-900 outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={buscarCliente}
                        aria-label="Buscar cliente"
                        className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[#d7dcec] bg-white text-[#102d92]"
                      >
                        <Search size={12} />
                      </button>
                    </div>

                    <div className="max-h-[180px] space-y-2 overflow-y-auto pr-1">
                      {clientesRecientes.length === 0 ? (
                        <div className="rounded-[8px] border border-dashed border-[#d5dced] bg-[#fbfcff] px-3 py-3 text-center text-[0.68rem] font-semibold text-slate-600">
                          {busquedaAplicada
                            ? `Sin resultados para "${busquedaAplicada}". Verifica o registra el cliente.`
                            : 'Aun no hay clientes registrados.'}
                        </div>
                      ) : (
                        clientesRecientes.map((cliente) => {
                          const selected = clienteSeleccionadoId === cliente.id;
                          return (
                            <div
                              key={cliente.id}
                              className={`flex w-full items-start justify-between gap-2 rounded-[8px] border px-3 py-2.5 text-left transition ${
                                selected
                                  ? 'border-[#1f3fa7] bg-[#f4f7ff]'
                                  : 'border-[#e6ebf5] bg-white hover:border-[#ccd6ea]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => seleccionarCliente(cliente)}
                                className="flex min-w-0 flex-1 items-start gap-3 text-left"
                              >
                                <span className="rounded-xl bg-[#e8eefc] p-2 text-[#102d92]">
                                  <User size={15} />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-[0.68rem] font-black text-slate-900">{cliente.nombre}</p>
                                  <p className="mt-0.5 truncate text-[0.56rem] text-slate-600">{cliente.documento}</p>
                                  <p className="mt-0.5 truncate text-[0.56rem] text-slate-500">{cliente.detalle}</p>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => abrirEditarCliente(cliente)}
                                aria-label={`Editar cliente ${cliente.nombre}`}
                                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f3f6fb] text-[#1f3fa7]"
                              >
                                <Pencil size={12} strokeWidth={2.3} />
                              </button>
                              <button
                                type="button"
                                onClick={() => seleccionarCliente(cliente)}
                                aria-label={`Seleccionar cliente ${cliente.nombre}`}
                                className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                  selected
                                    ? 'border-[#1f3fa7] bg-[#1f3fa7] text-white'
                                    : 'border-[#cad2e2] bg-white text-transparent'
                                }`}
                              >
                                <Check size={12} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => seleccionarCliente(CLIENTE_GENERAL)}
                  className={`w-full rounded-[8px] border px-3 py-3 text-left transition ${
                    clienteSelectionMode === 'general'
                      ? 'border-[#1f3fa7] bg-[#f4f7ff] shadow-[0_8px_18px_rgba(31,63,167,0.08)]'
                      : 'border-[#e3e7f3] bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        clienteSelectionMode === 'general'
                          ? 'bg-[#1f3fa7] text-white'
                          : 'bg-[#eef2f7] text-slate-500'
                      }`}
                    >
                      <User size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.72rem] font-black leading-tight text-slate-900">Cliente generico</p>
                      <p className="mt-0.5 text-[0.58rem] text-slate-500">Venta rapida sin cliente registrado</p>
                    </div>
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                        clienteSelectionMode === 'general'
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
                  onClick={() => {
                    setClienteEditandoId(null);
                    setClienteForm({ nombre: '', telefono: '', documento: '' });
                    setClienteFormError(null);
                    setFloatingError(null);
                    setMostrarModal(true);
                  }}
                  className="w-full rounded-[8px] border border-[#e3e7f3] bg-white px-3 py-3 text-left transition hover:border-[#ccd6ea]"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef2f7] text-slate-600">
                      <Plus size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.72rem] font-black leading-tight text-slate-900">Registrar cliente</p>
                      <p className="mt-0.5 text-[0.58rem] text-slate-500">Crear un nuevo cliente</p>
                    </div>
                  </div>
                </button>

                <article className="mt-2 border-t border-[#e7ebf4] pt-4">
                  <p className="text-[0.52rem] font-black uppercase tracking-[0.08em] text-slate-500">
                    Cliente seleccionado
                  </p>
                  {clienteSeleccionado ? (
                    <div className="mt-3 flex items-center gap-3 rounded-[8px] border border-[#e4e9f5] bg-[#f7f8fb] px-3 py-2.5">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1f3fa7] text-white">
                        <User size={13} />
                      </span>
                      <div>
                        <p className="text-[0.68rem] font-black text-slate-900">{clienteSeleccionado.nombre}</p>
                        <p className="text-[0.58rem] text-slate-500">
                          {clienteSeleccionado.rapido ? 'Venta rapida' : clienteSeleccionado.documento}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-[8px] bg-[#fafafa] px-3 py-5 text-center text-[0.58rem] text-slate-500">
                      Selecciona a quien le haras la venta
                    </p>
                  )}
                </article>

                {clienteInvalido ? (
                  <InlineGuidedError
                    message={getVentasGuidance('Selecciona un cliente para continuar.')}
                  />
                ) : null}

                <button
                  type="button"
                  onClick={siguiente}
                  disabled={!clienteSeleccionado}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#1f3fa7] px-4 py-3 text-[0.68rem] font-black text-white shadow-[0_12px_28px_rgba(16,45,146,0.22)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Siguiente paso
                  <ArrowRight size={13} />
                </button>
              </section>
            ) : null}

            {paso === 3 ? (
              <section className="px-4 pb-5 pt-2">
                <p className="text-[0.52rem] font-black uppercase tracking-[0.08em] text-[#6b7a99]">
                  Datos de la venta
                </p>

                {submitError ? (
                  <InlineGuidedError
                    message={getVentasGuidance(submitError)}
                    className="mt-4"
                  />
                ) : null}

                <div className="mt-3 rounded-[8px] border border-[#e5e8f3] bg-white px-3 py-3 shadow-sm">
                  <p className="text-[0.55rem] font-black uppercase text-slate-500">
                    Cliente
                  </p>
                  <p className="mt-1 truncate text-[0.72rem] font-black text-slate-900">
                    {clienteSeleccionado?.nombre ?? 'Sin cliente'}
                  </p>
                  <p className="text-[0.58rem] text-slate-600">
                    {clienteSeleccionado?.documento ?? 'Seleccion pendiente'}
                  </p>
                </div>
                <p className="mt-4 text-[0.52rem] font-black uppercase tracking-[0.08em] text-[#6b7a99]">
                  Detalle de venta
                </p>
                <div className="mt-2 space-y-2">
                  {lotesConCantidad.map((lote) => (
                    <div
                      key={lote.id}
                      className="rounded-[8px] border border-[#e5e7f2] bg-[#fcfcff] px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.68rem] font-black text-slate-900">{lote.codigo}</p>
                          <p className="text-[0.58rem] text-slate-600">
                            {lote.tipoCafe} - {lote.calidad}
                          </p>
                          <p className="mt-1 text-[0.62rem] font-black text-[#102d92]">
                            {kg(lote.cantidad)} - {money(lote.cantidad * lote.precio)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={editarLoteDesdeRevision}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#eef2ff] text-[#102d92]"
                            title="Editar producto"
                            aria-label={`Editar ${lote.codigo}`}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarLoteDesdeRevision(lote.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#fff0f2] text-[#e24c5a]"
                            title="Quitar producto"
                            aria-label={`Quitar ${lote.codigo}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <article className="mt-4 rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] p-3 text-[#102d92]">
                  <div className="flex items-center justify-between text-[0.62rem] font-black text-slate-600">
                    <span>Total kg</span>
                    <span>{kg(totalKg)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[0.9rem] font-black text-slate-900">
                    <span>Total valor</span>
                    <span>{money(totalEstimado)}</span>
                  </div>
                </article>

                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={() => setMostrarConfirmarVenta(true)}
                    disabled={guardandoVenta || botonConfirmarPresionado}
                    className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[8px] px-4 py-3 text-[0.68rem] font-black text-white ${
                      guardandoVenta || botonConfirmarPresionado ? 'bg-[#7f93cf] cursor-wait' : 'bg-[#102d92]'
                    }`}
                  >
                    {guardandoVenta || botonConfirmarPresionado ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Guardando venta...
                      </>
                    ) : (
                      <>
                        Registrar venta
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrarCancelarVenta(true)}
                    className="inline-flex min-h-[36px] items-center justify-center rounded-[8px] bg-white px-4 py-2 text-[0.62rem] font-semibold text-slate-500"
                  >
                    Cancelar
                  </button>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>

      {mostrarModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 px-3 pt-8 backdrop-blur-sm">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[340px] overflow-y-auto rounded-t-[14px] bg-white shadow-[0_16px_38px_rgba(15,23,42,0.16)]">
            <div className="px-3.5 pb-3 pt-2.5">
              <div className="mx-auto h-1.5 w-10 rounded-full bg-[#cfd8e6]" />
              <div className="mt-3 flex items-center justify-between gap-4">
                <h2 className="text-[0.82rem] font-black leading-tight text-[#111827]">
                  {clienteEditandoId ? 'Editar cliente' : 'Registrar cliente'}
                </h2>
                <button
                  type="button"
                  onClick={cerrarModalCliente}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                >
                  <X size={13} />
                </button>
              </div>

              <div className="mt-3 space-y-2.5">
                <div>
                  <label className="mb-1 block text-[0.58rem] font-black text-slate-900">
                    Nombre del cliente
                  </label>
                  <label className="flex items-center gap-2 rounded-[8px] border border-[#dde4f1] bg-[#f7f9fd] px-3 py-2">
                    <User size={13} className="text-slate-400" />
                    <input
                      type="text"
                      value={clienteForm.nombre}
                      onChange={(event) => {
                        setClienteForm((actual) => ({ ...actual, nombre: event.target.value }));
                        setClienteFormError(null);
                        setFloatingError(null);
                      }}
                      placeholder="Ej. Juan Perez Rodriguez"
                      className="w-full bg-transparent text-[0.64rem] text-slate-900 outline-none"
                    />
                  </label>
                </div>

                <div>
                  <label className="mb-1 block text-[0.58rem] font-black text-slate-900">
                    Telefono (opcional)
                  </label>
                  <label className="flex items-center gap-2 rounded-[8px] border border-[#dde4f1] bg-[#f7f9fd] px-3 py-2">
                    <Phone size={13} className="text-slate-400" />
                    <input
                      type="text"
                      value={clienteForm.telefono}
                      onChange={(event) => {
                        setClienteForm((actual) => ({ ...actual, telefono: event.target.value }));
                        setClienteFormError(null);
                        setFloatingError(null);
                      }}
                      placeholder="+57 000 000 000"
                      className="w-full bg-transparent text-[0.64rem] text-slate-900 outline-none"
                    />
                  </label>
                </div>

                <div>
                  <label className="mb-1 block text-[0.58rem] font-black text-slate-900">
                    Documento o NIT
                  </label>
                  <label className="flex items-center gap-2 rounded-[8px] border border-[#dde4f1] bg-[#f7f9fd] px-3 py-2">
                    <IdCard size={13} className="text-slate-400" />
                    <input
                      type="text"
                      value={clienteForm.documento}
                      onChange={(event) => {
                        setClienteForm((actual) => ({ ...actual, documento: event.target.value }));
                        setClienteFormError(null);
                        setFloatingError(null);
                      }}
                      placeholder="1029384756"
                      className="w-full bg-transparent text-[0.64rem] text-slate-900 outline-none"
                    />
                  </label>
                </div>

                {clienteFormError ? (
                  <InlineGuidedError message={getVentasGuidance(clienteFormError)} />
                ) : null}
              </div>
            </div>

            <div className="border-t border-[#eef2f7] bg-[#fbfcff] px-3.5 py-3">
              <button
                type="button"
                onClick={guardarCliente}
                className="inline-flex min-h-[36px] w-full items-center justify-center rounded-[8px] bg-[#102d92] px-4 py-2 text-[0.64rem] font-black text-white"
              >
                {clienteEditandoId ? 'Guardar cambios' : 'Guardar cliente'}
              </button>
              <button
                type="button"
                onClick={cerrarModalCliente}
                className="mt-2 inline-flex w-full items-center justify-center px-4 py-1.5 text-[0.6rem] font-semibold text-slate-500"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarConfirmarVenta ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4 backdrop-blur-sm">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[340px] overflow-y-auto rounded-[14px] bg-white px-4 py-6 text-center shadow-[0_18px_48px_rgba(15,23,42,0.18)]">
            <h2 className="text-[1rem] font-black text-slate-900">Confirmar venta</h2>
            <p className="mt-2 text-[0.72rem] leading-5 text-slate-500">
              Se registrara esta venta y se descontara del inventario.
            </p>
            <button
              type="button"
              onClick={() => void confirmar()}
              disabled={guardandoVenta || botonConfirmarPresionado}
              className="mt-5 inline-flex min-h-[40px] w-full items-center justify-center rounded-[6px] bg-[#1f3fa7] px-4 text-[0.72rem] font-black text-white disabled:opacity-60"
            >
              {guardandoVenta ? 'Guardando venta...' : 'Confirmar venta'}
            </button>
            <button
              type="button"
              onClick={() => setMostrarConfirmarVenta(false)}
              className="mt-3 inline-flex min-h-[32px] w-full items-center justify-center text-[0.68rem] font-semibold text-slate-500"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {mostrarCancelarVenta ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4 backdrop-blur-sm">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[340px] overflow-y-auto rounded-[14px] bg-white px-4 py-6 text-center shadow-[0_18px_48px_rgba(15,23,42,0.18)]">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#fee2e2] text-[#dc2626]">
              <X size={17} />
            </div>
            <h2 className="mt-4 text-[1rem] font-black text-slate-900">Cancelar venta</h2>
            <p className="mt-2 text-[0.72rem] leading-5 text-slate-500">
              Se perderan los datos de esta venta.
            </p>
            <button
              type="button"
              onClick={cancelarVenta}
              className="mt-5 inline-flex min-h-[40px] w-full items-center justify-center rounded-[6px] bg-[#1f3fa7] px-4 text-[0.72rem] font-black text-white"
            >
              Cancelar venta
            </button>
            <button
              type="button"
              onClick={() => setMostrarCancelarVenta(false)}
              className="mt-3 inline-flex min-h-[32px] w-full items-center justify-center text-[0.68rem] font-semibold text-[#1f3fa7]"
            >
              Continuar editando
            </button>
          </div>
        </div>
      ) : null}

      {floatingError ? (
        <FloatingGuidedNotice
          message={floatingError}
          onClose={() => setFloatingError(null)}
        />
      ) : null}

      <AppBottomNav hidden={mostrarModal || mostrarConfirmarVenta || mostrarCancelarVenta} />
    </div>
  );
}

function CardMsg({ text }: { text: string }) {
  return (
    <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-5 text-center shadow-sm">
      <p className="text-sm font-semibold text-[#102d92]">{text}</p>
    </section>
  );
}
