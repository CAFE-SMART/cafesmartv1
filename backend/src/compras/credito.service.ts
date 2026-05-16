import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParametrosService } from '../parametros/parametros.service';

@Injectable()
export class CreditoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametros: ParametrosService,
  ) {}

  async obtenerCredito(organizacionId: string) {
    const limiteCredito = await this.parametros.getParametro(
      'CREDITO_LIMITE', organizacionId
    ).catch(() => '0');

    const comprasPendientes = await this.prisma.compra.findMany({
      where: {
        organizacionId,
        deletedAt: null,
      },
      select: { totalCompra: true },
    });

    let usado = 0;
    for (const c of comprasPendientes) {
      if (c.totalCompra) usado += Number(c.totalCompra);
    }

    const limite = Number(limiteCredito);

    return {
      limite,
      usado,
      disponible: Math.max(0, limite - usado),
      estado: limite > 0 ? (usado >= limite ? 'BLOQUEADO' : 'ACTIVO') : 'NO_CONFIGURADO',
    };
  }

  async setLimiteCredito(organizacionId: string, limite: number) {
    await this.parametros.setParametro('CREDITO_LIMITE', limite.toString(), organizacionId);
    return { success: true, limite };
  }
}
