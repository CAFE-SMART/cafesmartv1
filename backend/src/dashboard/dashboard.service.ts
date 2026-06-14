import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ParametrosService } from '../parametros/parametros.service';
import {
  calcularGastosPorSubloteHelper,
  SublotePesable,
  VentaResumen,
  GastoSubloteLink,
} from '../common/utils/financiero';

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
  totalComprasHoy: number;
  totalVentasHoy: number;
  totalGastosHoy: number;
  totalComprasSemana: number;
  totalVentasSemana: number;
  totalGastosSemana: number;
  totalComprasAcumulado: number;
  totalVentasAcumulado: number;
  totalGastosAcumulado: number;
  totalProductores: number;
  kgActual: number;
  kgCapacidad: number | null;
  inventarioPorTipo: Array<{
    tipoCafeId: string;
    tipoCafe: string;
    kgDisponible: number;
  }>;
  utilidadTotalAcumulada: number;
  mermaTotalKg: number;
  movimientosRecientes: DashboardMovimiento[];
};

type DashboardInicioBodegaItem = {
  key: 'VERDE_BUENO' | 'VERDE_REGULAR' | 'SECO_BUENO';
  tipo: 'Verde' | 'Seco';
  calidad: 'Bueno' | 'Regular';
  tipoCafeId: string;
  calidadId: string;
  totalKg: number;
  lots: number;
  averageDays: number;
};

type DashboardInicioSubloteAntiguo = {
  id: string;
  tipo: string;
  calidad: string;
  tipoCafeId: string;
  calidadId: string;
  totalKg: number;
  days: number;
};

type DashboardInicioResponse = Pick<
  DashboardSummaryResponse,
  | 'comprasHoy'
  | 'ventasHoy'
  | 'gastosHoy'
  | 'kgCompradosHoy'
  | 'totalComprasHoy'
  | 'totalVentasHoy'
  | 'totalGastosHoy'
  | 'totalProductores'
  | 'kgActual'
  | 'kgCapacidad'
  | 'inventarioPorTipo'
> & {
  inventarioBodega: DashboardInicioBodegaItem[];
  sublotesAntiguos: DashboardInicioSubloteAntiguo[];
};

const LIMITE_MOVIMIENTOS_RECIENTES = 50;
const DASHBOARD_INICIO_CACHE_MS = 20000;
const dashboardInicioCache = new Map<
  string,
  { expiresAt: number; data: DashboardInicioResponse }
>();

export function invalidarDashboardCache(organizacionId: string): void {
  dashboardInicioCache.delete(organizacionId);
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametrosService: ParametrosService,
  ) {}

  async obtenerInicio(userId: string): Promise<DashboardInicioResponse> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const cached = dashboardInicioCache.get(organizacionId);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const data = await this.calcularInicio(organizacionId);
    dashboardInicioCache.set(organizacionId, {
      data,
      expiresAt: Date.now() + DASHBOARD_INICIO_CACHE_MS,
    });

    return data;
  }

  async obtenerResumen(userId: string): Promise<DashboardSummaryResponse> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const { inicioDia, finDia } = this.obtenerRangoHoyBogota();
    const { inicioSemana, finSemana } = this.obtenerRangoSemanaBogota();

    const [
      comprasHoy,
      ventasHoy,
      gastosHoy,
      kgCompradosHoy,
      totalComprasHoy,
      totalVentasHoy,
      totalGastosHoy,
      totalComprasSemana,
      totalVentasSemana,
      totalGastosSemana,
      totalComprasAcumulado,
      totalVentasAcumulado,
      totalGastosAcumulado,
      totalProductores,
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
      this.prisma.compra.aggregate({
        _sum: { totalCompra: true },
        where: {
          organizacionId,
          deletedAt: null,
          fecha: {
            gte: inicioDia,
            lt: finDia,
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
      this.prisma.compra.aggregate({
        _sum: { totalCompra: true },
        where: {
          organizacionId,
          deletedAt: null,
          fecha: {
            gte: inicioSemana,
            lt: finSemana,
          },
        },
      }),
      this.prisma.venta.aggregate({
        _sum: { totalVenta: true },
        where: {
          organizacionId,
          deletedAt: null,
          fecha: {
            gte: inicioSemana,
            lt: finSemana,
          },
        },
      }),
      this.prisma.gastoOperativo.aggregate({
        _sum: { montoGasto: true },
        where: {
          organizacionId,
          deletedAt: null,
          fechaGasto: {
            gte: inicioSemana,
            lt: finSemana,
          },
        },
      }),
      this.prisma.compra.aggregate({
        _sum: { totalCompra: true },
        where: {
          organizacionId,
          deletedAt: null,
        },
      }),
      this.prisma.venta.aggregate({
        _sum: { totalVenta: true },
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
      this.prisma.productor.count({
        where: {
          organizacionId,
          deletedAt: null,
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
    const [kgCapacidad, resumenInventario, resumenFinanciero] =
      await Promise.all([
        this.obtenerCapacidadBodegaKg(organizacionId),
        this.obtenerResumenInventario(organizacionId),
        this.obtenerResumenFinanciero(organizacionId),
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
      .map((movimientoConOrden) => {
        const { orden: _orden, ...movimiento } = movimientoConOrden;
        return movimiento;
      });

    return {
      comprasHoy,
      ventasHoy,
      gastosHoy,
      kgCompradosHoy: Number(kgCompradosHoy._sum.pesoInicial ?? 0),
      totalComprasHoy: Number(totalComprasHoy._sum.totalCompra ?? 0),
      totalVentasHoy: Number(totalVentasHoy._sum.totalVenta ?? 0),
      totalGastosHoy: Number(totalGastosHoy._sum.montoGasto ?? 0),
      totalComprasSemana: Number(totalComprasSemana._sum.totalCompra ?? 0),
      totalVentasSemana: Number(totalVentasSemana._sum.totalVenta ?? 0),
      totalGastosSemana: Number(totalGastosSemana._sum.montoGasto ?? 0),
      totalComprasAcumulado: Number(
        totalComprasAcumulado._sum.totalCompra ?? 0,
      ),
      totalVentasAcumulado: Number(totalVentasAcumulado._sum.totalVenta ?? 0),
      totalGastosAcumulado: Number(totalGastosAcumulado._sum.montoGasto ?? 0),
      totalProductores,
      kgActual: resumenInventario.kgActual,
      kgCapacidad,
      inventarioPorTipo: resumenInventario.inventarioPorTipo,
      utilidadTotalAcumulada: resumenFinanciero.utilidadTotalAcumulada,
      mermaTotalKg: resumenFinanciero.mermaTotalKg,
      movimientosRecientes,
    };
  }

  private async calcularInicio(
    organizacionId: string,
  ): Promise<DashboardInicioResponse> {
    const { inicioDia, finDia } = this.obtenerRangoHoyBogota();

    const [
      comprasAggregate,
      ventasAggregate,
      gastosAggregate,
      kgCompradosHoy,
      totalProductores,
      resumenInventario,
      kgCapacidad,
      inventarioBodega,
      sublotesAntiguos,
    ] = await Promise.all([
      this.prisma.compra.aggregate({
        _count: { id: true },
        _sum: { totalCompra: true },
        where: {
          organizacionId,
          deletedAt: null,
          fecha: { gte: inicioDia, lt: finDia },
        },
      }),
      this.prisma.venta.aggregate({
        _count: { id: true },
        _sum: { totalVenta: true },
        where: {
          organizacionId,
          deletedAt: null,
          fecha: { gte: inicioDia, lt: finDia },
        },
      }),
      this.prisma.gastoOperativo.aggregate({
        _count: { id: true },
        _sum: { montoGasto: true },
        where: {
          organizacionId,
          deletedAt: null,
          fechaGasto: { gte: inicioDia, lt: finDia },
        },
      }),
      this.prisma.sublote.aggregate({
        _sum: { pesoInicial: true },
        where: {
          deletedAt: null,
          compra: {
            deletedAt: null,
            organizacionId,
            fecha: { gte: inicioDia, lt: finDia },
          },
        },
      }),
      this.prisma.productor.count({
        where: {
          organizacionId,
          deletedAt: null,
        },
      }),
      this.obtenerResumenInventario(organizacionId),
      this.obtenerCapacidadBodegaKg(organizacionId),
      this.obtenerInventarioBodegaInicio(organizacionId),
      this.obtenerSublotesAntiguosInicio(organizacionId),
    ]);

    return {
      comprasHoy: comprasAggregate._count.id ?? 0,
      ventasHoy: ventasAggregate._count.id ?? 0,
      gastosHoy: gastosAggregate._count.id ?? 0,
      kgCompradosHoy: Number(kgCompradosHoy._sum.pesoInicial ?? 0),
      totalComprasHoy: Number(comprasAggregate._sum.totalCompra ?? 0),
      totalVentasHoy: Number(ventasAggregate._sum.totalVenta ?? 0),
      totalGastosHoy: Number(gastosAggregate._sum.montoGasto ?? 0),
      totalProductores,
      kgActual: resumenInventario.kgActual,
      kgCapacidad,
      inventarioPorTipo: resumenInventario.inventarioPorTipo,
      inventarioBodega,
      sublotesAntiguos,
    };
  }

  private async obtenerResumenInventario(organizacionId: string) {
    const inventarios = await this.prisma.inventario.findMany({
      where: { organizacionId },
      select: {
        pesoTotal: true,
        tipoCafeId: true,
        tipoCafe: {
          select: { nombre: true },
        },
      },
    });

    const inventarioPorTipoMap = new Map<
      string,
      { tipoCafeId: string; tipoCafe: string; kgDisponible: number }
    >();
    let kgActual = 0;

    for (const item of inventarios) {
      const kg = Number(item.pesoTotal);
      kgActual += kg;
      const current = inventarioPorTipoMap.get(item.tipoCafeId) ?? {
        tipoCafeId: item.tipoCafeId,
        tipoCafe: item.tipoCafe.nombre,
        kgDisponible: 0,
      };
      current.kgDisponible += kg;
      inventarioPorTipoMap.set(item.tipoCafeId, current);
    }

    return {
      kgActual,
      inventarioPorTipo: [...inventarioPorTipoMap.values()],
    };
  }

  private async obtenerInventarioBodegaInicio(
    organizacionId: string,
  ): Promise<DashboardInicioBodegaItem[]> {
    const sublotes = await this.prisma.sublote.findMany({
      where: {
        deletedAt: null,
        pesoActual: { gt: 0 },
        tipoCafe: { nombre: { in: ['VERDE', 'SECO'] } },
        calidad: { nombre: { in: ['BUENO', 'REGULAR'] } },
        compra: {
          organizacionId,
          deletedAt: null,
        },
      },
      select: {
        pesoActual: true,
        tipoCafeId: true,
        calidadId: true,
        tipoCafe: { select: { nombre: true } },
        calidad: { select: { nombre: true } },
        compra: { select: { fecha: true } },
        creadoEn: true,
      },
    });

    const map = new Map<
      DashboardInicioBodegaItem['key'],
      DashboardInicioBodegaItem & { dayWeight: number }
    >();

    for (const sublote of sublotes) {
      const tipoKey = sublote.tipoCafe.nombre.trim().toUpperCase();
      const calidadKey = sublote.calidad.nombre.trim().toUpperCase();
      const key =
        `${tipoKey}_${calidadKey}` as DashboardInicioBodegaItem['key'];

      if (
        key !== 'VERDE_BUENO' &&
        key !== 'VERDE_REGULAR' &&
        key !== 'SECO_BUENO'
      ) {
        continue;
      }

      const totalKg = Number(sublote.pesoActual);
      const days = this.daysSinceBogota(
        sublote.compra.fecha ?? sublote.creadoEn,
      );
      const current = map.get(key) ?? {
        key,
        tipo: tipoKey === 'SECO' ? 'Seco' : 'Verde',
        calidad: calidadKey === 'REGULAR' ? 'Regular' : 'Bueno',
        tipoCafeId: sublote.tipoCafeId,
        calidadId: sublote.calidadId,
        totalKg: 0,
        lots: 0,
        averageDays: 0,
        dayWeight: 0,
      };

      current.totalKg += totalKg;
      current.lots += 1;
      current.dayWeight += days;
      map.set(key, current);
    }

    return [...map.values()]
      .map(({ dayWeight, ...item }) => ({
        ...item,
        averageDays: item.lots > 0 ? Math.round(dayWeight / item.lots) : 0,
      }))
      .sort((a, b) => {
        if (b.averageDays !== a.averageDays)
          return b.averageDays - a.averageDays;
        return b.totalKg - a.totalKg;
      });
  }

  private async obtenerSublotesAntiguosInicio(
    organizacionId: string,
  ): Promise<DashboardInicioSubloteAntiguo[]> {
    const sublotes = await this.prisma.sublote.findMany({
      where: {
        deletedAt: null,
        pesoActual: { gt: 0 },
        compra: {
          organizacionId,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        pesoActual: true,
        tipoCafeId: true,
        calidadId: true,
        tipoCafe: { select: { nombre: true } },
        calidad: { select: { nombre: true } },
        compra: { select: { fecha: true } },
        creadoEn: true,
      },
      orderBy: [{ compra: { fecha: 'asc' } }, { creadoEn: 'asc' }],
      take: 3,
    });

    return sublotes.map((sublote) => ({
      id: sublote.id,
      tipo: this.toTitleLabel(sublote.tipoCafe.nombre),
      calidad: this.toTitleLabel(sublote.calidad.nombre),
      tipoCafeId: sublote.tipoCafeId,
      calidadId: sublote.calidadId,
      totalKg: Number(sublote.pesoActual),
      days: this.daysSinceBogota(sublote.compra.fecha ?? sublote.creadoEn),
    }));
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
        kgActual: 0,
        inventarioPorTipo: [],
        utilidadTotalAcumulada: 0,
        mermaTotalKg: 0,
      };
    }

    const subloteIds = sublotes.map((sublote) => sublote.id);
    const [detallesVenta = [], gastosSublote = [], gastosGenerales = []] =
      await this.prisma.$transaction([
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

    const ventasPorSublote = new Map<
      string,
      { pesoVendido: number; totalVentas: number }
    >();
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
    let kgActual = 0;
    const inventarioPorTipoMap = new Map<
      string,
      { tipoCafeId: string; tipoCafe: string; kgDisponible: number }
    >();

    for (const sublote of sublotes) {
      const pesoInicial = Number(sublote.pesoInicial);
      const pesoActual = Number(sublote.pesoActual);
      kgActual += pesoActual;
      const venta = ventasPorSublote.get(sublote.id);
      const pesoVendido = venta?.pesoVendido ?? 0;
      const totalVentas = venta?.totalVentas ?? 0;
      const costoTotal = Number(sublote.costoTotal || 0);
      const mermaKg = Math.max(0, pesoInicial - pesoActual - pesoVendido);
      const costoPorKg = pesoInicial > 0 ? costoTotal / pesoInicial : 0;
      const costoVendido = pesoVendido * costoPorKg;
      const mermaValor = mermaKg * costoPorKg;
      const pesoBase = pesoActual + pesoVendido;
      const proporcionVendida =
        pesoBase > 0 ? pesoVendido / pesoBase : pesoVendido > 0 ? 1 : 0;
      const gastoGeneralAsignado =
        totalGastosGenerales > 0
          ? pesoBaseTotal > 0
            ? (pesoBase / pesoBaseTotal) * totalGastosGenerales
            : totalGastosGenerales / sublotes.length
          : 0;
      const totalGastos =
        (gastosPorSublote.get(sublote.id) ?? 0) + gastoGeneralAsignado;
      const gastosRealizados = totalGastos * proporcionVendida;

      utilidadTotalAcumulada +=
        totalVentas - costoVendido - gastosRealizados - mermaValor;
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
      kgActual,
      inventarioPorTipo: [...inventarioPorTipoMap.values()],
      utilidadTotalAcumulada,
      mermaTotalKg,
    };
  }

  private calcularGastosPorSublote(
    gastosSublote: GastoSubloteLink[],
    sublotes: SublotePesable[],
    ventasPorSublote: Map<string, VentaResumen>,
  ): Map<string, number> {
    return calcularGastosPorSubloteHelper(
      gastosSublote,
      sublotes,
      ventasPorSublote,
    );
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
      throw new BadRequestException(
        'El usuario no tiene organizacion asignada',
      );
    }

    return usuario.organizacionId;
  }

  private async obtenerCapacidadBodegaKg(
    organizacionId: string,
  ): Promise<number | null> {
    const capacidadKgStr = await this.parametrosService.getParametroString(
      'capacidad_bodega',
      organizacionId,
    );
    const capacidadKg = Number(capacidadKgStr);

    if (Number.isFinite(capacidadKg) && capacidadKg > 0) {
      return capacidadKg;
    }

    return null;
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

  private toTitleLabel(value: string): string {
    const clean = value.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!clean) return '';

    return clean
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private daysSinceBogota(value: Date): number {
    const { inicioDia } = this.obtenerRangoHoyBogota();
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const year = Number(
      dateParts.find((parte) => parte.type === 'year')?.value,
    );
    const month = Number(
      dateParts.find((parte) => parte.type === 'month')?.value,
    );
    const day = Number(dateParts.find((parte) => parte.type === 'day')?.value);
    const target = new Date(
      `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00-05:00`,
    );

    if (Number.isNaN(target.getTime())) return 0;

    return Math.max(
      0,
      Math.floor((inicioDia.getTime() - target.getTime()) / 86400000),
    );
  }

  private obtenerRangoSemanaBogota(): {
    inicioSemana: Date;
    finSemana: Date;
  } {
    const { inicioDia } = this.obtenerRangoHoyBogota();
    const inicioSemana = new Date(
      inicioDia.getTime() - 6 * 24 * 60 * 60 * 1000,
    );
    const finSemana = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000);

    return { inicioSemana, finSemana };
  }
}
