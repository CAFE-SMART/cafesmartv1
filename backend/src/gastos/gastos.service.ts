import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EstadoPago, Prisma, TipoGasto } from '@prisma/client';
import { apiError } from '../common/errors/api-error';
import {
  getCachedOrganizationId,
  setCachedOrganizationId,
} from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarGastoDto } from './dto/actualizar-gasto.dto';
import { CrearGastoDto } from './dto/crear-gasto.dto';

// ─── Include reutilizable (definido aquí para que typeof funcione) ────────────
const INCLUDE_SUBLOTES = {
  sublotes: {
    include: {
      sublote: {
        select: {
          id: true,
          pesoActual: true,
          tipoCafe: { select: { nombre: true } },
          calidad: { select: { nombre: true } },
        },
      },
    },
  },
} as const;

type GastoConSublotes = Prisma.GastoOperativoGetPayload<{
  include: typeof INCLUDE_SUBLOTES;
}>;

// ─── Tipos de respuesta ──────────────────────────────────────────────────────

type SubloteResumen = {
  id: string;
  tipoCafe: string;
  calidad: string;
  pesoActual: number;
};

type GastoItem = {
  id: string;
  conceptoGasto: string;
  descripcion: string | null;
  montoGasto: number;
  fechaGasto: string;
  tipoGasto: TipoGasto;
  estadoPago: EstadoPago;
  esGastoGeneral: boolean;
  createdAt: string;
  updatedAt: string;
  sublotes: SubloteResumen[];
};

// ─── Servicio ────────────────────────────────────────────────────────────────

@Injectable()
export class GastosService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Creación ──────────────────────────────────────────────────────────────

  async crearGasto(dto: CrearGastoDto, userId: string): Promise<GastoItem> {
    const organizacionId = await this.obtenerOrganizacionId(userId);

    const esGastoGeneral = !dto.asociarASublotes;

    // Valida subloteIds cuando el gasto se asocia a sublotes específicos
    if (!esGastoGeneral) {
      if (!dto.subloteIds || dto.subloteIds.length === 0) {
        throw new BadRequestException(
          apiError(
            'GASTO_SUBLOTES_REQUERIDOS',
            'Selecciona al menos un sublote para asociar este gasto.',
            { field: 'subloteIds' },
          ),
        );
      }
      await this.validarSublotesExistentes(dto.subloteIds, organizacionId);
    }

    // Idempotencia offline-first: si ya existe el registro local, devuélvelo
    if (dto.deviceId && dto.localId) {
      const existente = await this.buscarGastoPorSync(
        this.prisma,
        dto.deviceId,
        dto.localId,
      );
      if (existente) {
        return this.formatearGasto(existente, esGastoGeneral);
      }
    }

    const gasto = await this.prisma.$transaction(
      async (tx) => {
        const nuevoGasto = await tx.gastoOperativo.create({
          data: {
            conceptoGasto: dto.conceptoGasto,
            descripcion: dto.descripcion ?? null,
            montoGasto: dto.montoGasto,
            fechaGasto: new Date(dto.fechaGasto),
            tipoGasto: dto.tipoGasto,
            estadoPago: dto.estadoPago,
            organizacionId,
            deviceId: dto.deviceId ?? null,
            localId: dto.localId ?? null,
            syncStatus: dto.syncStatus ?? null,
            createdBy: userId,
          },
          include: this.incluirSublotes(),
        });

        // Asociar sublotes en la tabla pivot cuando aplica
        if (!esGastoGeneral && dto.subloteIds && dto.subloteIds.length > 0) {
          await tx.gastoSublote.createMany({
            data: dto.subloteIds.map((subloteId) => ({
              gastoOperativoId: nuevoGasto.id,
              subloteId,
            })),
          });

          // Recarga con sublotes incluidos
          return tx.gastoOperativo.findUniqueOrThrow({
            where: { id: nuevoGasto.id },
            include: this.incluirSublotes(),
          });
        }

        return nuevoGasto;
      },
      { maxWait: 10000, timeout: 25000 },
    );

    return this.formatearGasto(gasto, esGastoGeneral);
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  /**
   * Lista todos los gastos activos de la organización del usuario.
   * Soporta filtro opcional por subloteId.
   */
  async listarGastos(
    userId: string,
    filtros: {
      subloteId?: string;
      fecha?: string;
      tipo?: string;
      orden?: 'recent' | 'oldest';
      page?: number;
      limit?: number;
    } = {},
  ): Promise<GastoItem[]> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const tipoGasto =
      filtros.tipo && Object.values(TipoGasto).includes(filtros.tipo as TipoGasto)
        ? (filtros.tipo as TipoGasto)
        : undefined;

    const where: Prisma.GastoOperativoWhereInput = {
      organizacionId,
      deletedAt: null,
      ...(filtros.subloteId
        ? { sublotes: { some: { subloteId: filtros.subloteId } } }
        : {}),
      ...(filtros.fecha ? { fechaGasto: this.crearFiltroDia(filtros.fecha) } : {}),
      ...(tipoGasto ? { tipoGasto } : {}),
    };
    const direccion = filtros.orden === 'oldest' ? 'asc' : 'desc';
    const pagination = this.crearPaginacion(filtros.page, filtros.limit);

    const gastos = await this.prisma.gastoOperativo.findMany({
      where,
      include: this.incluirSublotes(),
      orderBy: [{ fechaGasto: direccion }, { createdAt: direccion }],
      ...(pagination ?? {}),
    });

    return gastos.map((g) => this.formatearGasto(g, g.sublotes.length === 0));
  }

  /**
   * Obtiene un gasto por su id, verificando que pertenezca a la organización.
   */
  async obtenerGasto(id: string, userId: string): Promise<GastoItem> {
    const organizacionId = await this.obtenerOrganizacionId(userId);

    const gasto = await this.prisma.gastoOperativo.findFirst({
      where: { id, organizacionId, deletedAt: null },
      include: this.incluirSublotes(),
    });

    if (!gasto) {
      throw new NotFoundException(`Gasto con id "${id}" no encontrado`);
    }

    return this.formatearGasto(gasto, gasto.sublotes.length === 0);
  }

  async actualizarEstadoGasto(
    id: string,
    userId: string,
    estadoPago: EstadoPago,
  ): Promise<GastoItem> {
    const organizacionId = await this.obtenerOrganizacionId(userId);

    const existente = await this.prisma.gastoOperativo.findFirst({
      where: { id, organizacionId, deletedAt: null },
      select: { id: true },
    });

    if (!existente) {
      throw new NotFoundException(`Gasto con id "${id}" no encontrado`);
    }

    const gasto = await this.prisma.gastoOperativo.update({
      where: { id },
      data: { estadoPago },
      include: this.incluirSublotes(),
    });

    return this.formatearGasto(gasto, gasto.sublotes.length === 0);
  }

  async actualizarGasto(
    id: string,
    userId: string,
    dto: ActualizarGastoDto,
  ): Promise<GastoItem> {
    const organizacionId = await this.obtenerOrganizacionId(userId);

    const existente = await this.prisma.gastoOperativo.findFirst({
      where: { id, organizacionId, deletedAt: null },
      include: this.incluirSublotes(),
    });

    if (!existente) {
      throw new NotFoundException(`Gasto con id "${id}" no encontrado`);
    }

    const nextSubloteIds = dto.asociarASublotes
      ? (dto.subloteIds ?? existente.sublotes.map((item) => item.subloteId))
      : [];
    const actualizaSublotes =
      typeof dto.asociarASublotes === 'boolean' || Array.isArray(dto.subloteIds);

    if (actualizaSublotes && nextSubloteIds.length > 0) {
      await this.validarSublotesExistentes(nextSubloteIds, organizacionId);
    }

    const gasto = await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.gastoOperativo.update({
        where: { id },
        data: {
          ...(dto.conceptoGasto !== undefined
            ? { conceptoGasto: dto.conceptoGasto }
            : {}),
          ...(dto.descripcion !== undefined
            ? { descripcion: dto.descripcion || null }
            : {}),
          ...(dto.montoGasto !== undefined ? { montoGasto: dto.montoGasto } : {}),
          ...(dto.fechaGasto !== undefined
            ? { fechaGasto: new Date(dto.fechaGasto) }
            : {}),
          ...(dto.tipoGasto !== undefined ? { tipoGasto: dto.tipoGasto } : {}),
          ...(dto.estadoPago !== undefined ? { estadoPago: dto.estadoPago } : {}),
        },
        include: this.incluirSublotes(),
      });

      if (actualizaSublotes) {
        await tx.gastoSublote.deleteMany({ where: { gastoOperativoId: id } });
        if (nextSubloteIds.length > 0) {
          await tx.gastoSublote.createMany({
            data: nextSubloteIds.map((subloteId) => ({
              gastoOperativoId: id,
              subloteId,
            })),
          });
        }
        return tx.gastoOperativo.findUniqueOrThrow({
          where: { id },
          include: this.incluirSublotes(),
        });
      }

      return actualizado;
    });

    return this.formatearGasto(gasto, gasto.sublotes.length === 0);
  }

  async eliminarGasto(id: string, userId: string): Promise<void> {
    const organizacionId = await this.obtenerOrganizacionId(userId);

    const existente = await this.prisma.gastoOperativo.findFirst({
      where: { id, organizacionId, deletedAt: null },
      select: { id: true },
    });

    if (!existente) {
      throw new NotFoundException(`Gasto con id "${id}" no encontrado`);
    }

    await this.prisma.gastoOperativo.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Lista los gastos asociados a un sublote específico.
   */
  async listarGastosPorSublote(
    subloteId: string,
    userId: string,
  ): Promise<GastoItem[]> {
    const organizacionId = await this.obtenerOrganizacionId(userId);

    // Verifica que el sublote pertenezca a la organización
    const sublote = await this.prisma.sublote.findFirst({
      where: {
        id: subloteId,
        deletedAt: null,
        compra: { organizacionId },
      },
      select: { id: true },
    });

    if (!sublote) {
      throw new NotFoundException(
        `Sublote con id "${subloteId}" no encontrado`,
      );
    }

    const gastos = await this.prisma.gastoOperativo.findMany({
      where: {
        organizacionId,
        deletedAt: null,
        sublotes: { some: { subloteId } },
      },
      include: this.incluirSublotes(),
      orderBy: [{ fechaGasto: 'desc' }, { createdAt: 'desc' }],
    });

    return gastos.map((g) => this.formatearGasto(g, false));
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  /**
   * Resuelve el organizacionId del usuario autenticado.
   */
  private async obtenerOrganizacionId(userId: string): Promise<string> {
    const cached = getCachedOrganizationId(userId);
    if (cached) return cached;

    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizacionId: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!usuario.organizacionId) {
      throw new BadRequestException(
        'El usuario no tiene organización asignada',
      );
    }

    setCachedOrganizationId(userId, usuario.organizacionId);
    return usuario.organizacionId;
  }

  /**
   * Valida que todos los subloteIds existan, pertenezcan a la organización
   * y aun tengan inventario disponible para recibir gastos asociados.
   */
  private async validarSublotesExistentes(
    subloteIds: string[],
    organizacionId: string,
  ): Promise<void> {
    const encontrados = await this.prisma.sublote.findMany({
      where: {
        id: { in: subloteIds },
        deletedAt: null,
        compra: { organizacionId },
      },
      select: { id: true, pesoActual: true },
    });

    if (encontrados.length !== subloteIds.length) {
      const encontradosSet = new Set(encontrados.map((s) => s.id));
      const faltantes = subloteIds.filter((id) => !encontradosSet.has(id));
      throw new BadRequestException(
        `Sublote(s) no encontrado(s) o no pertenecen a la organización: ${faltantes.join(', ')}`,
      );
    }

    const agotados = encontrados.filter(
      (sublote) => Number(sublote.pesoActual) <= 0,
    );

    if (agotados.length > 0) {
      throw new ConflictException(
        apiError(
          'SUBLOTE_SIN_INVENTARIO',
          'No se pueden asociar gastos a sublotes que ya fueron vendidos.',
          {
            field: 'subloteIds',
            details: {
              subloteIds: agotados.map((sublote) => sublote.id),
            },
          },
        ),
      );
    }
  }

  /**
   * Búsqueda por clave de sincronización offline-first.
   */
  private async buscarGastoPorSync(
    client: Prisma.TransactionClient | PrismaService,
    deviceId: string,
    localId: string,
  ) {
    return client.gastoOperativo.findFirst({
      where: { deviceId, localId, deletedAt: null },
      include: this.incluirSublotes(),
    });
  }

  /**
   * Include de Prisma reutilizable para obtener los sublotes de un gasto.
   */
  private incluirSublotes() {
    return INCLUDE_SUBLOTES;
  }

  private crearFiltroDia(fecha: string): Prisma.DateTimeFilter {
    const [year, month, day] = fecha.slice(0, 10).split('-').map(Number);
    if (!year || !month || !day) {
      throw new BadRequestException(
        apiError('GASTO_FECHA_INVALIDA', 'La fecha debe tener formato YYYY-MM-DD.'),
      );
    }

    const desde = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const hasta = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
    return { gte: desde, lt: hasta };
  }

  private crearPaginacion(page?: number, limit?: number) {
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.trunc(limit as number), 1), 100)
      : undefined;
    if (!safeLimit) return null;

    const safePage = Number.isFinite(page)
      ? Math.max(Math.trunc(page as number), 1)
      : 1;

    return {
      take: safeLimit,
      skip: (safePage - 1) * safeLimit,
    };
  }

  /**
   * Mapea el modelo Prisma al formato de respuesta de la API.
   */
  private formatearGasto(
    gasto: GastoConSublotes,
    esGastoGeneral: boolean,
  ): GastoItem {
    return {
      id: gasto.id,
      conceptoGasto: gasto.conceptoGasto,
      descripcion: gasto.descripcion,
      montoGasto: Number(gasto.montoGasto),
      fechaGasto: gasto.fechaGasto.toISOString(),
      tipoGasto: gasto.tipoGasto,
      estadoPago: gasto.estadoPago,
      esGastoGeneral,
      createdAt: gasto.createdAt.toISOString(),
      updatedAt: gasto.updatedAt.toISOString(),
      sublotes: gasto.sublotes.map((pivot) => ({
        id: pivot.sublote.id,
        tipoCafe: pivot.sublote.tipoCafe.nombre,
        calidad: pivot.sublote.calidad.nombre,
        pesoActual: Number(pivot.sublote.pesoActual),
      })),
    };
  }
}
