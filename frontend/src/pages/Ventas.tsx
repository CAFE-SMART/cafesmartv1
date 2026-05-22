import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Scale,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppBottomNav } from '../components/AppBottomNav';
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
import {
  LoteResumen,
  obtenerDetalleLote,
  obtenerLotes,
  guardarPesosSublotes,
} from '../services/lotesService';
import { CreateVentaResponse, crearVenta } from '../services/ventasService';
import { obtenerConfiguracionBodega } from '../services/bodegaApi';
import { ApiRequestError } from '../services/apiService';
import { ENABLE_SECADO_PROTOTYPE } from '../config/features';
import {
  applySecadoToDetalle,
  applySecadoToLots,
  getActiveSecadoSessions,
} from '../utils/secadoFlow';
import {
  PESO_MINIMO_KG,
  PRECIO_MAXIMO_KG,
  PRECIO_MINIMO_KG,
} from '../utils/businessRules';
import {
  BUSINESS_MIN_DATE_VALUE,
  formatDateLabel,
  getTodayLocalDateValue,
  toIsoDateAtUtcNoon,
  validateBusinessDateRange,
} from '../utils/date';
import { formatCoffeeLabel, formatDisplayLabel } from '../utils/uiMessages';
import {
  type DocumentType,
  PERSON_NAME_MAX_LENGTH,
  sanitizeDocumentInput,
  sanitizeDigits as sanitizePersonDigits,
  sanitizeProducerNameInput,
  validateDocumentNumber,
  validateProducerName,
  validatePhoneNumber,
} from '../utils/personValidation';

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

type ClienteForm = {
  nombre: string;
  tipoDocumento: DocumentType;
  telefono: string;
  documento: string;
};
type ClienteFormErrors = Partial<Record<keyof ClienteForm, string>>;
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
  pesoVerificadoKg: string;
};
type VentaGuardadaResumen = {
  referenciaId: string;
  fecha: string;
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
  detalle:
    'Para ventas rapidas o clientes ocasionales no registrados en el sistema.',
  rapido: true,
};
const TIPOS_DOCUMENTO_CLIENTE: Array<{
  value: DocumentType;
  label: string;
}> = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'NIT', label: 'NIT' },
];
const CLIENTE_FORM_INICIAL: ClienteForm = {
  nombre: '',
  tipoDocumento: 'CC',
  telefono: '',
  documento: '',
};

const kg = (v: number) =>
  `${v.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`;
const money = (v: number) =>
  `$${v.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
const toNum = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const soloDigitos = (v: string) => v.replace(/\D/g, '');
const norm = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const keyOf = (v: string) => v.trim().toUpperCase();

function personFieldClass(hasError?: boolean) {
  return `w-full rounded-[14px] border bg-[#f7f9fd] px-4 py-3 text-[0.95rem] font-semibold text-slate-900 outline-none transition ${
    hasError
      ? 'border-rose-300 bg-rose-50/40 focus:border-rose-400'
      : 'border-[#dde4f1] focus:border-[#173ea6]'
  }`;
}

function PersonFieldError({ message }: { message: string }) {
  return (
    <p className="mt-1.5 text-[0.78rem] font-semibold leading-5 text-rose-600">
      {message}
    </p>
  );
}

function getPersonNameLabel(type: DocumentType, role: 'cliente' | 'productor') {
  if (type === 'NIT') return 'Nombre de la empresa';
  return role === 'cliente' ? 'Nombre del cliente' : 'Nombre completo';
}

function getPersonNamePlaceholder(type: DocumentType, role: 'cliente' | 'productor') {
  if (type === 'NIT') return 'Ej: Café Los Alpes';
  return role === 'cliente' ? 'Ej: Juan Pérez Rodríguez' : 'Ej: Juan Pérez Rodríguez';
}

function isSecadoProcessLot(lote: LoteResumen | LoteVenta) {
  return keyOf(lote.tipoCafe) === 'EN SECADO';
}

function coffeeWithQuality(tipoCafe: string, calidad: string) {
  return `${formatCoffeeLabel(tipoCafe)} - ${formatDisplayLabel(calidad)}`;
}

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
      precioKg: '',
      pesoVerificadoKg: '',
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

function clavePersona(nombre: string, documento: string) {
  const documentoNormalizado = soloDigitos(documento);
  return documentoNormalizado
    ? `documento:${documentoNormalizado}`
    : `nombre:${norm(nombre.trim())}`;
}

function dedupeClientesOptions(clientes: ClienteOption[]) {
  const vistos = new Set<string>();

  return clientes.filter((cliente) => {
    const key = clavePersona(cliente.nombre, cliente.documento);

    if (vistos.has(key)) {
      return false;
    }

    vistos.add(key);
    return true;
  });
}

function findClienteExistente(
  clientes: ClienteOption[],
  nombre: string,
  documento: string,
) {
  const key = clavePersona(nombre, documento);
  return clientes.find(
    (cliente) => clavePersona(cliente.nombre, cliente.documento) === key,
  );
}

function crearResumenVentaGuardada(
  respuesta: CreateVentaResponse,
): VentaGuardadaResumen {
  const ventaTotalKg = respuesta.detalles.reduce(
    (total, item) => total + item.pesoVendido,
    0,
  );
  return {
    referenciaId: respuesta.venta.id,
    fecha: respuesta.venta.fecha,
    clienteNombre: 'Cliente registrado',
    clienteDocumento: 'Sin detalle',
    totalKg: ventaTotalKg,
    totalVenta: respuesta.detalles.reduce(
      (total, item) => total + item.subtotal,
      0,
    ),
    items: [],
  };
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sanitizeDecimalVentaInput(value: string, maxValue?: number) {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const [integerRaw = '', ...decimalParts] = normalized.split('.');
  const maxIntegerLength =
    maxValue && Number.isFinite(maxValue) && maxValue > 0
      ? String(Math.floor(maxValue)).length
      : 9;
  const integer = integerRaw.slice(0, maxIntegerLength);
  const decimal = decimalParts.join('').slice(0, 2);
  const next = normalized.includes('.')
    ? `${integer || '0'}${decimal.length > 0 ? `.${decimal}` : '.'}`
    : integer;

  if (!next || next === '.') return '';
  if (next.endsWith('.')) return next;

  const parsed = Number(next);
  if (!Number.isFinite(parsed)) return '';

  return maxValue && parsed > maxValue ? String(maxValue) : next;
}

function sanitizeIntegerVentaInput(
  value: string,
  maxValue: number,
  fallbackValue = '',
) {
  const digits = soloDigitos(value).slice(0, String(maxValue).length);
  if (!digits) return '';

  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return '';

  return parsed > maxValue ? fallbackValue : digits;
}

function getPesoVerificado(lote: LoteVenta) {
  if (!lote.pesoVerificadoKg.trim()) return null;
  return round2(toNum(lote.pesoVerificadoKg));
}

function getDisponibleVenta(lote: LoteVenta) {
  const verificado = getPesoVerificado(lote);
  if (verificado === null) return lote.disponibleKg;
  return Math.max(0, Math.min(lote.disponibleKg, verificado));
}

function pesoVerificadoInvalido(lote: LoteVenta) {
  const verificado = getPesoVerificado(lote);
  return (
    verificado !== null && (verificado < 0 || verificado > lote.disponibleKg)
  );
}

function distribuirPesoVerificado(
  pool: Array<{ subloteId: string; disponibleKg: number }>,
  pesoVerificado: number,
) {
  const totalActual = round2(
    pool.reduce((sum, item) => sum + item.disponibleKg, 0),
  );
  if (pesoVerificado >= totalActual || totalActual <= 0) return pool;

  let acumulado = 0;
  return pool.map((item, index) => {
    const disponibleKg =
      index === pool.length - 1
        ? round2(Math.max(0, pesoVerificado - acumulado))
        : round2((item.disponibleKg / totalActual) * pesoVerificado);
    acumulado = round2(acumulado + disponibleKg);

    return {
      ...item,
      disponibleKg,
    };
  });
}

function datosPasoVenta(step: Step) {
  if (step === 1) {
    return {
      titulo: 'Cliente',
      progreso: 33,
    };
  }
  if (step === 2) {
    return {
      titulo: 'Seleccionar café',
      progreso: 66,
    };
  }
  return {
    titulo: 'Confirmar venta',
    progreso: 100,
  };
}

function getVentasGuidance(message: string): GuidedErrorMessage {
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

  if (message.includes('cédula') || message.includes('documento')) {
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
      'Revisa la fecha de venta.',
      'Solo puedes registrar ventas desde 2026 hasta hoy.',
      'Elige una fecha válida para continuar.',
    );
  }

  if (message === 'No hay suficiente inventario para realizar la venta') {
    return createGuidedError(
      message,
      'Inventario insuficiente',
      'La venta queda bloqueada porque no hay café suficiente.',
      'Actualiza el inventario o reduce la cantidad.',
    );
  }

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
      'Selecciona un cliente',
      'No elegiste a quien registrar la venta.',
      'Usa Cliente General o busca uno.',
    );
  }

  if (
    message.includes('modo de venta') ||
    message.includes('como deseas realizar la venta')
  ) {
    return createGuidedError(
      message,
      'Selecciona como vender',
      'No elegiste el tipo de venta.',
      'Una parte o todo el inventario.',
    );
  }

  if (
    message.includes('precio por kg') ||
    message.includes('precio mínimo') ||
    message.includes('precio no puede')
  ) {
    return createGuidedError(
      message,
      'Precio por kg inválido.',
      `Debe estar entre $${PRECIO_MINIMO_KG.toLocaleString('es-CO')} y $${PRECIO_MAXIMO_KG.toLocaleString('es-CO')}/kg.`,
      'Revisa el precio marcado.',
    );
  }

  if (message.includes('supera el disponible')) {
    return createGuidedError(
      message,
      'Cantidad excedida',
      'Estás intentando vender más de lo disponible.',
      'Reduce la cantidad o revisa el inventario.',
    );
  }

  if (message.includes('cantidad')) {
    return createGuidedError(
      message,
      'Cantidad inválida',
      `Ingresa una cantidad mínima de ${PESO_MINIMO_KG} kg.`,
      'Revisa el campo de cantidad.',
    );
  }

  return createGuidedError(
    message,
    'Revisa los datos de la venta.',
    'Hay un valor incompleto o fuera del rango permitido.',
    'Corrige los campos marcados e intenta nuevamente.',
  );
}

function getVentaSubmitMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return 'Revisa la conexión a internet y vuelve a intentarlo.';
    }

    if (error.status >= 500) {
      return 'No pudimos completar la venta. Vuelve a intentarlo.';
    }

    if (
      error.code === 'INSUFFICIENT_STOCK' ||
      error.code === 'VENTA_INVENTARIO_INSUFICIENTE'
    ) {
      return 'No hay suficiente inventario para realizar la venta';
    }

    if (error.code === 'VENTA_CANTIDAD_INVALIDA') {
      return `La cantidad mínima de venta es ${PESO_MINIMO_KG} kg.`;
    }

    if (error.code === 'VENTA_PRECIO_INVALIDO') {
      return 'El precio por kg está fuera del rango permitido.';
    }

    if (error.code === 'VENTA_SUBLOTE_INVALIDO') {
      return 'El sublote seleccionado no está disponible para la venta.';
    }
  }

  return error instanceof Error
    ? error.message
    : 'No fue posible registrar la venta.';
}

function esErrorGeneralGuardadoVenta(error: unknown) {
  if (!(error instanceof ApiRequestError)) {
    return false;
  }

  if (error.status === 0 || error.status >= 500) {
    return true;
  }

  const erroresCorregibles = new Set([
    'INSUFFICIENT_STOCK',
    'VENTA_INVENTARIO_INSUFICIENTE',
    'VENTA_CANTIDAD_INVALIDA',
    'VENTA_PRECIO_INVALIDO',
    'VENTA_SUBLOTE_INVALIDO',
  ]);

  return !error.field && !erroresCorregibles.has(error.code ?? '');
}

function getCantidadLoteGuidance(
  lote: LoteVenta,
  cantidad: number,
): GuidedErrorMessage {
  const disponible = getDisponibleVenta(lote);

  if (cantidad > disponible) {
    return createGuidedError(
      `La cantidad supera el disponible en ${lote.codigo}.`,
      'Cantidad excedida',
      'Solo puedes vender hasta lo disponible.',
      `Disponible: ${kg(disponible)}.`,
    );
  }

  return createGuidedError(
    `La cantidad debe ser mínimo ${PESO_MINIMO_KG} kg en ${lote.codigo}.`,
    'Cantidad inválida',
    `Ingresa mínimo ${PESO_MINIMO_KG} kg.`,
    `Ingresa mínimo ${PESO_MINIMO_KG} kg.`,
  );
}

export default function Ventas() {
  const navigate = useNavigate();
  const [cargando, setCargando] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [guardandoVenta, setGuardandoVenta] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [registroErrorMensaje, setRegistroErrorMensaje] = React.useState<
    string | null
  >(null);
  const [ventaGuardada, setVentaGuardada] =
    React.useState<VentaGuardadaResumen | null>(null);
  const [paso, setPaso] = React.useState<Step>(1);
  const [botonConfirmarPresionado, setBotonConfirmarPresionado] =
    React.useState(false);
  const [intentoPaso1, setIntentoPaso1] = React.useState(false);
  const [intentoPaso2, setIntentoPaso2] = React.useState(false);
  const [clienteMetodo, setClienteMetodo] = React.useState<
    'BUSCAR' | 'GENERAL' | 'REGISTRAR' | null
  >(null);
  const [modoVenta, setModoVenta] = React.useState<ModoVenta | null>(null);
  const [fechaVenta, setFechaVenta] = React.useState(getTodayLocalDateValue());
  const [preciosVentaTotal, setPreciosVentaTotal] = React.useState<
    Record<string, string>
  >({});
  const [lotesVenta, setLotesVenta] = React.useState<LoteVenta[]>([]);
  const [secadoExcluidoVenta, setSecadoExcluidoVenta] = React.useState({
    sublotes: 0,
    kg: 0,
  });
  const [loteAjustandoId, setLoteAjustandoId] = React.useState<string | null>(
    null,
  );
  const [clientes, setClientes] = React.useState<ClienteOption[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] =
    React.useState<ClienteOption | null>(null);
  const [busquedaCliente, setBusquedaCliente] = React.useState('');
  const [busquedaAplicada, setBusquedaAplicada] = React.useState('');
  const [mostrarModal, setMostrarModal] = React.useState(false);
  const [mostrarModalConfirmar, setMostrarModalConfirmar] =
    React.useState(false);
  const [mostrarModalCancelar, setMostrarModalCancelar] = React.useState(false);
  const [clienteForm, setClienteForm] =
    React.useState<ClienteForm>(CLIENTE_FORM_INICIAL);
  const [clienteFormErrors, setClienteFormErrors] =
    React.useState<ClienteFormErrors>({});
  const [clienteFormError, setClienteFormError] = React.useState<string | null>(
    null,
  );
  const [maxPrecioVentaKg, setMaxPrecioVentaKg] =
    React.useState(PRECIO_MAXIMO_KG);
  const precioMaximoVentaPermitido = Math.min(
    maxPrecioVentaKg,
    PRECIO_MAXIMO_KG,
  );
  const ventaLocalIdRef = React.useRef(uid());

  const cargarLotes = React.useCallback(async () => {
    try {
      setCargando(true);
      setLoadError(null);
      const [lotes, clientesData, bodegaConfig] = await Promise.all([
        obtenerLotes(),
        listarClientes(),
        obtenerConfiguracionBodega().catch(() => null),
      ]);
      if (bodegaConfig) {
        setMaxPrecioVentaKg(bodegaConfig.maxPrecioVentaKg || PRECIO_MAXIMO_KG);
      }
      const lotesDisponibles = ENABLE_SECADO_PROTOTYPE
        ? applySecadoToLots(lotes, { includeGeneratedOutputs: false })
        : lotes;
      const secadosActivos = ENABLE_SECADO_PROTOTYPE
        ? getActiveSecadoSessions()
        : [];
      setSecadoExcluidoVenta({
        sublotes: secadosActivos.reduce(
          (total, session) => total + session.sublotes.length,
          0,
        ),
        kg: round2(
          secadosActivos.reduce(
            (total, session) =>
              total +
              session.sublotes.reduce(
                (sessionTotal, sublote) => sessionTotal + sublote.pesoActual,
                0,
              ),
            0,
          ),
        ),
      });
      setLotesVenta(
        mkLotes(
          lotesDisponibles.filter((lote) => !isSecadoProcessLot(lote)),
        ),
      );
      setClientes(dedupeClientesOptions(clientesData.map(mapClienteToOption)));
    } catch (e) {
      setSecadoExcluidoVenta({ sublotes: 0, kg: 0 });
      setLoadError(
        e instanceof Error
          ? e.message
          : 'No fue posible cargar el inventario para venta.',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  React.useEffect(() => {
    void cargarLotes();
  }, [cargarLotes]);

  const clientesRecientes = React.useMemo(() => {
    const base = dedupeClientesOptions([...clientes]);
    const term = norm(busquedaAplicada.trim());
    if (!term) return base.slice(0, LIMITE);
    return base.filter((c) =>
      [c.nombre, c.documento, c.detalle].some((v) => norm(v).includes(term)),
    );
  }, [busquedaAplicada, clientes]);
  const sinClientesRegistrados = clientes.length === 0;
  const busquedaClienteActiva =
    busquedaCliente.trim().length > 0 || busquedaAplicada.trim().length > 0;
  const mostrarResultadosClientes =
    clienteMetodo === 'BUSCAR' &&
    (!clienteSeleccionado || busquedaClienteActiva);

  const lotesConCantidad = React.useMemo(() => {
    if (modoVenta === 'TOTAL') {
      return lotesVenta
        .filter((l) => getDisponibleVenta(l) > 0)
        .map((l) => ({
          ...l,
          cantidad: getDisponibleVenta(l),
          precio: toNum(preciosVentaTotal[l.tipoCafeId] ?? ''),
        }));
    }
    if (modoVenta !== 'PARCIAL') {
      return [];
    }
    return lotesVenta
      .map((l) => ({
        ...l,
        cantidad: toNum(l.cantidadKg),
        precio: toNum(l.precioKg),
      }))
      .filter((l) => l.cantidad > 0);
  }, [lotesVenta, modoVenta, preciosVentaTotal]);

  const totalKg = React.useMemo(
    () => lotesConCantidad.reduce((a, l) => a + l.cantidad, 0),
    [lotesConCantidad],
  );
  const totalEstimado = React.useMemo(
    () => lotesConCantidad.reduce((a, l) => a + l.cantidad * l.precio, 0),
    [lotesConCantidad],
  );
  const totalDisponibleVenta = React.useMemo(
    () =>
      lotesVenta.reduce((total, lote) => total + getDisponibleVenta(lote), 0),
    [lotesVenta],
  );
  const resumenDisponiblePorTipo = React.useMemo(() => {
    const resumen = new Map<
      string,
      { tipoCafeId: string; tipoCafe: string; pesoKg: number }
    >();

    for (const lote of lotesVenta) {
      const actual = resumen.get(lote.tipoCafeId);
      resumen.set(lote.tipoCafeId, {
        tipoCafeId: lote.tipoCafeId,
        tipoCafe: lote.tipoCafe,
        pesoKg: round2((actual?.pesoKg ?? 0) + getDisponibleVenta(lote)),
      });
    }

    return Array.from(resumen.values());
  }, [lotesVenta]);
  const preciosVentaTotalInvalidos = React.useMemo(() => {
    const invalidos = new Set<string>();

    for (const item of resumenDisponiblePorTipo) {
      const precioVentaItem = toNum(preciosVentaTotal[item.tipoCafeId] ?? '');
      if (
        precioVentaItem < PRECIO_MINIMO_KG ||
        precioVentaItem > precioMaximoVentaPermitido
      ) {
        invalidos.add(item.tipoCafeId);
      }
    }

    return invalidos;
  }, [precioMaximoVentaPermitido, preciosVentaTotal, resumenDisponiblePorTipo]);
  const fechaVentaValidacion = React.useMemo(
    () => validateBusinessDateRange(fechaVenta),
    [fechaVenta],
  );

  const validarPasoVenta = React.useCallback(() => {
    if (!fechaVentaValidacion.isValid) {
      return fechaVentaValidacion.message ?? 'Selecciona la fecha de venta.';
    }
    if (!lotesVenta.length) return 'No hay lotes disponibles para vender.';
    if (!modoVenta) return 'Selecciona como deseas realizar la venta.';
    if (modoVenta === 'TOTAL') {
      const tipoSinPrecio = resumenDisponiblePorTipo.find((item) =>
        preciosVentaTotalInvalidos.has(item.tipoCafeId),
      );

      if (tipoSinPrecio) {
        return `Ingresa un precio por kg válido para café ${formatCoffeeLabel(tipoSinPrecio.tipoCafe)}.`;
      }

      return null;
    }
    if (!lotesConCantidad.length)
      return 'Ingresa al menos una cantidad para continuar.';
    for (const l of lotesConCantidad) {
      if (pesoVerificadoInvalido(l))
        return `El peso verificado no puede superar el disponible en ${l.codigo}.`;
      if (l.cantidad < PESO_MINIMO_KG)
        return `La cantidad debe ser mínimo ${PESO_MINIMO_KG} kg en ${l.codigo}.`;
      if (l.cantidad > getDisponibleVenta(l))
        return `La cantidad supera el disponible en ${l.codigo}.`;
      if (
        l.precio < PRECIO_MINIMO_KG ||
        l.precio > precioMaximoVentaPermitido
      )
        return `Ingresa un precio por kg válido en ${l.codigo}.`;
    }
    return null;
  }, [
    fechaVentaValidacion.isValid,
    fechaVentaValidacion.message,
    lotesVenta.length,
    modoVenta,
    preciosVentaTotalInvalidos,
    precioMaximoVentaPermitido,
    resumenDisponiblePorTipo,
    lotesConCantidad,
  ]);

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
      return (
        cantidad < PESO_MINIMO_KG ||
        cantidad > getDisponibleVenta(lote) ||
        toNum(lote.precioKg) < PRECIO_MINIMO_KG ||
        toNum(lote.precioKg) > precioMaximoVentaPermitido ||
        pesoVerificadoInvalido(lote)
      );
    });
  }, [lotesVenta, modoVenta, precioMaximoVentaPermitido]);
  const puedeAvanzarPaso2 =
    !fechaVentaValidacion.isValid || modoVenta === null
      ? false
      : modoVenta === 'TOTAL'
        ? resumenDisponiblePorTipo.length > 0 &&
          preciosVentaTotalInvalidos.size === 0 &&
          !lotesVenta.some(pesoVerificadoInvalido)
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

  const eliminarLoteDesdeRevision = React.useCallback(
    (loteId: string) => {
      setSubmitError(null);
      setIntentoPaso2(false);
      setPaso(2);

      setLotesVenta((prev) =>
        prev.map((lote) => {
          if (modoVenta === 'TOTAL') {
            return {
              ...lote,
              cantidadKg: lote.id === loteId ? '' : String(lote.disponibleKg),
              precioKg: preciosVentaTotal[lote.tipoCafeId] || lote.precioKg,
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
        setPreciosVentaTotal({});
      }
    },
    [modoVenta, preciosVentaTotal],
  );

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
    setRegistroErrorMensaje(null);

    try {
      type PoolEntry = {
        subloteId: string;
        disponibleKg: number;
      };

      const pools = new Map<string, PoolEntry[]>();
      const detalles = [] as Array<{
        subloteId: string;
        pesoVendido: number;
        precioKg: number;
      }>;

      for (const lote of lotesConCantidad) {
        const poolKey = `${lote.tipoCafeId}::${lote.calidadId}`;

        if (!pools.has(poolKey)) {
          const detalleBase = await obtenerDetalleLote(
            lote.tipoCafeId,
            lote.calidadId,
          );
          const detalle = ENABLE_SECADO_PROTOTYPE
            ? applySecadoToDetalle(
                detalleBase,
                lote.tipoCafeId,
                lote.calidadId,
                {
                  includeGeneratedOutputs: false,
                },
              )
            : detalleBase;
          let pool = (detalle?.sublotes ?? [])
            .filter((sublote) => sublote.pesoActual > 0)
            .sort(
              (a, b) =>
                new Date(a.fechaIngreso).getTime() -
                new Date(b.fechaIngreso).getTime(),
            )
            .map((sublote) => ({
              subloteId: sublote.id,
              disponibleKg: round2(sublote.pesoActual),
            }));

          const pesoVerificado = getPesoVerificado(lote);
          const totalPool = round2(
            pool.reduce((sum, item) => sum + item.disponibleKg, 0),
          );

          if (pesoVerificado !== null && pesoVerificado < totalPool) {
            pool = distribuirPesoVerificado(pool, pesoVerificado);
            await guardarPesosSublotes(
              pool.map((entry) => ({
                id: entry.subloteId,
                pesoActual: entry.disponibleKg,
                motivo: 'Calibración antes de venta',
              })),
            );
          }

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
          throw new Error(
            `La cantidad supera el disponible en ${lote.codigo}.`,
          );
        }
      }

      const fechaVentaIso = toIsoDateAtUtcNoon(fechaVenta);
      const respuesta = await crearVenta({
        ...(fechaVentaIso ? { fecha: fechaVentaIso } : {}),
        ...(!clienteSeleccionado.rapido
          ? { clienteId: clienteSeleccionado.id }
          : {}),
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
      void cargarLotes();
    } catch (error) {
      const mensaje = getVentaSubmitMessage(error);

      if (esErrorGeneralGuardadoVenta(error)) {
        setRegistroErrorMensaje(mensaje);
        setSubmitError(null);
      } else {
        setSubmitError(mensaje);
      }
    } finally {
      setGuardandoVenta(false);
      setBotonConfirmarPresionado(false);
    }
  }, [
    cargarLotes,
    clienteSeleccionado,
    guardandoVenta,
    lotesConCantidad,
    fechaVenta,
    totalEstimado,
    totalKg,
    validarPasoVenta,
  ]);

  const reiniciar = React.useCallback(() => {
    setPaso(1);
    setGuardandoVenta(false);
    setSubmitError(null);
    setRegistroErrorMensaje(null);
    setVentaGuardada(null);
    setClienteSeleccionado(null);
    setClienteMetodo(null);
    setBusquedaCliente('');
    setBusquedaAplicada('');
    setModoVenta(null);
    setMostrarModalConfirmar(false);
    setMostrarModalCancelar(false);
    setFechaVenta(getTodayLocalDateValue());
    setPreciosVentaTotal({});
    setClienteFormErrors({});
    setIntentoPaso1(false);
    setIntentoPaso2(false);
    setLoadError(null);
    ventaLocalIdRef.current = uid();
    void cargarLotes();
  }, [cargarLotes]);

  const updateLote = (
    id: string,
    campo: 'cantidadKg' | 'precioKg' | 'pesoVerificadoKg',
    valor: string,
  ) => {
    setLotesVenta((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;

        const normalizado =
          campo === 'precioKg'
            ? sanitizeIntegerVentaInput(
                valor,
                precioMaximoVentaPermitido,
                l.precioKg,
              )
            : sanitizeDecimalVentaInput(
                valor,
                campo === 'pesoVerificadoKg' ? l.disponibleKg : getDisponibleVenta(l),
              );

        return { ...l, [campo]: normalizado };
      }),
    );
  };

  const usarPesoRegistrado = (lote: LoteVenta) => {
    setLotesVenta((prev) =>
      prev.map((item) =>
        item.id === lote.id
          ? {
              ...item,
              pesoVerificadoKg: '',
              cantidadKg:
                modoVenta === 'PARCIAL'
                  ? String(round2(lote.disponibleKg))
                  : item.cantidadKg,
            }
          : item,
      ),
    );
  };

  const seleccionarCliente = React.useCallback((cliente: ClienteOption) => {
    setClienteSeleccionado(cliente);
    setClienteMetodo(cliente.rapido ? 'GENERAL' : 'BUSCAR');
    setBusquedaCliente('');
    setBusquedaAplicada('');
    setIntentoPaso1(false);
    setSubmitError(null);
  }, []);

  const buscarCliente = () => setBusquedaAplicada(busquedaCliente.trim());
  const pasoActual = React.useMemo(() => datosPasoVenta(paso), [paso]);
  const clienteSeleccionadoId = clienteSeleccionado?.id ?? null;
  const clienteInvalido = paso === 1 && intentoPaso1 && !clienteSeleccionado;
  const modoInvalido = paso === 2 && intentoPaso2 && !modoVenta;
  const fechaVentaInvalida =
    paso === 2 && intentoPaso2 && !fechaVentaValidacion.isValid;
  const precioTotalInvalido =
    paso === 2 &&
    modoVenta === 'TOTAL' &&
    intentoPaso2 &&
    preciosVentaTotalInvalidos.size > 0;
  const haySecadoExcluido =
    ENABLE_SECADO_PROTOTYPE && secadoExcluidoVenta.sublotes > 0;
  const sinInventario = paso === 2 && lotesVenta.length === 0;
  const parcialSinCantidad =
    paso === 2 && modoVenta === 'PARCIAL' && !hayCantidadParcial;
  const parcialSinSeleccion = parcialSinCantidad && intentoPaso2;
  const volverPasoAnterior = () => {
    if (paso > 1) {
      anterior();
      return;
    }

    navigate('/inicio');
  };

  const confirmarCancelarVenta = () => {
    setMostrarModalCancelar(false);
    navigate('/inicio');
  };

  const validarClienteForm = React.useCallback(() => {
    const errores: ClienteFormErrors = {};
    const nombre = validateProducerName(
      clienteForm.nombre,
      clienteForm.tipoDocumento,
    );
    const telefono = validatePhoneNumber(clienteForm.telefono, 'El teléfono', {
      optional: true,
    });
    const documento = validateDocumentNumber(
      clienteForm.documento,
      'La cédula o NIT',
      {
        optional: true,
        documentType: clienteForm.tipoDocumento,
      },
    );

    if (!nombre.isValid) errores.nombre = nombre.message;
    if (!telefono.isValid) errores.telefono = telefono.message;
    if (!documento.isValid) errores.documento = documento.message;

    return errores;
  }, [
    clienteForm.documento,
    clienteForm.nombre,
    clienteForm.telefono,
    clienteForm.tipoDocumento,
  ]);

  const guardarCliente = async () => {
    const nombre = clienteForm.nombre.trim();
    const telefono = sanitizePersonDigits(clienteForm.telefono, 15);
    const documento = sanitizeDocumentInput(
      clienteForm.documento,
      clienteForm.tipoDocumento,
    );
    const errores = validarClienteForm();

    setClienteFormErrors(errores);
    setClienteFormError(null);

    if (Object.keys(errores).length > 0) {
      return;
    }

    const clienteExistente = findClienteExistente(clientes, nombre, documento);
    if (clienteExistente) {
      setClienteSeleccionado(clienteExistente);
      setClienteMetodo('BUSCAR');
      setBusquedaCliente('');
      setBusquedaAplicada('');
      setMostrarModal(false);
      setClienteForm(CLIENTE_FORM_INICIAL);
      setClienteFormErrors({});
      setIntentoPaso1(false);
      setSubmitError(null);
      return;
    }

    try {
      const clienteGuardado = await crearCliente({
        nombre,
        tipoDocumento: clienteForm.tipoDocumento,
        documento: documento || undefined,
        telefono: telefono || undefined,
      });
      const nuevo = mapClienteToOption(clienteGuardado);
      setClientes((actual) =>
        dedupeClientesOptions([
          nuevo,
          ...actual.filter((cliente) => cliente.id !== nuevo.id),
        ]),
      );
      setClienteSeleccionado(nuevo);
      setIntentoPaso1(false);
      setBusquedaCliente('');
      setBusquedaAplicada('');
      setMostrarModal(false);
      setClienteMetodo('BUSCAR');
      setClienteForm(CLIENTE_FORM_INICIAL);
      setClienteFormErrors({});
      setClienteFormError(null);
      setSubmitError(null);
    } catch (error) {
      setClienteFormError(
        error instanceof Error
          ? error.message
          : 'No fue posible registrar el cliente.',
      );
    }
  };

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
                No se pudo guardar la venta
              </h1>
              <p className="mt-3 text-[0.98rem] leading-6 text-slate-500">
                {registroErrorMensaje}
              </p>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => void confirmar()}
                disabled={guardandoVenta}
                className="inline-flex min-h-[54px] items-center justify-center gap-3 rounded-[14px] bg-[#1f3fa7] px-5 py-3 text-[1.05rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {guardandoVenta ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Reintentando...
                  </>
                ) : (
                  'Reintentar'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRegistroErrorMensaje(null);
                  setPaso(3);
                }}
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

  if (ventaGuardada) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] px-4 py-8 pb-10 text-slate-900">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[430px] flex-col justify-center">
          <section className="rounded-[26px] bg-white p-6 text-center shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
            <div className="mx-auto flex h-[92px] w-[92px] items-center justify-center rounded-full bg-[#eaf3ff]">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#12bf84] text-white">
                <CheckCircle2 size={28} strokeWidth={3} />
              </span>
            </div>
            <h2 className="mt-6 text-[1.75rem] font-black text-slate-950">
              Venta registrada
            </h2>
            <p className="mt-2 text-base leading-6 text-slate-500">
              La venta se guardó correctamente.
            </p>

            <article className="mt-6 rounded-[18px] border border-[#e1e7f3] bg-[#fbfcff] p-4 text-left">
              <p className="text-[0.7rem] font-black uppercase tracking-[0.12em] text-slate-500">
                Resumen de venta
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-slate-500">Cliente</span>
                  <span className="text-right font-black text-slate-950">
                    {ventaGuardada.clienteNombre}
                  </span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-slate-500">Fecha</span>
                  <span className="font-black text-slate-950">
                    {formatDateLabel(ventaGuardada.fecha)}
                  </span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-slate-500">Total kg</span>
                  <span className="font-black text-slate-950">
                    {kg(ventaGuardada.totalKg)}
                  </span>
                </div>
                <div className="rounded-[14px] bg-[#f0f4ff] px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[0.78rem] font-black uppercase text-slate-700">
                      Total recibido
                    </span>
                    <span className="text-[1.35rem] font-black text-[#173ea6]">
                      {money(ventaGuardada.totalVenta)}
                    </span>
                  </div>
                </div>
              </div>
            </article>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={reiniciar}
                className="inline-flex min-h-[56px] items-center justify-center rounded-[16px] bg-[#1f3fa7] px-5 text-base font-black text-white shadow-[0_14px_30px_rgba(31,63,167,0.22)]"
              >
                Registrar nueva venta
              </button>
              <button
                type="button"
                onClick={() => navigate('/inventario')}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[16px] bg-[#edf1f8] px-5 text-base font-black text-[#1f3f97]"
              >
                Ir a inventario
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-5 pb-[145px] text-slate-900">
      <div className="mx-auto max-w-[430px] space-y-4">
        <header className="px-4 py-4 pt-6">
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              onClick={volverPasoAnterior}
              className="absolute left-0 inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-900 transition hover:bg-white/70 hover:opacity-75"
              aria-label={
                paso > 1 ? 'Volver al paso anterior' : 'Salir a inicio'
              }
            >
              <ArrowLeft size={22} />
            </button>
            <h1 className="text-[1.35rem] font-semibold text-slate-900">
              Registro de Venta
            </h1>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between text-[1.05rem] font-medium text-slate-900">
              <span>
                Paso {paso}: {pasoActual.titulo}
              </span>
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
          <LoadingCard text="Cargando inventario para venta..." />
        ) : loadError ? (
          <section className="rounded-[18px] border border-[#f3d7dc] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0f2] text-[#d9485a]">
                <RefreshCw size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.95rem] font-semibold text-slate-900">
                  No se pudo cargar el inventario
                </p>
                <p className="mt-1 text-[0.82rem] leading-5 text-slate-500">
                  Revisa tu conexión e intenta de nuevo.
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
                <h2 className="text-[1.3rem] font-semibold text-[#102d92]">
                  ¿Cómo deseas realizar la venta?
                </h2>

                <div className="mt-3 rounded-[14px] border border-[#dbe1f1] bg-[#f7f8fe] p-3">
                  <p className="text-xs font-medium text-slate-500">
                    Cliente seleccionado
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {clienteSeleccionado?.nombre ?? 'Sin cliente'}
                  </p>
                  <p className="text-xs text-slate-600">
                    {clienteSeleccionado?.documento ?? 'Selección pendiente'}
                  </p>
                </div>

                <div className="mt-4 rounded-[14px] border border-[#dbe1f1] bg-[#f7f8fe] p-3">
                  <p className="text-xs font-medium text-slate-500">
                    Fecha de venta
                  </p>
                  <div
                    className={`mt-2 flex items-center gap-3 rounded-[12px] border bg-white px-3 py-3 ${
                      fechaVentaInvalida
                        ? 'border-[#ef4444]'
                        : 'border-[#d7dcec]'
                    }`}
                  >
                    <CalendarDays size={16} className="text-[#102d92]" />
                    <input
                      type="date"
                      value={fechaVenta}
                      min={BUSINESS_MIN_DATE_VALUE}
                      max={getTodayLocalDateValue()}
                      onChange={(event) => {
                        setFechaVenta(event.target.value);
                        setSubmitError(null);
                      }}
                      className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                    />
                  </div>
                  {fechaVentaInvalida ? (
                    <InlineGuidedError
                      message={getVentasGuidance(
                        fechaVentaValidacion.message ??
                          'Selecciona la fecha de venta.',
                      )}
                      className="mt-2"
                    />
                  ) : null}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setModoVenta('PARCIAL');
                      setIntentoPaso2(false);
                    }}
                    disabled={sinInventario}
                    className={`min-h-[92px] rounded-[16px] border p-4 text-left ${
                      modoVenta === 'PARCIAL'
                        ? 'border-[#102d92] bg-[#eef2ff]'
                        : sinInventario
                          ? 'cursor-not-allowed border-[#e3e7f3] bg-slate-50 opacity-60'
                          : modoInvalido
                            ? 'border-[#f2c17b] bg-[#fff9ef]'
                            : 'border-[#e3e7f3] bg-white'
                    }`}
                  >
                    <p className="text-base font-black text-slate-900">
                      Venta parcial
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Seleccionar cantidad a vender
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModoVenta('TOTAL');
                      setIntentoPaso2(false);
                    }}
                    disabled={sinInventario}
                    className={`min-h-[92px] rounded-[16px] border p-4 text-left ${
                      modoVenta === 'TOTAL'
                        ? 'border-[#102d92] bg-[#eef2ff]'
                        : sinInventario
                          ? 'cursor-not-allowed border-[#e3e7f3] bg-slate-50 opacity-60'
                          : modoInvalido
                            ? 'border-[#f2c17b] bg-[#fff9ef]'
                            : 'border-[#e3e7f3] bg-white'
                    }`}
                  >
                    <p className="text-base font-black text-slate-900">
                      Venta total
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Vender todo el inventario disponible
                    </p>
                  </button>
                </div>
                {sinInventario ? (
                  <InlineGuidedError
                    message={getVentasGuidance(
                      'No hay lotes disponibles para vender.',
                    )}
                    className="mt-2"
                  />
                ) : null}
                {modoInvalido ? (
                  <InlineGuidedError
                    message={getVentasGuidance(
                      'Selecciona como deseas realizar la venta.',
                    )}
                    className="mt-2"
                  />
                ) : null}

                {modoVenta === 'TOTAL' ? (
                  <div className="mt-6 space-y-4">
                    <div className="text-center">
                      <h2 className="text-[1.5rem] font-black leading-tight text-slate-950">
                        Se venderá todo el café disponible en inventario
                      </h2>
                      <p className="mt-2 text-sm font-semibold text-slate-500">
                        Incluye todos los tipos y calidades disponibles.
                      </p>
                      {haySecadoExcluido ? (
                        <p className="mt-3 rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-3 text-left text-xs font-semibold leading-5 text-amber-800">
                          No se tendrán en cuenta los sublotes que se
                          encuentran en proceso de secado (
                          {secadoExcluidoVenta.sublotes} sublote
                          {secadoExcluidoVenta.sublotes === 1 ? '' : 's'}
                          {secadoExcluidoVenta.kg > 0
                            ? `, ${kg(secadoExcluidoVenta.kg)}`
                            : ''}
                          ).
                        </p>
                      ) : null}
                    </div>

                    <article className="rounded-[18px] bg-white p-4 shadow-sm">
                      <p className="text-[0.72rem] font-black uppercase tracking-[0.12em] text-slate-500">
                        Resumen por tipo
                      </p>
                      <div className="mt-4 max-h-[180px] divide-y divide-slate-100 overflow-y-auto pr-[6px] [scrollbar-color:#c5ccda_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-[8px] [&::-webkit-scrollbar-thumb]:bg-[#c5ccda]">
                        {resumenDisponiblePorTipo.map((item) => (
                          <div
                            key={item.tipoCafeId}
                            className="flex items-center justify-between py-3"
                          >
                            <span className="font-semibold text-slate-600">
                              Café {formatCoffeeLabel(item.tipoCafe)}
                            </span>
                            <span className="font-black text-slate-950">
                              {kg(item.pesoKg)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="rounded-[18px] border border-[#e2e7f2] bg-[#f8faff] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold text-slate-700">
                          Total a vender
                        </span>
                        <span className="text-[1.55rem] font-black text-slate-950">
                          {kg(totalDisponibleVenta)}
                        </span>
                      </div>
                    </article>

                    <div className="rounded-[18px] bg-white p-4 shadow-sm">
                      <p className="text-[0.72rem] font-black uppercase tracking-[0.12em] text-slate-500">
                        Precio por kg por tipo
                      </p>
                      <div className="mt-3 max-h-[260px] space-y-3 overflow-y-auto pr-[6px] [scrollbar-color:#c5ccda_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-[8px] [&::-webkit-scrollbar-thumb]:bg-[#c5ccda]">
                        {resumenDisponiblePorTipo.map((item) => {
                          const precioTipo =
                            preciosVentaTotal[item.tipoCafeId] ?? '';
                          const precioTipoInvalido =
                            modoVenta === 'TOTAL' &&
                            (intentoPaso2 || precioTipo.trim() !== '') &&
                            (toNum(precioTipo) < PRECIO_MINIMO_KG ||
                              toNum(precioTipo) > precioMaximoVentaPermitido);

                          return (
                            <div key={item.tipoCafeId}>
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <span className="text-sm font-black text-slate-800">
                                  Café {formatCoffeeLabel(item.tipoCafe)}
                                </span>
                                <span className="text-xs font-semibold text-slate-500">
                                  {kg(item.pesoKg)}
                                </span>
                              </div>
                              <label
                                className={`flex min-h-[56px] items-center rounded-[14px] border bg-[#f8faff] px-4 ${
                                  precioTipoInvalido
                                    ? 'border-[#ef4444]'
                                    : 'border-[#d7dcec]'
                                }`}
                              >
                                <span className="mr-3 text-xl font-black text-[#1f3fa7]">
                                  $
                                </span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={6}
                                  value={precioTipo}
                                  onChange={(event) => {
                                    const raw = sanitizeIntegerVentaInput(
                                      event.target.value,
                                      precioMaximoVentaPermitido,
                                      precioTipo,
                                    );
                                    setPreciosVentaTotal((actual) => ({
                                      ...actual,
                                      [item.tipoCafeId]: raw,
                                    }));
                                  }}
                                  placeholder="Ej. 14500"
                                  className="w-full bg-transparent text-xl font-black text-slate-950 outline-none placeholder:text-slate-300"
                                />
                              </label>
                              <p className="mt-1 text-right text-[0.62rem] font-semibold text-slate-400">
                                Máx. $100.000/kg
                              </p>
                              {precioTipoInvalido ? (
                                <InlineGuidedError
                                  message={getVentasGuidance(
                                    toNum(precioTipo) < PRECIO_MINIMO_KG
                                      ? 'El precio mínimo es $1.000/kg.'
                                      : 'El precio no puede superar $100.000/kg.',
                                  )}
                                  className="mt-2"
                                />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                      {precioTotalInvalido ? (
                        <p className="mt-2 text-xs font-semibold text-[#b42318]">
                          Completa el precio de cada tipo de café para
                          continuar.
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {modoVenta === 'PARCIAL' ? (
                  <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto pr-[6px] [scrollbar-color:#c5ccda_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-[8px] [&::-webkit-scrollbar-thumb]:bg-[#c5ccda]">
                    {lotesVenta.map((lote) => {
                      const cantidad = toNum(lote.cantidadKg);
                      const cantidadIngresada = lote.cantidadKg.trim() !== '';
                      const precioIngresado = lote.precioKg.trim() !== '';
                      const disponibleVenta = getDisponibleVenta(lote);
                      const ajustePesoKg = round2(
                        lote.disponibleKg - disponibleVenta,
                      );
                      const pesoVerificadoError = pesoVerificadoInvalido(lote);
                      const estaAjustandoPeso = loteAjustandoId === lote.id;
                      const cantidadInvalida =
                        modoVenta === 'PARCIAL' &&
                        cantidadIngresada &&
                        (cantidad < PESO_MINIMO_KG ||
                          cantidad > disponibleVenta);
                      const precioInvalido =
                        modoVenta === 'PARCIAL' &&
                        (cantidadIngresada || precioIngresado) &&
                        (toNum(lote.precioKg) < PRECIO_MINIMO_KG ||
                          toNum(lote.precioKg) > precioMaximoVentaPermitido);
                      const cantidadErrorTexto =
                        cantidadInvalida && cantidad < PESO_MINIMO_KG
                          ? `Mínimo ${PESO_MINIMO_KG} kg.`
                          : cantidadInvalida
                            ? `Disponible: ${kg(disponibleVenta)}.`
                            : '';
                      const precioErrorTexto =
                        precioInvalido && toNum(lote.precioKg) < PRECIO_MINIMO_KG
                          ? 'Mínimo $1.000/kg.'
                          : precioInvalido
                            ? 'Máximo $100.000/kg.'
                            : '';

                      return (
                        <article
                          key={lote.id}
                          className="rounded-[16px] border border-[#e5e8f3] bg-[#fcfcff] p-4"
                        >
                          <p className="text-lg font-semibold text-[#102d92]">
                            {lote.codigo}
                          </p>
                          <p className="text-sm text-slate-600">
                            {coffeeWithQuality(lote.tipoCafe, lote.calidad)}
                          </p>
                          <div className="mt-3 rounded-[14px] border border-[#e4e9f4] bg-white p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[0.68rem] font-black uppercase tracking-[0.08em] text-slate-500">
                                  Peso para vender
                                </p>
                                <p className="mt-1 text-base font-black text-slate-900">
                                  {kg(disponibleVenta)}
                                </p>
                                <p className="text-[0.72rem] leading-5 text-slate-500">
                                  Registrado: {kg(lote.disponibleKg)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setLoteAjustandoId((actual) =>
                                    actual === lote.id ? null : lote.id,
                                  )
                                }
                                className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-[12px] bg-[#eef3ff] px-3 text-[0.72rem] font-black text-[#102d92]"
                                aria-expanded={estaAjustandoPeso}
                              >
                                <Scale size={14} />
                                Ajustar
                              </button>
                            </div>
                            {estaAjustandoPeso ? (
                              <div className="mt-3 rounded-[12px] border border-[#dce5f6] bg-[#f8faff] p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <label
                                    className="text-xs font-black text-slate-600"
                                    htmlFor={`peso-${lote.id}`}
                                  >
                                    Peso total actual
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => usarPesoRegistrado(lote)}
                                    className="rounded-full bg-white px-3 py-1.5 text-[0.65rem] font-black text-[#102d92] shadow-sm"
                                  >
                                    Usar registrado
                                  </button>
                                </div>
                                <input
                                  id={`peso-${lote.id}`}
                                  type="range"
                                  min={0}
                                  max={lote.disponibleKg}
                                  step="0.1"
                                  value={disponibleVenta}
                                  onChange={(event) =>
                                    updateLote(
                                      lote.id,
                                      'pesoVerificadoKg',
                                      event.target.value,
                                    )
                                  }
                                  className="mt-3 w-full accent-[#102d92]"
                                />
                                <label className="mt-3 flex min-h-[48px] items-center gap-3 rounded-[12px] border border-[#d7dcec] bg-white px-3">
                                  <Scale
                                    size={16}
                                    className="shrink-0 text-[#102d92]"
                                  />
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    maxLength={12}
                                    value={lote.pesoVerificadoKg}
                                    onChange={(event) =>
                                      updateLote(
                                        lote.id,
                                        'pesoVerificadoKg',
                                        event.target.value,
                                      )
                                    }
                                    placeholder={`Actual: ${kg(lote.disponibleKg)}`}
                                    className={`w-full bg-transparent text-sm font-semibold outline-none ${
                                      pesoVerificadoError
                                        ? 'text-[#b42318]'
                                        : 'text-slate-900'
                                    }`}
                                  />
                                  <span className="text-xs font-black text-slate-400">
                                    kg
                                  </span>
                                </label>
                              </div>
                            ) : null}
                            {pesoVerificadoError ? (
                              <p className="mt-2 text-xs font-semibold text-[#b42318]">
                                El peso verificado debe estar entre 0 y{' '}
                                {kg(lote.disponibleKg)}.
                              </p>
                            ) : ajustePesoKg > 0 ? (
                              <p className="mt-2 text-xs font-semibold text-[#8a5b10]">
                                Peso ajustado: se vendera sobre{' '}
                                {kg(disponibleVenta)}.
                              </p>
                            ) : null}
                          </div>

                          {modoVenta === 'PARCIAL' ? (
                            <>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  maxLength={12}
                                  value={lote.cantidadKg}
                                  onChange={(event) =>
                                    updateLote(
                                      lote.id,
                                      'cantidadKg',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Cantidad kg"
                                  className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:border-[#102d92] ${
                                    cantidadInvalida
                                      ? 'border-[#ef4444] bg-[#fff7f7] text-[#b42318]'
                                      : 'border-[#d7dcec] bg-white text-slate-900'
                                  }`}
                                />
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={6}
                                  value={lote.precioKg}
                                  onChange={(event) =>
                                    updateLote(
                                      lote.id,
                                      'precioKg',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Precio por kg"
                                  className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:border-[#102d92] ${
                                    precioInvalido
                                      ? 'border-[#ef4444] bg-[#fff7f7] text-[#b42318]'
                                      : 'border-[#d7dcec] bg-white text-slate-900'
                                  }`}
                                />
                              </div>
                              {cantidadInvalida || precioInvalido ? (
                                <div className="mt-1 grid grid-cols-2 gap-2 text-[0.62rem] font-semibold text-[#b42318]">
                                  <p className="min-h-[16px] pl-1">
                                    {cantidadErrorTexto}
                                  </p>
                                  <p className="min-h-[16px] pr-1 text-right">
                                    {precioErrorTexto}
                                  </p>
                                </div>
                              ) : null}
                              {false && cantidadInvalida ? (
                                <InlineGuidedError
                                  message={getCantidadLoteGuidance(
                                    lote,
                                    cantidad,
                                  )}
                                  className="mt-2"
                                />
                              ) : null}
                              {false && precioInvalido ? (
                                <InlineGuidedError
                                  message={getVentasGuidance(
                                    toNum(lote.precioKg) < PRECIO_MINIMO_KG
                                      ? 'El precio mínimo es $1.000/kg.'
                                      : 'El precio no puede superar $100.000/kg.',
                                  )}
                                  className="mt-2"
                                />
                              ) : null}
                              <div className="mt-1 grid grid-cols-2 gap-2 text-[0.6rem] font-semibold text-slate-400">
                                <p className="pl-1">Máx. disponible</p>
                                <p className="pr-1 text-right">
                                  Máx. $100.000/kg
                                </p>
                              </div>
                            </>
                          ) : (
                            <p className="mt-3 text-sm text-slate-600">
                              En modo total se vende el peso disponible
                              verificado: {kg(disponibleVenta)}.
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : null}
                {parcialSinSeleccion ? (
                  <InlineGuidedError
                    message={getVentasGuidance(
                      'Ingresa una cantidad en al menos un lote para continuar.',
                    )}
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
                    disabled={sinInventario}
                    className={`inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[16px] px-5 py-4 text-[1.35rem] font-semibold text-white shadow-[0_12px_28px_rgba(16,45,146,0.26)] ${
                      sinInventario
                        ? 'cursor-not-allowed bg-[#7f93cf]'
                        : 'bg-[#1f3fa7]'
                    }`}
                  >
                    Siguiente paso
                  </button>
                  <button
                    type="button"
                    onClick={anterior}
                    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-[#edf1fa] px-4 py-3 text-sm font-semibold text-slate-600"
                  >
                    Regresar
                  </button>
                </div>
              </section>
            ) : null}

            {paso === 1 ? (
              <section className="space-y-4">
                <p className="text-[0.8rem] font-medium text-slate-500">
                  Selecciona cómo deseas elegir el cliente
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setClienteMetodo('BUSCAR');
                    if (clienteSeleccionado?.id === CLIENTE_GENERAL.id) {
                      setClienteSeleccionado(null);
                    }
                  }}
                  className={`w-full rounded-[16px] border bg-white p-4 text-left shadow-sm transition ${
                    clienteMetodo === 'BUSCAR'
                      ? 'border-[#1f3fa7] ring-1 ring-[#1f3fa7]'
                      : 'border-[#e3e7f3]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#eef3ff] text-[#1f3fa7]">
                      <Search size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.95rem] font-black text-slate-900">
                        Buscar cliente
                      </p>
                      <p className="mt-1 text-[0.78rem] text-slate-500">
                        Selecciona un cliente registrado
                      </p>
                    </div>
                    <span
                      className={`h-6 w-6 rounded-full border-2 ${
                        clienteMetodo === 'BUSCAR'
                          ? 'border-[#1f3fa7] bg-[#1f3fa7] shadow-[inset_0_0_0_4px_white]'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                </button>

                {clienteMetodo === 'BUSCAR' ? (
                  <div className="space-y-3">
                    <label className="flex min-h-[52px] items-center gap-3 rounded-[14px] bg-[#eef2f7] px-3">
                      <Search size={17} className="text-slate-400" />
                      <input
                        type="text"
                        value={busquedaCliente}
                        maxLength={60}
                        onChange={(event) => {
                          const busqueda = event.target.value.slice(0, 60);
                          setBusquedaCliente(busqueda);
                          setBusquedaAplicada(busqueda.trim());
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            buscarCliente();
                          }
                        }}
                        placeholder="Nombre o identificación..."
                        className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={buscarCliente}
                        aria-label="Buscar cliente"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-white text-[#1f3fa7]"
                      >
                        <Search size={16} />
                      </button>
                    </label>

                    {mostrarResultadosClientes ? (
                      clientesRecientes.length === 0 ? (
                        <div className="rounded-[14px] border border-dashed border-[#d5dced] bg-white px-4 py-5 text-center text-sm text-slate-500">
                          <p className="font-semibold text-slate-700">
                            {sinClientesRegistrados
                              ? 'Aún no hay clientes registrados'
                              : 'No se encontraron resultados'}
                          </p>
                          <p className="mt-1">
                            {sinClientesRegistrados
                              ? 'Registra uno para comenzar.'
                              : 'Intenta con otro nombre o documento.'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {clientesRecientes.map((cliente) => {
                            const selected =
                              clienteSeleccionadoId === cliente.id;
                            return (
                              <button
                                key={cliente.id}
                                type="button"
                                onClick={() => seleccionarCliente(cliente)}
                                className={`w-full rounded-[14px] border px-3 py-3 text-left ${
                                  selected
                                    ? 'border-[#102d92] bg-[#eef2ff]'
                                    : 'border-[#e3e7f3] bg-white'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="rounded-xl bg-[#e8eefc] p-2 text-[#102d92]">
                                    <User size={15} />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-black text-slate-900">
                                      {cliente.nombre}
                                    </p>
                                    <p className="mt-0.5 truncate text-xs text-slate-500">
                                      {cliente.documento}
                                    </p>
                                  </div>
                                  {selected ? (
                                    <CheckCircle2
                                      size={20}
                                      className="text-[#1f3fa7]"
                                    />
                                  ) : null}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )
                    ) : null}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => seleccionarCliente(CLIENTE_GENERAL)}
                  className={`w-full rounded-[16px] border bg-white p-4 text-left shadow-sm transition ${
                    clienteMetodo === 'GENERAL'
                      ? 'border-[#1f3fa7] bg-[#eef4ff] ring-1 ring-[#1f3fa7]'
                      : 'border-[#e3e7f3]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#eef3ff] text-[#1f3fa7]">
                      <User size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.95rem] font-black text-slate-900">
                        Cliente genérico
                      </p>
                      <p className="mt-1 text-[0.78rem] text-slate-500">
                        Venta rápida sin cliente registrado
                      </p>
                    </div>
                    <span
                      className={`h-6 w-6 rounded-full border-2 ${
                        clienteMetodo === 'GENERAL'
                          ? 'border-[#1f3fa7] bg-[#1f3fa7] shadow-[inset_0_0_0_4px_white]'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setClienteMetodo('REGISTRAR');
                    setClienteForm(CLIENTE_FORM_INICIAL);
                    setClienteFormErrors({});
                    setClienteFormError(null);
                    setMostrarModal(true);
                  }}
                  className={`w-full rounded-[16px] border bg-white p-4 text-left shadow-sm transition ${
                    clienteMetodo === 'REGISTRAR'
                      ? 'border-[#1f3fa7] ring-1 ring-[#1f3fa7]'
                      : 'border-[#e3e7f3]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#eef3ff] text-[#1f3fa7]">
                      <Plus size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.95rem] font-black text-slate-900">
                        Registrar cliente
                      </p>
                      <p className="mt-1 text-[0.78rem] text-slate-500">
                        Crear un nuevo cliente
                      </p>
                    </div>
                    <span
                      className={`h-6 w-6 rounded-full border-2 ${
                        clienteMetodo === 'REGISTRAR'
                          ? 'border-[#1f3fa7] bg-[#1f3fa7] shadow-[inset_0_0_0_4px_white]'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                </button>

                <section>
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.12em] text-slate-400">
                    Cliente seleccionado
                  </p>
                  <div className="mt-3 rounded-[16px] bg-white p-4 shadow-sm">
                    {clienteSeleccionado ? (
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#eef3ff] text-[#1f3fa7]">
                          <User size={18} />
                        </span>
                        <div>
                          <p className="font-black text-slate-950">
                            {clienteSeleccionado.nombre}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {clienteSeleccionado.rapido
                              ? 'Venta rápida'
                              : clienteSeleccionado.documento}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 text-center text-sm font-semibold text-slate-400">
                        Selecciona a quién le harás la venta
                      </div>
                    )}
                  </div>
                </section>

                {clienteInvalido ? (
                  <InlineGuidedError
                    message={getVentasGuidance(
                      'Selecciona un cliente para continuar.',
                    )}
                  />
                ) : null}

                <button
                  type="button"
                  onClick={siguiente}
                  className="inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[14px] bg-[#1f3fa7] px-5 py-4 text-base font-black text-white shadow-[0_14px_30px_rgba(31,63,167,0.22)]"
                >
                  Siguiente paso
                </button>
              </section>
            ) : null}

            {paso === 3 ? (
              <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-medium text-slate-500">
                  Revisión final
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
                  <p className="text-xs font-medium text-slate-500">Cliente</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {clienteSeleccionado?.nombre ?? 'Sin cliente'}
                  </p>
                  <p className="text-xs text-slate-600">
                    {clienteSeleccionado?.documento ?? 'Selección pendiente'}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Fecha
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDateLabel(fechaVenta)}
                  </p>
                </div>
                <div className="mt-4 max-h-[260px] space-y-2 overflow-y-auto pr-[6px] [scrollbar-color:#c5ccda_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-[8px] [&::-webkit-scrollbar-thumb]:bg-[#c5ccda]">
                  {lotesConCantidad.map((lote) => (
                    <div
                      key={lote.id}
                      className="rounded-[12px] border border-[#e5e7f2] bg-[#fcfcff] px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {lote.codigo}
                          </p>
                          <p className="text-xs text-slate-600">
                            {coffeeWithQuality(lote.tipoCafe, lote.calidad)}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#102d92]">
                            {kg(lote.cantidad)} -{' '}
                            {money(lote.cantidad * lote.precio)}
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

                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={() => setMostrarModalConfirmar(true)}
                    disabled={guardandoVenta || botonConfirmarPresionado}
                    className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-sm font-semibold text-white ${
                      guardandoVenta || botonConfirmarPresionado
                        ? 'bg-[#7f93cf] cursor-wait'
                        : 'bg-[#102d92]'
                    }`}
                  >
                    {guardandoVenta || botonConfirmarPresionado ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Guardando venta...
                      </>
                    ) : (
                      'Confirmar venta'
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarModalCancelar(true)}
                  disabled={guardandoVenta || botonConfirmarPresionado}
                  className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-[14px] px-4 py-3 text-sm font-black text-slate-500 disabled:opacity-60"
                >
                  Cancelar
                </button>
              </section>
            ) : null}
          </>
        )}
      </div>

      {mostrarModalConfirmar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[24px] bg-white p-6 text-center shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
            <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f1ff] text-[#1f3fa7]">
              <ReceiptText size={24} />
            </div>
            <h2 className="mt-5 text-[1.8rem] font-black leading-tight text-slate-950">
              Confirmar venta
            </h2>
            <p className="mt-3 text-base leading-6 text-slate-500">
              Se registrará esta venta y se descontará del inventario.
            </p>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalConfirmar(false);
                  void confirmar();
                }}
                disabled={guardandoVenta || botonConfirmarPresionado}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] bg-[#1f3fa7] px-5 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {guardandoVenta || botonConfirmarPresionado
                  ? 'Guardando venta...'
                  : 'Confirmar venta'}
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalConfirmar(false)}
                disabled={guardandoVenta || botonConfirmarPresionado}
                className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] px-5 text-base font-black text-slate-500 disabled:opacity-70"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModalCancelar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[24px] bg-white p-6 text-center shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
            <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#fff0f2] text-[#e24c5a]">
              <AlertTriangle size={24} />
            </div>
            <h2 className="mt-5 text-[1.8rem] font-black leading-tight text-slate-950">
              Cancelar venta
            </h2>
            <p className="mt-3 text-base leading-6 text-slate-500">
              Se perderán los datos de esta venta.
            </p>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={confirmarCancelarVenta}
                className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] bg-[#1f3fa7] px-5 text-base font-black text-white"
              >
                Cancelar venta
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalCancelar(false)}
                className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] px-5 text-base font-black text-[#1f3fa7]"
              >
                Continuar editando
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/55 px-5 py-6 backdrop-blur-sm">
          <div className="flex max-h-[78vh] w-full max-w-[360px] flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_24px_56px_rgba(15,23,42,0.26)]">
            <div className="shrink-0 px-4 pb-3 pt-3">
              <div className="mx-auto h-1 w-9 rounded-full bg-[#cfd8e6]" />
              <div className="mt-3 flex items-center justify-between gap-3">
                <h2 className="text-[1.05rem] font-semibold leading-tight text-[#111827]">
                  Registrar cliente
                </h2>
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
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
                    value={clienteForm.tipoDocumento}
                    translate="no"
                    onChange={(event) => {
                      const tipoDocumento =
                        event.target.value === 'NIT' ? 'NIT' : 'CC';
                      setClienteForm((actual) => ({
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
                      setClienteFormErrors((actual) => ({
                        ...actual,
                        nombre: undefined,
                        documento: undefined,
                      }));
                      setClienteFormError(null);
                    }}
                    className={personFieldClass(false)}
                  >
                    {TIPOS_DOCUMENTO_CLIENTE.map((tipo) => (
                      <option key={tipo.value} value={tipo.value} translate="no">
                        {tipo.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[0.78rem] font-semibold text-slate-900">
                    {getPersonNameLabel(clienteForm.tipoDocumento, 'cliente')}
                  </label>
                  <input
                    type="text"
                    value={clienteForm.nombre}
                    maxLength={PERSON_NAME_MAX_LENGTH}
                    onChange={(event) => {
                      setClienteForm((actual) => ({
                        ...actual,
                        nombre: sanitizeProducerNameInput(
                          event.target.value,
                          actual.tipoDocumento,
                        ).slice(0, PERSON_NAME_MAX_LENGTH),
                      }));
                      setClienteFormErrors((actual) => ({
                        ...actual,
                        nombre: undefined,
                      }));
                      setClienteFormError(null);
                    }}
                    placeholder={getPersonNamePlaceholder(
                      clienteForm.tipoDocumento,
                      'cliente',
                    )}
                    className={personFieldClass(
                      Boolean(clienteFormErrors.nombre),
                    )}
                  />
                  {clienteFormErrors.nombre ? (
                    <PersonFieldError message={clienteFormErrors.nombre} />
                  ) : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-[0.78rem] font-semibold text-slate-900">
                    Número de documento
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={40}
                    value={clienteForm.documento}
                    onChange={(event) => {
                      setClienteForm((actual) => ({
                        ...actual,
                        documento: sanitizeDocumentInput(
                          event.target.value,
                          actual.tipoDocumento,
                        ),
                      }));
                      setClienteFormErrors((actual) => ({
                        ...actual,
                        documento: undefined,
                      }));
                      setClienteFormError(null);
                    }}
                    placeholder={
                      clienteForm.tipoDocumento === 'NIT'
                        ? 'Ej. 900123456-7'
                        : 'Ej. 123456789'
                    }
                    className={personFieldClass(
                      Boolean(clienteFormErrors.documento),
                    )}
                  />
                  {clienteFormErrors.documento ? (
                    <PersonFieldError message={clienteFormErrors.documento} />
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
                    value={clienteForm.telefono}
                    onChange={(event) => {
                      setClienteForm((actual) => ({
                        ...actual,
                        telefono: sanitizePersonDigits(event.target.value, 15),
                      }));
                      setClienteFormErrors((actual) => ({
                        ...actual,
                        telefono: undefined,
                      }));
                      setClienteFormError(null);
                    }}
                    placeholder="Ej. +57 300 123 4567"
                    className={personFieldClass(
                      Boolean(clienteFormErrors.telefono),
                    )}
                  />
                  {clienteFormErrors.telefono ? (
                    <PersonFieldError message={clienteFormErrors.telefono} />
                  ) : null}
                </div>

                {clienteFormError ? (
                  <InlineGuidedError
                    message={getVentasGuidance(clienteFormError)}
                  />
                ) : null}
              </div>
            </div>

            <div className="shrink-0 border-t border-[#eef2f7] bg-[#fbfcff] px-4 py-3">
              <button
                type="button"
                onClick={guardarCliente}
                className="inline-flex w-full items-center justify-center rounded-[12px] bg-[#102d92] px-4 py-3 text-[0.82rem] font-semibold text-white"
              >
                Guardar cliente
              </button>
              <button
                type="button"
                onClick={() => setMostrarModal(false)}
                className="mt-2 inline-flex w-full items-center justify-center px-4 py-1.5 text-[0.78rem] font-semibold text-slate-500"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {guardandoVenta || botonConfirmarPresionado ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/10 px-4">
          <div className="w-full max-w-[300px] rounded-[18px] bg-white px-5 py-4 text-center shadow-[0_18px_42px_rgba(15,23,42,0.22)]">
            <RefreshCw
              size={28}
              className="mx-auto animate-spin text-[#1f3fa7]"
            />
            <p className="mt-2 text-sm font-black text-slate-900">
              Guardando venta
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Actualizando inventario...
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#dbe4f3]">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[#102d92]" />
            </div>
          </div>
        </div>
      ) : null}

      <AppBottomNav hidden={mostrarModal || paso >= 1} />
    </div>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <RefreshCw size={18} className="animate-spin text-[#102d92]" />
        <p className="text-sm font-semibold text-[#102d92]">{text}</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#d0dbeb]">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-[#04337b]" />
      </div>
    </section>
  );
}
