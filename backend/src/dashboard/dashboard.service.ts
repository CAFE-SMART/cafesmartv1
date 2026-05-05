import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParametrosService } from '../parametros/parametros.service';

type DashboardMovimiento = {
  id: string;
  tipo: 'COMPRA' | 'VENTA';
  nombre: string;
  kg: number;
  valor: number;
  fecha: string;
};

type DashboardSummaryResponse = {
  comprasHoy: number;
  ventasHoy: number;
  kgCompradosHoy: number;
  totalProductores: number;
  kgActual: number;
  kgCapacidad: number;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  totalWasteKg: number;
  movimientosRecientes: DashboardMovimiento[];
};

const LIMITE_MOVIMIENTOS_RECIENTES = 3;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametrosService: ParametrosService,
  ) {}

  async obtenerResumen(userId: string): Promise<DashboardSummaryResponse> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const { inicioDia, finDia } = this.obtenerRangoHoyBogota();

    const [
      comprasHoy,
      ventasHoy,
      kgCompradosHoy,
      totalProductores,
      kgActual,
      kgCapacidad,
      totalVentas,
      totalCompras,
      totalGastos,
      sublotesParaMerma,
      comprasRecientes,
      ventasRecientes,
    ] = await Promise.all([
      this.prisma.compra.count({
        where: {
          organizacionId,
          deletedAt: null,
          fecha: {
            gte: inicioDia,
            lt: finDia,
          },
        },
      }),
      this.prisma.venta.count({
        where: {
          organizacionId,
          deletedAt: null,
          fecha: {
            gte: inicioDia,
            lt: finDia,
          },
        },
      }),
      this.prisma.sublote.aggregate({
        _sum: { pesoInicial: true },
        where: {
          deletedAt: null,
          compra: {
            deletedAt: null,
            organizacionId,
            fecha: {
              gte: inicioDia,
              lt: finDia,
            },
          },
        },
      }),
      this.prisma.productor.count({
        where: {
          organizacionId,
          deletedAt: null,
        },
      }),
      this.prisma.inventario.aggregate({
        _sum: { pesoTotal: true },
        where: { organizacionId },
      }),
      this.obtenerCapacidadBodegaKg(organizacionId),
      this.prisma.venta.aggregate({
        _sum: { totalVenta: true },
        where: {
          organizacionId,
          deletedAt: null,
        },
      }),
      this.prisma.compra.aggregate({
        _sum: { totalCompra: true },
        where: {
          organizacionId,
          deletedAt: null,
        },
      }),
      this.prisma.gastoOperativo.aggregate({
        _sum: { montoGasto: true },
        where: {
          organizacionId,
          deletedAt: null,
        },
      }),
      this.prisma.sublote.findMany({
        where: {
          deletedAt: null,
          compra: {
            deletedAt: null,
            organizacionId,
          },
        },
        select: {
          pesoInicial: true,
          pesoActual: true,
          detallesVenta: {
            where: {
              deletedAt: null,
              venta: {
                deletedAt: null,
                organizacionId,
              },
            },
            select: {
              pesoVendido: true,
            },
          },
        },
      }),
      this.prisma.compra.findMany({
        where: {
          organizacionId,
          deletedAt: null,
        },
        orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
        take: LIMITE_MOVIMIENTOS_RECIENTES,
        select: {
          id: true,
          fecha: true,
          creadoEn: true,
          totalCompra: true,
          productor: {
            select: {
              nombre: true,
            },
          },
          sublotes: {
            where: { deletedAt: null },
            select: {
              pesoInicial: true,
            },
          },
        },
      }),
      this.prisma.venta.findMany({
        where: {
          organizacionId,
          deletedAt: null,
        },
        orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
        take: LIMITE_MOVIMIENTOS_RECIENTES,
        select: {
          id: true,
          fecha: true,
          createdAt: true,
          totalVenta: true,
          cliente: {
            select: {
              nombre: true,
            },
          },
          detalles: {
            where: { deletedAt: null },
            select: {
              pesoVendido: true,
            },
          },
        },
      }),
    ]);

    const movimientosCompras = comprasRecientes.map((compra) => ({
      id: compra.id,
      tipo: 'COMPRA' as const,
      nombre: compra.productor?.nombre?.trim() || 'Productor no registrado',
      kg: compra.sublotes.reduce(
        (total, sublote) => total + Number(sublote.pesoInicial),
        0,
      ),
      valor: Number(compra.totalCompra),
      fecha: compra.fecha.toISOString(),
      orden: compra.creadoEn.getTime(),
    }));

    const movimientosVentas = ventasRecientes.map((venta) => ({
      id: venta.id,
      tipo: 'VENTA' as const,
      nombre: venta.cliente?.nombre?.trim() || 'Cliente no registrado',
      kg: venta.detalles.reduce(
        (total, detalle) => total + Number(detalle.pesoVendido),
        0,
      ),
      valor: Number(venta.totalVenta),
      fecha: venta.fecha.toISOString(),
      orden: venta.createdAt.getTime(),
    }));

    const movimientosRecientes = [...movimientosCompras, ...movimientosVentas]
      .sort((a, b) => {
        const fechaA = new Date(a.fecha).getTime();
        const fechaB = new Date(b.fecha).getTime();
        if (fechaA !== fechaB) {
          return fechaB - fechaA;
        }

        return b.orden - a.orden;
      })
      .slice(0, LIMITE_MOVIMIENTOS_RECIENTES)
      .map(({ orden, ...movimiento }) => movimiento);

    const totalRevenue = Number(totalVentas._sum.totalVenta ?? 0);
    const totalCompraCost = Number(totalCompras._sum.totalCompra ?? 0);
    const totalOperationalExpenses = Number(totalGastos._sum.montoGasto ?? 0);
    const totalExpenses = totalCompraCost + totalOperationalExpenses;
    const totalWasteKg = sublotesParaMerma.reduce((total, sublote) => {
      const pesoVendido = sublote.detallesVenta.reduce(
        (subtotal, detalle) => subtotal + Number(detalle.pesoVendido),
        0,
      );

      const merma = Math.max(
        0,
        Number(sublote.pesoInicial) - Number(sublote.pesoActual) - pesoVendido,
      );

      return total + merma;
    }, 0);

    return {
      comprasHoy,
      ventasHoy,
      kgCompradosHoy: Number(kgCompradosHoy._sum.pesoInicial ?? 0),
      totalProductores,
      kgActual: Number(kgActual._sum.pesoTotal ?? 0),
      kgCapacidad,
      totalRevenue,
      totalExpenses,
      totalProfit: totalRevenue - totalExpenses,
      totalWasteKg,
      movimientosRecientes,
    };
  }

  private async obtenerOrganizacionId(userId: string): Promise<string> {
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizacionId: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!usuario.organizacionId) {
      throw new BadRequestException('El usuario no tiene organizacion asignada');
    }

    return usuario.organizacionId;
  }

  private async obtenerCapacidadBodegaKg(organizacionId: string): Promise<number> {
    const capacidadKgStr = await this.parametrosService.getParametroString(
      'capacidad_bodega',
      organizacionId,
    );
    const capacidadKg = Number(capacidadKgStr);

    if (Number.isFinite(capacidadKg) && capacidadKg > 0) {
      return capacidadKg;
    }

    return 3000;
  }

  private obtenerRangoHoyBogota(): { inicioDia: Date; finDia: Date } {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const year = Number(partes.find((parte) => parte.type === 'year')?.value);
    const month = Number(partes.find((parte) => parte.type === 'month')?.value);
    const day = Number(partes.find((parte) => parte.type === 'day')?.value);
    const inicioDia = new Date(
      `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00-05:00`,
    );
    const finDia = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000);

    return { inicioDia, finDia };
  }
}
