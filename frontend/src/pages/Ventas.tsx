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
  Check,
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
  createdAt: string;
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
type ClienteOrden = 'recientes' | 'antiguos' | 'az';
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

const LIMITE_CLIENTES_RECIENTES = 2;
const LIMITE_CLIENTES_MODAL = 100;

const CLIENTE_GENERAL: ClienteOption = {
  id: 'general',
  nombre: 'Cliente General',
  documento: 'Venta rapida',
  detalle:
    'Para ventas rapidas o clientes ocasionales no registrados en el sistema.',
  createdAt: '',
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
  return `w-full rounded-[14px] border bg-[#f7f9fd] px-4 py-3 text-[0.95rem] font-semibold text-slate-900 outline-none transition ${hasError
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

function getPersonNamePlaceholder(
  type: DocumentType,
  role: 'cliente' | 'productor',
) {
  if (type === 'NIT') return 'Ej: Café Los Alpes';
  return role === 'cliente'
    ? 'Ej: Juan Pérez Rodríguez'
    : 'Ej: Juan Pérez Rodríguez';
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
    createdAt: cliente.createdAt,
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

function filtrarClientesPorBusqueda(
  clientes: ClienteOption[],
  busqueda: string,
) {
  const termino = norm(busqueda.trim());

  if (!termino) {
    return clientes;
  }

  return clientes.filter((cliente) =>
    [cliente.nombre, cliente.documento, cliente.detalle].some((valor) =>
      norm(valor).includes(termino),
    ),
  );
}

function ordenarClientes(clientes: ClienteOption[], orden: ClienteOrden) {
  const items = [...clientes];

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
      titulo: 'Elige un cliente',
      progreso: 33,
    };
  }
  if (step === 2) {
    return {
      titulo: 'Selecciona el café',
      progreso: 66,
    };
  }
  return {
    titulo: 'Revisa y confirma',
    progreso: 100,
  };
}

function getVentasGuidance(message: string, minPrecio: number, maxPrecio: number): GuidedErrorMessage {
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
    message.includes('precio no puede') ||
    message.includes('precio por kg está fuera')
  ) {
    return createGuidedError(
      message,
      'Precio por kg inválido.',
      `Debe estar entre $${minPrecio.toLocaleString('es-CO')} y $${maxPrecio.toLocaleString('es-CO')}/kg.`,
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
  cantidadIngresada: boolean,
): GuidedErrorMessage {
  const disponible = getDisponibleVenta(lote);

  if (!cantidadIngresada) {
    return createGuidedError(
      `Falta ingresar la cantidad a vender en ${lote.codigo}.`,
      'Falta ingresar la cantidad a vender.',
      'Escribe una cantidad antes de continuar.',
      `Ingresa al menos 0.01 kg.`,
    );
  }

  if (cantidad < 0.01) {
    return createGuidedError(
      `La cantidad debe ser mínimo 0.01 kg en ${lote.codigo}.`,
      'Cantidad muy baja.',
      `La cantidad mínima es 0.01 kg.`,
      `Ingresa al menos 0.01 kg.`,
    );
  }

  return createGuidedError(
    `La cantidad supera el disponible en ${lote.codigo}.`,
    'Cantidad excedida',
    `Solo puedes vender ${kg(disponible)} en este lote.`,
    'Ajusta la cantidad para continuar.',
  );
}

function getPrecioLoteGuidance(
  lote: LoteVenta,
  precio: number,
  precioIngresado: boolean,
  minPrecioVenta: number,
  precioMaximo: number,
): GuidedErrorMessage {
  if (!precioIngresado) {
    return createGuidedError(
      `Falta elegir el precio por kg en ${lote.codigo}.`,
      'Falta elegir el precio por kg.',
      'Escribe el valor por kilo antes de continuar.',
      `Ingresa un valor entre $${minPrecioVenta.toLocaleString('es-CO')} y $${precioMaximo.toLocaleString('es-CO')}/kg.`,
    );
  }

  if (precio < minPrecioVenta) {
    return createGuidedError(
      `El precio por kg es muy bajo en ${lote.codigo}.`,
      'Precio por kg muy bajo.',
      `El mínimo es $${minPrecioVenta.toLocaleString('es-CO')}/kg.`,
      `Ingresa al menos $${minPrecioVenta.toLocaleString('es-CO')}/kg.`,
    );
  }

  return createGuidedError(
    `El precio por kg supera el máximo en ${lote.codigo}.`,
    'Precio por kg demasiado alto.',
    `El máximo es $${precioMaximo.toLocaleString('es-CO')}/kg.`,
    'Ajusta el valor para continuar.',
  );
}

function getPrecioTipoGuidance(
  tipoCafe: string,
  precio: number,
  precioIngresado: boolean,
  minPrecioVenta: number,
  precioMaximo: number,
): GuidedErrorMessage {
  const cafe = formatCoffeeLabel(tipoCafe);

  if (!precioIngresado) {
    return createGuidedError(
      `Falta elegir el precio por kg para café ${cafe}.`,
      'Falta elegir el precio por kg.',
      `Define el precio para café ${cafe} antes de continuar.`,
      `Ingresa un valor entre $${minPrecioVenta.toLocaleString('es-CO')} y $${precioMaximo.toLocaleString('es-CO')}/kg.`,
    );
  }

  if (precio < minPrecioVenta) {
    return createGuidedError(
      `El precio por kg es muy bajo para café ${cafe}.`,
      'Precio por kg muy bajo.',
      `El mínimo es $${minPrecioVenta.toLocaleString('es-CO')}/kg.`,
      `Ingresa al menos $${minPrecioVenta.toLocaleString('es-CO')}/kg.`,
    );
  }

  return createGuidedError(
    `El precio por kg supera el máximo para café ${cafe}.`,
    'Precio por kg demasiado alto.',
    `El máximo es $${precioMaximo.toLocaleString('es-CO')}/kg.`,
    'Ajusta el valor para continuar.',
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

  const [clientes, setClientes] = React.useState<ClienteOption[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] =
    React.useState<ClienteOption | null>(null);
  const [busquedaCliente, setBusquedaCliente] = React.useState('');
  const [mostrarModalSelectorCliente, setMostrarModalSelectorCliente] =
    React.useState(false);
  const [busquedaSelectorCliente, setBusquedaSelectorCliente] =
    React.useState('');
  const [ordenSelectorCliente, setOrdenSelectorCliente] =
    React.useState<ClienteOrden>('recientes');
  const [limiteSelectorCliente, setLimiteSelectorCliente] = React.useState(
    LIMITE_CLIENTES_MODAL,
  );
  const [clientesSelector, setClientesSelector] = React.useState<
    ClienteOption[]
  >([]);
  const [cargandoClientesSelector, setCargandoClientesSelector] =
    React.useState(false);
  const [hayMasClientesSelector, setHayMasClientesSelector] =
    React.useState(false);
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
  const [minPrecioVentaKg, setMinPrecioVentaKg] =
    React.useState(PRECIO_MINIMO_KG);
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
        listarClientes({
          limit: LIMITE_CLIENTES_RECIENTES,
          orden: 'recientes',
        }),
        obtenerConfiguracionBodega().catch(() => null),
      ]);
      if (bodegaConfig) {
        setMaxPrecioVentaKg(bodegaConfig.maxPrecioVentaKg || PRECIO_MAXIMO_KG);
        setMinPrecioVentaKg(bodegaConfig.minPrecioVentaKg || PRECIO_MINIMO_KG);
      }
      const lotesDisponibles = ENABLE_SECADO_PROTOTYPE
        ? applySecadoToLots(lotes, { includeGeneratedOutputs: false })
        : lotes;
      const secadosActivos = ENABLE_SECADO_PROTOTYPE
        ? await getActiveSecadoSessions()
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
      const lotesFiltrados = lotesDisponibles.filter((lote) => !isSecadoProcessLot(lote));
      const lotesDetalles = await Promise.all(
        lotesFiltrados.map((lote) =>
          obtenerDetalleLote(lote.tipoCafeId, lote.calidadId).catch(() => null)
        )
      );

      const list: LoteVenta[] = [];
      for (let i = 0; i < lotesFiltrados.length; i++) {
        const lote = lotesFiltrados[i];
        const detail = lotesDetalles[i];
        if (!detail) continue;

        const sublotesList = ENABLE_SECADO_PROTOTYPE
          ? applySecadoToDetalle(detail, lote.tipoCafeId, lote.calidadId, {
              includeGeneratedOutputs: false,
            })?.sublotes ?? []
          : detail.sublotes;

        for (const sub of sublotesList) {
          if (sub.pesoActual > 0) {
            list.push({
              id: sub.id,
              codigo: sub.etiqueta,
              tipoCafeId: sub.tipoCafeId,
              tipoCafe: sub.tipoCafe,
              calidadId: sub.calidadId,
              calidad: sub.calidad,
              disponibleKg: sub.pesoActual,
              cantidadKg: '',
              precioKg: '',
              pesoVerificadoKg: '',
            });
          }
        }
      }
      setLotesVenta(list);
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
    const base = ordenarClientes(
      dedupeClientesOptions([...clientes]),
      'recientes',
    );

    return filtrarClientesPorBusqueda(base, busquedaCliente).slice(
      0,
      LIMITE_CLIENTES_RECIENTES,
    );
  }, [busquedaCliente, clientes]);
  const clientesSelectorFiltrados = React.useMemo(() => {
    return clientesSelector;
  }, [clientesSelector]);
  const clientesSelectorVisibles = clientesSelectorFiltrados.slice(
    0,
    limiteSelectorCliente,
  );
  const quedanClientesPorCargar =
    hayMasClientesSelector ||
    clientesSelectorFiltrados.length > limiteSelectorCliente;
  const busquedaSelectorActiva = busquedaSelectorCliente.trim().length > 0;
  const sinClientesRegistrados = clientes.length === 0;
  const mostrarResultadosClientes = clienteMetodo === 'BUSCAR';

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
        precioVentaItem < minPrecioVentaKg ||
        precioVentaItem > precioMaximoVentaPermitido
      ) {
        invalidos.add(item.tipoCafeId);
      }
    }

    return invalidos;
  }, [minPrecioVentaKg, precioMaximoVentaPermitido, preciosVentaTotal, resumenDisponiblePorTipo]);
  const preciosVentaTotalFaltantes = React.useMemo(
    () =>
      resumenDisponiblePorTipo.some(
        (item) => (preciosVentaTotal[item.tipoCafeId] ?? '').trim() === '',
      ),
    [preciosVentaTotal, resumenDisponiblePorTipo],
  );
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

      if (totalDisponibleVenta < PESO_MINIMO_KG) {
        return `La cantidad total a vender debe ser mínimo ${PESO_MINIMO_KG} kg.`;
      }

      return null;
    }
    if (!lotesConCantidad.length)
      return 'Ingresa al menos una cantidad para continuar.';

    if (totalKg < PESO_MINIMO_KG) {
      return `La cantidad total a vender debe ser mínimo ${PESO_MINIMO_KG} kg.`;
    }

    for (const l of lotesConCantidad) {
      if (pesoVerificadoInvalido(l))
        return `El peso verificado no puede superar el disponible en ${l.codigo}.`;
      if (l.cantidad < 0.01)
        return `La cantidad debe ser mínimo 0.01 kg en ${l.codigo}.`;
      if (l.cantidad > getDisponibleVenta(l))
        return `La cantidad supera el disponible en ${l.codigo}.`;
      if (l.precio < minPrecioVentaKg || l.precio > precioMaximoVentaPermitido)
        return `Ingresa un precio por kg válido en ${l.codigo}.`;
    }
    return null;
  }, [
    fechaVentaValidacion.isValid,
    fechaVentaValidacion.message,
    lotesVenta.length,
    modoVenta,
    preciosVentaTotalInvalidos,
    minPrecioVentaKg,
    precioMaximoVentaPermitido,
    resumenDisponiblePorTipo,
    lotesConCantidad,
    totalDisponibleVenta,
    totalKg,
  ]);

  const hayCantidadParcial = React.useMemo(
    () => lotesVenta.some((l) => toNum(l.cantidadKg) > 0),
    [lotesVenta],
  );
  const parcialConErrores = React.useMemo(() => {
    if (modoVenta !== 'PARCIAL') return false;
    return lotesVenta.some((lote) => {
      const cantidadIngresada = lote.cantidadKg.trim() !== '';
      const precioIngresado = lote.precioKg.trim() !== '';
      // Si el usuario no tocó ningún campo, ignorar este sublote (es opcional)
      if (!cantidadIngresada && !precioIngresado) return false;
      const cantidad = toNum(lote.cantidadKg);
      const precio = toNum(lote.precioKg);
      // Si inició el llenado, ambos campos son obligatorios y deben ser válidos
      return (
        !cantidadIngresada ||
        !precioIngresado ||
        cantidad < 0.01 ||
        cantidad > getDisponibleVenta(lote) ||
        precio < minPrecioVentaKg ||
        precio > precioMaximoVentaPermitido ||
        pesoVerificadoInvalido(lote)
      );
    });
  }, [lotesVenta, modoVenta, minPrecioVentaKg, precioMaximoVentaPermitido]);
  const puedeAvanzarPaso2 =
    !fechaVentaValidacion.isValid || modoVenta === null
      ? false
      : modoVenta === 'TOTAL'
        ? resumenDisponiblePorTipo.length > 0 &&
          preciosVentaTotalInvalidos.size === 0 &&
          !lotesVenta.some(pesoVerificadoInvalido) &&
          totalDisponibleVenta >= PESO_MINIMO_KG
        : hayCantidadParcial && !parcialConErrores && totalKg >= PESO_MINIMO_KG;

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
      const detalles = [] as Array<{
        subloteId: string;
        pesoVendido: number;
        precioKg: number;
      }>;

      for (const lote of lotesConCantidad) {
        const pesoVerificado = getPesoVerificado(lote);
        let pesoVendido = round2(lote.cantidad);

        if (pesoVerificado !== null && pesoVerificado !== lote.disponibleKg) {
          await guardarPesosSublotes([
            {
              id: lote.id, // lote.id is the subloteId
              pesoActual: pesoVerificado,
              motivo: 'Calibración antes de venta',
            },
          ]);
          if (pesoVendido > pesoVerificado) {
            pesoVendido = pesoVerificado;
          }
        }

        if (pesoVendido > 0) {
          detalles.push({
            subloteId: lote.id, // lote.id is the subloteId
            pesoVendido,
            precioKg: round2(lote.precio),
          });
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
              campo === 'pesoVerificadoKg'
                ? l.disponibleKg
                : getDisponibleVenta(l),
            );

        const updatedLote = { ...l, [campo]: normalizado };

        if (campo === 'pesoVerificadoKg') {
          const nextDisponibleVenta = getDisponibleVenta(updatedLote);
          const currentCantidad = toNum(l.cantidadKg);
          const oldDisponibleVenta = getDisponibleVenta(l);

          if (
            currentCantidad > nextDisponibleVenta ||
            Math.abs(currentCantidad - oldDisponibleVenta) < 0.001
          ) {
            updatedLote.cantidadKg = String(round2(nextDisponibleVenta));
          }
        }

        return updatedLote;
      }),
    );
  };



  const seleccionarCliente = React.useCallback((cliente: ClienteOption) => {
    setClienteSeleccionado(cliente);
    setClienteMetodo(cliente.rapido ? 'GENERAL' : 'BUSCAR');
    setBusquedaCliente('');
    setMostrarModalSelectorCliente(false);
    setIntentoPaso1(false);
    setSubmitError(null);
  }, []);

  const abrirSelectorCliente = () => {
    setClienteMetodo('BUSCAR');
    setClienteSeleccionado(null);
    setBusquedaSelectorCliente(busquedaCliente);
    setOrdenSelectorCliente('recientes');
    setLimiteSelectorCliente(LIMITE_CLIENTES_MODAL);
    setClientesSelector([]);
    setHayMasClientesSelector(false);
    setMostrarModalSelectorCliente(true);
    setSubmitError(null);
  };

  const cerrarSelectorCliente = () => {
    setMostrarModalSelectorCliente(false);
    setBusquedaSelectorCliente('');
    setLimiteSelectorCliente(LIMITE_CLIENTES_MODAL);
    setClientesSelector([]);
    setHayMasClientesSelector(false);
  };

  const refrescarClientes = async () => {
    try {
      const clientesData = await listarClientes({
        limit: LIMITE_CLIENTES_RECIENTES,
        orden: 'recientes',
      });
      setClientes(dedupeClientesOptions(clientesData.map(mapClienteToOption)));
    } catch {
      // La recarga de clientes no debe bloquear la venta.
    }
  };

  const cargarClientesSelector = async (reset = false) => {
    const offset = reset ? 0 : clientesSelector.length;
    setCargandoClientesSelector(true);

    try {
      const clientesData = await listarClientes({
        q: busquedaSelectorCliente,
        limit: LIMITE_CLIENTES_MODAL + 1,
        offset,
        orden: ordenSelectorCliente,
      });
      const mapped = clientesData.map(mapClienteToOption);
      const nextItems = mapped.slice(0, LIMITE_CLIENTES_MODAL);

      setClientesSelector((actual) =>
        dedupeClientesOptions(reset ? nextItems : [...actual, ...nextItems]),
      );
      setLimiteSelectorCliente((actual) =>
        reset
          ? LIMITE_CLIENTES_MODAL
          : Math.max(actual, offset + nextItems.length),
      );
      setHayMasClientesSelector(mapped.length > LIMITE_CLIENTES_MODAL);
      setClientes((actual) =>
        dedupeClientesOptions([...nextItems, ...actual]).slice(
          0,
          LIMITE_CLIENTES_RECIENTES,
        ),
      );
    } catch {
      setHayMasClientesSelector(false);
    } finally {
      setCargandoClientesSelector(false);
    }
  };

  React.useEffect(() => {
    if (!mostrarModalSelectorCliente) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void cargarClientesSelector(true);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [
    busquedaSelectorCliente,
    mostrarModalSelectorCliente,
    ordenSelectorCliente,
  ]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      try {
        const clientesData = await listarClientes({
          q: busquedaCliente,
          limit: LIMITE_CLIENTES_RECIENTES,
          orden: 'recientes',
        });
        setClientes(
          dedupeClientesOptions(clientesData.map(mapClienteToOption)),
        );
      } catch {
        // La busqueda rapida no debe bloquear la venta.
      }
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [busquedaCliente]);

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

    navigate(-1);
  };

  const confirmarCancelarVenta = () => {
    setMostrarModalCancelar(false);
    navigate(-1);
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
      setClientesSelector((actual) =>
        dedupeClientesOptions([
          nuevo,
          ...actual.filter((cliente) => cliente.id !== nuevo.id),
        ]),
      );
      setClienteSeleccionado(nuevo);
      setIntentoPaso1(false);
      setBusquedaCliente('');
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
                className="inline-flex min-h-[54px] items-center justify-center gap-3 rounded-full bg-[#1D4ED8] px-5 py-3 text-[1.05rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
              <p className="text-[0.85rem] font-semibold text-slate-800">
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
                    <span className="text-sm font-semibold text-slate-800">
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
                className="inline-flex min-h-[56px] items-center justify-center rounded-full bg-[#1D4ED8] px-5 text-base font-black text-white shadow-[0_14px_30px_rgba(31,63,167,0.22)]"
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
            <div className="flex items-center justify-between text-[0.95rem] font-medium text-slate-600">
              <span>
                Paso {paso}: {pasoActual.titulo}
              </span>
              <span className="text-slate-400">{paso} de 3</span>
            </div>
            <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#d0dbeb]">
              <div
                className="h-full rounded-full bg-[#1D4ED8] transition-all duration-300"
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
              className="mt-4 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-full bg-[#1D4ED8] px-4 text-[0.9rem] font-semibold text-white"
            >
              <RefreshCw size={14} />
              Reintentar
            </button>
          </section>
        ) : (
          <>
            {paso === 2 ? (
              <div className="flex flex-col gap-4">
                <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-4 shadow-sm">
                  <div className="mt-3 rounded-[14px] border border-[#dbe1f1] bg-[#f7f8fe] p-3">
                    <p className="text-xs font-medium text-slate-500">
                      Cliente seleccionado
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {clienteSeleccionado?.nombre ?? 'Sin cliente'}
                    </p>
                    {clienteSeleccionado?.id !== 'general' && (
                      <p className="text-xs text-slate-600">
                        {clienteSeleccionado?.documento ??
                          'Selección pendiente'}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 rounded-[18px] border border-[#dbe1f1] bg-white px-4 py-3 shadow-[0_4px_12px_rgba(20,35,85,0.02)]">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <CalendarDays
                          size={15}
                          className="shrink-0 text-slate-400"
                        />
                        <span className="text-[0.85rem] font-semibold text-slate-800">
                          Fecha de venta
                        </span>
                      </div>
                      <input
                        type="date"
                        value={fechaVenta}
                        min={BUSINESS_MIN_DATE_VALUE}
                        max={getTodayLocalDateValue()}
                        onChange={(event) => {
                          setFechaVenta(event.target.value);
                          setSubmitError(null);
                        }}
                        className="bg-transparent text-[0.95rem] font-semibold text-slate-900 outline-none"
                      />
                    </div>
                    {fechaVentaInvalida ? (
                      <InlineGuidedError
                        message={getVentasGuidance(
                          fechaVentaValidacion.message ??
                            'Selecciona la fecha de venta.',
                          minPrecioVentaKg,
                          precioMaximoVentaPermitido,
                        )}
                        className="mt-2"
                      />
                    ) : null}
                  </div>

                  <h2 className="mt-5 text-[1.12rem] font-semibold text-slate-900">
                    ¿Cómo deseas realizar la venta?
                  </h2>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setModoVenta('PARCIAL');
                        setIntentoPaso2(false);
                      }}
                      disabled={sinInventario}
                      className={`min-h-[92px] rounded-[16px] border p-4 text-left ${
                        modoVenta === 'PARCIAL'
                          ? 'border-[#1D4ED8] bg-[#eef2ff]'
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
                          ? 'border-[#1D4ED8] bg-[#eef2ff]'
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
                        minPrecioVentaKg,
                        precioMaximoVentaPermitido,
                      )}
                      className="mt-2"
                    />
                  ) : null}
                  {modoInvalido ? (
                    <InlineGuidedError
                      message={getVentasGuidance(
                        'Selecciona como deseas realizar la venta.',
                        minPrecioVentaKg,
                        precioMaximoVentaPermitido,
                      )}
                      className="mt-2"
                    />
                  ) : null}

                  {modoVenta === 'TOTAL' ? (
                    <div className="mt-6 space-y-4">
                      <div className="text-center">
                        <h2 className="text-[1.2rem] font-black leading-tight text-slate-950">
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
                        <p className="text-[0.85rem] font-semibold text-slate-800">
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
                        <p className="text-[0.85rem] font-semibold text-slate-800">
                          Precio por kg por tipo
                        </p>
                        <div className="mt-3 max-h-[260px] space-y-3 overflow-y-auto pr-[6px] [scrollbar-color:#c5ccda_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-[8px] [&::-webkit-scrollbar-thumb]:bg-[#c5ccda]">
                          {resumenDisponiblePorTipo.map((item) => {
                            const precioTipo =
                              preciosVentaTotal[item.tipoCafeId] ?? '';
                            const precioTipoVacio = precioTipo.trim() === '';
                            const precioTipoFueraRango =
                              !precioTipoVacio &&
                              (toNum(precioTipo) < PRECIO_MINIMO_KG ||
                                toNum(precioTipo) > precioMaximoVentaPermitido);
                            const precioTipoInvalido =
                              modoVenta === 'TOTAL' &&
                              (intentoPaso2 || precioTipo.trim() !== '') &&
                              (precioTipoVacio || precioTipoFueraRango);

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
                                  <span className="mr-3 text-xl font-black text-[#1D4ED8]">
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
                                  Rango: {money(minPrecioVentaKg)} - {money(precioMaximoVentaPermitido)}/kg
                                </p>
                                {precioTipoInvalido ? (
                                  <InlineGuidedError
                                    message={getPrecioTipoGuidance(
                                      item.tipoCafe,
                                      toNum(precioTipo),
                                      !precioTipoVacio,
                                      minPrecioVentaKg,
                                      precioMaximoVentaPermitido,
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
                            {preciosVentaTotalFaltantes
                              ? 'Falta definir el precio por kg de uno o más tipos de café.'
                              : 'Revisa el precio por kg de los tipos marcados.'}
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

                        // El sublote está "activo" si el usuario llenó al menos uno de los campos
                        const subloteActivo = cantidadIngresada || precioIngresado;
                        // Si el usuario intentó avanzar Y el sublote está activo, validar ambos campos
                        // Si solo uno está lleno, mostrar error en el faltante inmediatamente
                        const cantidadFalta =
                          subloteActivo && !cantidadIngresada;
                        const cantidadFueraRango =
                          cantidadIngresada &&
                          (cantidad < PESO_MINIMO_KG ||
                            cantidad > disponibleVenta);
                        const cantidadInvalida =
                          modoVenta === 'PARCIAL' &&
                          (cantidadFalta || cantidadFueraRango);
                        const precioFalta = subloteActivo && !precioIngresado;
                        const precioFueraRango =
                          precioIngresado &&
                          (toNum(lote.precioKg) < PRECIO_MINIMO_KG ||
                            toNum(lote.precioKg) > precioMaximoVentaPermitido);
                        const precioInvalido =
                          modoVenta === 'PARCIAL' &&
                          (precioFalta || precioFueraRango);
                        return (
                          <article
                            key={lote.id}
                            className="rounded-[16px] border border-[#e5e8f3] bg-[#fcfcff] p-4"
                          >
                            <p className="text-lg font-semibold text-[#1D4ED8]">
                              {lote.codigo}
                            </p>
                            <p className="text-sm text-slate-600">
                              {coffeeWithQuality(lote.tipoCafe, lote.calidad)}
                            </p>
                            <div className="mt-3 rounded-[14px] border border-[#e4e9f4] bg-white p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[0.85rem] font-semibold text-slate-800">
                                    Peso para vender
                                  </p>
                                  <p className="mt-1 text-base font-black text-slate-900">
                                    {kg(disponibleVenta)}
                                  </p>
                                  <p className="text-[0.72rem] leading-5 text-slate-500">
                                    Registrado: {kg(lote.disponibleKg)}
                                  </p>
                                </div>
                              </div>
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
                                    className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:border-[#1D4ED8] ${
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
                                    className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:border-[#1D4ED8] ${
                                      precioInvalido
                                        ? 'border-[#ef4444] bg-[#fff7f7] text-[#b42318]'
                                        : 'border-[#d7dcec] bg-white text-slate-900'
                                    }`}
                                  />
                                </div>
                                {cantidadInvalida ? (
                                  <InlineGuidedError
                                    message={getCantidadLoteGuidance(
                                      lote,
                                      cantidad,
                                      cantidadIngresada,
                                    )}
                                    className="mt-2"
                                  />
                                ) : null}
                                {precioInvalido ? (
                                  <InlineGuidedError
                                    message={getPrecioLoteGuidance(
                                      lote,
                                      toNum(lote.precioKg),
                                      precioIngresado,
                                      minPrecioVentaKg,
                                      precioMaximoVentaPermitido,
                                    )}
                                    className="mt-2"
                                  />
                                ) : null}
                                <div className="mt-1 grid grid-cols-2 gap-2 text-[0.6rem] font-semibold text-slate-400">
                                  <p className="pl-1">Máx. disponible</p>
                                  <p className="pr-1 text-right">
                                    Rango: {money(minPrecioVentaKg)} - {money(precioMaximoVentaPermitido)}/kg
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
                        minPrecioVentaKg,
                        precioMaximoVentaPermitido,
                      )}
                      className="mt-2"
                    />
                  ) : null}
                  {intentoPaso2 && totalKg < PESO_MINIMO_KG && modoVenta === 'PARCIAL' && hayCantidadParcial ? (
                    <InlineGuidedError
                      message={createGuidedError(
                        'La cantidad total de venta debe ser mínimo 5 kg.',
                        'Cantidad total insuficiente.',
                        `La suma de todos los sublotes a vender debe ser mínimo ${PESO_MINIMO_KG} kg. Actualmente tienes ${kg(totalKg)}.`,
                        'Ingresa más cantidad o selecciona otros sublotes.',
                      )}
                      className="mt-2"
                    />
                  ) : null}
                  {intentoPaso2 && totalDisponibleVenta < PESO_MINIMO_KG && modoVenta === 'TOTAL' ? (
                    <InlineGuidedError
                      message={createGuidedError(
                        'La cantidad total disponible debe ser mínimo 5 kg.',
                        'Inventario total insuficiente.',
                        `Para realizar una venta total, debes tener mínimo ${PESO_MINIMO_KG} kg de café disponible. Actualmente tienes ${kg(totalDisponibleVenta)}.`,
                        'Registra una compra para aumentar tu inventario.',
                      )}
                      className="mt-2"
                    />
                  ) : null}
                </section>

                {/* Resumen de venta y botones en un card aparte */}
                <div className="rounded-[20px] border border-[#e4e9f5] bg-white p-4 shadow-[0_4px_14px_rgba(20,35,85,0.05)]">
                  <article className="rounded-[18px] border border-[#d6e2ff] bg-[#eef3ff] p-4 text-[#1D4ED8] shadow-sm">
                    <p className="text-[0.95rem] font-bold text-[#4c5c80]">
                      Resumen de venta
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#d6e2ff] pt-3">
                      <div className="min-w-0 rounded-[14px] bg-white/50 px-3 py-2.5">
                        <p className="text-[0.82rem] font-semibold text-[#5b6f9d]">
                          Total kg
                        </p>
                        <p className="mt-1 max-w-full overflow-hidden whitespace-nowrap text-[1.35rem] font-bold leading-[1.1] text-[#1D4ED8]">
                          {kg(totalKg)}
                        </p>
                      </div>
                      <div className="min-w-0 rounded-[14px] bg-white/50 px-3 py-2.5 text-right">
                        <p className="text-[0.82rem] font-semibold text-[#5b6f9d]">
                          Total estimado
                        </p>
                        <p className="mt-1 max-w-full overflow-hidden whitespace-nowrap text-[1.35rem] font-bold leading-[1.1] text-[#1D4ED8]">
                          {money(totalEstimado)}
                        </p>
                      </div>
                    </div>
                  </article>

                  <div className="mt-4 grid gap-3">
                    <button
                      type="button"
                      onClick={siguiente}
                      disabled={sinInventario}
                      className={`inline-flex min-h-[56px] w-full items-center justify-center rounded-full px-5 py-4 text-[1rem] font-medium text-white shadow-[0_8px_20px_rgba(29,78,216,0.22)] transition ${
                        sinInventario
                          ? 'cursor-not-allowed bg-blue-300'
                          : 'bg-[#1D4ED8] hover:bg-[#1e40af] active:scale-[0.99]'
                      }`}
                    >
                      Siguiente paso
                    </button>
                    <button
                      type="button"
                      onClick={anterior}
                      className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-[1rem] font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Regresar
                    </button>
                  </div>
                </div>
              </div>
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
                    setClienteSeleccionado(null);
                    void refrescarClientes();
                    setSubmitError(null);
                  }}
                  className={`w-full rounded-[16px] border bg-white p-4 text-left shadow-sm transition ${
                    clienteMetodo === 'BUSCAR'
                      ? 'border-[#1D4ED8] ring-1 ring-[#1f3fa7]'
                      : 'border-[#e3e7f3]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#eef3ff] text-[#1D4ED8]">
                      <Search size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.95rem] font-bold text-slate-900">
                        Buscar cliente
                      </p>
                      <p className="mt-1 text-[0.78rem] text-slate-500">
                        Selecciona un cliente registrado
                      </p>
                    </div>
                    <span
                      className={`h-6 w-6 rounded-full border-2 ${
                        clienteMetodo === 'BUSCAR'
                          ? 'border-[#1D4ED8] bg-[#1D4ED8] shadow-[inset_0_0_0_4px_white]'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                </button>

                {/* Panel de búsqueda — animación suave de expansión */}
                <div
                  className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{
                    maxHeight: clienteMetodo === 'BUSCAR' ? '420px' : '0px',
                    opacity: clienteMetodo === 'BUSCAR' ? 1 : 0,
                    marginTop: clienteMetodo === 'BUSCAR' ? '12px' : '0px',
                  }}
                >
                  <div className="space-y-2.5 px-1 pt-1">
                    <p className="text-[0.85rem] font-semibold text-slate-800">
                      Recientes
                    </p>

                    {mostrarResultadosClientes &&
                    clientesRecientes.length === 0 ? (
                      <div className="rounded-[14px] border border-dashed border-[#d5dced] bg-white px-4 py-5 text-center text-sm text-slate-500">
                        <p className="font-semibold text-slate-700">
                          {sinClientesRegistrados
                            ? 'Aún no tienes clientes registrados.'
                            : 'No se encontraron resultados'}
                        </p>
                        <p className="mt-1">
                          {sinClientesRegistrados
                            ? 'Registra uno para iniciar la venta.'
                            : 'Intenta con otro nombre o documento.'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {clientesRecientes.map((cliente) => {
                          const selected = clienteSeleccionadoId === cliente.id;
                          return (
                            <button
                              key={cliente.id}
                              type="button"
                              onClick={() => seleccionarCliente(cliente)}
                              className={`flex w-full flex-col rounded-[14px] border px-3 py-2.5 text-left transition ${
                                selected
                                  ? 'border-[#1D4ED8] bg-[#f4f7ff]'
                                  : 'border-[#e6ebf5] bg-white hover:border-[#ccd6ea]'
                              }`}
                            >
                              <p className="truncate text-[0.88rem] font-medium text-slate-900">
                                {cliente.nombre}
                              </p>
                              <p className="mt-0.5 truncate text-[0.75rem] text-slate-400">
                                {cliente.documento}
                              </p>
                              {selected ? (
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
                      onClick={abrirSelectorCliente}
                      className="inline-flex min-h-[38px] w-full items-center justify-center rounded-[12px] border border-[#dbe2f0] bg-white px-4 text-[0.82rem] font-medium text-[#1D4ED8]"
                    >
                      Ver más clientes
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => seleccionarCliente(CLIENTE_GENERAL)}
                  className={`w-full rounded-[16px] border bg-white p-4 text-left shadow-sm transition ${
                    clienteMetodo === 'GENERAL'
                      ? 'border-[#1D4ED8] bg-[#eef4ff] ring-1 ring-[#1f3fa7]'
                      : 'border-[#e3e7f3]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#eef3ff] text-[#1D4ED8]">
                      <User size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.95rem] font-bold text-slate-900">
                        Cliente genérico
                      </p>
                      <p className="mt-1 text-[0.78rem] text-slate-500">
                        Venta rápida sin cliente registrado
                      </p>
                    </div>
                    <span
                      className={`h-6 w-6 rounded-full border-2 ${
                        clienteMetodo === 'GENERAL'
                          ? 'border-[#1D4ED8] bg-[#1D4ED8] shadow-[inset_0_0_0_4px_white]'
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
                      ? 'border-[#1D4ED8] ring-1 ring-[#1f3fa7]'
                      : 'border-[#e3e7f3]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#eef3ff] text-[#1D4ED8]">
                      <Plus size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.95rem] font-bold text-slate-900">
                        Registrar cliente
                      </p>
                      <p className="mt-1 text-[0.78rem] text-slate-500">
                        Crear un nuevo cliente
                      </p>
                    </div>
                    <span
                      className={`h-6 w-6 rounded-full border-2 ${
                        clienteMetodo === 'REGISTRAR'
                          ? 'border-[#1D4ED8] bg-[#1D4ED8] shadow-[inset_0_0_0_4px_white]'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                </button>

                {/* ── Zona de acción: separada visualmente de las opciones ── */}
                <div className="mt-6 rounded-[20px] border border-[#e4e9f5] bg-white p-4 shadow-[0_4px_14px_rgba(20,35,85,0.05)]">
                  {clienteSeleccionado ? (
                    <div className="mb-4 flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1D4ED8] text-white">
                        <User size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.85rem] font-semibold text-slate-800">
                          Cliente seleccionado
                        </p>
                        <p className="truncate text-[0.98rem] font-semibold text-slate-900">
                          {clienteSeleccionado.nombre}
                        </p>
                        <p className="text-[0.82rem] text-slate-500">
                          {clienteSeleccionado.rapido
                            ? 'Venta rápida'
                            : clienteSeleccionado.documento}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 rounded-[12px] border border-dashed border-[#d8dfee] px-4 py-3 text-center text-[0.88rem] text-slate-400">
                      Ningún cliente seleccionado
                    </div>
                  )}

                  {clienteInvalido ? (
                    <p className="mb-3 rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-[0.82rem] font-semibold leading-5 text-rose-600">
                      Selecciona un cliente para continuar.
                    </p>
                  ) : null}

                  <div className="grid gap-2.5">
                    <button
                      type="button"
                      onClick={siguiente}
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

            {paso === 3 ? (
              <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-medium text-slate-500">
                  Revisión final
                </p>
                <h2 className="mt-2 text-[1.3rem] font-semibold text-[#1D4ED8]">
                  Confirma los datos de la venta
                </h2>

                {submitError ? (
                  <InlineGuidedError
                    message={getVentasGuidance(
                      submitError,
                      minPrecioVentaKg,
                      precioMaximoVentaPermitido,
                    )}
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
                          <p className="mt-1 text-sm font-semibold text-[#1D4ED8]">
                            {kg(lote.cantidad)} -{' '}
                            {money(lote.cantidad * lote.precio)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={editarLoteDesdeRevision}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#eef2ff] text-[#1D4ED8]"
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

                <article className="mt-4 rounded-[16px] border border-[#d6e2ff] bg-[#eef3ff] p-3 text-[#1D4ED8]">
                  <div className="flex items-center justify-between text-sm font-black">
                    <span>Total kg</span>
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
                    onClick={() => setMostrarModalConfirmar(true)}
                    disabled={guardandoVenta || botonConfirmarPresionado}
                    className={`inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full px-5 py-4 text-[1rem] font-medium text-white transition ${
                      guardandoVenta || botonConfirmarPresionado
                        ? 'bg-blue-300 cursor-wait'
                        : 'bg-[#1D4ED8] hover:bg-[#1e40af] shadow-[0_8px_20px_rgba(29,78,216,0.22)] active:scale-[0.99]'
                    }`}
                  >
                    {guardandoVenta || botonConfirmarPresionado ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Guardando venta...
                      </>
                    ) : (
                      'Registrar venta'
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

      {mostrarModalSelectorCliente ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 px-4 pb-4 pt-8 backdrop-blur-sm sm:items-center">
          <div className="flex h-[75vh] max-h-[75vh] w-full max-w-[430px] flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.28)]">
            <div className="shrink-0 border-b border-[#eef2f7] px-5 pb-4 pt-3">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-[#cfd8e6]" />
              <div className="mt-4 flex items-center justify-between gap-4">
                <h2 className="text-[1.35rem] font-semibold leading-tight text-[#111827]">
                  Seleccionar cliente
                </h2>
                <button
                  type="button"
                  onClick={cerrarSelectorCliente}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                  aria-label="Cerrar selector de clientes"
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
                  value={busquedaSelectorCliente}
                  maxLength={60}
                  onChange={(event) => {
                    const busqueda = event.target.value.slice(0, 60);
                    setBusquedaSelectorCliente(busqueda);
                    setLimiteSelectorCliente(LIMITE_CLIENTES_MODAL);
                    setClientesSelector([]);
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
                    const activo = ordenSelectorCliente === orden.value;

                    return (
                      <button
                        key={orden.value}
                        type="button"
                        onClick={() => {
                          setOrdenSelectorCliente(orden.value as ClienteOrden);
                          setLimiteSelectorCliente(LIMITE_CLIENTES_MODAL);
                          setClientesSelector([]);
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
                  quedanClientesPorCargar &&
                  !cargandoClientesSelector
                ) {
                  if (
                    clientesSelectorFiltrados.length > limiteSelectorCliente
                  ) {
                    setLimiteSelectorCliente(
                      (actual) => actual + LIMITE_CLIENTES_MODAL,
                    );
                    return;
                  }

                  void cargarClientesSelector(false);
                }
              }}
            >
              {cargandoClientesSelector &&
              clientesSelectorVisibles.length === 0 ? (
                <div className="rounded-[16px] border border-[#e6ebf5] bg-[#fafbff] px-4 py-8 text-center">
                  <RefreshCw
                    size={24}
                    className="mx-auto animate-spin text-[#1D4ED8]"
                  />
                  <p className="mt-3 text-sm font-black text-slate-700">
                    Cargando clientes...
                  </p>
                </div>
              ) : clientesSelectorFiltrados.length === 0 &&
                !busquedaSelectorActiva ? (
                <div className="rounded-[16px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-8 text-center">
                  <p className="text-[1rem] font-black text-slate-800">
                    Aún no tienes clientes registrados.
                  </p>
                  <p className="mt-2 text-sm leading-5 text-slate-500">
                    Registra uno para iniciar la venta.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarModalSelectorCliente(false);
                      setClienteMetodo('REGISTRAR');
                      setClienteForm(CLIENTE_FORM_INICIAL);
                      setClienteFormErrors({});
                      setClienteFormError(null);
                      setMostrarModal(true);
                    }}
                    className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-full bg-[#1D4ED8] px-4 text-sm font-black text-white"
                  >
                    Registrar cliente
                  </button>
                </div>
              ) : clientesSelectorFiltrados.length === 0 &&
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
                      {clientesSelectorVisibles.length} resultados
                    </p>
                  </div>
                  <div className="space-y-2">
                    {clientesSelectorVisibles.map((cliente) => {
                      const activo = clienteSeleccionado?.id === cliente.id;

                      return (
                        <button
                          key={cliente.id}
                          type="button"
                          onClick={() => seleccionarCliente(cliente)}
                          className={`flex w-full cursor-pointer items-center gap-3 rounded-[14px] border px-3 py-3 text-left transition ${
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
                              <CheckCircle2 size={12} strokeWidth={3} />
                            ) : null}
                          </span>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="truncate text-[0.98rem] font-black text-slate-900">
                              {cliente.nombre}
                            </p>
                            <p className="mt-0.5 truncate text-[0.84rem] font-semibold text-slate-500">
                              {cliente.documento}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModalConfirmar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[24px] bg-white p-6 text-center shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
            <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f1ff] text-[#1D4ED8]">
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
                className="inline-flex min-h-[54px] items-center justify-center rounded-full bg-[#1D4ED8] px-5 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
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
                className="inline-flex min-h-[54px] items-center justify-center rounded-full bg-[#1D4ED8] px-5 text-base font-black text-white"
              >
                Cancelar venta
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalCancelar(false)}
                className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] px-5 text-base font-black text-[#1D4ED8]"
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
                    message={getVentasGuidance(clienteFormError, minPrecioVentaKg, precioMaximoVentaPermitido)}
                  />
                ) : null}
              </div>
            </div>

            <div className="shrink-0 border-t border-[#eef2f7] bg-[#fbfcff] px-4 py-3">
              <button
                type="button"
                onClick={guardarCliente}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#1D4ED8] px-4 py-3 text-[0.82rem] font-semibold text-white"
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
              className="mx-auto animate-spin text-[#1D4ED8]"
            />
            <p className="mt-2 text-sm font-black text-slate-900">
              Guardando venta
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Actualizando inventario...
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#dbe4f3]">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[#1D4ED8]" />
            </div>
          </div>
        </div>
      ) : null}

      <AppBottomNav
        hidden={mostrarModal || mostrarModalSelectorCliente || paso >= 1}
      />
    </div>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <RefreshCw size={18} className="animate-spin text-[#1D4ED8]" />
        <p className="text-sm font-semibold text-[#1D4ED8]">{text}</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#d0dbeb]">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-[#1D4ED8]" />
      </div>
    </section>
  );
}
