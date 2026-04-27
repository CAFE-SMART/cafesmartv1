import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string) {
    const organizacionId = await this.obtenerOrganizacionId(userId);

    const [
      inventarios,
      comprasAgg,
      ventasAgg,
      gastosAgg,
      primeraCompra,
      primeraVenta,
      primerGasto,
    ] = await this.prisma.$transaction([
      this.prisma.inventario.findMany({
        where: { organizacionId },
        include: {
          tipoCafe: {
            select: { id: true, nombre: true },
          },
        },
        orderBy: [{ tipoCafe: { nombre: 'asc' } }],
      }),
      this.prisma.compra.aggregate({
        where: {
          organizacionId,
          deletedAt: null,
        },
        _sum: { totalCompra: true },
      }),
      this.prisma.venta.aggregate({
        where: {
          id_organizacion: organizacionId,
          deleted_at: null,
        },
        _sum: { total_venta: true },
      }),
      this.prisma.gasto_operativo.aggregate({
        where: {
          id_organizacion: organizacionId,
          deleted_at: null,
        },
        _sum: { monto_gasto: true },
      }),
      this.prisma.compra.findFirst({
        where: {
          organizacionId,
          deletedAt: null,
        },
        select: { id: true },
      }),
      this.prisma.venta.findFirst({
        where: {
          id_organizacion: organizacionId,
          deleted_at: null,
        },
        select: { id_venta: true },
      }),
      this.prisma.gasto_operativo.findFirst({
        where: {
          id_organizacion: organizacionId,
          deleted_at: null,
        },
        select: { id_gasto: true },
      }),
    ]);

    const inventoryByTypeMap = new Map<
      string,
      { tipoCafeId: string; tipoCafe: string; kg: number }
    >();

    for (const inventario of inventarios) {
      const tipoCafeId = inventario.tipoCafeId;
      const actual = inventoryByTypeMap.get(tipoCafeId) ?? {
        tipoCafeId,
        tipoCafe: inventario.tipoCafe.nombre,
        kg: 0,
      };

      actual.kg += toNumber(inventario.pesoTotal);
      inventoryByTypeMap.set(tipoCafeId, actual);
    }

    const inventoryByType = [...inventoryByTypeMap.values()].map((item) => ({
      ...item,
      kg: round2(item.kg),
    }));

    const inventoryAvailableKg = round2(
      inventoryByType.reduce((sum, item) => sum + item.kg, 0),
    );
    const totalVentas = round2(toNumber(ventasAgg._sum.total_venta));
    const totalCompras = round2(toNumber(comprasAgg._sum.totalCompra));
    const totalGastos = round2(toNumber(gastosAgg._sum.monto_gasto));
    const totalProfit = round2(totalVentas - totalCompras - totalGastos);
    const totalWasteKg = 0;
    const hasRecords =
      inventoryAvailableKg > 0 ||
      Boolean(primeraCompra) ||
      Boolean(primeraVenta) ||
      Boolean(primerGasto);

    return {
      inventoryAvailableKg,
      inventoryByType,
      totalProfit,
      totalWasteKg,
      hasRecords,
    };
  }

  private async obtenerOrganizacionId(userId: string) {
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
