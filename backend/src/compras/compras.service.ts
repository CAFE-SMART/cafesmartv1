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
  TipoOrganizacion,
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

type CatalogoItem = {
  id: string;
  nombre: string;
};

type CompraListadoItem = {
  id: string;
  fecha: string;
  totalCompra: number;
  totalSublotes: number;
  creadoEn: string;
  sublotes: {
    id: string;
    tipoCafeId: string;
    tipoCafe: string;
    calidadId: string;
    calidad: string;
    pesoInicial: number;
    pesoActual: number;
    precioKg: number;
  }[];
};

type MovimientoInventario = {
  tipoCafeId: string;
  calidadId: string;
  cantidad: number;
  tipoMovimiento: TipoMovimientoInventario;
  referenciaTipo: TipoReferenciaInventario;
};

const TIPOS_CAFE_BASE = ['VERDE', 'SECO', 'TRILLADO', 'PASILLA'];
const CALIDADES_BASE = ['BUENO', 'REGULAR', 'MALO'];

@Injectable()
export class ComprasService {
  constructor(private readonly prisma: PrismaService) {}

  private async asegurarCatalogosBase(
    prisma: PrismaService | Prisma.TransactionClient,
  ) {
    await Promise.all([
      prisma.tipoCafe.createMany({
        data: TIPOS_CAFE_BASE.map((nombre) => ({ nombre })),
        skipDuplicates: true,
      }),
      prisma.calidad.createMany({
        data: CALIDADES_BASE.map((nombre) => ({ nombre })),
        skipDuplicates: true,
      }),
    ]);
  }

  async listarCompras(userId: string): Promise<CompraListadoItem[]> {
    const organizacionId = await this.obtenerOrganizacionId(this.prisma, userId);
    const compras = await this.prisma.compra.findMany({
      where: {
        deletedAt: null,
        organizacionId,
      },
      include: {
        sublotes: {
          where: this.obtenerWhereSubloteActivo(),
          include: {
            tipoCafe: { select: { id: true, nombre: true } },
            calidad: { select: { id: true, nombre: true } },
          },
          orderBy: { creadoEn: 'asc' },
        },
      },
      orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
    });

    return compras.map((compra) => ({
      id: compra.id,
      fecha: compra.fecha.toISOString(),
      totalCompra: Number(compra.totalCompra),
      totalSublotes: compra.sublotes.length,
      creadoEn: compra.creadoEn.toISOString(),
      sublotes: compra.sublotes.map((sublote) => ({
        id: sublote.id,
        tipoCafeId: sublote.tipoCafeId,
        tipoCafe: sublote.tipoCafe.nombre,
        calidadId: sublote.calidadId,
        calidad: sublote.calidad.nombre,
        pesoInicial: Number(sublote.pesoInicial),
        pesoActual: Number(sublote.pesoActual),
        precioKg: Number(sublote.precioKg),
      })),
    }));
  }

  async obtenerCatalogos(userId: string): Promise<{
    tiposCafe: CatalogoItem[];
    calidades: CatalogoItem[];
  }> {
    await this.asegurarCatalogosBase(this.prisma);

    const tipoOrganizacion = await this.obtenerTipoOrganizacionUsuario(userId);
    const whereTiposCafe =
      tipoOrganizacion === TipoOrganizacion.COMPRAVENTA
        ? { nombre: { not: 'TRILLADO' } }
        : {};

    const [tiposCafe, calidades] = await Promise.all([
      this.prisma.tipoCafe.findMany({
        where: whereTiposCafe,
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.calidad.findMany({
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
    ]);

    return { tiposCafe, calidades };
  }

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
        await this.asegurarCatalogosBase(tx);
        await this.validarCatalogos(tx, input);

        const contextoCapacidad = await this.obtenerContextoCapacidad(
          tx,
          organizacionIdFinal,
        );
        const compraProcesada = procesarCompra(input, contextoCapacidad);
        const lotesCompra = await this.asegurarLotesCompra(
          tx,
          organizacionIdFinal,
          compraProcesada.sublotes,
        );
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
            lotesCompra,
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
    tx: Prisma.TransactionClient | PrismaService,
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

  private async obtenerTipoOrganizacionUsuario(
    userId: string,
  ): Promise<TipoOrganizacion | null> {
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        organizacion: {
          select: { tipo: true },
        },
      },
    });

    return usuario?.organizacion?.tipo ?? null;
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

  private construirClaveLote(tipoCafeId: string, calidadId: string): string {
    return `${tipoCafeId}::${calidadId}`;
  }

  private async asegurarLotesCompra(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    sublotesProcesados: CompraProcesada['sublotes'],
  ): Promise<Map<string, string>> {
    const tipoCafeIds = [...new Set(sublotesProcesados.map((s) => s.tipoCafeId))];
    const calidadIds = [...new Set(sublotesProcesados.map((s) => s.calidadId))];

    const [tiposCafe, calidades, lotesExistentes] = await Promise.all([
      tx.tipoCafe.findMany({
        where: { id: { in: tipoCafeIds } },
        select: { id: true, nombre: true },
      }),
      tx.calidad.findMany({
        where: { id: { in: calidadIds } },
        select: { id: true, nombre: true },
      }),
      tx.lote.findMany({
        where: {
          organizacionId,
          tipoCafeId: { in: tipoCafeIds },
          calidadId: { in: calidadIds },
        },
        select: { id: true, tipoCafeId: true, calidadId: true },
      }),
    ]);

    const nombreTipoPorId = new Map(tiposCafe.map((tipoCafe) => [tipoCafe.id, tipoCafe.nombre]));
    const nombreCalidadPorId = new Map(calidades.map((calidad) => [calidad.id, calidad.nombre]));

    const lotesPorClave = new Map<string, string>();
    for (const lote of lotesExistentes) {
      lotesPorClave.set(
        this.construirClaveLote(lote.tipoCafeId, lote.calidadId),
        lote.id,
      );
    }

    for (const sublote of sublotesProcesados) {
      const clave = this.construirClaveLote(sublote.tipoCafeId, sublote.calidadId);
      if (lotesPorClave.has(clave)) {
        continue;
      }

      const tipoNombre = nombreTipoPorId.get(sublote.tipoCafeId) ?? 'TIPO';
      const calidadNombre = nombreCalidadPorId.get(sublote.calidadId) ?? 'CALIDAD';
      const codigo = `${tipoNombre} ${calidadNombre}`.trim();

      try {
        const loteCreado = await tx.lote.create({
          data: {
            organizacionId,
            tipoCafeId: sublote.tipoCafeId,
            calidadId: sublote.calidadId,
            codigo,
          },
          select: { id: true },
        });

        lotesPorClave.set(clave, loteCreado.id);
      } catch (error) {
        if (!this.esErrorUnico(error)) {
          throw error;
        }

        const loteExistente = await tx.lote.findUnique({
          where: {
            organizacionId_tipoCafeId_calidadId: {
              organizacionId,
              tipoCafeId: sublote.tipoCafeId,
              calidadId: sublote.calidadId,
            },
          },
          select: { id: true },
        });

        if (!loteExistente) {
          throw new ConflictException(
            'No se pudo asegurar el lote para la combinación tipo/calidad',
          );
        }

        lotesPorClave.set(clave, loteExistente.id);
      }
    }

    return lotesPorClave;
  }

  private construirSublotesData(
    compraId: string,
    input: CreateCompraDto,
    sublotesProcesados: CompraProcesada['sublotes'],
    lotesCompra: Map<string, string>,
  ): Prisma.SubloteCreateManyInput[] {
    return sublotesProcesados.map((sublote, index) => {
      const clave = this.construirClaveLote(sublote.tipoCafeId, sublote.calidadId);
      const idLote = lotesCompra.get(clave);

      if (!idLote) {
        throw new BadRequestException(
          'No se encontró el lote para uno de los sublotes de la compra',
        );
      }

      return {
      compraId,
      tipoCafeId: sublote.tipoCafeId,
      calidadId: sublote.calidadId,
      pesoInicial: sublote.pesoInicial,
      pesoActual: sublote.pesoActual,
      precioKg: sublote.precioKg,
      idLote,
      deviceId: input.sublotes[index].deviceId,
      localId: input.sublotes[index].localId,
      };
    });
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

