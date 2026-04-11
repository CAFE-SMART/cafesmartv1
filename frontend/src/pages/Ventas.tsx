import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  IdCard,
  Phone,
  Plus,
  RefreshCw,
  Search,
  User,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppBottomNav } from '../components/AppBottomNav';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import { LoteResumen, obtenerLotes } from '../services/lotesService';
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

const DEVICE_STORAGE_KEY = 'cafesmart-device-id';
const STORAGE_KEY = 'cafesmart-clientes-locales-v1';
const LIMITE = 6;

const CLIENTE_GENERAL: ClienteOption = {
  id: 'general',
  nombre: 'Cliente General',
  documento: 'Venta rápida',
  detalle: 'Para ventas rápidas o clientes ocasionales no registrados en el sistema.',
  rapido: true,
};

const CLIENTES_BASE: ClienteOption[] = [
  { id: 'c1', nombre: 'Juan Pérez Rodríguez', documento: 'C.C. 1.123.456.789', detalle: 'Cliente agregado manualmente' },
  { id: 'c2', nombre: 'María Elena Giraldo', documento: 'C.C. 24.331.XXX', detalle: 'Compra frecuente' },
  { id: 'c3', nombre: 'Pedro Gómez Ospina', documento: 'C.C. 70.122.XXX', detalle: 'Pago de contado' },
];

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

function readClientes() {
  if (typeof window === 'undefined') return [] as ClienteOption[];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [] as ClienteOption[];
    const data = JSON.parse(raw) as ClienteOption[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [] as ClienteOption[];
  }
}

function saveClientes(clientes: ClienteOption[]) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clientes));
  }
}

const uid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function obtenerDeviceId() {
  if (typeof window === 'undefined') return uid();
  const existente = window.localStorage.getItem(DEVICE_STORAGE_KEY);
  if (existente) return existente;
  const nuevo = uid();
  window.localStorage.setItem(DEVICE_STORAGE_KEY, nuevo);
  return nuevo;
}

function crearResumenVentaGuardada(respuesta: CreateVentaResponse): VentaGuardadaResumen {
  return {
    referenciaId: respuesta.venta.referenciaId,
    clienteNombre: respuesta.venta.cliente.nombre,
    clienteDocumento: respuesta.venta.cliente.documento,
    totalKg: respuesta.venta.totalKg,
    totalVenta: respuesta.venta.totalVenta,
    items: respuesta.items.map((item) => ({
      codigo: item.codigo,
      tipoCafe: item.tipoCafe,
      calidad: item.calidad,
      cantidadKg: item.cantidadKg,
      subtotal: item.subtotal,
    })),
  };
}

function datosPasoVenta(step: Step) {
  if (step === 1) {
    return {
      chip: 'Paso 1 de 3',
      titulo: 'Registro de Venta',
      descripcion: 'Seleccione el cliente para iniciar la venta de cafe.',
      progreso: 33,
    };
  }
  if (step === 2) {
    return {
      chip: 'Paso 2 de 3',
      titulo: 'Seleccionar Cafe',
      descripcion: 'Elige modo de venta, cantidades y precio por kilo.',
      progreso: 66,
    };
  }
  return {
    chip: 'Paso 3 de 3',
    titulo: 'Revision Final',
    descripcion: 'Confirma el resumen antes de registrar la venta.',
    progreso: 100,
  };
}

export default function Ventas() {
  const navigate = useNavigate();
  const [cargando, setCargando] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [guardandoVenta, setGuardandoVenta] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [ventaGuardada, setVentaGuardada] = React.useState<VentaGuardadaResumen | null>(null);
  const [paso, setPaso] = React.useState<Step>(1);
  const [intentoPaso1, setIntentoPaso1] = React.useState(false);
  const [intentoPaso2, setIntentoPaso2] = React.useState(false);
  const [modoVenta, setModoVenta] = React.useState<ModoVenta | null>(null);
  const [precioGlobal, setPrecioGlobal] = React.useState('');
  const [lotesVenta, setLotesVenta] = React.useState<LoteVenta[]>([]);
  const [clientesLocales, setClientesLocales] = React.useState<ClienteOption[]>(() => readClientes());
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
      const lotes = await obtenerLotes();
      setLotesVenta(mkLotes(lotes));
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
    saveClientes(clientesLocales);
  }, [clientesLocales]);

  const clientesRecientes = React.useMemo(() => {
    const base = clientesLocales.length ? [...clientesLocales] : [...CLIENTES_BASE];
    const term = norm(busquedaAplicada.trim());
    if (!term) return base.slice(0, LIMITE);
    return base.filter((c) => [c.nombre, c.documento, c.detalle].some((v) => norm(v).includes(term)));
  }, [busquedaAplicada, clientesLocales]);

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
      if (toNum(precioGlobal) <= 0) return 'Ingresa un precio por kg válido para venta total.';
      return null;
    }
    if (!lotesConCantidad.length) return 'Ingresa al menos una cantidad para continuar.';
    for (const l of lotesConCantidad) {
      if (l.cantidad > l.disponibleKg) return `La cantidad supera el disponible en ${l.codigo}.`;
      if (l.precio <= 0) return `Ingresa un precio por kg válido en ${l.codigo}.`;
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
    setSubmitError(null);

    try {
      const respuesta = await crearVenta({
        deviceId: obtenerDeviceId(),
        localId: ventaLocalIdRef.current,
        cliente: {
          nombre: clienteSeleccionado.nombre,
          documento: clienteSeleccionado.documento,
          telefono: clienteSeleccionado.telefono,
          detalle: clienteSeleccionado.detalle,
          rapido: clienteSeleccionado.rapido,
        },
        items: lotesConCantidad.map((lote) => ({
          tipoCafeId: lote.tipoCafeId,
          calidadId: lote.calidadId,
          cantidadKg: lote.cantidad,
          precioKg: lote.precio,
        })),
      });

      setVentaGuardada(crearResumenVentaGuardada(respuesta));
      await cargarLotes();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No fue posible registrar la venta.');
    } finally {
      setGuardandoVenta(false);
    }
  }, [cargarLotes, clienteSeleccionado, guardandoVenta, lotesConCantidad, validarPasoVenta]);

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
  const parcialSinSeleccion = paso === 2 && modoVenta === 'PARCIAL' && !hayCantidadParcial;

  const guardarCliente = () => {
    const nombre = clienteForm.nombre.trim();
    const telefono = clienteForm.telefono.trim();
    const documento = clienteForm.documento.trim();
    if (!nombre) return setClienteFormError('Escribe al menos el nombre del cliente.');
    const nuevo: ClienteOption = {
      id: uid(),
      nombre,
      telefono,
      documento: documento || 'Documento pendiente',
      detalle: telefono || 'Cliente agregado manualmente',
    };
    const next = [nuevo, ...clientesLocales];
    setClientesLocales(next);
    setClienteSeleccionado(nuevo);
    setIntentoPaso1(false);
    setBusquedaCliente(nombre);
    setBusquedaAplicada(nombre);
    setMostrarModal(false);
    setClienteFormError(null);
    setSubmitError(null);
  };

  if (ventaGuardada) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-6 pb-[145px] text-slate-900">
        <div className="mx-auto max-w-[520px] space-y-4">
          <section className="rounded-[22px] border border-[#daf0e3] bg-white p-5 text-center shadow-sm">
            <span className="inline-flex rounded-full bg-[#e8fff3] px-3 py-1 text-xs font-black text-[#0d7b67]">Venta exitosa</span>
            <div className="mx-auto mt-3 inline-flex rounded-full bg-[#e8fff3] p-3 text-[#0d7b67]"><CheckCircle2 size={28} /></div>
            <h2 className="mt-3 text-[1.35rem] font-black text-[#102d92]">¡Venta exitosa!</h2>
            <p className="mt-2 text-sm text-slate-600">La venta se registró y el inventario quedó actualizado.</p>
            <div className="mt-4 rounded-[14px] border border-[#e1e6f3] bg-[#f8f9ff] p-4 text-left">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Cliente</p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {ventaGuardada.clienteNombre}
              </p>
              <p className="text-xs text-slate-600">{ventaGuardada.clienteDocumento}</p>
              <p className="mt-2 text-sm text-slate-600">Total: {kg(ventaGuardada.totalKg)}</p>
              <p className="text-sm font-black text-[#102d92]">{money(ventaGuardada.totalVenta)}</p>
            </div>
            <div className="mt-3 rounded-[14px] border border-[#e1e6f3] bg-[#fcfcff] p-4 text-left">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Detalle</p>
              <div className="mt-2 space-y-2">
                {ventaGuardada.items.map((item) => (
                  <div
                    key={`${ventaGuardada.referenciaId}-${item.codigo}`}
                    className="rounded-[12px] border border-[#e7ebf7] bg-white px-3 py-2"
                  >
                    <p className="text-sm font-black text-slate-900">{item.codigo}</p>
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
              <button type="button" onClick={reiniciar} className="rounded-[14px] border border-[#d6dcf0] bg-white px-4 py-3 text-sm font-black text-[#102d92]">Nueva venta</button>
              <button type="button" onClick={() => navigate('/inicio')} className="rounded-[14px] bg-[#102d92] px-4 py-3 text-sm font-black text-white">Volver al inicio</button>
            </div>
          </section>
        </div>
        <AppBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-5 pb-[145px] text-slate-900">
      <div className="mx-auto max-w-[520px] space-y-4">
        <header className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-[#eef2ff] p-3 text-[#102d92]"><Banknote size={18} /></div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Cafe Smart</p>
                <h1 className="mt-1 text-[1.35rem] font-black text-[#102d92]">{pasoActual.titulo}</h1>
                <p className="mt-1 text-sm text-slate-600">{pasoActual.descripcion}</p>
              </div>
            </div>
            <CloudStatusBadge compact className="max-w-[190px]" />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="rounded-full bg-[#ccf5ef] px-3 py-1 text-xs font-black text-[#0b7664]">
              {pasoActual.chip}
            </span>
            <span className="text-xs font-black text-[#102d92]">{pasoActual.progreso}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-[#d6e0f0]">
            <div
              className="h-full rounded-full bg-[#102d92] transition-all duration-300"
              style={{ width: `${pasoActual.progreso}%` }}
            />
          </div>
        </header>
        {cargando ? (
          <CardMsg text="Cargando lotes para venta..." />
        ) : loadError ? (
          <section className="rounded-[22px] border border-[#ffd5d5] bg-[#fff6f6] p-4 shadow-sm">
            <p className="text-sm font-black text-[#a22424]">No se pudo cargar inventario de venta.</p>
            <p className="mt-1 text-sm text-[#8c3838]">{loadError}</p>
            <button
              type="button"
              onClick={() => void cargarLotes()}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#f4a7a7] bg-white px-3 py-2 text-xs font-black text-[#a22424]"
            >
              <RefreshCw size={14} />
              Reintentar
            </button>
          </section>
        ) : (
          <>
            {paso === 2 ? (
              <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Seleccionar café
                </p>
                <h2 className="mt-2 text-[1.3rem] font-black text-[#102d92]">
                  ¿Cómo deseas realizar la venta?
                </h2>

                <div className="mt-3 rounded-[14px] border border-[#dbe1f1] bg-[#f7f8fe] p-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    Cliente seleccionado
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-900">{clienteSeleccionado?.nombre ?? 'Sin cliente'}</p>
                  <p className="text-xs text-slate-600">{clienteSeleccionado?.documento ?? 'Seleccion pendiente'}</p>
                </div>

                <div className="mt-4 grid gap-3">
                  <button
                    type="button"
                    onClick={() => setModoVenta('PARCIAL')}
                    className={`rounded-[16px] border p-4 text-left ${
                      modoVenta === 'PARCIAL'
                        ? 'border-[#102d92] bg-[#eef2ff]'
                        : modoInvalido
                          ? 'border-[#f2c17b] bg-[#fff9ef]'
                        : 'border-[#e3e7f3] bg-white'
                    }`}
                  >
                    <p className="text-base font-black text-slate-900">Vender una parte del inventario</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Selecciona lotes específicos y ajusta cantidades.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModoVenta('TOTAL')}
                    className={`rounded-[16px] border p-4 text-left ${
                      modoVenta === 'TOTAL'
                        ? 'border-[#102d92] bg-[#eef2ff]'
                        : modoInvalido
                          ? 'border-[#f2c17b] bg-[#fff9ef]'
                        : 'border-[#e3e7f3] bg-white'
                    }`}
                  >
                    <p className="text-base font-black text-slate-900">Vender todo el inventario</p>
                    <p className="mt-1 text-sm text-slate-600">Usa todos los lotes disponibles de una vez.</p>
                  </button>
                </div>
                {modoInvalido ? (
                  <p className="mt-2 text-xs font-semibold text-[#9a5a00]">
                    Elige un modo de venta para continuar.
                  </p>
                ) : null}

                {modoVenta === 'TOTAL' ? (
                  <div className="mt-4 rounded-[16px] border border-[#e5e8f3] bg-[#f8f9ff] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                      Precio por kg (COP)
                    </p>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={precioGlobal}
                      onChange={(event) => setPrecioGlobal(event.target.value)}
                      placeholder="Ej: 12500"
                      className={`mt-2 w-full rounded-xl border px-3 py-3 text-lg font-black outline-none focus:border-[#102d92] ${
                        precioTotalInvalido
                          ? 'border-[#ef4444] bg-[#fff7f7] text-[#b42318]'
                          : 'border-[#d7dcec] bg-white text-[#102d92]'
                      }`}
                    />
                    {precioTotalInvalido ? (
                      <p className="mt-2 text-xs font-semibold text-[#b42318]">
                        Ingresa un precio por kg valido.
                      </p>
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
                      <p className="text-lg font-black text-[#102d92]">{lote.codigo}</p>
                      <p className="text-sm text-slate-600">
                        {lote.tipoCafe} · {lote.calidad}
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-900">
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
                            <p className="mt-2 text-xs font-semibold text-[#b42318]">
                              Ajusta cantidad: mayor a 0 y menor o igual al disponible.
                            </p>
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
                  <p className="mt-2 rounded-xl border border-[#f2c17b] bg-[#fff9ef] px-3 py-2 text-xs font-semibold text-[#9a5a00]">
                    Ingresa una cantidad en al menos un lote para continuar.
                  </p>
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

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={anterior}
                    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-[#edf1fa] px-4 py-3 text-sm font-black text-slate-600"
                  >
                    <ArrowLeft size={16} />
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={siguiente}
                    disabled={!puedeAvanzarPaso2}
                    className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-sm font-black text-white ${
                      puedeAvanzarPaso2 ? 'bg-[#102d92]' : 'bg-[#9aa9d8] cursor-not-allowed'
                    }`}
                  >
                    Siguiente paso
                    <ArrowRight size={16} />
                  </button>
                </div>
              </section>
            ) : null}

            {paso === 1 ? (
              <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Seleccionar cliente
                </p>
                <h2 className="mt-2 text-[1.3rem] font-black text-[#102d92]">
                  Elige quién recibe la venta
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
                        <p className="text-base font-black text-[#102d92]">Cliente General</p>
                        <p className="mt-1 text-sm text-slate-600">
                          Venta rápida para cliente ocasional.
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#dbe5ff] px-2.5 py-1 text-[11px] font-black text-[#102d92]">
                      Rápido
                    </span>
                  </div>
                </button>

                <div className="mt-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#e0e6f4]" />
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
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
                      placeholder="Buscar por nombre, cédula o documento"
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
                  className="mt-3 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-[#b7c6ef] bg-[#f8f9ff] px-4 py-3 text-sm font-black text-[#102d92]"
                >
                  <Plus size={16} />
                  Registrar nuevo cliente
                </button>

                <div className="mt-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Clientes recientes
                  </p>
                  {clientesRecientes.length === 0 ? (
                    <div className="mt-2 rounded-[14px] border border-dashed border-[#d5dced] bg-[#fbfcff] px-4 py-5 text-center text-sm text-slate-500">
                      No se encontraron clientes con esa búsqueda.
                    </div>
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
                                <p className="truncate text-sm font-black text-slate-900">{cliente.nombre}</p>
                                <p className="mt-0.5 truncate text-xs text-slate-600">{cliente.documento}</p>
                                <p className="mt-0.5 truncate text-xs text-slate-500">{cliente.detalle}</p>
                              </div>
                              {selected ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#102d92] px-2.5 py-1 text-[11px] font-black text-white">
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
                  <p
                    className="mt-4 rounded-[12px] border border-[#f1b7b7] bg-[#fff5f5] px-3 py-2 text-sm font-semibold text-[#b42318]"
                    role="alert"
                  >
                    Selecciona un cliente para continuar.
                  </p>
                ) : null}

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={siguiente}
                    className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 py-3 text-sm font-black text-white"
                  >
                    Siguiente paso
                    <ArrowRight size={16} />
                  </button>
                </div>

              </section>
            ) : null}

            {paso === 3 ? (
              <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Revisión final
                </p>
                <h2 className="mt-2 text-[1.3rem] font-black text-[#102d92]">
                  Confirma los datos de la venta
                </h2>

                {submitError ? (
                  <div className="mt-4 rounded-[14px] border border-[#f1b7b7] bg-[#fff5f5] px-4 py-3 text-sm font-semibold text-[#b42318]">
                    {submitError}
                  </div>
                ) : null}

                <div className="mt-4 rounded-[14px] border border-[#dbe1f1] bg-[#f7f8fe] p-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    Cliente
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-900">
                    {clienteSeleccionado?.nombre ?? 'Sin cliente'}
                  </p>
                  <p className="text-xs text-slate-600">
                    {clienteSeleccionado?.documento ?? 'Seleccion pendiente'}
                  </p>
                </div>

                <div className="mt-4 space-y-2">
                  {lotesConCantidad.map((lote) => (
                    <div
                      key={lote.id}
                      className="rounded-[12px] border border-[#e5e7f2] bg-[#fcfcff] px-3 py-2"
                    >
                      <p className="text-sm font-black text-slate-900">{lote.codigo}</p>
                      <p className="text-xs text-slate-600">
                        {lote.tipoCafe} · {lote.calidad}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#102d92]">
                        {kg(lote.cantidad)} · {money(lote.cantidad * lote.precio)}
                      </p>
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
                    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-[#edf1fa] px-4 py-3 text-sm font-black text-slate-600"
                  >
                    <ArrowLeft size={16} />
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={confirmar}
                    disabled={guardandoVenta}
                    className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-sm font-black text-white ${
                      guardandoVenta ? 'bg-[#7f93cf] cursor-wait' : 'bg-[#102d92]'
                    }`}
                  >
                    {guardandoVenta ? (
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/45 px-4 py-8 backdrop-blur-sm">
          <div className="mx-auto mt-12 w-full max-w-[430px] overflow-hidden rounded-[30px] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.2)]">
            <div className="px-6 pb-6 pt-4">
              <div className="mx-auto h-2 w-16 rounded-full bg-[#cfd8e6]" />
              <div className="mt-5 flex items-start justify-between gap-4">
                <h2 className="text-[1.7rem] font-black leading-tight text-[#111827]">
                  Registrar cliente
                </h2>
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="mt-8 space-y-5">
                <div>
                  <label className="mb-2 block text-base font-black text-slate-900">
                    Nombre del cliente
                  </label>
                  <label className="flex items-center gap-3 rounded-[20px] border border-[#dde4f1] bg-[#f7f9fd] px-5 py-4">
                    <User size={18} className="text-slate-400" />
                    <input
                      type="text"
                      value={clienteForm.nombre}
                      onChange={(event) =>
                        setClienteForm((actual) => ({ ...actual, nombre: event.target.value }))
                      }
                      placeholder="Ej. Juan Pérez Rodríguez"
                      className="w-full bg-transparent text-base text-slate-900 outline-none"
                    />
                  </label>
                </div>

                <div>
                  <label className="mb-2 block text-base font-black text-slate-900">
                    Teléfono (opcional)
                  </label>
                  <label className="flex items-center gap-3 rounded-[20px] border border-[#dde4f1] bg-[#f7f9fd] px-5 py-4">
                    <Phone size={18} className="text-slate-400" />
                    <input
                      type="text"
                      value={clienteForm.telefono}
                      onChange={(event) =>
                        setClienteForm((actual) => ({ ...actual, telefono: event.target.value }))
                      }
                      placeholder="+57 000 000 000"
                      className="w-full bg-transparent text-base text-slate-900 outline-none"
                    />
                  </label>
                </div>

                <div>
                  <label className="mb-2 block text-base font-black text-slate-900">
                    Documento o NIT
                  </label>
                  <label className="flex items-center gap-3 rounded-[20px] border border-[#dde4f1] bg-[#f7f9fd] px-5 py-4">
                    <IdCard size={18} className="text-slate-400" />
                    <input
                      type="text"
                      value={clienteForm.documento}
                      onChange={(event) =>
                        setClienteForm((actual) => ({ ...actual, documento: event.target.value }))
                      }
                      placeholder="1029384756"
                      className="w-full bg-transparent text-base text-slate-900 outline-none"
                    />
                  </label>
                </div>

                {clienteFormError ? (
                  <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {clienteFormError}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-t border-[#eef2f7] bg-[#fbfcff] px-6 py-5">
              <button
                type="button"
                onClick={guardarCliente}
                className="inline-flex w-full items-center justify-center rounded-[20px] bg-[#102d92] px-5 py-4 text-base font-black text-white"
              >
                Guardar cliente
              </button>
              <button
                type="button"
                onClick={() => setMostrarModal(false)}
                className="mt-4 inline-flex w-full items-center justify-center px-5 py-2 text-base font-semibold text-slate-500"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AppBottomNav hidden={mostrarModal} />
    </div>
  );
}

function CardMsg({ text }: { text: string }) {
  return (
    <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-5 text-center shadow-sm">
      <p className="text-sm font-black text-[#102d92]">{text}</p>
    </section>
  );
}
