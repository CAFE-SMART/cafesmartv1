import type { CreateCompraDto } from './dto/crear-compra.dto';
import { PRECIO_MINIMO_KG } from '../common/business-rules';

export type ContextoCapacidadCompra = {
  capacidadBodegaKg: number;
  inventarioActualKg: number;
};

export type NivelCapacidadCompra =
  | 'normal'
  | 'alerta'
  | 'exceso'
  | 'sin_validacion'
  | 'requiere_configuracion';

export type EstadoCapacidadCompra = {
  validada: boolean;
  nivel: NivelCapacidadCompra;
  mensaje: string;
  capacidadBodegaKg?: number;
  inventarioActualKg?: number;
  capacidadUsadaKg?: number;
  capacidadRestanteKg?: number;
  porcentajeOcupacion?: number;
  excesoKg?: number;
  disponibleKg?: number;
};

export type CompraProcesada = {
  compra: {
    fecha: string;
    totalKg: number;
    totalCompra: number;
    deviceId: string;
    localId: string;
  };
  sublotes: Array<{
    tipoCafeId: string;
    calidadId: string;
    pesoInicial: number;
    pesoActual: number;
    precioKg: number;
    costoTotal: number;
    subtotal: number;
  }>;
  warning?: string;
  exceso?: number;
  capacidad: EstadoCapacidadCompra;
};

type SubloteInput = CreateCompraDto['sublotes'][number];
type SubloteProcesado = CompraProcesada['sublotes'][number];
type ResumenCompra = CompraProcesada['compra'];

export class CompraValidacionCriticaError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

/**
 * Utilidades numericas para operar montos y pesos con precision estable a dos decimales.
 */
function aCentiUnidades(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100);
}

function desdeCentiUnidades(valor: number): number {
  return valor / 100;
}

const COMPRA_CANTIDAD_IRREAL_KG = 99_999_999;

function normalizarADosDecimales(valor: number): number {
  return desdeCentiUnidades(aCentiUnidades(valor));
}

function normalizarNumeroEntrada(valor: unknown): number {
  if (typeof valor === 'number') {
    return valor;
  }

  if (typeof valor !== 'string') {
    return Number.NaN;
  }

  const limpio = valor.trim().replace(/\s/g, '');
  if (!limpio) {
    return Number.NaN;
  }

  if (limpio.includes(',')) {
    return Number(limpio.replace(/\./g, '').replace(',', '.'));
  }

  if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) {
    return Number(limpio.replace(/\./g, ''));
  }

  return Number(limpio);
}

function resolverFechaCompra(fecha?: string): string {
  const texto = fecha?.trim();
  if (texto) {
    return texto;
  }

  return new Date().toISOString();
}

function textoObligatorio(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

export function validarCompraCritica(input: CreateCompraDto): void {
  if (!input || typeof input !== 'object') {
    throw new CompraValidacionCriticaError(
      'DATOS_OBLIGATORIOS_INCOMPLETOS',
      'Datos obligatorios faltantes.',
    );
  }

  if (!textoObligatorio(input.deviceId) || !textoObligatorio(input.localId)) {
    throw new CompraValidacionCriticaError(
      'DATOS_OBLIGATORIOS_INCOMPLETOS',
      'Datos obligatorios faltantes.',
    );
  }

  if (!Array.isArray(input.sublotes) || input.sublotes.length === 0) {
    throw new CompraValidacionCriticaError(
      'DATOS_OBLIGATORIOS_INCOMPLETOS',
      'Debe incluir al menos un sublote.',
    );
  }

  for (const [index, sublote] of input.sublotes.entries()) {
    if (!textoObligatorio(sublote.tipoCafeId)) {
      throw new CompraValidacionCriticaError(
        'COMPRA_TIPO_CAFE_INVALIDO',
        'El tipo de cafe seleccionado no es valido.',
        { index },
      );
    }

    if (!textoObligatorio(sublote.calidadId)) {
      throw new CompraValidacionCriticaError(
        'COMPRA_CALIDAD_INVALIDA',
        'La calidad seleccionada no es valida.',
        { index },
      );
    }

    if (
      !textoObligatorio(sublote.deviceId) ||
      !textoObligatorio(sublote.localId)
    ) {
      throw new CompraValidacionCriticaError(
        'DATOS_OBLIGATORIOS_INCOMPLETOS',
        'Datos obligatorios faltantes.',
        { index },
      );
    }

    const pesoInicial = normalizarNumeroEntrada(sublote.pesoInicial);
    const precioKg = normalizarNumeroEntrada(sublote.precioKg);

    if (!Number.isFinite(pesoInicial)) {
      throw new CompraValidacionCriticaError(
        'COMPRA_CANTIDAD_NO_NUMERICA',
        'Ingresa solo números.',
        { index },
      );
    }

    if (pesoInicial <= 0) {
      throw new CompraValidacionCriticaError(
        'COMPRA_CANTIDAD_INVALIDA',
        'La cantidad debe ser mayor a cero.',
        { index },
      );
    }

    if (
      !Number.isFinite(precioKg) ||
      precioKg < PRECIO_MINIMO_KG
    ) {
      throw new CompraValidacionCriticaError(
        'COMPRA_PRECIO_INVALIDO',
        'El precio por kg debe ser mínimo $1,000.',
        { index },
      );
    }
  }
}

/**
 * Calcula los valores normalizados de un sublote antes de persistirlo.
 */
function procesarSublote(sublote: SubloteInput): SubloteProcesado {
  const pesoInicialCenti = aCentiUnidades(
    normalizarNumeroEntrada(sublote.pesoInicial),
  );
  const precioKgCenti = aCentiUnidades(
    normalizarNumeroEntrada(sublote.precioKg),
  );
  const subtotalCenti = Math.round((pesoInicialCenti * precioKgCenti) / 100);

  return {
    tipoCafeId: sublote.tipoCafeId,
    calidadId: sublote.calidadId,
    pesoInicial: desdeCentiUnidades(pesoInicialCenti),
    pesoActual: desdeCentiUnidades(pesoInicialCenti),
    precioKg: desdeCentiUnidades(precioKgCenti),
    costoTotal: desdeCentiUnidades(subtotalCenti),
    subtotal: desdeCentiUnidades(subtotalCenti),
  };
}

/**
 * Construye el resumen consolidado de la compra a partir de sus sublotes.
 */
function construirCompra(
  input: CreateCompraDto,
  sublotes: SubloteProcesado[],
): ResumenCompra {
  const totalKgCenti = sublotes.reduce(
    (acumulado, sublote) => acumulado + aCentiUnidades(sublote.pesoInicial),
    0,
  );
  const totalCompraCenti = sublotes.reduce(
    (acumulado, sublote) => acumulado + aCentiUnidades(sublote.subtotal),
    0,
  );

  return {
    fecha: resolverFechaCompra(input.fecha),
    totalKg: desdeCentiUnidades(totalKgCenti),
    totalCompra: desdeCentiUnidades(totalCompraCenti),
    deviceId: input.deviceId,
    localId: input.localId,
  };
}

/**
 * Evalua si la compra deja la bodega en alerta o excede la capacidad registrada.
 */
export function evaluarCapacidadCompra(
  totalKg: number,
  contextoCapacidad: ContextoCapacidadCompra,
): Pick<CompraProcesada, 'warning' | 'exceso' | 'capacidad'> {
  const capacidadCenti = aCentiUnidades(contextoCapacidad.capacidadBodegaKg);

  if (capacidadCenti <= 0) {
    return {
      capacidad: crearCapacidadSinValidacion(),
    };
  }

  const inventarioActualCenti = aCentiUnidades(
    contextoCapacidad.inventarioActualKg,
  );
  const totalKgCenti = aCentiUnidades(totalKg);
  const nuevoTotalCenti = inventarioActualCenti + totalKgCenti;
  const limiteWarningCenti = Math.round(capacidadCenti * 0.8);
  const capacidadBodegaKg = desdeCentiUnidades(capacidadCenti);
  const nuevoTotalKg = desdeCentiUnidades(nuevoTotalCenti);
  const capacidadRestanteKg = desdeCentiUnidades(
    capacidadCenti - nuevoTotalCenti,
  );
  const porcentajeOcupacion = normalizarADosDecimales(
    (nuevoTotalCenti / capacidadCenti) * 100,
  );

  if (nuevoTotalCenti > capacidadCenti) {
    const excesoKg = desdeCentiUnidades(nuevoTotalCenti - capacidadCenti);
    const disponibleKg = desdeCentiUnidades(
      Math.max(0, capacidadCenti - inventarioActualCenti),
    );
    const mensaje = `La cantidad ingresada supera la capacidad disponible de la bodega. Nuevo total: ${nuevoTotalKg} kg de ${capacidadBodegaKg} kg.`;

    return {
      warning: mensaje,
      exceso: excesoKg,
      capacidad: {
        validada: true,
        nivel: 'exceso',
        mensaje,
        capacidadBodegaKg,
        inventarioActualKg: desdeCentiUnidades(inventarioActualCenti),
        capacidadUsadaKg: nuevoTotalKg,
        capacidadRestanteKg,
        porcentajeOcupacion,
        excesoKg,
        disponibleKg,
      },
    };
  }

  if (nuevoTotalCenti >= limiteWarningCenti) {
    const mensaje = `La compra deja la bodega en nivel de alerta. Nuevo total: ${nuevoTotalKg} kg de ${capacidadBodegaKg} kg.`;

    return {
      warning: mensaje,
      capacidad: {
        validada: true,
        nivel: 'alerta',
        mensaje,
        capacidadBodegaKg,
        inventarioActualKg: desdeCentiUnidades(inventarioActualCenti),
        capacidadUsadaKg: nuevoTotalKg,
        capacidadRestanteKg,
        porcentajeOcupacion,
      },
    };
  }

  return {
    capacidad: {
      validada: true,
      nivel: 'normal',
      mensaje: `Capacidad validada. La compra deja la bodega en ${nuevoTotalKg} kg de ${capacidadBodegaKg} kg.`,
      capacidadBodegaKg,
      inventarioActualKg: desdeCentiUnidades(inventarioActualCenti),
      capacidadUsadaKg: nuevoTotalKg,
      capacidadRestanteKg,
      porcentajeOcupacion,
    },
  };
}

export function crearCapacidadSinValidacion(): EstadoCapacidadCompra {
  return {
    validada: false,
    nivel: 'sin_validacion',
    mensaje: 'No se pudo validar la capacidad de la bodega',
  };
}

export function crearCapacidadRequerida(): EstadoCapacidadCompra {
  return {
    validada: false,
    nivel: 'requiere_configuracion',
    mensaje:
      'Registra la capacidad total de la bodega para validar esta compra.',
  };
}

/**
 * Prepara la compra en memoria y devuelve resumen, sublotes y alertas de capacidad.
 */
export function procesarCompra(
  input: CreateCompraDto,
  contextoCapacidad?: ContextoCapacidadCompra | null,
): CompraProcesada {
  validarCompraCritica(input);
  const sublotes = input.sublotes.map(procesarSublote);
  const compra = construirCompra(input, sublotes);
  const resultadoCapacidad = contextoCapacidad
    ? evaluarCapacidadCompra(compra.totalKg, contextoCapacidad)
    : { capacidad: crearCapacidadSinValidacion() };

  if (
    resultadoCapacidad.capacidad.nivel !== 'exceso' &&
    sublotes.some((sublote) => sublote.pesoInicial > COMPRA_CANTIDAD_IRREAL_KG)
  ) {
    throw new CompraValidacionCriticaError(
      'COMPRA_CANTIDAD_DEMASIADO_ALTA',
      'Revisa la cantidad ingresada. Parece demasiado alta.',
    );
  }

  return {
    compra,
    sublotes,
    ...resultadoCapacidad,
  };
}

export { normalizarADosDecimales };
