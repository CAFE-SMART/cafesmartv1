import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EstadoPago, Prisma, TipoGasto } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
          'Debe indicar al menos un subloteId cuando asociarASublotes es true',
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

    const gasto = await this.prisma.$transaction(async (tx) => {
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
    }, { maxWait: 10000, timeout: 25000 });

    return this.formatearGasto(gasto, esGastoGeneral);
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  /**
   * Lista todos los gastos activos de la organización del usuario.
   * Soporta filtro opcional por subloteId.
   */
  async listarGastos(
    userId: string,
    subloteId?: string,
  ): Promise<GastoItem[]> {
    const organizacionId = await this.obtenerOrganizacionId(userId);

    const where: Prisma.GastoOperativoWhereInput = {
      organizacionId,
      deletedAt: null,
      ...(subloteId
        ? { sublotes: { some: { subloteId } } }
        : {}),
    };

    const gastos = await this.prisma.gastoOperativo.findMany({
      where,
      include: this.incluirSublotes(),
      orderBy: [{ fechaGasto: 'desc' }, { createdAt: 'desc' }],
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
      throw new NotFoundException(`Sublote con id "${subloteId}" no encontrado`);
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
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizacionId: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!usuario.organizacionId) {
      throw new BadRequestException('El usuario no tiene organización asignada');
    }

    return usuario.organizacionId;
  }

  /**
   * Valida que todos los subloteIds existan y pertenezcan a la organización.
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
      select: { id: true },
    });

    if (encontrados.length !== subloteIds.length) {
      const encontradosSet = new Set(encontrados.map((s) => s.id));
      const faltantes = subloteIds.filter((id) => !encontradosSet.has(id));
      throw new BadRequestException(
        `Sublote(s) no encontrado(s) o no pertenecen a la organización: ${faltantes.join(', ')}`,
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
