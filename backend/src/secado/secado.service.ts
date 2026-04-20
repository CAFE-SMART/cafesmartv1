import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecadoResultsDto } from './dto/secado-results.dto';

@Injectable()
export class SecadoService {
  constructor(private readonly prisma: PrismaService) {}

  async startSecado(
    userId: string,
    tipoCafeId: string,
    calidadId: string,
    subloteIds: string[],
    loteId?: string,
  ) {
    const organizacionId = await this.getOrganizacionId(userId);

    const sublotes = await this.prisma.sublote.findMany({
      where: {
        id: { in: subloteIds },
        tipoCafeId,
        calidadId,
        deletedAt: null,
      },
    });

    if (sublotes.length !== subloteIds.length) {
      throw new BadRequestException('Algunos sublotes no coinciden o no existen');
    }

    const inputKg = sublotes.reduce(
      (sum, s) => sum + Number(s.pesoActual ?? 0),
      0,
    );

    const active = await this.prisma.secadoSession.findFirst({
      where: {
        organizacionId,
        estado: { not: 'COMPLETED' },
      },
    });

    if (active) {
      throw new BadRequestException('Ya existe una sesión activa');
    }

    return this.prisma.secadoSession.create({
      data: {
        organizacionId,
        loteId: loteId ?? null,
        tipoCafeId,
        calidadId,
        inputKg,
        sublotes: {
          connect: subloteIds.map((id) => ({ id })),
        },
      },
    });
  }

  async saveSecadoResults(
    userId: string,
    sessionId: string,
    dto: SecadoResultsDto,
  ) {
    await this.getOrganizacionId(userId);

    const session = await this.prisma.secadoSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.estado === 'COMPLETED') {
      throw new NotFoundException('Sesión no encontrada o ya completada');
    }

    const inputBueno = dto.outputBuenoKg + dto.outputRegularKg;
    const inputKg = Number(session.inputKg);

    const mermaKg = Math.max(0, inputKg - inputBueno);
    const rendimientoPct = inputKg > 0 ? (inputBueno / inputKg) * 100 : 0;

    return this.prisma.secadoSession.update({
      where: { id: sessionId },
      data: {
        estado: 'READY',
        outputBuenoKg: dto.outputBuenoKg,
        outputBuenoHumedad: dto.outputBuenoHumedad,
        outputRegularKg: dto.outputRegularKg,
        outputRegularHumedad: dto.outputRegularHumedad,
        mermaKg,
        rendimientoPct,
      },
    });
  }

  async finalizeSecado(userId: string, sessionId: string) {
    const organizacionId = await this.getOrganizacionId(userId);

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.secadoSession.findUnique({
        where: { id: sessionId },
        include: { sublotes: true },
      });

      if (!session || session.estado !== 'READY') {
        throw new NotFoundException('Sesión no lista para finalizar');
      }

      const now = new Date();

      await tx.inventarioMovimiento.create({
        data: {
          usuarioId: userId, // 🔥 FIX clave
          organizacionId,
          tipoCafeId: session.tipoCafeId,
          calidadId: session.calidadId,
          cantidad: -Number(session.inputKg),
          tipoMovimiento: 'SECADO',
          referenciaTipo: 'SECADO',
          referenciaId: sessionId,
        },
      });

      return tx.secadoSession.update({
        where: { id: sessionId },
        data: {
          estado: 'COMPLETED',
          completedAt: now,
        },
      });
    });
  }

  async getActiveSecado(organizacionId: string) {
    return this.prisma.secadoSession.findFirst({
      where: {
        organizacionId,
        estado: { not: 'COMPLETED' },
      },
    });
  }

  async getActiveSecadoForLote(userId: string, loteId: string) {
    const organizacionId = await this.getOrganizacionId(userId);

    return this.prisma.secadoSession.findFirst({
      where: {
        organizacionId,
        loteId,
        estado: { not: 'COMPLETED' },
      },
    });
  }

  async getSecadoSession(organizacionId: string, sessionId: string) {
    return this.prisma.secadoSession.findUnique({
      where: { id: sessionId },
    });
  }

  private async getOrganizacionId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizacionId: true },
    });

    if (!user?.organizacionId) {
      throw new BadRequestException('Usuario sin organización');
    }

    return user.organizacionId;
  }
}
