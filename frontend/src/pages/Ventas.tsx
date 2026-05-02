import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
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
  InlineGuidedError,
  type GuidedErrorMessage,
} from '../components/forms/GuidedError';
import { obtenerDeviceId } from '../utils/deviceId';
import {
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
  if (message.includes('No hay lotes disponibles')) {
    return createGuidedError(
      message,
      'Sin inventario disponible',
      'No puedes registrar una venta porque no tienes producto en bodega.',
      'Registra una compra para continuar.',
    );
  }

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

  if (message.includes('supera el disponible')) {
    return createGuidedError(
      message,
      'Cantidad excedida',
      'Estas intentando vender mas de lo disponible.',
      'Reduce la cantidad o revisa el inventario.',
    );
  }

  if (message.includes('cantidad')) {
    return createGuidedError(
      message,
      'Cantidad invalida',
      'Ingresa una cantidad mayor a 0.',
      'Revisa el campo de cantidad.',
    );
  }

  return createGuidedError(
    message,
    'Ups, no se pudo guardar.',
    'Revisa los campos señalados.',
    'Vuelve a intentar.',
  );
}

function getCantidadLoteGuidance(lote: LoteVenta, cantidad: number): GuidedErrorMessage {
  if (cantidad > lote.disponibleKg) {
    return createGuidedError(
      `La cantidad supera el disponible en ${lote.codigo}.`,
      'Cantidad excedida',
      'Solo puedes vender hasta lo disponible.',
      `Disponible: ${kg(lote.disponibleKg)}.`,
    );
  }

  return createGuidedError(
    `La cantidad debe ser mayor a 0 en ${lote.codigo}.`,
    'Cantidad invalida',
    'Ingresa una cantidad mayor a 0.',
    `Disponible: ${kg(lote.disponibleKg)}.`,
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
  const [lotesVenta, setLotesVenta] = React.useState<LoteVenta[]>([]);
  const [clientes, setClientes] = React.useState<ClienteOption[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = React.useState<ClienteOption | null>(null);
  const [busquedaCliente, setBusquedaCliente] = React.useState('');
  const [busquedaAplicada, setBusquedaAplicada] = React.useState('');
  const [mostrarModal, setMostrarModal] = React.useState(false);
  const [clienteForm, setClienteForm] = React.useState<ClienteForm>({ nombre: '', telefono: '', documento: '' });
  const [clienteFormError, setClienteFormError] = React.useState<string | null>(null);
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

  const clientesRecientes = React.useMemo(() => {
    const base = [...clientes];
    const term = norm(busquedaAplicada.trim());
    if (!term) return base.slice(0, LIMITE);
    return base.filter((c) => [c.nombre, c.documento, c.detalle].some((v) => norm(v).includes(term)));
  }, [busquedaAplicada, clientes]);
  const busquedaClienteActiva = busquedaAplicada.trim().length > 0;
  const sinClientesRegistrados = clientes.length === 0;

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
        ? toNum(precioGlobal) > 0
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
    setBusquedaCliente('');
    setBusquedaAplicada('');
    setModoVenta(null);
    setPrecioGlobal('');
    setIntentoPaso1(false);
    setIntentoPaso2(false);
    setLoadError(null);
    ventaLocalIdRef.current = uid();
    void cargarLotes();
  }, [cargarLotes]);

  const updateLote = (id: string, campo: 'cantidadKg' | 'precioKg', valor: string) =>
    setLotesVenta((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));

  const seleccionarCliente = React.useCallback((cliente: ClienteOption) => {
    setClienteSeleccionado(cliente);
    setIntentoPaso1(false);
    setSubmitError(null);
  }, []);

  const buscarCliente = () => setBusquedaAplicada(busquedaCliente.trim());
  const pasoActual = React.useMemo(() => datosPasoVenta(paso), [paso]);
  const clienteSeleccionadoId = clienteSeleccionado?.id ?? null;
  const clienteInvalido = paso === 1 && intentoPaso1 && !clienteSeleccionado;
  const modoInvalido = paso === 2 && intentoPaso2 && !modoVenta;
  const precioTotalInvalido =
    paso === 2 &&
    modoVenta === 'TOTAL' &&
    (intentoPaso2 || precioGlobal.trim() !== '') &&
    toNum(precioGlobal) <= 0;
  const sinInventario = paso === 2 && lotesVenta.length === 0;
  const parcialSinCantidad = paso === 2 && modoVenta === 'PARCIAL' && !hayCantidadParcial;
  const parcialSinSeleccion = parcialSinCantidad && intentoPaso2;
  const bloquearSiguientePaso2 =
    sinInventario ||
    modoInvalido ||
    precioTotalInvalido ||
    parcialSinSeleccion ||
    parcialConErrores;

  const volverPasoAnterior = () => {
    if (paso > 1) {
      anterior();
      return;
    }

    navigate(-1);
  };

  const guardarCliente = async () => {
    const nombre = clienteForm.nombre.trim();
    const telefono = clienteForm.telefono.trim();
    const documento = clienteForm.documento.trim();
    if (!nombre) return setClienteFormError('Escribe al menos el nombre del cliente.');

    try {
      const clienteGuardado = await crearCliente({
        nombre,
        documento: documento || undefined,
        telefono: telefono || undefined,
      });
      const nuevo = mapClienteToOption(clienteGuardado);
      setClientes((actual) => [nuevo, ...actual.filter((cliente) => cliente.id !== nuevo.id)]);
      setClienteSeleccionado(nuevo);
      setIntentoPaso1(false);
      setBusquedaCliente(nombre);
      setBusquedaAplicada(nombre);
      setMostrarModal(false);
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
      <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 pb-10 text-slate-900">
        <div className="mx-auto max-w-[520px] space-y-4">
          <section className="rounded-[22px] border border-[#daf0e3] bg-white p-5 text-center shadow-sm">
            <span className="inline-flex rounded-full bg-[#e8fff3] px-3 py-1 text-xs font-semibold text-[#0d7b67]">Venta exitosa</span>
            <div className="mx-auto mt-3 inline-flex rounded-full bg-[#e8fff3] p-3 text-[#0d7b67]"><CheckCircle2 size={28} /></div>
            <h2 className="mt-3 text-[1.35rem] font-semibold text-[#102d92]">Venta exitosa</h2>
            <p className="mt-2 text-sm text-slate-600">La venta se registro y el inventario quedo actualizado.</p>
            <div className="mt-4 rounded-[14px] border border-[#e1e6f3] bg-[#f8f9ff] p-4 text-left">
              <p className="text-xs font-medium text-slate-500">Cliente</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {ventaGuardada.clienteNombre}
              </p>
              <p className="text-xs text-slate-600">{ventaGuardada.clienteDocumento}</p>
              <p className="mt-2 text-sm text-slate-600">Total: {kg(ventaGuardada.totalKg)}</p>
              <p className="text-sm font-semibold text-[#102d92]">{money(ventaGuardada.totalVenta)}</p>
            </div>
            <div className="mt-3 rounded-[14px] border border-[#e1e6f3] bg-[#fcfcff] p-4 text-left">
              <p className="text-xs font-medium text-slate-500">Detalle</p>
              <div className="mt-2 space-y-2">
                {ventaGuardada.items.map((item) => (
                  <div
                    key={`${ventaGuardada.referenciaId}-${item.codigo}`}
                    className="rounded-[12px] border border-[#e7ebf7] bg-white px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-slate-900">{item.codigo}</p>
                    <p className="text-xs text-slate-600">
                      {item.tipoCafe} - {item.calidad}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#102d92]">
                      {kg(item.cantidadKg)} - {money(item.subtotal)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={reiniciar} className="rounded-[14px] border border-[#d6dcf0] bg-white px-4 py-3 text-sm font-semibold text-[#102d92]">Nueva venta</button>
              <button type="button" onClick={() => navigate('/inventario')} className="rounded-[14px] bg-[#102d92] px-4 py-3 text-sm font-semibold text-white">Ir a inventario</button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-5 pb-[145px] text-slate-900">
      <div className="mx-auto max-w-[520px] space-y-4">
        <header className="px-4 py-4 pt-6">
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              onClick={volverPasoAnterior}
              className="absolute left-0 inline-flex items-center gap-1.5 text-slate-900 transition hover:opacity-75"
            >
              <ArrowLeft size={22} />
              <span className="text-[0.95rem] font-semibold">Inicio</span>
            </button>
            <h1 className="text-[1.35rem] font-semibold text-slate-900">Registro de Venta</h1>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between text-[1.05rem] font-medium text-slate-900">
              <span>Paso {paso}: {pasoActual.titulo}</span>
              <span className="text-[1.05rem] text-[#002f6c]">{paso} de 3</span>
            </div>
            <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#d0dbeb]">
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
          <section className="rounded-[18px] border border-[#f3d7dc] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0f2] text-[#d9485a]">
                <RefreshCw size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.95rem] font-semibold text-slate-900">No se pudo cargar el inventario</p>
                <p className="mt-1 text-[0.82rem] leading-5 text-slate-500">
                  Revisa tu conexión e intenta otra vez.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void cargarLotes()}
              className="mt-4 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#1f3fa7] px-4 text-[0.9rem] font-semibold text-white"
            >
              <RefreshCw size={14} />
              Reintentar
            </button>
          </section>
        ) : (
          <>
            {paso === 2 ? (
              <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-medium text-slate-500">
                  Seleccionar cafe
                </p>
                <h2 className="mt-2 text-[1.3rem] font-semibold text-[#102d92]">
                  Como deseas realizar la venta?
                </h2>

                <div className="mt-3 rounded-[14px] border border-[#dbe1f1] bg-[#f7f8fe] p-3">
                  <p className="text-xs font-medium text-slate-500">
                    Cliente seleccionado
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{clienteSeleccionado?.nombre ?? 'Sin cliente'}</p>
                  <p className="text-xs text-slate-600">{clienteSeleccionado?.documento ?? 'Selección pendiente'}</p>
                </div>

                <div className="mt-4 grid gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setModoVenta('PARCIAL');
                      setIntentoPaso2(false);
                    }}
                    disabled={sinInventario}
                    className={`rounded-[16px] border p-4 text-left ${
                      modoVenta === 'PARCIAL'
                        ? 'border-[#102d92] bg-[#eef2ff]'
                        : sinInventario
                          ? 'cursor-not-allowed border-[#e3e7f3] bg-slate-50 opacity-60'
                        : modoInvalido
                          ? 'border-[#f2c17b] bg-[#fff9ef]'
                        : 'border-[#e3e7f3] bg-white'
                    }`}
                  >
                    <p className="text-base font-semibold text-slate-900">Vender una parte del inventario</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Selecciona lotes especificos y ajusta cantidades.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModoVenta('TOTAL');
                      setIntentoPaso2(false);
                    }}
                    disabled={sinInventario}
                    className={`rounded-[16px] border p-4 text-left ${
                      modoVenta === 'TOTAL'
                        ? 'border-[#102d92] bg-[#eef2ff]'
                        : sinInventario
                          ? 'cursor-not-allowed border-[#e3e7f3] bg-slate-50 opacity-60'
                        : modoInvalido
                          ? 'border-[#f2c17b] bg-[#fff9ef]'
                        : 'border-[#e3e7f3] bg-white'
                    }`}
                  >
                    <p className="text-base font-semibold text-slate-900">Vender todo el inventario</p>
                    <p className="mt-1 text-sm text-slate-600">Usa todos los lotes disponibles de una vez.</p>
                  </button>
                </div>
                {sinInventario ? (
                  <InlineGuidedError
                    message={getVentasGuidance('No hay lotes disponibles para vender.')}
                    className="mt-2"
                  />
                ) : null}
                {modoInvalido ? (
                  <InlineGuidedError
                    message={getVentasGuidance('Selecciona como deseas realizar la venta.')}
                    className="mt-2"
                  />
                ) : null}

                {modoVenta === 'TOTAL' ? (
                  <div className="mt-4 rounded-[16px] border border-[#e5e8f3] bg-[#f8f9ff] p-4">
                    <p className="text-xs font-medium text-slate-500">
                      Precio por kg (COP)
                    </p>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={precioGlobal}
                      onChange={(event) => setPrecioGlobal(event.target.value)}
                      placeholder="Ej: 12500"
                      className={`mt-2 w-full rounded-xl border px-3 py-3 text-lg font-semibold outline-none focus:border-[#102d92] ${
                        precioTotalInvalido
                          ? 'border-[#ef4444] bg-[#fff7f7] text-[#b42318]'
                          : 'border-[#d7dcec] bg-white text-[#102d92]'
                      }`}
                    />
                    {precioTotalInvalido ? (
                      <InlineGuidedError
                        message={getVentasGuidance('Ingresa un precio por kg valido para venta total.')}
                        className="mt-2"
                      />
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-5 space-y-3">
                  {lotesVenta.map((lote) => {
                    const cantidad = toNum(lote.cantidadKg);
                    const cantidadIngresada = lote.cantidadKg.trim() !== '';
                    const cantidadInvalida =
                      modoVenta === 'PARCIAL' && cantidadIngresada && (cantidad <= 0 || cantidad > lote.disponibleKg);
                    const precioInvalido =
                      modoVenta === 'PARCIAL' && cantidadIngresada && toNum(lote.precioKg) <= 0;

                    return (
                    <article
                      key={lote.id}
                      className="rounded-[16px] border border-[#e5e8f3] bg-[#fcfcff] p-4"
                    >
                      <p className="text-lg font-semibold text-[#102d92]">{lote.codigo}</p>
                      <p className="text-sm text-slate-600">
                        {lote.tipoCafe} - {lote.calidad}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        Disponible: {kg(lote.disponibleKg)}
                      </p>

                      {modoVenta === 'PARCIAL' ? (
                        <>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={lote.disponibleKg}
                              value={lote.cantidadKg}
                              onChange={(event) => updateLote(lote.id, 'cantidadKg', event.target.value)}
                              placeholder="Cantidad kg"
                              className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:border-[#102d92] ${
                                cantidadInvalida
                                  ? 'border-[#ef4444] bg-[#fff7f7] text-[#b42318]'
                                  : 'border-[#d7dcec] bg-white text-slate-900'
                              }`}
                            />
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              value={lote.precioKg}
                              onChange={(event) => updateLote(lote.id, 'precioKg', event.target.value)}
                              placeholder="Precio por kg"
                              className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:border-[#102d92] ${
                                precioInvalido
                                  ? 'border-[#ef4444] bg-[#fff7f7] text-[#b42318]'
                                  : 'border-[#d7dcec] bg-white text-slate-900'
                              }`}
                            />
                          </div>
                          {cantidadInvalida ? (
                            <InlineGuidedError
                              message={getCantidadLoteGuidance(lote, cantidad)}
                              className="mt-2"
                            />
                          ) : null}
                          {precioInvalido ? (
                            <p className="mt-1 text-xs font-semibold text-[#b42318]">
                              Ingresa un precio valido para este lote.
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className="mt-3 text-sm text-slate-600">
                          En modo total este lote se vende completo.
                        </p>
                      )}
                    </article>
                    );
                  })}
                </div>
                {parcialSinSeleccion ? (
                  <InlineGuidedError
                    message={getVentasGuidance('Ingresa una cantidad en al menos un lote para continuar.')}
                    className="mt-2"
                  />
                ) : null}

                <article className="mt-4 rounded-[16px] border border-[#d6e2ff] bg-[#eef3ff] p-3 text-[#102d92]">
                  <div className="flex items-center justify-between text-sm font-black">
                    <span>Total seleccionado</span>
                    <span>{kg(totalKg)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-lg font-black">
                    <span>Total estimado</span>
                    <span>{money(totalEstimado)}</span>
                  </div>
                </article>

                <div className="mt-4 grid gap-3">
                  <button
                    type="button"
                    onClick={siguiente}
                    disabled={bloquearSiguientePaso2}
                    className={`inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[16px] px-5 py-4 text-[1.35rem] font-semibold text-white shadow-[0_12px_28px_rgba(16,45,146,0.26)] ${
                      bloquearSiguientePaso2 ? 'cursor-not-allowed bg-[#7f93cf]' : 'bg-[#1f3fa7]'
                    }`}
                  >
                    Siguiente Paso
                    <ArrowRight size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={anterior}
                    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-[#edf1fa] px-4 py-3 text-sm font-semibold text-slate-600"
                  >
                    <ArrowLeft size={16} />
                    Regresar
                  </button>
                </div>
              </section>
            ) : null}

            {paso === 1 ? (
              <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-medium text-slate-500">
                  Seleccionar cliente
                </p>
                <h2 className="mt-2 text-[1.3rem] font-semibold text-[#102d92]">
                  Elige quien recibe la venta
                </h2>

                <button
                  type="button"
                  onClick={() => seleccionarCliente(CLIENTE_GENERAL)}
                  className={`mt-4 w-full rounded-[16px] border p-4 text-left ${
                    clienteSeleccionadoId === CLIENTE_GENERAL.id
                      ? 'border-[#102d92] bg-[#eef2ff]'
                      : 'border-[#e3e7f3] bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="rounded-[14px] bg-[#dbe5ff] p-2 text-[#102d92]">
                        <User size={18} />
                      </span>
                      <div>
                        <p className="text-base font-semibold text-[#102d92]">Cliente General</p>
                        <p className="mt-1 text-sm text-slate-600">
                          Venta rapida para cliente ocasional.
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#dbe5ff] px-2.5 py-1 text-[11px] font-semibold text-[#102d92]">
                      Rapido
                    </span>
                  </div>
                </button>

                <div className="mt-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#e0e6f4]" />
                  <p className="text-[11px] font-medium text-slate-400">
                    O busca un cliente
                  </p>
                  <div className="h-px flex-1 bg-[#e0e6f4]" />
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <label className="flex min-h-[52px] flex-1 items-center gap-3 rounded-[14px] border border-[#d7dcec] bg-white px-3">
                    <Search size={17} className="text-slate-400" />
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
                      placeholder="Buscar por nombre, cedula o documento"
                      className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={buscarCliente}
                    aria-label="Buscar cliente"
                    className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-[14px] border border-[#d7dcec] bg-[#f8f9ff] text-[#102d92]"
                  >
                    <Search size={17} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setClienteForm({ nombre: '', telefono: '', documento: '' });
                    setClienteFormError(null);
                    setMostrarModal(true);
                  }}
                  className="mt-3 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-[#b7c6ef] bg-[#f8f9ff] px-4 py-3 text-sm font-semibold text-[#102d92]"
                >
                  <Plus size={16} />
                  Registrar nuevo cliente
                </button>

                <div className="mt-5">
                  <p className="text-[11px] font-medium text-slate-500">
                    {busquedaClienteActiva ? 'Resultados' : 'Clientes recientes'}
                  </p>
                  {clientesRecientes.length === 0 ? (
                    sinClientesRegistrados ? (
                      <div className="mt-2 rounded-[14px] border border-dashed border-[#d5dced] bg-[#fbfcff] px-4 py-5 text-center text-sm text-slate-500">
                        <p className="font-semibold text-slate-700">Aun no hay clientes registrados</p>
                        <p className="mt-1">Registra uno para comenzar.</p>
                      </div>
                    ) : busquedaClienteActiva ? (
                      <div className="mt-2 rounded-[14px] border border-dashed border-[#d5dced] bg-[#fbfcff] px-4 py-5 text-center text-sm text-slate-500">
                        <p className="font-semibold text-slate-700">No se encontraron resultados</p>
                        <p className="mt-1">Intenta con otro nombre o documento.</p>
                      </div>
                    ) : null
                  ) : (
                    <div className="mt-2 space-y-2">
                      {clientesRecientes.map((cliente) => {
                        const selected = clienteSeleccionadoId === cliente.id;
                        return (
                          <button
                            key={cliente.id}
                            type="button"
                            onClick={() => seleccionarCliente(cliente)}
                            className={`w-full rounded-[14px] border px-3 py-3 text-left ${
                              selected ? 'border-[#102d92] bg-[#eef2ff]' : 'border-[#e3e7f3] bg-[#fcfcff]'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="rounded-xl bg-[#e8eefc] p-2 text-[#102d92]">
                                <User size={15} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-900">{cliente.nombre}</p>
                                <p className="mt-0.5 truncate text-xs text-slate-600">{cliente.documento}</p>
                                <p className="mt-0.5 truncate text-xs text-slate-500">{cliente.detalle}</p>
                              </div>
                              {selected ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#102d92] px-2.5 py-1 text-[11px] font-semibold text-white">
                                  <CheckCircle2 size={12} />
                                  Seleccionado
                                </span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {clienteInvalido ? (
                  <InlineGuidedError
                    message={getVentasGuidance('Selecciona un cliente para continuar.')}
                    className="mt-4"
                  />
                ) : null}

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={siguiente}
                    className="inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[16px] bg-[#1f3fa7] px-5 py-4 text-[1.35rem] font-semibold text-white shadow-[0_12px_28px_rgba(16,45,146,0.26)]"
                  >
                    Siguiente Paso
                    <ArrowRight size={22} />
                  </button>
                </div>

              </section>
            ) : null}

            {paso === 3 ? (
              <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-medium text-slate-500">
                  Revision final
                </p>
                <h2 className="mt-2 text-[1.3rem] font-semibold text-[#102d92]">
                  Confirma los datos de la venta
                </h2>

                {submitError ? (
                  <InlineGuidedError
                    message={getVentasGuidance(submitError)}
                    className="mt-4"
                  />
                ) : null}

                <div className="mt-4 rounded-[14px] border border-[#dbe1f1] bg-[#f7f8fe] p-3">
                  <p className="text-xs font-medium text-slate-500">
                    Cliente
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {clienteSeleccionado?.nombre ?? 'Sin cliente'}
                  </p>
                  <p className="text-xs text-slate-600">
                    {clienteSeleccionado?.documento ?? 'Selección pendiente'}
                  </p>
                </div>
                <div className="mt-4 space-y-2">
                  {lotesConCantidad.map((lote) => (
                    <div
                      key={lote.id}
                      className="rounded-[12px] border border-[#e5e7f2] bg-[#fcfcff] px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">{lote.codigo}</p>
                          <p className="text-xs text-slate-600">
                            {lote.tipoCafe} - {lote.calidad}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#102d92]">
                            {kg(lote.cantidad)} - {money(lote.cantidad * lote.precio)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={editarLoteDesdeRevision}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#eef2ff] text-[#102d92]"
                            title="Editar producto"
                            aria-label={`Editar ${lote.codigo}`}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarLoteDesdeRevision(lote.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#fff0f2] text-[#e24c5a]"
                            title="Quitar producto"
                            aria-label={`Quitar ${lote.codigo}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <article className="mt-4 rounded-[16px] border border-[#d6e2ff] bg-[#eef3ff] p-3 text-[#102d92]">
                  <div className="flex items-center justify-between text-sm font-black">
                    <span>Total kg</span>
                    <span>{kg(totalKg)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-lg font-black">
                    <span>Total estimado</span>
                    <span>{money(totalEstimado)}</span>
                  </div>
                </article>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={anterior}
                    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-[#edf1fa] px-4 py-3 text-sm font-semibold text-slate-600"
                  >
                    <ArrowLeft size={16} />
                    Regresar
                  </button>
                  <button
                    type="button"
                    onClick={confirmar}
                    disabled={guardandoVenta || botonConfirmarPresionado}
                    className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-sm font-semibold text-white ${
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
                        Confirmar venta
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>

      {mostrarModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/55 px-5 py-6 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-[430px] overflow-hidden rounded-[22px] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.28)]">
            <div className="px-5 pb-5 pt-3">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-[#cfd8e6]" />
              <div className="mt-4 flex items-start justify-between gap-4">
                <h2 className="text-[1.35rem] font-semibold leading-tight text-[#111827]">
                  Registrar cliente
                </h2>
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    Nombre del cliente
                  </label>
                  <label className="flex items-center gap-3 rounded-[14px] border border-[#dde4f1] bg-[#f7f9fd] px-4 py-3">
                    <User size={17} className="text-slate-400" />
                    <input
                      type="text"
                      value={clienteForm.nombre}
                      onChange={(event) => {
                        setClienteForm((actual) => ({ ...actual, nombre: event.target.value }));
                        setClienteFormError(null);
                      }}
                      placeholder="Ej. Juan Perez Rodriguez"
                      className="w-full bg-transparent text-[0.95rem] text-slate-900 outline-none"
                    />
                  </label>
                </div>

                <div>
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    Telefono (opcional)
                  </label>
                  <label className="flex items-center gap-3 rounded-[14px] border border-[#dde4f1] bg-[#f7f9fd] px-4 py-3">
                    <Phone size={17} className="text-slate-400" />
                    <input
                      type="text"
                      value={clienteForm.telefono}
                      onChange={(event) => {
                        setClienteForm((actual) => ({ ...actual, telefono: event.target.value }));
                        setClienteFormError(null);
                      }}
                      placeholder="+57 000 000 000"
                      className="w-full bg-transparent text-[0.95rem] text-slate-900 outline-none"
                    />
                  </label>
                </div>

                <div>
                  <label className="mb-2 block text-[0.9rem] font-semibold text-slate-900">
                    Documento o NIT
                  </label>
                  <label className="flex items-center gap-3 rounded-[14px] border border-[#dde4f1] bg-[#f7f9fd] px-4 py-3">
                    <IdCard size={17} className="text-slate-400" />
                    <input
                      type="text"
                      value={clienteForm.documento}
                      onChange={(event) => {
                        setClienteForm((actual) => ({ ...actual, documento: event.target.value }));
                        setClienteFormError(null);
                      }}
                      placeholder="1029384756"
                      className="w-full bg-transparent text-[0.95rem] text-slate-900 outline-none"
                    />
                  </label>
                </div>

                {clienteFormError ? (
                  <InlineGuidedError message={getVentasGuidance(clienteFormError)} />
                ) : null}
              </div>
            </div>

            <div className="border-t border-[#eef2f7] bg-[#fbfcff] px-5 py-4">
              <button
                type="button"
                onClick={guardarCliente}
                className="inline-flex w-full items-center justify-center rounded-[14px] bg-[#102d92] px-5 py-3.5 text-[0.95rem] font-semibold text-white"
              >
                Guardar cliente
              </button>
              <button
                type="button"
                onClick={() => setMostrarModal(false)}
                className="mt-3 inline-flex w-full items-center justify-center px-5 py-2 text-[0.9rem] font-semibold text-slate-500"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AppBottomNav hidden={mostrarModal || paso >= 1} />
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
