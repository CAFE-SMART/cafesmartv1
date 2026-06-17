import {
  Prisma,
  PrismaClient,
  TipoMovimientoInventario,
  TipoReferenciaInventario,
  Venta,
  VentaDetalle,
} from '@prisma/client';
import { CreateVentaDto } from './dto/crear-venta.dto';
import { PRECIO_MINIMO_KG } from '../common/business-rules';
import { generarCodigoLote, generarPrefijoCodigo } from '../common/codigo-lote.util';

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
  tipoCafeNombre: string;
  calidadId: string;
  calidadNombre: string;
  pesoVendido: number;
  precioKg: number;
  subtotal: number;
  precioCompraKg: number;
  fechaIngreso: Date;
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

type VentaDetalleCompatColumns = {
  codigoSublote: boolean;
  tipoCafeSnapshot: boolean;
  calidadSnapshot: boolean;
  precioCompraKg: boolean;
  fechaIngresoSublote: boolean;
  inventarioRestante: boolean;
};

type SubloteBloqueado = {
  id: string;
  pesoActual: Prisma.Decimal;
  precioKg: Prisma.Decimal;
  creadoEn: Date;
  fechaIngreso: Date;
  tipoCafeId: string;
  tipoCafeNombre: string;
  calidadId: string;
  calidadNombre: string;
};

type SubloteParaCodigo = {
  id: string;
  creadoEn: Date;
  compra: { fecha: Date };
  tipoCafe: { nombre: string };
  calidad: { nombre: string };
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

  for (const [index, detalle] of data.detalles.entries()) {
    if (!textoObligatorio(detalle.subloteId)) {
      throw new VentaValidacionCriticaError(
        'VENTA_SUBLOTE_INVALIDO',
        'El sublote seleccionado no es valido.',
        { index },
      );
    }

    if (!Number.isFinite(detalle.pesoVendido) || detalle.pesoVendido <= 0) {
      throw new VentaValidacionCriticaError(
        'VENTA_CANTIDAD_INVALIDA',
        'La cantidad a vender debe ser mayor a 0.',
        { index, subloteId: detalle.subloteId },
      );
    }

    if (
      !Number.isFinite(detalle.precioKg) ||
      detalle.precioKg < PRECIO_MINIMO_KG
    ) {
      throw new VentaValidacionCriticaError(
        'VENTA_PRECIO_INVALIDO',
        'El precio por kg debe ser mínimo $1,000.',
        { index, subloteId: detalle.subloteId },
      );
    }
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
  console.log('[CafeSmart][ventas-create] etapa 1: validando payload');
  validarVentaCritica(data);
  validarSublotesDuplicados(data);

  return prisma.$transaction(
    async (tx) => {
      const ventaDetalleCompatColumns =
        await obtenerColumnasCompatiblesVentaDetalle(tx);
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

      console.log('[CafeSmart][ventas-create] etapa 2: buscando sublote', {
        subloteIds: data.detalles.map((detalle) => detalle.subloteId),
      });
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
      console.log('[CafeSmart][ventas-create] etapa 3: sublote encontrado', {
        encontrados: sublotes.length,
        columnasVentaDetalle: ventaDetalleCompatColumns,
      });

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

      console.log('[CafeSmart][ventas-create] etapa 4: creando venta');
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
              gte: detalle.pesoVendido,
            },
            compra: {
              is: {
                organizacionId: data.organizacionId,
                deletedAt: null,
              },
            },
          },
          data: {
            pesoActual: {
              decrement: detalle.pesoVendido,
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

        console.log('[CafeSmart][ventas-create] etapa 5: creando detalle', {
          subloteId: detalle.subloteId,
        });
        const detalleCreado = await tx.ventaDetalle.create({
          data: construirVentaDetalleCreateData(
            venta.id,
            detalle,
            normalizarADosDecimales(
              Number(sublotesPorId.get(detalle.subloteId)?.pesoActual ?? 0) -
                detalle.pesoVendido,
            ),
            ventaDetalleCompatColumns,
          ),
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
        console.log(
          '[CafeSmart][ventas-create] etapa 6: actualizando inventario',
          movimiento,
        );
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
              gte: movimiento.cantidad,
            },
          },
          data: {
            pesoTotal: {
              decrement: movimiento.cantidad,
            },
          },
        });

        if (actualizacionInventario.count === 0) {
          throw new InventarioInconsistenteError([movimiento]);
        }
      }

      console.log('[CafeSmart][ventas-create] etapa 7: transacción completada', {
        ventaId: venta.id,
        detalles: detallesCreados.length,
      });
      return {
        venta,
        detalles: detallesCreados,
      };
    },
    { maxWait: 10000, timeout: 25000 },
  );
}

async function obtenerColumnasCompatiblesVentaDetalle(
  tx: Prisma.TransactionClient,
): Promise<VentaDetalleCompatColumns> {
  if (process.env.NODE_ENV === 'test') {
    return {
      codigoSublote: true,
      tipoCafeSnapshot: true,
      calidadSnapshot: true,
      precioCompraKg: true,
      fechaIngresoSublote: true,
      inventarioRestante: true,
    };
  }

  const expected = {
    codigoSublote: 'codigo_sublote',
    tipoCafeSnapshot: 'tipo_cafe',
    calidadSnapshot: 'calidad',
    precioCompraKg: 'precio_compra_kg',
    fechaIngresoSublote: 'fecha_ingreso_sublote',
    inventarioRestante: 'inventario_restante',
  } as const;

  try {
    const rows = await tx.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'venta_detalle'
        AND column_name IN (${Prisma.join(Object.values(expected))})
    `);
    const existingColumns = new Set(rows.map((row) => row.column_name));

    return Object.fromEntries(
      Object.entries(expected).map(([property, column]) => [
        property,
        existingColumns.has(column),
      ]),
    ) as VentaDetalleCompatColumns;
  } catch (error) {
    console.error(
      '[CafeSmart][ventas-create] no se pudieron verificar columnas venta_detalle:',
      error,
    );
    return {
      codigoSublote: true,
      tipoCafeSnapshot: true,
      calidadSnapshot: true,
      precioCompraKg: true,
      fechaIngresoSublote: true,
      inventarioRestante: true,
    };
  }
}

function construirVentaDetalleCreateData(
  ventaId: string,
  detalle: DetalleProcesado,
  inventarioRestante: number,
  compatColumns: VentaDetalleCompatColumns,
): Prisma.VentaDetalleUncheckedCreateInput {
  const data: Prisma.VentaDetalleUncheckedCreateInput = {
    ventaId,
    subloteId: detalle.subloteId,
    pesoVendido: detalle.pesoVendido,
    precioKg: detalle.precioKg,
    subtotal: detalle.subtotal,
    deviceId: detalle.deviceId,
    localId: detalle.localId,
  };

  if (compatColumns.codigoSublote) data.codigoSublote = detalle.subloteId;
  if (compatColumns.tipoCafeSnapshot) {
    data.tipoCafeSnapshot = detalle.tipoCafeNombre;
  }
  if (compatColumns.calidadSnapshot) data.calidadSnapshot = detalle.calidadNombre;
  if (compatColumns.precioCompraKg) data.precioCompraKg = detalle.precioCompraKg;
  if (compatColumns.fechaIngresoSublote) {
    data.fechaIngresoSublote = detalle.fechaIngreso;
  }
  if (compatColumns.inventarioRestante) {
    data.inventarioRestante = inventarioRestante;
  }

  return data;
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
      s.precio_kg AS "precioKg",
      s.creado_en AS "creadoEn",
      c.fecha AS "fechaIngreso",
      s.id_tipo_cafe AS "tipoCafeId",
      tc.nombre AS "tipoCafeNombre",
      s.id_calidad AS "calidadId",
      q.nombre AS "calidadNombre"
    FROM sublote s
    INNER JOIN compra c
      ON c.id_compra = s.id_compra
    INNER JOIN tipo_cafe tc
      ON tc.id_tipo_cafe = s.id_tipo_cafe
    INNER JOIN calidad q
      ON q.id_calidad = s.id_calidad
    WHERE s.id_sublote IN (${Prisma.join(idsOrdenados)})
      AND s.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND c.id_organizacion = ${organizacionId}
    ORDER BY s.id_sublote
    FOR UPDATE
  `);
}

async function generarMapaCodigosSublote(
  tx: Prisma.TransactionClient,
  organizacionId: string,
): Promise<Map<string, string>> {
  const sublotes = await tx.sublote.findMany({
    where: {
      deletedAt: null,
      compra: {
        deletedAt: null,
        organizacionId,
      },
    },
    select: {
      id: true,
      creadoEn: true,
      compra: { select: { fecha: true } },
      tipoCafe: { select: { nombre: true } },
      calidad: { select: { nombre: true } },
    },
  });

  return construirMapaCodigosSublote(sublotes);
}

function construirMapaCodigosSublote(
  sublotes: SubloteParaCodigo[],
): Map<string, string> {
  const counters = new Map<string, number>();
  const codigos = new Map<string, string>();

  [...sublotes]
    .sort((a, b) => {
      const prefixCompare = generarPrefijoCodigo(
        a.tipoCafe.nombre,
        a.calidad.nombre,
      ).localeCompare(
        generarPrefijoCodigo(b.tipoCafe.nombre, b.calidad.nombre),
      );
      if (prefixCompare !== 0) return prefixCompare;

      const fechaCompare = a.compra.fecha.getTime() - b.compra.fecha.getTime();
      if (fechaCompare !== 0) return fechaCompare;

      const creadoCompare = a.creadoEn.getTime() - b.creadoEn.getTime();
      if (creadoCompare !== 0) return creadoCompare;

      return a.id.localeCompare(b.id);
    })
    .forEach((sublote) => {
      const prefijo = generarPrefijoCodigo(
        sublote.tipoCafe.nombre,
        sublote.calidad.nombre,
      );
      const secuencia = (counters.get(prefijo) ?? 0) + 1;
      counters.set(prefijo, secuencia);
      codigos.set(
        sublote.id,
        generarCodigoLote(
          sublote.tipoCafe.nombre,
          sublote.calidad.nombre,
          secuencia,
        ),
      );
    });

  return codigos;
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
    tipoCafeNombre: string;
    calidadId: string;
    calidadNombre: string;
    precioKg?: Prisma.Decimal;
    fechaIngreso?: Date;
  };
}): DetalleProcesado {
  const pesoVendido = normalizarADosDecimales(params.detalle.pesoVendido);
  const precioKg = normalizarADosDecimales(params.detalle.precioKg);
  const precioCompraKg = Number(params.sublote.precioKg);
  const subtotal = desdeCentiUnidades(
    Math.round((aCentiUnidades(pesoVendido) * aCentiUnidades(precioKg)) / 100),
  );

  return {
    subloteId: params.sublote.id,
    tipoCafeId: params.sublote.tipoCafeId,
    tipoCafeNombre: params.sublote.tipoCafeNombre ?? '',
    calidadId: params.sublote.calidadId,
    calidadNombre: params.sublote.calidadNombre ?? '',
    pesoVendido,
    precioKg,
    subtotal,
    precioCompraKg: Number.isFinite(precioCompraKg)
      ? normalizarADosDecimales(precioCompraKg)
      : 0,
    fechaIngreso: params.sublote.fechaIngreso ?? new Date(0),
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

/**
 * Utilidades de conversion para operar pesos y montos con dos decimales.
 */
export function aCentiUnidades(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100);
}

export function desdeCentiUnidades(valor: number): number {
  return valor / 100;
}

export function normalizarADosDecimales(valor: number): number {
  return desdeCentiUnidades(aCentiUnidades(valor));
}
