import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Compra,
  Prisma,
  Sublote,
  TipoReferenciaInventario,
  TipoMovimientoInventario,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompraDto } from './dto/crear-compra.dto';
import {
  CompraProcesada,
  ContextoCapacidadCompra,
  normalizarADosDecimales,
  procesarCompra,
} from './procesar-compra';

type CompraActivaConSublotes = Compra & { sublotes: Sublote[] };

type CrearCompraResultado = {
  compra: Compra;
  sublotes: Sublote[];
  warning?: string;
  exceso?: number;
};

type MovimientoInventario = {
  tipoCafeId: string;
  calidadId: string;
  cantidad: number;
  tipoMovimiento: TipoMovimientoInventario;
  referenciaTipo: TipoReferenciaInventario;
};

@Injectable()
export class ComprasService {
  constructor(private readonly prisma: PrismaService) {}

  async crearCompra(
    input: CreateCompraDto,
    userId: string,
  ): Promise<CrearCompraResultado>;
  async crearCompra(
    input: CreateCompraDto,
    userId: string,
    organizacionId: string,
  ): Promise<CrearCompraResultado>;
  async crearCompra(
    input: CreateCompraDto,
    userId: string,
    organizacionId?: string,
  ): Promise<CrearCompraResultado> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const organizacionIdFinal = await this.obtenerOrganizacionId(
          tx,
          userId,
          organizacionId,
        );

        const compraExistente = await this.buscarCompraActivaPorSync(
          tx,
          input.deviceId,
          input.localId,
        );

        if (compraExistente) {
          return this.construirRespuestaDesdeCompraExistente(compraExistente);
        }

        this.validarSublotesDuplicadosEnRequest(input);
        await this.validarCatalogos(tx, input);

        const contextoCapacidad = await this.obtenerContextoCapacidad(
          tx,
          organizacionIdFinal,
        );
        const compraProcesada = procesarCompra(input, contextoCapacidad);
        const movimientosCompra = this.construirMovimientosCompra(
          compraProcesada.sublotes,
        );

        const compra = await tx.compra.create({
          data: {
            fecha: new Date(compraProcesada.compra.fecha),
            totalCompra: compraProcesada.compra.totalCompra,
            deviceId: compraProcesada.compra.deviceId,
            localId: compraProcesada.compra.localId,
            usuarioId: userId,
            organizacionId: organizacionIdFinal,
          },
        });

        await tx.sublote.createMany({
          data: this.construirSublotesData(
            compra.id,
            input,
            compraProcesada.sublotes,
          ),
        });

        await this.actualizarInventarioSnapshot(
          tx,
          organizacionIdFinal,
          movimientosCompra,
        );

        await this.registrarMovimientosInventario(
          tx,
          organizacionIdFinal,
          userId,
          compra.id,
          movimientosCompra,
        );

        const sublotes = await tx.sublote.findMany({
          where: this.obtenerWhereSubloteActivo({
            compraId: compra.id,
          }),
          orderBy: { creadoEn: 'asc' },
        });

        return {
          compra,
          sublotes,
          warning: compraProcesada.warning,
          exceso: compraProcesada.exceso,
        };
      });
    } catch (error) {
      if (this.esErrorUnico(error)) {
        const compraExistente = await this.buscarCompraActivaPorSync(
          this.prisma,
          input.deviceId,
          input.localId,
        );

        if (compraExistente) {
          return this.construirRespuestaDesdeCompraExistente(compraExistente);
        }

        await this.lanzarConflictoDeSincronizacion(input);
      }

      throw error;
    }
  }

  private async obtenerOrganizacionId(
    tx: Prisma.TransactionClient,
    userId: string,
    organizacionId?: string,
  ): Promise<string> {
    const usuario = await tx.user.findUnique({
      where: { id: userId },
      select: { organizacionId: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!usuario.organizacionId) {
      throw new BadRequestException('El usuario no tiene organizacion asignada');
    }

    if (organizacionId && usuario.organizacionId !== organizacionId) {
      throw new UnauthorizedException(
        'El usuario no pertenece a la organizacion indicada',
      );
    }

    return usuario.organizacionId;
  }

  private validarSublotesDuplicadosEnRequest(input: CreateCompraDto): void {
    const clavesVistas = new Set<string>();
    const clavesDuplicadas = new Set<string>();

    for (const sublote of input.sublotes) {
      const clave = `${sublote.deviceId}::${sublote.localId}`;

      if (clavesVistas.has(clave)) {
        clavesDuplicadas.add(clave);
        continue;
      }

      clavesVistas.add(clave);
    }

    if (clavesDuplicadas.size > 0) {
      throw new BadRequestException(
        `Hay sublotes duplicados en la compra: ${[...clavesDuplicadas].join(', ')}`,
      );
    }
  }

  private async validarCatalogos(
    tx: Prisma.TransactionClient,
    input: CreateCompraDto,
  ): Promise<void> {
    const tipoCafeIds = [...new Set(input.sublotes.map((s) => s.tipoCafeId))];
    const calidadIds = [...new Set(input.sublotes.map((s) => s.calidadId))];

    const [tiposCafe, calidades] = await Promise.all([
      tx.tipoCafe.findMany({
        where: { id: { in: tipoCafeIds } },
        select: { id: true },
      }),
      tx.calidad.findMany({
        where: { id: { in: calidadIds } },
        select: { id: true },
      }),
    ]);

    if (tiposCafe.length !== tipoCafeIds.length) {
      const encontrados = new Set(tiposCafe.map((tipoCafe) => tipoCafe.id));
      const faltantes = tipoCafeIds.filter((id) => !encontrados.has(id));
      throw new BadRequestException(
        `Tipo(s) de cafe no encontrado(s): ${faltantes.join(', ')}`,
      );
    }

    if (calidades.length !== calidadIds.length) {
      const encontrados = new Set(calidades.map((calidad) => calidad.id));
      const faltantes = calidadIds.filter((id) => !encontrados.has(id));
      throw new BadRequestException(
        `Calidad(es) no encontrada(s): ${faltantes.join(', ')}`,
      );
    }
  }

  private async obtenerContextoCapacidad(
    tx: Prisma.TransactionClient,
    organizacionId: string,
  ): Promise<ContextoCapacidadCompra | null> {
    const parametro = await tx.parametroOrganizacion.findUnique({
      where: {
        organizacionId_nombre: {
          organizacionId,
          nombre: 'capacidad_bodega',
        },
      },
      select: { valor: true },
    });

    if (!parametro?.valor?.trim()) {
      return null;
    }

    const capacidadBodegaKg = Number(parametro.valor);

    if (!Number.isFinite(capacidadBodegaKg) || capacidadBodegaKg <= 0) {
      return null;
    }

    const inventarioActual = await tx.inventario.aggregate({
      _sum: { pesoTotal: true },
      where: { organizacionId },
    });

    return {
      capacidadBodegaKg: normalizarADosDecimales(capacidadBodegaKg),
      inventarioActualKg: normalizarADosDecimales(
        Number(inventarioActual._sum.pesoTotal ?? 0),
      ),
    };
  }

  private construirSublotesData(
    compraId: string,
    input: CreateCompraDto,
    sublotesProcesados: CompraProcesada['sublotes'],
  ): Prisma.SubloteCreateManyInput[] {
    return sublotesProcesados.map((sublote, index) => ({
      compraId,
      tipoCafeId: sublote.tipoCafeId,
      calidadId: sublote.calidadId,
      pesoInicial: sublote.pesoInicial,
      pesoActual: sublote.pesoActual,
      precioKg: sublote.precioKg,
      idLote: null,
      deviceId: input.sublotes[index].deviceId,
      localId: input.sublotes[index].localId,
    }));
  }

  private async actualizarInventarioSnapshot(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    movimientos: MovimientoInventario[],
  ): Promise<void> {
    const movimientosAgrupados = this.agruparMovimientosInventario(movimientos);

    for (const movimiento of movimientosAgrupados) {
      await tx.inventario.upsert({
        where: {
          organizacionId_tipoCafeId_calidadId: {
            organizacionId,
            tipoCafeId: movimiento.tipoCafeId,
            calidadId: movimiento.calidadId,
          },
        },
        create: {
          organizacionId,
          tipoCafeId: movimiento.tipoCafeId,
          calidadId: movimiento.calidadId,
          pesoTotal: movimiento.cantidad,
        },
        update: {
          pesoTotal: {
            increment: movimiento.cantidad,
          },
        },
      });
    }
  }

  private async registrarMovimientosInventario(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    usuarioId: string,
    referenciaId: string,
    movimientos: MovimientoInventario[],
  ): Promise<void> {
    await tx.inventarioMovimiento.createMany({
      data: movimientos.map((movimiento) => ({
        organizacionId,
        usuarioId,
        tipoCafeId: movimiento.tipoCafeId,
        calidadId: movimiento.calidadId,
        cantidad: movimiento.cantidad,
        tipoMovimiento: movimiento.tipoMovimiento,
        referenciaTipo: movimiento.referenciaTipo,
        referenciaId,
      })),
    });
  }

  private construirMovimientosCompra(
    sublotesProcesados: CompraProcesada['sublotes'],
  ): MovimientoInventario[] {
    return sublotesProcesados.map((sublote) => ({
      tipoCafeId: sublote.tipoCafeId,
      calidadId: sublote.calidadId,
      cantidad: sublote.pesoActual,
      tipoMovimiento: TipoMovimientoInventario.COMPRA,
      referenciaTipo: TipoReferenciaInventario.COMPRA,
    }));
  }

  private agruparMovimientosInventario(
    movimientos: MovimientoInventario[],
  ): MovimientoInventario[] {
    const acumulados = new Map<
      string,
      Omit<MovimientoInventario, 'cantidad'> & { cantidadCenti: number }
    >();

    for (const movimiento of movimientos) {
      const clave = `${movimiento.tipoCafeId}::${movimiento.calidadId}::${movimiento.tipoMovimiento}::${movimiento.referenciaTipo}`;
      const movimientoActual = acumulados.get(clave);

      if (!movimientoActual) {
        acumulados.set(clave, {
          tipoCafeId: movimiento.tipoCafeId,
          calidadId: movimiento.calidadId,
          tipoMovimiento: movimiento.tipoMovimiento,
          referenciaTipo: movimiento.referenciaTipo,
          cantidadCenti: this.aCentiUnidades(movimiento.cantidad),
        });
        continue;
      }

      movimientoActual.cantidadCenti += this.aCentiUnidades(movimiento.cantidad);
    }

    return [...acumulados.values()].map((movimiento) => ({
      tipoCafeId: movimiento.tipoCafeId,
      calidadId: movimiento.calidadId,
      tipoMovimiento: movimiento.tipoMovimiento,
      referenciaTipo: movimiento.referenciaTipo,
      cantidad: this.desdeCentiUnidades(movimiento.cantidadCenti),
    }));
  }

  private async buscarCompraActivaPorSync(
    client: Prisma.TransactionClient | PrismaService,
    deviceId: string,
    localId: string,
  ): Promise<CompraActivaConSublotes | null> {
    const compra = await client.compra.findUnique({
      where: {
        deviceId_localId: {
          deviceId,
          localId,
        },
      },
      include: {
        sublotes: {
          where: this.obtenerWhereSubloteActivo(),
        },
      },
    });

    if (!compra || compra.deletedAt !== null) {
      return null;
    }

    return compra;
  }

  private async buscarCompraPorSync(
    client: Prisma.TransactionClient | PrismaService,
    deviceId: string,
    localId: string,
  ): Promise<Compra | null> {
    return client.compra.findUnique({
      where: {
        deviceId_localId: {
          deviceId,
          localId,
        },
      },
    });
  }

  private async buscarSublotePorSync(
    client: Prisma.TransactionClient | PrismaService,
    input: CreateCompraDto,
  ): Promise<Sublote | null> {
    return client.sublote.findFirst({
      where: {
        OR: input.sublotes.map((sublote) => ({
          deviceId: sublote.deviceId,
          localId: sublote.localId,
        })),
      },
    });
  }

  private construirRespuestaDesdeCompraExistente(
    compraExistente: CompraActivaConSublotes,
  ): CrearCompraResultado {
    const { sublotes, ...compra } = compraExistente;

    return {
      compra,
      sublotes,
    };
  }

  private obtenerWhereSubloteActivo(
    where: Prisma.SubloteWhereInput = {},
  ): Prisma.SubloteWhereInput {
    return {
      ...where,
      deletedAt: null,
    };
  }

  private async lanzarConflictoDeSincronizacion(
    input: CreateCompraDto,
  ): Promise<never> {
    const compraEliminada = await this.buscarCompraPorSync(
      this.prisma,
      input.deviceId,
      input.localId,
    );

    if (compraEliminada?.deletedAt !== null) {
      throw new ConflictException(
        'Ya existe una compra eliminada con ese identificador de sincronizacion',
      );
    }

    const subloteExistente = await this.buscarSublotePorSync(this.prisma, input);

    if (subloteExistente?.deletedAt !== null) {
      throw new ConflictException(
        'Ya existe un sublote eliminado con ese identificador de sincronizacion',
      );
    }

    if (subloteExistente) {
      throw new ConflictException(
        'Uno o mas sublotes ya existen y no pueden asociarse a una nueva compra',
      );
    }

    throw new ConflictException('Conflicto de sincronizacion al crear la compra');
  }

  private esErrorUnico(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private aCentiUnidades(valor: number): number {
    return Math.round((valor + Number.EPSILON) * 100);
  }

  private desdeCentiUnidades(valor: number): number {
    return valor / 100;
  }
}
