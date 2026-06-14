import {
  Prisma,
  PrismaClient,
  TipoMovimientoInventario,
  TipoReferenciaInventario,
  Venta,
  VentaDetalle,
} from '@prisma/client';
import { CreateVentaDto } from './dto/crear-venta.dto';
import {
  PESO_MINIMO_KG,
  PRECIO_MAXIMO_KG,
  PRECIO_MINIMO_KG,
} from '../common/business-rules';

export type CrearVentaResultado = {
  venta: Venta;
  detalles: VentaDetalle[];
};

export type ProcesarVentaInput = CreateVentaDto & {
  organizacionId: string;
  userId: string;
};

type VentaActivaConDetalles = Venta & { detalles: VentaDetalle[] };

type DetalleProcesado = {
  subloteId: string;
  tipoCafeId: string;
  calidadId: string;
  pesoVendido: number;
  precioKg: number;
  subtotal: number;
  deviceId: string;
  localId: string;
};

type StockInsuficienteDetalle = {
  subloteId: string;
  disponibleKg: number;
  solicitadoKg: number;
};

type MovimientoAgrupado = {
  tipoCafeId: string;
  calidadId: string;
  cantidad: number;
};

type SubloteBloqueado = {
  id: string;
  pesoActual: Prisma.Decimal;
  tipoCafeId: string;
  calidadId: string;
};

export class VentaConSublotesDuplicadosError extends Error {
  constructor(public readonly subloteIds: string[]) {
    super('Hay sublotes repetidos en la venta');
  }
}

export class SubloteNoEncontradoError extends Error {
  constructor(public readonly subloteIds: string[]) {
    super('Uno o varios sublotes no fueron encontrados');
  }
}

export class StockInsuficienteError extends Error {
  constructor(public readonly detalles: StockInsuficienteDetalle[]) {
    super('Uno o varios sublotes no tienen stock suficiente');
  }
}

export class VentaEliminadaError extends Error {
  constructor() {
    super('La venta ya existe pero fue eliminada');
  }
}

export class InventarioInconsistenteError extends Error {
  constructor(public readonly movimientos: MovimientoAgrupado[]) {
    super('El inventario agregado no coincide con los sublotes');
  }
}

export class InventarioNoEncontradoError extends Error {
  constructor(public readonly movimientos: MovimientoAgrupado[]) {
    super(
      'No se encontro el inventario agregado para uno o varios movimientos',
    );
  }
}

export class ClienteNoEncontradoError extends Error {
  constructor(public readonly clienteId: string) {
    super('El cliente indicado no fue encontrado');
  }
}

export class VentaValidacionCriticaError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

function textoObligatorio(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

export function validarVentaCritica(data: ProcesarVentaInput): void {
  if (!textoObligatorio(data.deviceId) || !textoObligatorio(data.localId)) {
    throw new VentaValidacionCriticaError(
      'DATOS_OBLIGATORIOS_INCOMPLETOS',
      'Datos obligatorios faltantes.',
    );
  }

  if (!Array.isArray(data.detalles) || data.detalles.length === 0) {
    throw new VentaValidacionCriticaError(
      'DATOS_OBLIGATORIOS_INCOMPLETOS',
      'Debe registrar al menos un detalle de venta.',
    );
  }

  let totalPesoVendido = 0;

  for (const [index, detalle] of data.detalles.entries()) {
    if (!textoObligatorio(detalle.subloteId)) {
      throw new VentaValidacionCriticaError(
        'VENTA_SUBLOTE_INVALIDO',
        'El sublote seleccionado no es valido.',
        { index },
      );
    }

    if (!Number.isFinite(detalle.pesoVendido) || detalle.pesoVendido < 0.01) {
      throw new VentaValidacionCriticaError(
        'VENTA_CANTIDAD_INVALIDA',
        `La cantidad a vender en cada sublote debe ser minimo 0.01 kg.`,
        { index, subloteId: detalle.subloteId },
      );
    }

    totalPesoVendido += detalle.pesoVendido;

    if (
      !Number.isFinite(detalle.precioKg) ||
      detalle.precioKg < PRECIO_MINIMO_KG ||
      detalle.precioKg > PRECIO_MAXIMO_KG
    ) {
      throw new VentaValidacionCriticaError(
        'VENTA_PRECIO_INVALIDO',
        'El precio por kg debe ser mínimo $1,000.',
        { index, subloteId: detalle.subloteId },
      );
    }
  }

  if (totalPesoVendido < PESO_MINIMO_KG) {
    throw new VentaValidacionCriticaError(
      'VENTA_CANTIDAD_INVALIDA',
      `La cantidad total a vender debe ser minimo ${PESO_MINIMO_KG} kg.`,
    );
  }
}

/**
 * Ejecuta la venta completa dentro de una transaccion:
 * valida sublotes, bloquea stock, crea la venta y actualiza trazabilidad.
 */
export async function procesarVenta(
  data: ProcesarVentaInput,
  prisma: PrismaClient,
): Promise<CrearVentaResultado> {
  validarVentaCritica(data);
  validarSublotesDuplicados(data);

  return prisma.$transaction(
    async (tx) => {
      const ventaPorSync = await buscarVentaPorSync(
        tx,
        data.deviceId,
        data.localId,
      );

      if (ventaPorSync) {
        if (ventaPorSync.deletedAt === null) {
          return construirRespuestaDesdeVentaExistente(ventaPorSync);
        }

        throw new VentaEliminadaError();
      }

      const sublotes = await bloquearSublotesDisponibles(
        tx,
        data.detalles.map((detalle) => detalle.subloteId),
        data.organizacionId,
      );

      const sublotesPorId = new Map(
        sublotes.map((sublote) => [sublote.id, sublote]),
      );
      const faltantes = data.detalles
        .map((detalle) => detalle.subloteId)
        .filter((subloteId) => !sublotesPorId.has(subloteId));

      if (faltantes.length > 0) {
        throw new SubloteNoEncontradoError([...new Set(faltantes)]);
      }

      const detallesProcesados = data.detalles.map((detalle) =>
        procesarDetalleVenta({
          detalle,
          deviceIdVenta: data.deviceId,
          localIdVenta: data.localId,
          sublote: sublotesPorId.get(detalle.subloteId)!,
        }),
      );
      const detallesOrdenados = ordenarDetallesPorSublote(detallesProcesados);

      const stockInsuficiente = detallesOrdenados
        .map((detalle) => {
          const sublote = sublotesPorId.get(detalle.subloteId)!;
          const disponibleKg = normalizarADosDecimales(
            Number(sublote.pesoActual),
          );

          if (
            aCentiUnidades(disponibleKg) >= aCentiUnidades(detalle.pesoVendido)
          ) {
            return null;
          }

          return {
            subloteId: detalle.subloteId,
            disponibleKg,
            solicitadoKg: detalle.pesoVendido,
          };
        })
        .filter(
          (detalle): detalle is StockInsuficienteDetalle => detalle !== null,
        );

      if (stockInsuficiente.length > 0) {
        throw new StockInsuficienteError(stockInsuficiente);
      }

      if (data.clienteId?.trim()) {
        const cliente = await tx.cliente.findFirst({
          where: {
            id: data.clienteId.trim(),
            organizacionId: data.organizacionId,
            deletedAt: null,
          },
          select: {
            id: true,
          },
        });

        if (!cliente) {
          throw new ClienteNoEncontradoError(data.clienteId.trim());
        }
      }

      const venta = await tx.venta.create({
        data: {
          fecha: data.fecha ? new Date(data.fecha) : undefined,
          totalVenta: calcularTotalVenta(detallesOrdenados),
          deviceId: data.deviceId,
          localId: data.localId,
          clienteId: data.clienteId?.trim() || null,
          organizacionId: data.organizacionId,
          creadoPor: data.userId,
        },
      });

      const detallesCreados: VentaDetalle[] = [];

      for (const detalle of detallesOrdenados) {
        const actualizacionSublote = await tx.sublote.updateMany({
          where: {
            id: detalle.subloteId,
            deletedAt: null,
            pesoActual: {
              gte: new Prisma.Decimal(detalle.pesoVendido.toFixed(2)),
            },
          },
          data: {
            pesoActual: {
              decrement: new Prisma.Decimal(detalle.pesoVendido.toFixed(2)),
            },
          },
        });

        if (actualizacionSublote.count === 0) {
          const subloteActualizado = await tx.sublote.findFirst({
            where: {
              id: detalle.subloteId,
              deletedAt: null,
            },
            select: {
              pesoActual: true,
            },
          });

          if (!subloteActualizado) {
            throw new SubloteNoEncontradoError([detalle.subloteId]);
          }

          throw new StockInsuficienteError([
            {
              subloteId: detalle.subloteId,
              disponibleKg: normalizarADosDecimales(
                Number(subloteActualizado.pesoActual),
              ),
              solicitadoKg: detalle.pesoVendido,
            },
          ]);
        }

        const detalleCreado = await tx.ventaDetalle.create({
          data: {
            ventaId: venta.id,
            subloteId: detalle.subloteId,
            pesoVendido: detalle.pesoVendido,
            precioKg: detalle.precioKg,
            subtotal: detalle.subtotal,
            deviceId: detalle.deviceId,
            localId: detalle.localId,
          },
        });

        detallesCreados.push(detalleCreado);

        await tx.inventarioMovimiento.create({
          data: {
            organizacionId: data.organizacionId,
            usuarioId: data.userId,
            tipoCafeId: detalle.tipoCafeId,
            calidadId: detalle.calidadId,
            subloteId: detalle.subloteId,
            cantidad: detalle.pesoVendido,
            tipoMovimiento: TipoMovimientoInventario.VENTA,
            referenciaTipo: TipoReferenciaInventario.VENTA,
            referenciaId: venta.id,
          },
        });
      }

      const movimientosAgrupados =
        agruparMovimientosInventario(detallesOrdenados);

      for (const movimiento of movimientosAgrupados) {
        const inventario = await tx.inventario.findUnique({
          where: {
            organizacionId_tipoCafeId_calidadId: {
              organizacionId: data.organizacionId,
              tipoCafeId: movimiento.tipoCafeId,
              calidadId: movimiento.calidadId,
            },
          },
          select: {
            id: true,
            pesoTotal: true,
          },
        });

        if (!inventario) {
          throw new InventarioNoEncontradoError([movimiento]);
        }

        const actualizacionInventario = await tx.inventario.updateMany({
          where: {
            organizacionId: data.organizacionId,
            tipoCafeId: movimiento.tipoCafeId,
            calidadId: movimiento.calidadId,
            pesoTotal: {
              gte: new Prisma.Decimal(movimiento.cantidad.toFixed(2)),
            },
          },
          data: {
            pesoTotal: {
              decrement: new Prisma.Decimal(movimiento.cantidad.toFixed(2)),
            },
          },
        });

        if (actualizacionInventario.count === 0) {
          throw new InventarioInconsistenteError([movimiento]);
        }
      }

      return {
        venta,
        detalles: detallesCreados,
      };
    },
    { maxWait: 10000, timeout: 25000 },
  );
}

/**
 * Busca una venta activa por su llave de sincronizacion movil.
 */
export async function buscarVentaActivaPorSync(
  client: Prisma.TransactionClient | PrismaClient,
  deviceId: string,
  localId: string,
): Promise<VentaActivaConDetalles | null> {
  const venta = await buscarVentaPorSync(client, deviceId, localId);

  if (!venta || venta.deletedAt !== null) {
    return null;
  }

  return venta;
}

/**
 * Busca una venta por sincronizacion con sus detalles activos.
 */
export async function buscarVentaPorSync(
  client: Prisma.TransactionClient | PrismaClient,
  deviceId: string,
  localId: string,
): Promise<VentaActivaConDetalles | null> {
  return client.venta.findUnique({
    where: {
      deviceId_localId: {
        deviceId,
        localId,
      },
    },
    include: {
      detalles: {
        where: {
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });
}

/**
 * Recompone la respuesta de una venta ya registrada para mantener idempotencia.
 */
export function construirRespuestaDesdeVentaExistente(
  ventaExistente: VentaActivaConDetalles,
): CrearVentaResultado {
  const { detalles, ...venta } = ventaExistente;

  return {
    venta,
    detalles,
  };
}

/**
 * Bloquea los sublotes elegibles para la venta y evita carreras entre ventas simultaneas.
 */
async function bloquearSublotesDisponibles(
  tx: Prisma.TransactionClient,
  subloteIds: string[],
  organizacionId: string,
): Promise<SubloteBloqueado[]> {
  const idsOrdenados = [...new Set(subloteIds)].sort();

  if (idsOrdenados.length === 0) {
    return [];
  }

  return tx.$queryRaw<SubloteBloqueado[]>(Prisma.sql`
    SELECT
      s.id_sublote AS id,
      s.peso_actual AS "pesoActual",
      s.id_tipo_cafe AS "tipoCafeId",
      s.id_calidad AS "calidadId"
    FROM sublote s
    INNER JOIN compra c
      ON c.id_compra = s.id_compra
    WHERE s.id_sublote IN (${Prisma.join(idsOrdenados)})
      AND s.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND c.id_organizacion = ${organizacionId}
    ORDER BY s.id_sublote
    FOR UPDATE
  `);
}

/**
 * Valida que un request no intente vender dos veces el mismo sublote.
 */
function validarSublotesDuplicados(
  data: Pick<ProcesarVentaInput, 'detalles'>,
): void {
  const vistos = new Set<string>();
  const duplicados = new Set<string>();

  for (const detalle of data.detalles) {
    if (vistos.has(detalle.subloteId)) {
      duplicados.add(detalle.subloteId);
      continue;
    }

    vistos.add(detalle.subloteId);
  }

  if (duplicados.size > 0) {
    throw new VentaConSublotesDuplicadosError([...duplicados]);
  }
}

/**
 * Normaliza un detalle de venta y calcula su subtotal con precision estable.
 */
function procesarDetalleVenta(params: {
  detalle: CreateVentaDto['detalles'][number];
  deviceIdVenta: string;
  localIdVenta: string;
  sublote: {
    id: string;
    tipoCafeId: string;
    calidadId: string;
  };
}): DetalleProcesado {
  const pesoVendido = normalizarADosDecimales(params.detalle.pesoVendido);
  const precioKg = normalizarADosDecimales(params.detalle.precioKg);
  const subtotal = desdeCentiUnidades(
    Math.round((aCentiUnidades(pesoVendido) * aCentiUnidades(precioKg)) / 100),
  );

  return {
    subloteId: params.sublote.id,
    tipoCafeId: params.sublote.tipoCafeId,
    calidadId: params.sublote.calidadId,
    pesoVendido,
    precioKg,
    subtotal,
    deviceId: params.deviceIdVenta,
    localId: construirLocalIdDetalle(params.localIdVenta, params.sublote.id),
  };
}

/**
 * Calcula el total final de la venta a partir de sus detalles procesados.
 */
function calcularTotalVenta(detalles: DetalleProcesado[]): number {
  return desdeCentiUnidades(
    detalles.reduce(
      (acumulado, detalle) => acumulado + aCentiUnidades(detalle.subtotal),
      0,
    ),
  );
}

/**
 * Consolida movimientos de salida para actualizar el inventario agregado una sola vez por grupo.
 */
function agruparMovimientosInventario(
  detalles: DetalleProcesado[],
): MovimientoAgrupado[] {
  const acumulados = new Map<
    string,
    Omit<MovimientoAgrupado, 'cantidad'> & { cantidadCenti: number }
  >();

  for (const detalle of detalles) {
    const clave = `${detalle.tipoCafeId}::${detalle.calidadId}`;
    const acumulado = acumulados.get(clave);

    if (!acumulado) {
      acumulados.set(clave, {
        tipoCafeId: detalle.tipoCafeId,
        calidadId: detalle.calidadId,
        cantidadCenti: aCentiUnidades(detalle.pesoVendido),
      });
      continue;
    }

    acumulado.cantidadCenti += aCentiUnidades(detalle.pesoVendido);
  }

  return [...acumulados.values()]
    .map((movimiento) => ({
      tipoCafeId: movimiento.tipoCafeId,
      calidadId: movimiento.calidadId,
      cantidad: desdeCentiUnidades(movimiento.cantidadCenti),
    }))
    .sort((a, b) => {
      const comparacionTipoCafe = a.tipoCafeId.localeCompare(b.tipoCafeId);

      if (comparacionTipoCafe !== 0) {
        return comparacionTipoCafe;
      }

      return a.calidadId.localeCompare(b.calidadId);
    });
}

/**
 * Genera un identificador estable por detalle para soportar reintentos idempotentes.
 */
function construirLocalIdDetalle(
  localIdVenta: string,
  subloteId: string,
): string {
  return `${localIdVenta}::detalle::${subloteId}`;
}

/**
 * Ordena los detalles para procesarlos de forma determinista dentro de la transaccion.
 */
function ordenarDetallesPorSublote(
  detalles: DetalleProcesado[],
): DetalleProcesado[] {
  return [...detalles].sort((a, b) => a.subloteId.localeCompare(b.subloteId));
}

import {
  aCentiUnidades,
  desdeCentiUnidades,
  normalizarADosDecimales,
} from '../common/utils/math';
