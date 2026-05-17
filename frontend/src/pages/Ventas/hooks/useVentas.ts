import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Preferences } from '@capacitor/preferences';
import {
  actualizarCliente,
  crearCliente,
  listarClientes,
  type ClienteItem,
} from '../../../services/clientesService';
import {
  LoteResumen,
  obtenerDetalleLote,
  obtenerLotes,
  guardarPesosSublotes,
} from '../../../services/lotesService';
import { CreateVentaResponse, crearVenta } from '../../../services/ventasService';
import { ApiRequestError } from '../../../services/apiService';
import { obtenerDeviceId } from '../../../utils/deviceId';
import { ENABLE_SECADO_PROTOTYPE } from '../../../config/features';
import { applySecadoToDetalle, applySecadoToLots } from '../../../utils/secadoFlow';
import { PRECIO_MINIMO_KG } from '../../../utils/businessRules';
import {
  BUSINESS_MIN_DATE_VALUE,
  formatDateLabel,
  getTodayLocalDateValue,
  toIsoDateAtUtcNoon,
  validateBusinessDateRange,
} from '../../../utils/date';
import {
  formatPhoneNumber,
  normalizeCompanyName,
  normalizeHumanName,
  normalizeDocumentForStorage,
  sanitizeDigits as sanitizePersonDigits,
  validateCompanyName,
  type DocumentType,
  validateDocumentNumber,
  validatePersonName,
} from '../../../utils/personValidation';
import { sanitizeSearchInput } from '../../../utils/inputLimits';
import {
  createGuidedError,
  type GuidedErrorMessage,
} from '../../../components/forms/GuidedError';
import { uid } from 'uid';

// TIPOS
export type ModoVenta = 'PARCIAL' | 'TOTAL';
export type Step = 1 | 2 | 3;
export type ClienteSortMode = 'recent' | 'oldest' | 'az' | 'za' | 'doc-asc' | 'doc-desc';

export type ClienteOption = {
  id: string;
  nombre: string;
  documento: string;
  detalle: string;
  telefono?: string;
  tipoDocumento?: DocumentType;
  createdAt?: string;
  rapido?: boolean;
};

export type ClienteForm = {
  nombre: string;
  telefono: string;
  documento: string;
  tipoDocumento: DocumentType | '';
};

export type ClienteFormErrors = Partial<Record<keyof ClienteForm, string>>;

export type LoteVenta = {
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

export type VentaFifoItem = {
  groupId: string;
  subloteId: string;
  subloteNombre: string;
  fifoPosition: number;
  pesoAsignado: number;
  fechaEntrada: string;
  costoBase: number | null;
};

export type VentaGuardadaResumen = {
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
  fifoBreakdown?: VentaFifoItem[];
};

export type VentaParcialCardAlert = {
  title: string;
  detail: string;
};

// CONSTANTES
export const LIMITE = 6;
export const CLIENTE_SORT_OPTIONS: Array<{ value: ClienteSortMode; label: string }> = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguos' },
  { value: 'az', label: 'A-Z' },
  { value: 'za', label: 'Z-A' },
  { value: 'doc-asc', label: 'Número menor a mayor' },
  { value: 'doc-desc', label: 'Número mayor a menor' },
];

export const VENTA_FILTRO_TODOS = 'TODOS';
export const VENTA_DRAFT_STORAGE_KEY = 'cafe-smart:venta-draft:v1';

export const CLIENTE_GENERAL: ClienteOption = {
  id: 'general',
  nombre: 'Cliente General',
  documento: 'Venta rapida',
  detalle: 'Para ventas rapidas o clientes ocasionales no registrados en el sistema.',
  rapido: true,
};

// UTILIDADES
export const kg = (v: number) =>
  `${v.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`;
export const money = (v: number) =>
  `$${v.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
export const toNum = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
export const soloDigitos = (v: string) => v.replace(/\D/g, '');
export const norm = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

function mkLotes(lotes: LoteResumen[]): LoteVenta[] {
  return lotes
    .filter((l) => l.sublotes?.length)
    .map((l) => ({
      id: l.id,
      codigo: l.codigo,
      tipoCafeId: l.tipoCafeId,
      tipoCafe: l.tipoCafe,
      calidadId: l.calidadId,
      calidad: l.calidad,
      disponibleKg: l.pesoActual ?? 0,
      cantidadKg: '',
      precioKg: '',
      pesoVerificadoKg: '',
    }));
}

function clavePersona(nombre: string, documento: string) {
  return `${norm(nombre.trim())}:${soloDigitos(documento)}`;
}

function mapClienteToOption(cliente: ClienteItem): ClienteOption {
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    documento: cliente.documento
      ? `${cliente.tipoDocumento === 'NIT' ? 'NIT ' : 'CC '} ${cliente.documento}`
      : 'Documento pendiente',
    detalle: `${cliente.tipoDocumento === 'NIT' ? 'Empresa' : 'Persona natural'}`,
    telefono: cliente.telefono,
    tipoDocumento: cliente.tipoDocumento,
    createdAt: cliente.createdAt,
  };
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
  excludeId?: string,
) {
  const key = clavePersona(nombre, documento);
  return clientes.find(
    (cliente) =>
      cliente.id !== excludeId && clavePersona(cliente.nombre, cliente.documento) === key,
  );
}

function crearResumenVentaGuardada(respuesta: CreateVentaResponse): VentaGuardadaResumen {
  const ventaTotalKg = respuesta.detalles.reduce((total, item) => total + item.pesoVendido, 0);
  return {
    referenciaId: respuesta.venta.id,
    fecha: respuesta.venta.fecha,
    clienteNombre: 'Cliente registrado',
    clienteDocumento: 'Sin detalle',
    totalKg: ventaTotalKg,
    totalVenta: respuesta.detalles.reduce((total, item) => total + item.subtotal, 0),
    items: [],
  };
}

export function datosPasoVenta(step: Step) {
  if (step === 1) return { titulo: 'Cliente', progreso: 33 };
  if (step === 2) return { titulo: 'Seleccionar cafe', progreso: 66 };
  return { titulo: 'Confirmar venta', progreso: 100 };
}

// VALIDACIONES Y MENSAJES
export function getVentasGuidance(message: string): GuidedErrorMessage {
  const normalized = message.toLowerCase();

  if (normalized.includes('nombre del cliente') || normalized.includes('nombre')) {
    return createGuidedError(
      message,
      'Nombre incompleto.',
      'Ingresa el nombre del cliente.',
      'El nombre debe tener al menos 2 caracteres y no contener números.',
    );
  }

  if (
    normalized.includes('teléfono') ||
    normalized.includes('telefono') ||
    normalized.includes('celular') ||
    normalized.includes('símbolos') ||
    normalized.includes('simbolos')
  ) {
    return createGuidedError(
      message,
      'Teléfono inválido.',
      'Número celular colombiano opcional.',
      'Ingresa un celular válido que empiece por 3 y tenga 10 dígitos.',
    );
  }

  if (
    normalized.includes('tipo de documento') ||
    (normalized.includes('tipo de') && normalized.includes('documento'))
  ) {
    return createGuidedError(
      message,
      'Selecciona el tipo de documento.',
      'Selecciona si el cliente usa cédula o NIT.',
      'Luego escribe el número de documento.',
    );
  }

  if (normalized.includes('documento')) {
    if (normalized.includes('solo') && normalized.includes('números')) {
      return createGuidedError(
        message,
        'Documento inválido.',
        'El documento solo puede contener números.',
        'Borra letras y deja únicamente números.',
      );
    }

    if (normalized.includes('puntos') || normalized.includes('guiones') || normalized.includes('espacios')) {
      return createGuidedError(
        message,
        'Documento con formato inválido.',
        'No uses puntos, espacios ni guiones.',
        'Ingresa el documento sin esos caracteres.',
      );
    }

    if (normalized.includes('muy pocos')) {
      return createGuidedError(
        message,
        'Documento muy corto.',
        'El documento tiene muy pocos números.',
        'Revisa la cantidad de dígitos e intenta de nuevo.',
      );
    }

    return createGuidedError(
      message,
      'Documento inválido.',
      'Ingresa el número de documento sin formato.',
      'Verifica cédula/NIT según el tipo seleccionado.',
    );
  }

  if (message === 'No hay suficiente inventario para realizar la venta') {
    return createGuidedError(
      message,
      'Inventario insuficiente',
      'La venta queda bloqueada porque no hay cafe suficiente.',
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

  if (message.includes('modo de venta') || message.includes('como deseas realizar la venta')) {
    return createGuidedError(
      message,
      'Selecciona como vender',
      'No elegiste el tipo de venta.',
      'Una parte o todo el inventario.',
    );
  }

  if (message.includes('precio por kg')) {
    return createGuidedError(
      message,
      'Falta el precio por kilo.',
      'El precio minimo permitido es $1,000 por kg.',
      'Ingresa un valor desde $1,000.',
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
    'No se pudo guardar la venta.',
    'Revisa los campos señalados.',
    'Revisa el dato marcado y vuelve a intentarlo.',
  );
}

export function getClienteSeleccionGuidance(): GuidedErrorMessage {
  return createGuidedError(
    'Elige una opción para continuar.',
    'Opción no seleccionada.',
    'Selecciona un cliente o una forma de registro.',
    'Buscar cliente, Cliente genérico o Registrar cliente.',
  );
}

export function getClientePhoneError(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  if (/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(raw) || /[^\d\s]/.test(raw)) {
    return 'No uses letras ni símbolos.';
  }
  const digits = sanitizePersonDigits(raw, 10);
  if (digits.length !== 10) return 'El celular debe tener 10 números.';
  if (!digits.startsWith('3')) {
    return 'Ingresa un celular colombiano que empiece por 3.';
  }
  return null;
}

export function getVentaSubmitMessage(error: unknown) {
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
      return 'La cantidad a vender debe ser mayor a 0.';
    }

    if (error.code === 'VENTA_PRECIO_INVALIDO') {
      return 'El precio por kg debe ser mínimo $1,000.';
    }

    if (error.code === 'VENTA_SUBLOTE_INVALIDO') {
      return 'El sublote seleccionado no esta disponible para la venta.';
    }
  }

  return 'No fue posible registrar la venta. Intenta nuevamente.';
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

// PERSISTENCIA DE BORRADORES
export const writeVentaDraft = async (draft: any) => {
  try {
    await Preferences.set({
      key: VENTA_DRAFT_STORAGE_KEY,
      value: JSON.stringify(draft),
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Ventas] Error guardando borrador:', error);
    }
  }
};

export const readVentaDraft = async () => {
  try {
    const { value } = await Preferences.get({ key: VENTA_DRAFT_STORAGE_KEY });
    return value ? JSON.parse(value) : null;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Ventas] Error leyendo borrador:', error);
    }
    return null;
  }
};

export const clearVentaDraft = async () => {
  try {
    await Preferences.remove({ key: VENTA_DRAFT_STORAGE_KEY });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Ventas] Error borrando borrador:', error);
    }
  }
};

// HOOK PRINCIPAL
export function useVentas() {
  const navigate = useNavigate();
  const [cargando, setCargando] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [guardandoVenta, setGuardandoVenta] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [registroErrorMensaje, setRegistroErrorMensaje] = React.useState<string | null>(null);
  const [ventaGuardada, setVentaGuardada] = React.useState<VentaGuardadaResumen | null>(null);
  const [paso, setPaso] = React.useState<Step>(1);
  const [botonConfirmarPresionado, setBotonConfirmarPresionado] = React.useState(false);
  const [intentoPaso1, setIntentoPaso1] = React.useState(false);
  const [intentoPaso2, setIntentoPaso2] = React.useState(false);
  const [clienteMetodo, setClienteMetodo] = React.useState<
    'BUSCAR' | 'GENERAL' | 'REGISTRAR' | null
  >(null);
  const [modoVenta, setModoVenta] = React.useState<ModoVenta | null>(null);
  const [fechaVenta, setFechaVenta] = React.useState(getTodayLocalDateValue());
  const [fechaVentaPickerOpen, setFechaVentaPickerOpen] = React.useState(false);
  const [preciosVentaTotal, setPreciosVentaTotal] = React.useState<Record<string, string>>({});
  const [lotesVenta, setLotesVenta] = React.useState<LoteVenta[]>([]);
  const [ventaParcialOpenId, setVentaParcialOpenId] = React.useState<string | null>(null);
  const [busquedaCafeVenta, setBusquedaCafeVenta] = React.useState('');
  const [tipoCafeFiltroVenta, setTipoCafeFiltroVenta] = React.useState(VENTA_FILTRO_TODOS);
  const [calidadFiltroVenta, setCalidadFiltroVenta] = React.useState(VENTA_FILTRO_TODOS);
  const [tipoCafeFiltroOpen, setTipoCafeFiltroOpen] = React.useState(false);
  const [calidadFiltroOpen, setCalidadFiltroOpen] = React.useState(false);
  const [mostrarTodosCafeVenta, setMostrarTodosCafeVenta] = React.useState(false);
  const [ventaParcialAlert, setVentaParcialAlert] = React.useState<string | null>(null);
  const ventaParcialAlertTimerRef = React.useRef<number | null>(null);
  const [ventaParcialCardAlerts, setVentaParcialCardAlerts] = React.useState<
    Record<string, VentaParcialCardAlert>
  >({});
  const ventaParcialCardAlertTimerRef = React.useRef<number | null>(null);
  const [ajustesVentaParcialConfirmados, setAjustesVentaParcialConfirmados] = React.useState<
    Record<string, true>
  >({});
  const [ventaFifoBreakdown, setVentaFifoBreakdown] = React.useState<VentaFifoItem[]>([]);
  const [mostrarDesgloseSublotesVenta, setMostrarDesgloseSublotesVenta] = React.useState(false);
  const [revisionDeleteAlert, setRevisionDeleteAlert] = React.useState<VentaParcialCardAlert | null>(
    null,
  );
  const revisionDeleteAlertTimerRef = React.useRef<number | null>(null);
  const [borradorVentaPendiente, setBorradorVentaPendiente] = React.useState<any | null>(null);
  const [mostrarModalBorradorVenta, setMostrarModalBorradorVenta] = React.useState(false);
  const [clientes, setClientes] = React.useState<ClienteOption[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = React.useState<ClienteOption | null>(null);
  const [busquedaCliente, setBusquedaCliente] = React.useState('');
  const [busquedaAplicada, setBusquedaAplicada] = React.useState('');
  const [mostrarModal, setMostrarModal] = React.useState(false);
  const [mostrarModalClientes, setMostrarModalClientes] = React.useState(false);
  const [clienteDetalle, setClienteDetalle] = React.useState<ClienteOption | null>(null);
  const [clienteEditando, setClienteEditando] = React.useState<ClienteOption | null>(null);
  const [mostrarModalConfirmar, setMostrarModalConfirmar] = React.useState(false);
  const [mostrarModalCancelar, setMostrarModalCancelar] = React.useState(false);
  const clientesSearchRef = React.useRef<HTMLInputElement | null>(null);
  const [busquedaClientesModal, setBusquedaClientesModal] = React.useState('');
  const [clientesSortMode, setClientesSortMode] = React.useState<ClienteSortMode>('recent');
  const [clientesSortDropdownOpen, setClientesSortDropdownOpen] = React.useState(false);
  const [clienteDocumentoDropdownOpen, setClienteDocumentoDropdownOpen] = React.useState(false);
  const [mostrarHistorialVentas, setMostrarHistorialVentas] = React.useState(false);
  const [historialVentaFecha, setHistorialVentaFecha] = React.useState('');
  const [historialVentaFechaPickerOpen, setHistorialVentaFechaPickerOpen] = React.useState(false);
  const [historialVentaCliente, setHistorialVentaCliente] = React.useState('TODOS');
  const [historialVentaOrden, setHistorialVentaOrden] = React.useState<'recent' | 'oldest'>('recent');
  const [mostrarHistorialLotesVenta, setMostrarHistorialLotesVenta] = React.useState(false);
  const [ventasRealizadas, setVentasRealizadas] = React.useState<VentaGuardadaResumen[]>([]);
  const [clienteForm, setClienteForm] = React.useState<ClienteForm>({
    nombre: '',
    telefono: '',
    documento: '',
    tipoDocumento: '',
  });
  const [nombreMaxToast, setNombreMaxToast] = React.useState(false);
  const nombreMaxToastTimerRef = React.useRef<number | null>(null);
  const MAX_NOMBRE_CARACTERES = 60 as const;
  const MIN_NOMBRE_CARACTERES = 2 as const;
  const [clienteFormErrors, setClienteFormErrors] = React.useState<ClienteFormErrors>({});
  const [clienteFormError, setClienteFormError] = React.useState<string | null>(null);
  const ventaLocalIdRef = React.useRef(uid());

  // CARGAR DATOS INICIALES
  const cargarLotes = React.useCallback(async () => {
    try {
      setCargando(true);
      setLoadError(null);
      const [lotesResult, clientesResult] = await Promise.allSettled([
        obtenerLotes(),
        listarClientes(),
      ]);
      if (lotesResult.status === 'rejected') {
        if (import.meta.env.DEV) {
          console.warn('[Ventas] Error cargando inventario', lotesResult.reason);
        }
        throw lotesResult.reason;
      }
      if (clientesResult.status === 'rejected') {
        if (import.meta.env.DEV) {
          console.warn('[Ventas] Error cargando clientes', clientesResult.reason);
        }
        setClientes([]);
      }
      const lotes = lotesResult.value;
      const clientesData =
        clientesResult.status === 'fulfilled' ? clientesResult.value : [];
      const lotesDisponibles = ENABLE_SECADO_PROTOTYPE
        ? applySecadoToLots(lotes, { includeGeneratedOutputs: false })
        : lotes;
      setLotesVenta(mkLotes(lotesDisponibles));
      setClientes(dedupeClientesOptions(clientesData.map(mapClienteToOption)));
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[Ventas] No se pudo cargar la pantalla de venta', e);
      }
      setLoadError(
        e instanceof Error
          ? e.message
          : 'No fue posible cargar el inventario para venta.',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  // EFECTOS DE CARGA
  React.useEffect(() => {
    void cargarLotes();
  }, [cargarLotes]);

  React.useEffect(() => {
    const loadDraft = async () => {
      const draft = await readVentaDraft();
      if (draft?.savedAt) {
        setBorradorVentaPendiente(draft);
        setMostrarModalBorradorVenta(true);
      }
    };

    void loadDraft();
  }, []);

  // CALULACIONES DERIVADAS
  const clientesRecientes = React.useMemo(() => {
    const base = dedupeClientesOptions([...clientes]);
    const term = norm(busquedaAplicada.trim());
    if (!term) return base;
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

  const historialVentaClientes = React.useMemo(() => {
    const options = new Map<string, string>();
    options.set('TODOS', 'Todos');
    options.set('NO_REGISTRADO', 'Cliente no registrado');
    ventasRealizadas.forEach((venta) => {
      const nombre = venta.clienteNombre?.trim();
      if (nombre) options.set(nombre, nombre);
    });
    return Array.from(options.entries());
  }, [ventasRealizadas]);

  const ventasHistorialFiltradas = React.useMemo(() => {
    const sameDate = (value: string) => value.slice(0, 10) === historialVentaFecha;
    return [...ventasRealizadas]
      .filter((venta) => !historialVentaFecha || sameDate(venta.fecha))
      .filter((venta) => {
        if (historialVentaCliente === 'TODOS') return true;
        const noRegistrado =
          venta.clienteNombre === CLIENTE_GENERAL.nombre ||
          venta.clienteDocumento === CLIENTE_GENERAL.documento;
        if (historialVentaCliente === 'NO_REGISTRADO') return noRegistrado;
        return venta.clienteNombre === historialVentaCliente;
      })
      .sort((a, b) =>
        historialVentaOrden === 'oldest'
          ? new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
          : new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      );
  }, [
    historialVentaCliente,
    historialVentaFecha,
    historialVentaOrden,
    ventasRealizadas,
  ]);

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
      .filter((l) => ajustesVentaParcialConfirmados[l.id] && l.cantidad > 0);
  }, [ajustesVentaParcialConfirmados, lotesVenta, modoVenta, preciosVentaTotal]);

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

  const tipoCafeFiltroOpciones = React.useMemo(() => {
    const vistos = new Set<string>();
    return [
      { value: VENTA_FILTRO_TODOS, label: 'Todos los tipos' },
      ...lotesVenta.reduce<Array<{ value: string; label: string }>>((opciones, lote) => {
        const key = lote.tipoCafe.trim().toLowerCase();
        if (!key || vistos.has(key)) return opciones;
        vistos.add(key);
        opciones.push({ value: lote.tipoCafe, label: lote.tipoCafe });
        return opciones;
      }, []),
    ];
  }, [lotesVenta]);

  const calidadFiltroOpciones = React.useMemo(() => {
    const vistos = new Set<string>();
    return [
      { value: VENTA_FILTRO_TODOS, label: 'Todas las calidades' },
      ...lotesVenta.reduce<Array<{ value: string; label: string }>>((opciones, lote) => {
        const key = lote.calidad.trim().toLowerCase();
        if (!key || vistos.has(key)) return opciones;
        vistos.add(key);
        opciones.push({ value: lote.calidad, label: lote.calidad });
        return opciones;
      }, []),
    ];
  }, [lotesVenta]);

  const lotesVentaParcialFiltrados = React.useMemo(() => {
    const termino = norm(busquedaCafeVenta.trim());
    return lotesVenta.filter((lote) => {
      const texto = norm(`${lote.tipoCafe} ${lote.calidad} ${lote.codigo}`);
      const coincideBusqueda = !termino || texto.includes(termino);
      const coincideTipo =
        tipoCafeFiltroVenta === VENTA_FILTRO_TODOS ||
        norm(lote.tipoCafe) === norm(tipoCafeFiltroVenta);
      const coincideCalidad =
        calidadFiltroVenta === VENTA_FILTRO_TODOS ||
        norm(lote.calidad) === norm(calidadFiltroVenta);
      return coincideBusqueda && coincideTipo && coincideCalidad;
    });
  }, [busquedaCafeVenta, calidadFiltroVenta, lotesVenta, tipoCafeFiltroVenta]);

  const lotesVentaParcialVisibles = mostrarTodosCafeVenta
    ? lotesVentaParcialFiltrados
    : lotesVentaParcialFiltrados.slice(0, 3);

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
      if (toNum(preciosVentaTotal[item.tipoCafeId] ?? '') < PRECIO_MINIMO_KG) {
        invalidos.add(item.tipoCafeId);
      }
    }

    return invalidos;
  }, [preciosVentaTotal, resumenDisponiblePorTipo]);

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
        return `Ingresa un precio por kg valido para cafe ${tipoSinPrecio.tipoCafe}.`;
      }

      return null;
    }
    if (modoVenta === 'PARCIAL' && !lotesConCantidad.length)
      return 'Ingresa al menos una cantidad para continuar.';
    for (const l of lotesConCantidad) {
      if (pesoVerificadoInvalido(l))
        return `El peso verificado no puede superar el disponible en ${l.codigo}.`;
      if (l.cantidad > getDisponibleVenta(l))
        return `La cantidad supera el disponible en ${l.codigo}.`;
      if (l.precio < PRECIO_MINIMO_KG)
        return `Ingresa un precio por kg valido en ${l.codigo}.`;
    }
    return null;
  }, [
    fechaVentaValidacion.isValid,
    fechaVentaValidacion.message,
    lotesVenta.length,
    modoVenta,
    preciosVentaTotalInvalidos,
    resumenDisponiblePorTipo,
    lotesConCantidad,
  ]);

  const hayCantidadParcial = React.useMemo(
    () =>
      lotesVenta.some(
        (l) =>
          ajustesVentaParcialConfirmados[l.id] &&
          toNum(l.cantidadKg) > 0 &&
          toNum(l.precioKg) >= PRECIO_MINIMO_KG &&
          toNum(l.cantidadKg) <= getDisponibleVenta(l),
      ),
    [ajustesVentaParcialConfirmados, lotesVenta],
  );

  const parcialConErrores = React.useMemo(() => {
    if (modoVenta !== 'PARCIAL') return false;
    return lotesVenta.some((lote) => {
      if (!ajustesVentaParcialConfirmados[lote.id]) return false;
      const cantidad = toNum(lote.cantidadKg);
      return (
        cantidad <= 0 ||
        cantidad > getDisponibleVenta(lote) ||
        toNum(lote.precioKg) < PRECIO_MINIMO_KG ||
        pesoVerificadoInvalido(lote)
      );
    });
  }, [ajustesVentaParcialConfirmados, lotesVenta, modoVenta]);

  const puedeAvanzarPaso2 =
    !fechaVentaValidacion.isValid || modoVenta === null
      ? false
      : modoVenta === 'TOTAL'
        ? resumenDisponiblePorTipo.length > 0 &&
          preciosVentaTotalInvalidos.size === 0 &&
          !lotesVenta.some(pesoVerificadoInvalido)
        : hayCantidadParcial && !parcialConErrores;

  // PERSISTENCIA DE BORRADORES
  React.useEffect(() => {
    if (
      cargando ||
      ventaGuardada ||
      registroErrorMensaje ||
      mostrarModalBorradorVenta ||
      borradorVentaPendiente
    )
      return;
    const hasProgress =
      paso > 1 ||
      Boolean(clienteSeleccionado) ||
      Boolean(modoVenta) ||
      lotesVenta.some((lote) => lote.cantidadKg || lote.pesoVerificadoKg) ||
      Object.values(preciosVentaTotal).some((precio) => precio.trim() !== '');

    if (!hasProgress) {
      void clearVentaDraft();
      return;
    }

    const timer = window.setTimeout(() => {
      void writeVentaDraft({
        savedAt: Date.now(),
        paso,
        clienteSeleccionado,
        clienteMetodo,
        fechaVenta,
        modoVenta,
        lotesVenta,
        preciosVentaTotal,
        ajustesVentaParcialConfirmados,
        localId: ventaLocalIdRef.current,
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    cargando,
    borradorVentaPendiente,
    clienteMetodo,
    clienteSeleccionado,
    fechaVenta,
    lotesVenta,
    mostrarModalBorradorVenta,
    modoVenta,
    paso,
    preciosVentaTotal,
    registroErrorMensaje,
    ventaGuardada,
    ajustesVentaParcialConfirmados,
  ]);

  // EFECTOS DE VALIDACIÓN
  React.useEffect(() => {
    if (paso === 3 && !lotesConCantidad.length && !ventaGuardada) {
      setPaso(2);
      setIntentoPaso2(true);
    }
  }, [lotesConCantidad.length, paso, ventaGuardada]);

  // FIFO BREAKDOWN
  React.useEffect(() => {
    if (paso !== 3 || modoVenta !== 'PARCIAL' || lotesConCantidad.length === 0) {
      setVentaFifoBreakdown([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      const breakdown: VentaFifoItem[] = [];

      for (const lote of lotesConCantidad) {
        const detalleBase = await obtenerDetalleLote(lote.tipoCafeId, lote.calidadId);
        const detalle = ENABLE_SECADO_PROTOTYPE
          ? applySecadoToDetalle(detalleBase, lote.tipoCafeId, lote.calidadId, {
              includeGeneratedOutputs: false,
            })
          : detalleBase;
        let restante = round2(lote.cantidad);
        const sublotesOrdenados = [...(detalle?.sublotes ?? [])]
          .filter((sublote) => sublote.pesoActual > 0)
          .sort(
            (a, b) =>
              new Date(a.fechaIngreso).getTime() -
              new Date(b.fechaIngreso).getTime(),
          );

        sublotesOrdenados.forEach((sublote, index) => {
          if (restante <= 0) return;
          const asignado = round2(Math.min(restante, sublote.pesoActual));
          if (asignado <= 0) return;

          breakdown.push({
            groupId: lote.id,
            subloteId: sublote.id,
            subloteNombre: sublote.etiqueta || `Sublote ${index + 1}`,
            fifoPosition: index + 1,
            pesoAsignado: asignado,
            fechaEntrada: sublote.fechaIngreso,
            costoBase: Number.isFinite(sublote.costoPorKg)
              ? sublote.costoPorKg
              : null,
          });
          restante = round2(restante - asignado);
        });
      }

      if (!cancelled) {
        setVentaFifoBreakdown(breakdown);
      }
    })().catch(() => {
      if (!cancelled) setVentaFifoBreakdown([]);
    });

    return () => {
      cancelled = true;
    };
  }, [lotesConCantidad, modoVenta, paso]);

  // HANDLERS PRINCIPALES
  const siguiente = React.useCallback(() => {
    if (paso === 1) {
      setIntentoPaso1(true);
      if (!clienteMetodo) {
        setSubmitError(null);
        setClienteFormError(null);
        return;
      }
      if (!clienteSeleccionado) return;
      setSubmitError(null);
      setIntentoPaso2(false);
      return setPaso(2);
    }
    if (paso === 2) {
      setIntentoPaso2(true);
      if (modoVenta === 'PARCIAL') {
        if (!hayCantidadParcial) {
          const firstProblem = lotesVentaParcialFiltrados[0] ?? lotesVenta[0];
          const firstProblemAlert = firstProblem
            ? getVentaParcialCardAlert(firstProblem, true)
            : null;

          if (firstProblem && firstProblemAlert) {
            setVentaParcialOpenId(firstProblem.id);
            mostrarAlertaTarjetaVentaParcial(firstProblem.id, firstProblemAlert);
          }
        }
      }
      if (!puedeAvanzarPaso2) return;
      setVentaParcialCardAlerts({});
      setSubmitError(null);
      return setPaso(3);
    }
  }, [
    clienteMetodo,
    clienteSeleccionado,
    hayCantidadParcial,
    lotesVenta,
    lotesVentaParcialFiltrados,
    modoVenta,
    getVentaParcialCardAlert,
    mostrarAlertaTarjetaVentaParcial,
    paso,
    puedeAvanzarPaso2,
  ]);

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

      const ventaResumen = {
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
        fifoBreakdown: ventaFifoBreakdown,
      };
      setVentaGuardada(ventaResumen);
      setVentasRealizadas((actual) => [ventaResumen, ...actual]);
      await clearVentaDraft();
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
    ventaFifoBreakdown,
    validarPasoVenta,
  ]);

  const reiniciar = React.useCallback(() => {
    void clearVentaDraft();
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
    setAjustesVentaParcialConfirmados({});
    setVentaFifoBreakdown([});
    setClienteFormErrors({});
    setIntentoPaso1(false);
    setIntentoPaso2(false);
    setLoadError(null);
    ventaLocalIdRef.current = uid();
    void cargarLotes();
  }, [cargarLotes]);

  const continuarBorradorVenta = React.useCallback(() => {
    const draft = borradorVentaPendiente;
    if (!draft) return;
    setPaso((draft.paso || 1) as Step);
    setClienteSeleccionado(draft.clienteSeleccionado ?? null);
    setClienteMetodo(draft.clienteMetodo ?? null);
    setFechaVenta(draft.fechaVenta || getTodayLocalDateValue());
    setModoVenta(draft.modoVenta ?? null);
    if (Array.isArray(draft.lotesVenta)) setLotesVenta(draft.lotesVenta);
    setPreciosVentaTotal(draft.preciosVentaTotal ?? {});
    setAjustesVentaParcialConfirmados(
      draft.ajustesVentaParcialConfirmados ?? {},
    );
    ventaLocalIdRef.current = draft.localId || uid();
    setMostrarModalBorradorVenta(false);
    setBorradorVentaPendiente(null);
  }, [borradorVentaPendiente]);

  const empezarVentaNuevaDesdeBorrador = React.useCallback(() => {
    void clearVentaDraft();
    setMostrarModalBorradorVenta(false);
    setBorradorVentaPendiente(null);
    reiniciar();
  }, [reiniciar]);

  const updateLote = (
    id: string,
    campo: 'cantidadKg' | 'precioKg' | 'pesoVerificadoKg',
    valor: string,
  ) => {
    setVentaParcialCardAlerts((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setSubmitError(null);
    setAjustesVentaParcialConfirmados((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setLotesVenta((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, [campo]: campo === 'precioKg' ? soloDigitos(valor) : valor }
          : l,
      ),
    );
  };

  const mostrarAlertaVentaParcial = React.useCallback((message: string) => {
    setVentaParcialAlert(message);
    if (ventaParcialAlertTimerRef.current) {
      window.clearTimeout(ventaParcialAlertTimerRef.current);
    }
    ventaParcialAlertTimerRef.current = window.setTimeout(() => {
      setVentaParcialAlert(null);
    }, 4200);
  }, []);

  const getVentaParcialCardAlert = React.useCallback(
    (
      lote: LoteVenta,
      requireEmpty = false,
      skipConfirmCheck = false,
    ): VentaParcialCardAlert | null => {
      const nombreCafe = `${lote.tipoCafe} ${lote.calidad}`;
      const cantidadTexto = lote.cantidadKg.trim();
      const precioTexto = lote.precioKg.trim();
      const cantidad = toNum(lote.cantidadKg);
      const precio = toNum(lote.precioKg);
      const disponible = getDisponibleVenta(lote);

      if (!cantidadTexto && !precioTexto) {
        return requireEmpty
          ? {
              title: `Confirma el ajuste de ${nombreCafe}.`,
              detail:
                'Completa cantidad y precio, luego confirma el ajuste para agregarlo a la venta.',
            }
          : null;
      }

      if (!cantidadTexto && precioTexto) {
        return {
          title: `Falta la cantidad en ${nombreCafe}.`,
          detail: 'Ingresa cuántos kg deseas vender.',
        };
      }

      if (cantidad <= 0) {
        return {
          title: `Falta la cantidad en ${nombreCafe}.`,
          detail: 'Ingresa cuántos kg deseas vender.',
        };
      }

      if (cantidad > disponible) {
        return {
          title: `La cantidad supera el disponible de ${nombreCafe}.`,
          detail: `Disponible: ${kg(disponible)}.`,
        };
      }

      if (!precioTexto) {
        return {
          title: `Falta el precio en ${nombreCafe}.`,
          detail: 'Ingresa el precio por kg.',
        };
      }

      if (precio < PRECIO_MINIMO_KG) {
        return {
          title: `El precio de ${nombreCafe} es demasiado bajo.`,
          detail: 'Ingresa un valor desde $1.000 por kg.',
        };
      }

      if (pesoVerificadoInvalido(lote)) {
        return {
          title: `Revisa el peso de ${nombreCafe}.`,
          detail: `No puede superar el disponible: ${kg(disponible)}.`,
        };
      }

      if (!skipConfirmCheck && !ajustesVentaParcialConfirmados[lote.id]) {
        return {
          title: `Confirma el ajuste de ${nombreCafe}.`,
          detail: 'Presiona "Confirmar ajuste" para agregarlo a la venta.',
        };
      }

      return null;
    },
    [ajustesVentaParcialConfirmados],
  );

  const mostrarAlertaTarjetaVentaParcial = React.useCallback(
    (loteId: string, alert: VentaParcialCardAlert) => {
      setVentaParcialCardAlerts({ [loteId]: alert });
      if (ventaParcialCardAlertTimerRef.current) {
        window.clearTimeout(ventaParcialCardAlertTimerRef.current);
      }
      ventaParcialCardAlertTimerRef.current = window.setTimeout(() => {
        setVentaParcialCardAlerts({});
      }, 4200);
    },
    [],
  );

  const mostrarAlertaRevision = React.useCallback((alert: VentaParcialCardAlert) => {
    setRevisionDeleteAlert(alert);
    if (revisionDeleteAlertTimerRef.current) {
      window.clearTimeout(revisionDeleteAlertTimerRef.current);
    }
    revisionDeleteAlertTimerRef.current = window.setTimeout(() => {
      setRevisionDeleteAlert(null);
    }, 4200);
  }, []);

  const confirmarAjusteParcial = React.useCallback(
    (lote: LoteVenta) => {
      const alerta = getVentaParcialCardAlert(lote, false, true);
      if (alerta) {
        mostrarAlertaTarjetaVentaParcial(lote.id, alerta);
        return;
      }

      setAjustesVentaParcialConfirmados((current) => ({
        ...current,
        [lote.id]: true,
      }));
      setVentaParcialCardAlerts((current) => {
        if (!current[lote.id]) return current;
        const next = { ...current };
        delete next[lote.id];
        return next;
      });
      setVentaParcialOpenId(null);
    },
    [getVentaParcialCardAlert, mostrarAlertaTarjetaVentaParcial],
  );

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
    reiniciar();
  };

  const validarClienteForm = React.useCallback(() => {
    const errores: ClienteFormErrors = {};

    const nombre =
      clienteForm.tipoDocumento === 'NIT'
        ? validateCompanyName(clienteForm.nombre)
        : validatePersonName(clienteForm.nombre, 'El nombre');
    if (!nombre.isValid) errores.nombre = nombre.message;

    const telefono = getClientePhoneError(clienteForm.telefono);
    if (telefono) errores.telefono = telefono;

    if (!clienteForm.tipoDocumento) {
      errores.tipoDocumento = 'Selecciona el tipo de documento.';
    }

    const tipoSeleccionado = clienteForm.tipoDocumento || null;
    const documento = validateDocumentNumber(
      clienteForm.documento,
      'El documento',
      {
        optional: false,
        type: tipoSeleccionado,
      },
    );

    if (clienteForm.documento.trim() && !clienteForm.tipoDocumento) {
      errores.documento = undefined;
    } else if (!documento.isValid) {
      errores.documento = documento.message;
    }

    return errores;
  }, [clienteForm.documento, clienteForm.nombre, clienteForm.telefono, clienteForm.tipoDocumento]);

  const guardarCliente = async () => {
    const nombre =
      clienteForm.tipoDocumento === 'NIT'
        ? normalizeCompanyName(clienteForm.nombre)
        : normalizeHumanName(clienteForm.nombre);
    const telefono = sanitizePersonDigits(clienteForm.telefono);
    const tipoDocumento = clienteForm.tipoDocumento || undefined;
    const documento = tipoDocumento
      ? normalizeDocumentForStorage(clienteForm.documento, tipoDocumento)
      : '';
    const errores = validarClienteForm();

    setClienteFormErrors(errores);
    setClienteFormError(null);

    if (Object.keys(errores).length > 0) {
      return;
    }

    const clienteExistente = findClienteExistente(
      clientes,
      nombre,
      documento,
      clienteEditando?.id,
    );
    if (clienteExistente) {
      setClienteFormErrors((actual) => ({
        ...actual,
        documento: 'Este documento ya está registrado.',
      }));
      setClienteFormError(
        'Este documento ya está registrado. Busca el registro existente o usa otro número.',
      );
      return;
    }

    try {
      const payload = {
        nombre,
        documento: documento || undefined,
        tipoDocumento,
        telefono: telefono || undefined,
      };
      const clienteGuardado = clienteEditando
        ? await actualizarCliente(clienteEditando.id, payload)
        : await crearCliente(payload);
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
      setClienteEditando(null);
      setClienteMetodo('BUSCAR');
      setClienteForm({ nombre: '', telefono: '', documento: '', tipoDocumento: '' });
      setClienteFormErrors({});
      setClienteFormError(null);
      setSubmitError(null);
    } catch (error) {
      setClienteFormError('No fue posible registrar el cliente. Intenta nuevamente.');
    }
  };

  const editarLoteDesdeRevision = React.useCallback(() => {
    setSubmitError(null);
    setIntentoPaso2(false);
    setPaso(2);
  }, []);

  const eliminarLoteDesdeRevision = React.useCallback(
    (loteId: string) => {
      setSubmitError(null);
      setIntentoPaso2(false);

      if (lotesConCantidad.length <= 1) {
        setMostrarHistorialLotesVenta(false);
        mostrarAlertaRevision({
          title: 'Debe quedar al menos un café agregado',
          detail:
            'Si deseas cancelar completamente la venta, usa la opción "Cancelar venta".',
        });
        return;
      }

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
    [lotesConCantidad.length, modoVenta, mostrarAlertaRevision, preciosVentaTotal],
  );

  return {
    // State
    cargando,
    loadError,
    guardandoVenta,
    submitError,
    registroErrorMensaje,
    ventaGuardada,
    paso,
    botonConfirmarPresionado,
    intentoPaso1,
    intentoPaso2,
    clienteMetodo,
    modoVenta,
    fechaVenta,
    fechaVentaPickerOpen,
    preciosVentaTotal,
    lotesVenta,
    ventaParcialOpenId,
    busquedaCafeVenta,
    tipoCafeFiltroVenta,
    calidadFiltroVenta,
    tipoCafeFiltroOpen,
    calidadFiltroOpen,
    mostrarTodosCafeVenta,
    ventaParcialAlert,
    ventaParcialCardAlerts,
    ajustesVentaParcialConfirmados,
    ventaFifoBreakdown,
    mostrarDesgloseSublotesVenta,
    revisionDeleteAlert,
    borradorVentaPendiente,
    mostrarModalBorradorVenta,
    clientes,
    clienteSeleccionado,
    busquedaCliente,
    busquedaAplicada,
    mostrarModal,
    mostrarModalClientes,
    clienteDetalle,
    clienteEditando,
    mostrarModalConfirmar,
    mostrarModalCancelar,
    clientesSearchRef,
    busquedaClientesModal,
    clientesSortMode,
    clientesSortDropdownOpen,
    clienteDocumentoDropdownOpen,
    mostrarHistorialVentas,
    historialVentaFecha,
    historialVentaFechaPickerOpen,
    historialVentaCliente,
    historialVentaOrden,
    mostrarHistorialLotesVenta,
    ventasRealizadas,
    clienteForm,
    nombreMaxToast,
    MAX_NOMBRE_CARACTERES,
    MIN_NOMBRE_CARACTERES,
    clienteFormErrors,
    clienteFormError,
    
    // Computed
    clientesRecientes,
    sinClientesRegistrados,
    busquedaClienteActiva,
    mostrarResultadosClientes,
    historialVentaClientes,
    ventasHistorialFiltradas,
    lotesConCantidad,
    totalKg,
    totalEstimado,
    totalDisponibleVenta,
    tipoCafeFiltroOpciones,
    calidadFiltroOpciones,
    lotesVentaParcialFiltrados,
    lotesVentaParcialVisibles,
    resumenDisponiblePorTipo,
    preciosVentaTotalInvalidos,
    fechaVentaValidacion,
    validarPasoVenta,
    hayCantidadParcial,
    parcialConErrores,
    puedeAvanzarPaso2,
    pasoActual,
    clienteSeleccionadoId,
    clienteInvalido,
    modoInvalido,
    fechaVentaInvalida,
    precioTotalInvalido,
    sinInventario,
    parcialSinCantidad,
    parcialSinSeleccion,

    // Refs
    nombreMaxToastTimerRef,
    ventaLocalIdRef,

    // Handlers
    siguiente,
    anterior,
    confirmar,
    reiniciar,
    continuarBorradorVenta,
    empezarVentaNuevaDesdeBorrador,
    updateLote,
    mostrarAlertaVentaParcial,
    getVentaParcialCardAlert,
    mostrarAlertaTarjetaVentaParcial,
    mostrarAlertaRevision,
    confirmarAjusteParcial,
    seleccionarCliente,
    buscarCliente,
    volverPasoAnterior,
    confirmarCancelarVenta,
    validarClienteForm,
    guardarCliente,
    editarLoteDesdeRevision,
    eliminarLoteDesdeRevision,

    // Setters
    setCargando,
    setLoadError,
    setGuardandoVenta,
    setSubmitError,
    setRegistroErrorMensaje,
    setVentaGuardada,
    setPaso,
    setBotonConfirmarPresionado,
    setIntentoPaso1,
    setIntentoPaso2,
    setClienteMetodo,
    setModoVenta,
    setFechaVenta,
    setFechaVentaPickerOpen,
    setPreciosVentaTotal,
    setLotesVenta,
    setVentaParcialOpenId,
    setBusquedaCafeVenta,
    setTipoCafeFiltroVenta,
    setCalidadFiltroVenta,
    setTipoCafeFiltroOpen,
    setCalidadFiltroOpen,
    setMostrarTodosCafeVenta,
    setVentaParcialAlert,
    setVentaParcialCardAlerts,
    setAjustesVentaParcialConfirmados,
    setVentaFifoBreakdown,
    setMostrarDesgloseSublotesVenta,
    setRevisionDeleteAlert,
    setBorradorVentaPendiente,
    setMostrarModalBorradorVenta,
    setClientes,
    setClienteSeleccionado,
    setBusquedaCliente,
    setBusquedaAplicada,
    setMostrarModal,
    setMostrarModalClientes,
    setClienteDetalle,
    setClienteEditando,
    setMostrarModalConfirmar,
    setMostrarModalCancelar,
    setBusquedaClientesModal,
    setClientesSortMode,
    setClientesSortDropdownOpen,
    setClienteDocumentoDropdownOpen,
    setMostrarHistorialVentas,
    setHistorialVentaFecha,
    setHistorialVentaFechaPickerOpen,
    setHistorialVentaCliente,
    setHistorialVentaOrden,
    setMostrarHistorialLotesVenta,
    setVentasRealizadas,
    setClienteForm,
    setNombreMaxToast,
    setClienteFormErrors,
    setClienteFormError,

    // API
    cargarLotes,
  };
}
