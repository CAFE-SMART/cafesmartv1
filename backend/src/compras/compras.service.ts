import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { Prisma, Compra, Sublote } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompraDto } from './dto/crear-compra.dto';

type CompraActivaConSublotes = Compra & { sublotes: Sublote[] };

@Injectable()
export class ComprasService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================
  // 🔥 LISTAR COMPRAS
  // =========================
  async listarCompras(userId: string) {
    const organizacionId = await this.obtenerOrganizacionId(userId);

    const compras = await this.prisma.compra.findMany({
      where: {
        deletedAt: null,
        organizacionId,
      },
      include: {
        sublotes: {
          where: { deletedAt: null },
          include: {
            tipoCafe: true,
            calidad: true,
          },
        },
      },
      orderBy: [{ fecha: 'desc' }],
    });

    return compras.map((compra) => ({
      id: compra.id,
      fecha: compra.fecha.toISOString(),
      totalCompra: Number(compra.totalCompra ?? 0),
      totalSublotes: compra.sublotes.length,
      sublotes: compra.sublotes.map((s) => ({
        id: s.id,
        tipoCafe: s.tipoCafe.nombre,
        calidad: s.calidad.nombre,
        pesoInicial: Number(s.pesoInicial ?? 0),
        pesoActual: Number(s.pesoActual ?? 0),
      })),
    }));
  }

  // =========================
  // 🔥 CREAR COMPRA
  // =========================
  async crearCompra(input: CreateCompraDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const organizacionId = await this.obtenerOrganizacionId(userId);

      const fecha = input.fecha ? new Date(input.fecha) : new Date();

      const totalCompra = input.sublotes.reduce(
        (sum, s) => sum + s.pesoInicial * s.precioKg,
        0,
      );

      const compra = await tx.compra.create({
        data: {
          fecha,
          totalCompra,
          deviceId: input.deviceId,
          localId: input.localId,
          usuarioId: userId,
          organizacionId,
        },
      });

      await tx.sublote.createMany({
        data: input.sublotes.map((s) => ({
          compraId: compra.id,
          tipoCafeId: s.tipoCafeId,
          calidadId: s.calidadId,
          pesoInicial: s.pesoInicial,
          pesoActual: s.pesoInicial,
          precioKg: s.precioKg,
          deviceId: s.deviceId,
          localId: s.localId,
        })),
      });

      const sublotesCreados = await tx.sublote.findMany({
        where: { compraId: compra.id },
        orderBy: [{ creadoEn: 'asc' }],
      });

      return {
        compra: {
          id: compra.id,
          fecha: compra.fecha.toISOString(),
          totalCompra: Number(compra.totalCompra ?? 0),
        },
        sublotes: sublotesCreados.map((sublote) => ({
          id: sublote.id,
          pesoInicial: Number(sublote.pesoInicial ?? 0),
          pesoActual: Number(sublote.pesoActual ?? 0),
          precioKg: Number(sublote.precioKg ?? 0),
        })),
      };
    });
  }

  // =========================
  // 🔥 BUSCAR SUBLOTE (FIX REAL)
  // =========================
  private async buscarSublotePorSync(
    client: Prisma.TransactionClient | PrismaService,
    input: CreateCompraDto,
  ): Promise<Sublote | null> {
    // 🔥 IMPORTANTE: sin AND
    return client.sublote.findFirst({
      where: {
        OR: input.sublotes.map((s) => ({
          deviceId: s.deviceId,
          localId: s.localId,
        })),
      },
    });
  }

  // =========================
  // 🔥 ORGANIZACIÓN
  // =========================
  private async obtenerOrganizacionId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizacionId: true },
    });

    if (!user?.organizacionId) {
      throw new BadRequestException('Usuario sin organización');
    }

    return user.organizacionId;
  }

  // =========================
  // CATALOGOS
  // =========================
  async obtenerCatalogos(userId: string) {
    const organizacionId = await this.obtenerOrganizacionId(userId);

    const [tiposCafe, calidades] = await Promise.all([
      this.prisma.tipoCafe.findMany(),
      this.prisma.calidad.findMany(),
    ]);

    return {
      tiposCafe,
      calidades,
    };
  }

}
