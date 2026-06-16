import {
  createGuidedError,
  type GuidedErrorMessage,
} from '../../components/forms/GuidedError';
import { ApiRequestError } from '../../services/apiService';
import { getLimitesEntradaSnapshot } from '../../services/limitesEntradaService';
import type { LoteVenta, VentaParcialCardAlert } from './types';
import type { ClienteItem } from '../../services/clientesService';
import { LoteResumen } from '../../services/lotesService';
import type { ClienteOption } from './types';

// Formatting functions
export const kg = (v: number) =>
  `${v.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`;

export const money = (v: number) =>
  `$${v.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

export const MAX_CANTIDAD_KG = 1000000;
export const getLimitesVenta = () => getLimitesEntradaSnapshot();

function normalizeNumericText(value: string) {
  return value.trim();
}

export function parseNumericInput(
  value: string,
  options?: {
    allowDecimal?: boolean;
    maxDecimals?: number;
    maxValue?: number;
  },
) {
  const { allowDecimal = true, maxDecimals = 3, maxValue = Number.MAX_SAFE_INTEGER } = options ?? {};
  const raw = normalizeNumericText(value);
  if (!raw) return null;
  if (/[eE]/.test(raw)) return null;
  if (raw.includes(' ') || raw.includes('+') || raw.includes('-')) return null;

  const normalized = raw.replace(',', '.');
  const validPattern = allowDecimal ? /^\d+(?:\.\d*)?$/ : /^\d+$/;
  if (!validPattern.test(normalized)) return null;
  if (allowDecimal) {
    const [, decimals = ''] = normalized.split('.');
    if (decimals.length > maxDecimals) return null;
  }

  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0 || number > maxValue) return null;

  return number;
}

export const toNum = (v: string) =>
  parseNumericInput(v, {
    allowDecimal: true,
    maxDecimals: 3,
    maxValue: 1000000000,
  }) ?? 0;

export const isValidCantidadInput = (value: string, disponible: number) => {
  const cantidad = parseNumericInput(value, {
    allowDecimal: true,
    maxDecimals: 3,
    maxValue: MAX_CANTIDAD_KG,
  });
  return cantidad !== null && cantidad > 0 && cantidad <= disponible;
};

export const isValidPrecioInput = (value: string) => {
  const limites = getLimitesVenta();
  const precio = parseNumericInput(value, {
    allowDecimal: false,
    maxDecimals: 0,
    maxValue: limites.maxPrecioVentaKg,
  });
  return precio !== null && precio >= limites.minPrecioVentaKg;
};

export const soloDigitos = (v: string) => v.replace(/\D/g, '');

export const norm = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// Math functions
export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getPesoVerificado(lote: LoteVenta) {
  if (!lote.pesoVerificadoKg.trim()) return null;
  return round2(toNum(lote.pesoVerificadoKg));
}

export function getDisponibleVenta(lote: LoteVenta) {
  const verificado = getPesoVerificado(lote);
  if (verificado === null) return lote.disponibleKg;
  return Math.max(0, Math.min(lote.disponibleKg, verificado));
}

export function pesoVerificadoInvalido(lote: LoteVenta) {
  const verificado = getPesoVerificado(lote);
  return (
    verificado !== null && (verificado < 0 || verificado > lote.disponibleKg)
  );
}

export function distribuirPesoVerificado<T extends { subloteId: string; disponibleKg: number }>(
  pool: T[],
  pesoVerificado: number,
): T[] {
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
  }) as T[];
}

// Date functions
export function parseLocalDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

export function formatLocalDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatLongDateLabel(value: string) {
  const date = parseLocalDateValue(value);
  if (!date) return '';
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function isDateValueInRange(value: string, min: string, max: string) {
  return value >= min && value <= max;
}

// UID generation
export const uid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

// Lote functions
export function isLoteVendible(lote: LoteResumen) {
  const searchable = norm(
    `${lote.id} ${lote.codigo} ${lote.tipoCafeId} ${lote.tipoCafe} ${lote.calidadId} ${lote.calidad}`,
  );
  const noVendible =
    searchable.includes('en secado') ||
    searchable.includes('secado activo') ||
    searchable.includes('proceso de secado') ||
    searchable.includes('no disponible') ||
    searchable.includes('virtual-en-secado') ||
    searchable.includes('virtual-en-proceso') ||
    searchable.includes('secado-proceso');

  return lote.pesoActual > 0 && !noVendible;
}

export function mkLotes(lotes: LoteResumen[]): LoteVenta[] {
  return lotes
    .filter(isLoteVendible)
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
      pesoVerificadoKg: '',
    }));
}

// ARIA helpers
export function ariaExpanded(open: boolean) {
  return { 'aria-expanded': open ? 'true' : 'false' } as const;
}

export function ariaPressed(active: boolean) {
  return { 'aria-pressed': active ? 'true' : 'false' } as const;
}

// Cliente helpers
export function clavePersona(nombre: string, documento: string) {
  const documentoNormalizado = soloDigitos(documento);
  return documentoNormalizado
    ? `documento:${documentoNormalizado}`
    : `nombre:${norm(nombre.trim())}`;
}

export function dedupeClientesOptions<T extends { id: string; nombre: string; documento: string }>(
  clientes: T[],
): T[] {
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

export function findClienteExistente<T extends { id: string; nombre: string; documento: string }>(
  clientes: T[],
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

export function mapClienteToOption(cliente: ClienteItem): ClienteOption {
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    documento: cliente.documento?.trim() || 'Documento pendiente',
    detalle: cliente.telefono?.trim() || 'Cliente registrado en sistema',
    telefono: cliente.telefono ?? undefined,
    tipoDocumento: (cliente as ClienteItem & { tipoDocumento?: ClienteOption['tipoDocumento'] | null })
      .tipoDocumento ?? 'CEDULA',
    createdAt: cliente.createdAt,
  };
}

// Validation & Guidance
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
    if (!message.trim() || normalized.includes('ingresa')) {
      return createGuidedError(
        message,
        'Falta el documento.',
        'Ingresa el número de documento.',
        'Escribe solo los dígitos del documento.',
      );
    }

    if (normalized.includes('solo') && normalized.includes('números')) {
      return createGuidedError(
        message,
        'Documento inválido.',
        'La cédula solo puede contener números.',
        'Borra letras y deja únicamente números.',
      );
    }

    if (
      normalized.includes('caracteres no permitidos') ||
      normalized.includes('puntos') ||
      normalized.includes('guiones') ||
      normalized.includes('espacios')
    ) {
      return createGuidedError(
        message,
        'Documento con formato inválido.',
        'El documento contiene caracteres no permitidos.',
        'Ingresa el documento solo con números.',
      );
    }

    if (normalized.includes('supera') || normalized.includes('permitida')) {
      return createGuidedError(
        message,
        'Documento demasiado largo.',
        message,
        'Quita los dígitos sobrantes e intenta de nuevo.',
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

    if (normalized.includes('repetir') || normalized.includes('mismo número')) {
      return createGuidedError(
        message,
        'Documento repetido.',
        message,
        'Corrige el número del documento.',
      );
    }

    return createGuidedError(
      message,
      'Documento inválido.',
      'Ingresa el número de documento sin formato.',
      'Revisa el dato marcado e intenta de nuevo.',
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
      'Selecciona cómo vender',
      'No elegiste el tipo de venta.',
      'Elige venta parcial o venta total para continuar.',
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

  // Import sanitizePersonDigits from validation utils
  const sanitizePersonDigits = (v: string) => v.replace(/\D/g, '');
  const digits = sanitizePersonDigits(raw);

  if (digits.length !== 10) return 'El celular debe tener 10 números.';
  if (!digits.startsWith('3')) {
    return 'Ingresa un celular colombiano que empiece por 3.';
  }
  return null;
}

export function getVentaSubmitMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return 'No tienes conexión. Guardamos tu borrador para intentarlo después.';
    }

    if (error.status >= 500) {
      return 'La venta no se pudo guardar por un problema del servidor. Tus datos siguen seguros. Intenta nuevamente.';
    }

    if (
      error.code === 'INSUFFICIENT_STOCK' ||
      error.code === 'VENTA_INVENTARIO_INSUFICIENTE'
    ) {
      const details = error.details as unknown;
      const stockDetails = Array.isArray(details)
        ? details
        : Object.values(error.details ?? {}).flat();
      const stockDetail = stockDetails.find(
        (detail): detail is { disponibleKg?: number; solicitadoKg?: number } =>
          Boolean(detail) && typeof detail === 'object',
      );

      if (
        stockDetail &&
        typeof stockDetail.disponibleKg === 'number' &&
        typeof stockDetail.solicitadoKg === 'number'
      ) {
        return `La cantidad supera el inventario disponible. Máximo disponible: ${kg(
          stockDetail.disponibleKg,
        )}; solicitado: ${kg(stockDetail.solicitadoKg)}.`;
      }

      return 'La cantidad supera el inventario disponible.';
    }

    if (error.code === 'VENTA_CANTIDAD_INVALIDA') {
      return 'Ingresa una cantidad mayor a 0.';
    }

    if (error.code === 'VENTA_PRECIO_INVALIDO') {
      return `El precio por kg debe estar entre ${money(
        getLimitesVenta().minPrecioVentaKg,
      )} y ${money(getLimitesVenta().maxPrecioVentaKg)}.`;
    }

    if (
      error.code === 'VENTA_SUBLOTE_INVALIDO' ||
      error.code === 'SUBLOTE_NOT_FOUND'
    ) {
      return 'No encontramos el lote seleccionado. Actualiza el inventario e intenta de nuevo.';
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'No fue posible registrar la venta. Intenta nuevamente.';
}

export function esErrorGeneralGuardadoVenta(error: unknown) {
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
    'SUBLOTE_NOT_FOUND',
  ]);

  return !error.field && !erroresCorregibles.has(error.code ?? '');
}

export function getCantidadLoteGuidance(
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
    `La cantidad debe ser mayor a 0 en ${lote.codigo}.`,
    'Cantidad inválida',
    'Ingresa una cantidad mayor a 0.',
    `Disponible: ${kg(disponible)}.`,
  );
}

export function datosPasoVenta(step: 1 | 2 | 3) {
  if (step === 1) {
    return {
      titulo: 'Cliente',
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
    titulo: 'Confirmar venta',
    progreso: 100,
  };
}

export function crearResumenVentaGuardada(respuesta: any): any {
  const ventaTotalKg = respuesta.detalles.reduce(
    (total: number, item: any) => total + item.pesoVendido,
    0,
  );
  return {
    referenciaId: respuesta.venta.id,
    fecha: respuesta.venta.fecha,
    clienteNombre: 'Cliente registrado',
    clienteDocumento: 'Sin detalle',
    totalKg: ventaTotalKg,
    totalVenta: respuesta.detalles.reduce(
      (total: number, item: any) => total + item.subtotal,
      0,
    ),
    items: [],
  };
}

export function getClienteInitials(nombre: string) {
  const words = nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return words.map((w) => w[0]?.toUpperCase()).join('') || 'C';
}
