import type { CreateCompraDto } from './dto/crear-compra.dto';

export type ContextoCapacidadCompra = {
  capacidadBodegaKg: number;
  inventarioActualKg: number;
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
    subtotal: number;
  }>;
  warning?: string;
  exceso?: number;
};

type SubloteInput = CreateCompraDto['sublotes'][number];
type SubloteProcesado = CompraProcesada['sublotes'][number];
type ResumenCompra = CompraProcesada['compra'];

function aCentiUnidades(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100);
}

function desdeCentiUnidades(valor: number): number {
  return valor / 100;
}

function normalizarADosDecimales(valor: number): number {
  return desdeCentiUnidades(aCentiUnidades(valor));
}

function resolverFechaCompra(fecha?: string): string {
  const texto = fecha?.trim();
  if (texto) {
    return texto;
  }

  return new Date().toISOString();
}

function procesarSublote(sublote: SubloteInput): SubloteProcesado {
  const pesoInicialCenti = aCentiUnidades(sublote.pesoInicial);
  const precioKgCenti = aCentiUnidades(sublote.precioKg);
  const subtotalCenti = Math.round(
    (pesoInicialCenti * precioKgCenti) / 100,
  );

  return {
    tipoCafeId: sublote.tipoCafeId,
    calidadId: sublote.calidadId,
    pesoInicial: desdeCentiUnidades(pesoInicialCenti),
    pesoActual: desdeCentiUnidades(pesoInicialCenti),
    precioKg: desdeCentiUnidades(precioKgCenti),
    subtotal: desdeCentiUnidades(subtotalCenti),
  };
}

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

export function evaluarCapacidadCompra(
  totalKg: number,
  contextoCapacidad: ContextoCapacidadCompra,
): Pick<CompraProcesada, 'warning' | 'exceso'> {
  const capacidadCenti = aCentiUnidades(contextoCapacidad.capacidadBodegaKg);

  if (capacidadCenti <= 0) {
    return {};
  }

  const inventarioActualCenti = aCentiUnidades(contextoCapacidad.inventarioActualKg);
  const totalKgCenti = aCentiUnidades(totalKg);
  const nuevoTotalCenti = inventarioActualCenti + totalKgCenti;
  const limiteWarningCenti = Math.round(capacidadCenti * 0.8);
  const capacidadBodegaKg = desdeCentiUnidades(capacidadCenti);
  const nuevoTotalKg = desdeCentiUnidades(nuevoTotalCenti);

  if (nuevoTotalCenti > capacidadCenti) {
    return {
      warning: `La compra supera la capacidad de bodega. Nuevo total: ${nuevoTotalKg} kg de ${capacidadBodegaKg} kg.`,
      exceso: desdeCentiUnidades(nuevoTotalCenti - capacidadCenti),
    };
  }

  if (nuevoTotalCenti >= limiteWarningCenti) {
    return {
      warning: `La compra deja la bodega en nivel de alerta. Nuevo total: ${nuevoTotalKg} kg de ${capacidadBodegaKg} kg.`,
    };
  }

  return {};
}

export function procesarCompra(
  input: CreateCompraDto,
  contextoCapacidad?: ContextoCapacidadCompra | null,
): CompraProcesada {
  const sublotes = input.sublotes.map(procesarSublote);
  const compra = construirCompra(input, sublotes);

  return {
    compra,
    sublotes,
    ...(contextoCapacidad
      ? evaluarCapacidadCompra(compra.totalKg, contextoCapacidad)
      : {}),
  };
}

export { normalizarADosDecimales };
