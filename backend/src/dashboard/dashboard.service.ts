import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ParametrosService } from '../parametros/parametros.service';

type DashboardMovimiento = {
  id: string;
  tipo: 'COMPRA' | 'VENTA' | 'GASTO';
  nombre: string;
  kg: number;
  valor: number;
  fecha: string;
};

type DashboardSummaryResponse = {
  comprasHoy: number;
  ventasHoy: number;
  gastosHoy: number;
  kgCompradosHoy: number;
  totalVentasHoy: number;
  totalGastosHoy: number;
  totalProductores: number;
  kgActual: number;
  kgCapacidad: number;
  inventarioPorTipo: Array<{
    tipoCafeId: string;
    tipoCafe: string;
    kgDisponible: number;
  }>;
  utilidadTotalAcumulada: number;
  mermaTotalKg: number;
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
      gastosHoy,
      kgCompradosHoy,
      totalVentasHoy,
      totalGastosHoy,
      totalProductores,
      kgActual,
      comprasRecientes,
      ventasRecientes,
      gastosRecientes,
    ] = await this.prisma.$transaction([
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
      this.prisma.gastoOperativo.count({
        where: {
          organizacionId,
          deletedAt: null,
          fechaGasto: {
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
      this.prisma.venta.aggregate({
        _sum: { totalVenta: true },
        where: {
          organizacionId,
          deletedAt: null,
          fecha: {
            gte: inicioDia,
            lt: finDia,
          },
        },
      }),
      this.prisma.gastoOperativo.aggregate({
        _sum: { montoGasto: true },
        where: {
          organizacionId,
          deletedAt: null,
          fechaGasto: {
            gte: inicioDia,
            lt: finDia,
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
      this.prisma.gastoOperativo.findMany({
        where: {
          organizacionId,
          deletedAt: null,
        },
        orderBy: [{ fechaGasto: 'desc' }, { createdAt: 'desc' }],
        take: LIMITE_MOVIMIENTOS_RECIENTES,
        select: {
          id: true,
          conceptoGasto: true,
          fechaGasto: true,
          createdAt: true,
          montoGasto: true,
        },
      }),
    ]);
    const kgCapacidad = await this.obtenerCapacidadBodegaKg(organizacionId);
    const resumenFinanciero = await this.obtenerResumenFinanciero(organizacionId);

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

    const movimientosGastos = gastosRecientes.map((gasto) => ({
      id: gasto.id,
      tipo: 'GASTO' as const,
      nombre: gasto.conceptoGasto.trim() || 'Gasto operativo',
      kg: 0,
      valor: Number(gasto.montoGasto),
      fecha: gasto.fechaGasto.toISOString(),
      orden: gasto.createdAt.getTime(),
    }));

    const movimientosRecientes = [
      ...movimientosCompras,
      ...movimientosVentas,
      ...movimientosGastos,
    ]
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

    return {
      comprasHoy,
      ventasHoy,
      gastosHoy,
      kgCompradosHoy: Number(kgCompradosHoy._sum.pesoInicial ?? 0),
      totalVentasHoy: Number(totalVentasHoy._sum.totalVenta ?? 0),
      totalGastosHoy: Number(totalGastosHoy._sum.montoGasto ?? 0),
      totalProductores,
      kgActual: Number(kgActual._sum.pesoTotal ?? 0),
      kgCapacidad,
      inventarioPorTipo: resumenFinanciero.inventarioPorTipo,
      utilidadTotalAcumulada: resumenFinanciero.utilidadTotalAcumulada,
      mermaTotalKg: resumenFinanciero.mermaTotalKg,
      movimientosRecientes,
    };
  }

  private async obtenerResumenFinanciero(organizacionId: string) {
    const sublotes = await this.prisma.sublote.findMany({
      where: {
        deletedAt: null,
        compra: {
          deletedAt: null,
          organizacionId,
        },
      },
      select: {
        id: true,
        pesoInicial: true,
        pesoActual: true,
        costoTotal: true,
        tipoCafeId: true,
        tipoCafe: {
          select: {
            nombre: true,
          },
        },
      },
    });

    if (sublotes.length === 0) {
      return {
        inventarioPorTipo: [],
        utilidadTotalAcumulada: 0,
        mermaTotalKg: 0,
      };
    }

    const subloteIds = sublotes.map((sublote) => sublote.id);
    const [detallesVenta, gastosSublote, gastosGenerales] = await this.prisma.$transaction([
      this.prisma.ventaDetalle.findMany({
        where: {
          deletedAt: null,
          subloteId: { in: subloteIds },
        },
        select: {
          subloteId: true,
          pesoVendido: true,
          subtotal: true,
        },
      }),
      this.prisma.gastoSublote.findMany({
        where: {
          subloteId: { in: subloteIds },
          gastoOperativo: {
            deletedAt: null,
            organizacionId,
          },
        },
        select: {
          gastoOperativoId: true,
          subloteId: true,
          gastoOperativo: {
            select: {
              montoGasto: true,
            },
          },
        },
      }),
      this.prisma.gastoOperativo.findMany({
        where: {
          organizacionId,
          deletedAt: null,
          sublotes: { none: {} },
        },
        select: {
          montoGasto: true,
        },
      }),
    ]);

    const ventasPorSublote = new Map<string, { pesoVendido: number; totalVentas: number }>();
    for (const detalle of detallesVenta) {
      const actual = ventasPorSublote.get(detalle.subloteId) ?? {
        pesoVendido: 0,
        totalVentas: 0,
      };
      actual.pesoVendido += Number(detalle.pesoVendido);
      actual.totalVentas += Number(detalle.subtotal);
      ventasPorSublote.set(detalle.subloteId, actual);
    }

    const gastosPorSublote = this.calcularGastosPorSublote(
      gastosSublote,
      sublotes,
      ventasPorSublote,
    );
    const totalGastosGenerales = gastosGenerales.reduce(
      (sum, gasto) => sum + Number(gasto.montoGasto),
      0,
    );
    const pesoBaseTotal = sublotes.reduce((sum, sublote) => {
      const venta = ventasPorSublote.get(sublote.id);
      return sum + Number(sublote.pesoActual) + (venta?.pesoVendido ?? 0);
    }, 0);

    let utilidadTotalAcumulada = 0;
    let mermaTotalKg = 0;
    const inventarioPorTipoMap = new Map<
      string,
      { tipoCafeId: string; tipoCafe: string; kgDisponible: number }
    >();

    for (const sublote of sublotes) {
      const pesoInicial = Number(sublote.pesoInicial);
      const pesoActual = Number(sublote.pesoActual);
      const venta = ventasPorSublote.get(sublote.id);
      const pesoVendido = venta?.pesoVendido ?? 0;
      const totalVentas = venta?.totalVentas ?? 0;
      const costoTotal = Number(sublote.costoTotal || 0);
      const mermaKg = Math.max(0, pesoInicial - pesoActual - pesoVendido);
      const costoPorKg = pesoInicial > 0 ? costoTotal / pesoInicial : 0;
      const costoVendido = pesoVendido * costoPorKg;
      const mermaValor = mermaKg * costoPorKg;
      const pesoBase = pesoActual + pesoVendido;
      const gastoGeneralAsignado =
        totalGastosGenerales > 0
          ? pesoBaseTotal > 0
            ? (pesoBase / pesoBaseTotal) * totalGastosGenerales
            : totalGastosGenerales / sublotes.length
          : 0;
      const totalGastos =
        (gastosPorSublote.get(sublote.id) ?? 0) + gastoGeneralAsignado;

      utilidadTotalAcumulada += totalVentas - costoVendido - totalGastos - mermaValor;
      mermaTotalKg += mermaKg;

      const actual = inventarioPorTipoMap.get(sublote.tipoCafeId) ?? {
        tipoCafeId: sublote.tipoCafeId,
        tipoCafe: sublote.tipoCafe.nombre,
        kgDisponible: 0,
      };
      actual.kgDisponible += pesoActual;
      inventarioPorTipoMap.set(sublote.tipoCafeId, actual);
    }

    return {
      inventarioPorTipo: [...inventarioPorTipoMap.values()],
      utilidadTotalAcumulada,
      mermaTotalKg,
    };
  }

  private calcularGastosPorSublote(
    gastosSublote: Array<{
      gastoOperativoId: string;
      subloteId: string;
      gastoOperativo: { montoGasto: Prisma.Decimal | number };
    }>,
    sublotes: Array<{ id: string; pesoActual: Prisma.Decimal | number }>,
    ventasPorSublote: Map<string, { pesoVendido: number }>,
  ): Map<string, number> {
    const linksPorGasto = new Map<string, typeof gastosSublote>();
    const pesoBasePorSublote = new Map<string, number>();

    for (const sublote of sublotes) {
      pesoBasePorSublote.set(
        sublote.id,
        Number(sublote.pesoActual) + (ventasPorSublote.get(sublote.id)?.pesoVendido ?? 0),
      );
    }

    for (const link of gastosSublote) {
      const current = linksPorGasto.get(link.gastoOperativoId) ?? [];
      current.push(link);
      linksPorGasto.set(link.gastoOperativoId, current);
    }

    const gastosPorSublote = new Map<string, number>();
    for (const links of linksPorGasto.values()) {
      const montoGasto = Number(links[0]?.gastoOperativo.montoGasto ?? 0);
      const pesoBaseTotal = links.reduce(
        (sum, link) => sum + (pesoBasePorSublote.get(link.subloteId) ?? 0),
        0,
      );

      for (const link of links) {
        const pesoBase = pesoBasePorSublote.get(link.subloteId) ?? 0;
        const gastoAsignado =
          pesoBaseTotal > 0 ? (pesoBase / pesoBaseTotal) * montoGasto : montoGasto / links.length;
        gastosPorSublote.set(
          link.subloteId,
          (gastosPorSublote.get(link.subloteId) ?? 0) + gastoAsignado,
        );
      }
    }

    return gastosPorSublote;
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
