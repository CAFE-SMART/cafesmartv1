import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type SubloteFinanciero = {
  costoTotal: number;
  totalVentas: number;
  pesoVendido: number;
  totalGastos: number;
  mermaKg: number;
  mermaPorcentaje: number;
  mermaValor: number;
  utilidadNeta: number;
  costoPorKg: number;
};

export type LoteResponseItem = {
  id: string;
  codigo: string;
  tipoCafeId: string;
  tipoCafe: string;
  calidadId: string;
  calidad: string;
  sublotes: number;
  sublotesConHumedad: number;
  pesoInicial: number;
  pesoActual: number;
  precioPromedioKg: number;
  humedadPromedio: number | null;
  fecha: string;
  fechaPrimerIngreso: string;
  fechaUltimoIngreso: string;
  diasEnBodegaMin: number;
  diasEnBodegaMax: number;
  creadoEn: string;
  // Financial fields
  totalVentas: number;
  totalGastos: number;
  utilidadNeta: number;
  mermaValor: number;
  mermaKg: number;
};

export type LoteSubloteResponseItem = {
  id: string;
  etiqueta: string;
  tipoCafeId: string;
  tipoCafe: string;
  calidadId: string;
  calidad: string;
  pesoInicial: number;
  pesoActual: number;
  precioKg: number;
  humedad: number | null;
  factor: number | null;
  fechaIngreso: string;
  diasEnBodega: number;
  creadoEn: string;
} & SubloteFinanciero;

export type LoteDetalleResponse = {
  lote: LoteResponseItem;
  sublotes: LoteSubloteResponseItem[];
};

type LoteAcumulado = {
  id: string;
  codigo: string;
  tipoCafeId: string;
  tipoCafe: string;
  calidadId: string;
  calidad: string;
  sublotes: number;
  sublotesConHumedad: number;
  pesoInicial: number;
  pesoActual: number;
  precioPonderado: number;
  humedadPonderada: number;
  pesoConHumedad: number;
  fecha: Date;
  fechaPrimerIngreso: Date;
  fechaUltimoIngreso: Date;
  creadoEn: Date;
  // Financial fields
  totalVentas: number;
  totalGastos: number;
  utilidadNeta: number;
  mermaValor: number;
  mermaKg: number;
};

type HumedadUpdateInput = {
  id: string;
  humedad?: number | null;
};

type FactorUpdateInput = {
  id: string;
  factor?: number | null;
};

type PesoUpdateInput = {
  id: string;
  pesoActual: number;
  motivo?: string;
};

const SUBLOTE_INVENTARIO_SELECT = {
  id: true,
  pesoInicial: true,
  pesoActual: true,
  precioKg: true,
  costoTotal: true,
  humedad: true,
  factor: true,
  idLote: true,
  tipoCafeId: true,
  calidadId: true,
  creadoEn: true,
  compra: {
    select: {
      fecha: true,
    },
  },
  lote: {
    select: {
      id: true,
      codigo: true,
    },
  },
  tipoCafe: {
    select: {
      id: true,
      nombre: true,
    },
  },
  calidad: {
    select: {
      id: true,
      nombre: true,
    },
  },
} as const;

type InventarioSublote = Prisma.SubloteGetPayload<{
  select: typeof SUBLOTE_INVENTARIO_SELECT;
}>;

type VentaResumen = {
  pesoVendido: number;
  totalVentas: number;
};

@Injectable()
export class LotesService {
  constructor(private readonly prisma: PrismaService) {}

  private calcularFinancieroSublote(sublote: any): SubloteFinanciero {
    const costoTotal = Number(sublote.costoTotal || 0);
    const pesoInicial = Number(sublote.pesoInicial);
    const pesoActual = Number(sublote.pesoActual);

    const pesoVendido = sublote.detallesVenta?.reduce((sum: number, det: any) => sum + Number(det.pesoVendido), 0) || 0;
    const totalVentas = sublote.detallesVenta?.reduce((sum: number, det: any) => sum + Number(det.subtotal), 0) || 0;

    const mermaKg = Math.max(0, pesoInicial - pesoActual - pesoVendido);
    
    const costoPorKg = pesoInicial > 0 ? costoTotal / pesoInicial : 0;
    const costoVendido = pesoVendido * costoPorKg;
    
    const mermaPorcentaje = pesoInicial > 0 ? (mermaKg / pesoInicial) * 100 : 0;
    const mermaValor = mermaKg * costoPorKg;

    const pesoBase = pesoActual + pesoVendido;
    let totalGastos = 0;

    if (sublote.gastosOperativos) {
      for (const gastoPivot of sublote.gastosOperativos) {
        const gasto = gastoPivot.gastoOperativo;
        if (!gasto || !gasto.sublotes) continue;
        
        let sumPesoBase = 0;
        for (const pivot of gasto.sublotes) {
           const sub = pivot.sublote;
           if (sub) {
             const subPesoVendido = sub.detallesVenta?.reduce((s: number, det: any) => s + Number(det.pesoVendido), 0) || 0;
             sumPesoBase += Number(sub.pesoActual) + subPesoVendido;
           }
        }
        
        if (sumPesoBase > 0) {
           totalGastos += (pesoBase / sumPesoBase) * Number(gasto.montoGasto);
        } else {
           totalGastos += Number(gasto.montoGasto) / gasto.sublotes.length;
        }
      }
    }

    const utilidadNeta = totalVentas - costoVendido - totalGastos - mermaValor;

    return {
      costoTotal,
      totalVentas,
      pesoVendido,
      totalGastos,
      mermaKg,
      mermaPorcentaje,
      mermaValor,
      utilidadNeta,
      costoPorKg
    };
  }

  private calcularGastosPorSublote(
    gastosSublote: Array<{
      gastoOperativoId: string;
      subloteId: string;
      gastoOperativo: { montoGasto: Prisma.Decimal | number };
    }>,
    sublotes: InventarioSublote[],
    ventasPorSublote: Map<string, VentaResumen>,
  ): Map<string, number> {
    const pesoBasePorSublote = new Map<string, number>();

    for (const sublote of sublotes) {
      const venta = ventasPorSublote.get(sublote.id);
      pesoBasePorSublote.set(
        sublote.id,
        Number(sublote.pesoActual) + (venta?.pesoVendido ?? 0),
      );
    }

    const linksPorGasto = new Map<string, typeof gastosSublote>();

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

  private calcularGastosGeneralesPorSublote(
    gastosGenerales: Array<{ montoGasto: Prisma.Decimal | number }>,
    sublotes: InventarioSublote[],
    ventasPorSublote: Map<string, VentaResumen>,
  ): Map<string, number> {
    const gastosPorSublote = new Map<string, number>();
    const totalGastosGenerales = gastosGenerales.reduce(
      (sum, gasto) => sum + Number(gasto.montoGasto),
      0,
    );

    if (totalGastosGenerales <= 0 || sublotes.length === 0) {
      return gastosPorSublote;
    }

    const pesoBasePorSublote = new Map<string, number>();
    let pesoBaseTotal = 0;

    for (const sublote of sublotes) {
      const venta = ventasPorSublote.get(sublote.id);
      const pesoBase = Number(sublote.pesoActual) + (venta?.pesoVendido ?? 0);
      pesoBasePorSublote.set(sublote.id, pesoBase);
      pesoBaseTotal += pesoBase;
    }

    for (const sublote of sublotes) {
      const pesoBase = pesoBasePorSublote.get(sublote.id) ?? 0;
      const gastoAsignado =
        pesoBaseTotal > 0
          ? (pesoBase / pesoBaseTotal) * totalGastosGenerales
          : totalGastosGenerales / sublotes.length;

      gastosPorSublote.set(sublote.id, gastoAsignado);
    }

    return gastosPorSublote;
  }

  private combinarGastosPorSublote(
    gastosAsociados: Map<string, number>,
    gastosGenerales: Map<string, number>,
  ): Map<string, number> {
    const combinado = new Map(gastosAsociados);

    for (const [subloteId, monto] of gastosGenerales.entries()) {
      combinado.set(subloteId, (combinado.get(subloteId) ?? 0) + monto);
    }

    return combinado;
  }

  private sumarGastoFinanciero(
    financiero: SubloteFinanciero,
    gastoAdicional: number,
  ): SubloteFinanciero {
    if (gastoAdicional <= 0) {
      return financiero;
    }

    return {
      ...financiero,
      totalGastos: financiero.totalGastos + gastoAdicional,
      utilidadNeta: financiero.utilidadNeta - gastoAdicional,
    };
  }

  private calcularFinancieroSubloteResumen(
    sublote: Pick<InventarioSublote, 'costoTotal' | 'pesoInicial' | 'pesoActual'>,
    venta: VentaResumen | undefined,
    totalGastos: number,
  ): SubloteFinanciero {
    const costoTotal = Number(sublote.costoTotal || 0);
    const pesoInicial = Number(sublote.pesoInicial);
    const pesoActual = Number(sublote.pesoActual);
    const pesoVendido = venta?.pesoVendido ?? 0;
    const totalVentas = venta?.totalVentas ?? 0;
    const mermaKg = Math.max(0, pesoInicial - pesoActual - pesoVendido);
    const costoPorKg = pesoInicial > 0 ? costoTotal / pesoInicial : 0;
    const costoVendido = pesoVendido * costoPorKg;
    const mermaPorcentaje = pesoInicial > 0 ? (mermaKg / pesoInicial) * 100 : 0;
    const mermaValor = mermaKg * costoPorKg;
    const utilidadNeta = totalVentas - costoVendido - totalGastos - mermaValor;

    return {
      costoTotal,
      totalVentas,
      pesoVendido,
      totalGastos,
      mermaKg,
      mermaPorcentaje,
      mermaValor,
      utilidadNeta,
      costoPorKg,
    };
  }

  async findAll(userId: string): Promise<LoteResponseItem[]> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const sublotes = await this.prisma.sublote.findMany({
      where: {
        deletedAt: null,
        compra: {
          deletedAt: null,
          organizacionId,
        },
      },
      select: SUBLOTE_INVENTARIO_SELECT,
      orderBy: [{ compra: { fecha: 'asc' } }, { creadoEn: 'asc' }],
    });

    if (sublotes.length === 0) {
      return [];
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

    const ventasPorSublote = new Map<string, VentaResumen>();

    for (const detalle of detallesVenta) {
      const actual = ventasPorSublote.get(detalle.subloteId) ?? {
        pesoVendido: 0,
        totalVentas: 0,
      };
      actual.pesoVendido += Number(detalle.pesoVendido);
      actual.totalVentas += Number(detalle.subtotal);
      ventasPorSublote.set(detalle.subloteId, actual);
    }

    const gastosPorSublote = this.combinarGastosPorSublote(
      this.calcularGastosPorSublote(gastosSublote, sublotes, ventasPorSublote),
      this.calcularGastosGeneralesPorSublote(
        gastosGenerales,
        sublotes,
        ventasPorSublote,
      ),
    );

    const lotesAgrupados = new Map<string, LoteAcumulado>();

    for (const sublote of sublotes) {
      const claveCompuesta = `${sublote.tipoCafeId}::${sublote.calidadId}`;
      const clave = sublote.idLote ?? claveCompuesta;
      const pesoInicial = Number(sublote.pesoInicial);
      const pesoActual = Number(sublote.pesoActual);
      const precioKg = Number(sublote.precioKg);
      const humedad = this.normalizarNumeroNullable(sublote.humedad);
      const factor = this.normalizarNumeroNullable(sublote.factor);
      const fechaIngreso = sublote.compra.fecha;

      const actual = lotesAgrupados.get(clave);
      const financiero = this.calcularFinancieroSubloteResumen(
        sublote,
        ventasPorSublote.get(sublote.id),
        gastosPorSublote.get(sublote.id) ?? 0,
      );
      
      if (!actual) {
        lotesAgrupados.set(clave, {
          id: sublote.idLote ?? claveCompuesta,
          codigo:
            sublote.lote?.codigo ??
            `${sublote.tipoCafe.nombre} ${sublote.calidad.nombre}`,
          tipoCafeId: sublote.tipoCafeId,
          tipoCafe: sublote.tipoCafe.nombre,
          calidadId: sublote.calidadId,
          calidad: sublote.calidad.nombre,
          sublotes: 1,
          sublotesConHumedad:
            humedad !== null && pesoActual > 0 ? 1 : 0,
          pesoInicial,
          pesoActual,
          precioPonderado: precioKg * pesoInicial,
          humedadPonderada:
            humedad !== null && pesoActual > 0 ? humedad * pesoActual : 0,
          pesoConHumedad:
            humedad !== null && pesoActual > 0 ? pesoActual : 0,
          fecha: fechaIngreso,
          fechaPrimerIngreso: fechaIngreso,
          fechaUltimoIngreso: fechaIngreso,
          creadoEn: sublote.creadoEn,
          totalVentas: financiero.totalVentas,
          totalGastos: financiero.totalGastos,
          utilidadNeta: financiero.utilidadNeta,
          mermaValor: financiero.mermaValor,
          mermaKg: financiero.mermaKg,
        });
        continue;
      }

      actual.sublotes += 1;
      actual.pesoInicial += pesoInicial;
      actual.pesoActual += pesoActual;
      actual.precioPonderado += precioKg * pesoInicial;
      actual.totalVentas += financiero.totalVentas;
      actual.totalGastos += financiero.totalGastos;
      actual.utilidadNeta += financiero.utilidadNeta;
      actual.mermaValor += financiero.mermaValor;
      actual.mermaKg += financiero.mermaKg;

      if (humedad !== null && pesoActual > 0) {
        actual.sublotesConHumedad += 1;
        actual.humedadPonderada += humedad * pesoActual;
        actual.pesoConHumedad += pesoActual;
      }

      if (fechaIngreso > actual.fecha) actual.fecha = fechaIngreso;
      if (fechaIngreso < actual.fechaPrimerIngreso) actual.fechaPrimerIngreso = fechaIngreso;
      if (fechaIngreso > actual.fechaUltimoIngreso) actual.fechaUltimoIngreso = fechaIngreso;
      if (sublote.creadoEn > actual.creadoEn) actual.creadoEn = sublote.creadoEn;
    }

    return [...lotesAgrupados.values()]
      .sort((a, b) => {
        const primerIngreso = a.fechaPrimerIngreso.getTime() - b.fechaPrimerIngreso.getTime();
        if (primerIngreso !== 0) {
          return primerIngreso;
        }

        return a.fechaUltimoIngreso.getTime() - b.fechaUltimoIngreso.getTime();
      })
      .map((lote) => ({
        id: lote.id,
        codigo: lote.codigo,
        tipoCafeId: lote.tipoCafeId,
        tipoCafe: lote.tipoCafe,
        calidadId: lote.calidadId,
        calidad: lote.calidad,
        sublotes: lote.sublotes,
        sublotesConHumedad: lote.sublotesConHumedad,
        pesoInicial: lote.pesoInicial,
        pesoActual: lote.pesoActual,
        precioPromedioKg:
          lote.pesoInicial > 0 ? lote.precioPonderado / lote.pesoInicial : 0,
        humedadPromedio:
          lote.pesoConHumedad > 0
            ? this.redondearUnDecimal(lote.humedadPonderada / lote.pesoConHumedad)
            : null,
        fecha: lote.fecha.toISOString(),
        fechaPrimerIngreso: lote.fechaPrimerIngreso.toISOString(),
        fechaUltimoIngreso: lote.fechaUltimoIngreso.toISOString(),
        diasEnBodegaMin: this.calcularDiasEnBodega(lote.fechaUltimoIngreso),
        diasEnBodegaMax: this.calcularDiasEnBodega(lote.fechaPrimerIngreso),
        creadoEn: lote.creadoEn.toISOString(),
        totalVentas: lote.totalVentas,
        totalGastos: lote.totalGastos,
        utilidadNeta: lote.utilidadNeta,
        mermaValor: lote.mermaValor,
        mermaKg: lote.mermaKg,
      }));
  }

  async findSublotesByLote(
    userId: string,
    tipoCafeId: string,
    calidadId: string,
  ): Promise<LoteDetalleResponse> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const sublotes = await this.prisma.sublote.findMany({
      where: {
        deletedAt: null,
        tipoCafeId,
        calidadId,
        compra: {
          deletedAt: null,
          organizacionId,
        },
      },
      select: {
        ...SUBLOTE_INVENTARIO_SELECT,
        detallesVenta: {
          where: { deletedAt: null },
        },
        gastosOperativos: {
          include: {
            gastoOperativo: {
              include: {
                sublotes: {
                  include: {
                    sublote: {
                      include: {
                        detallesVenta: { where: { deletedAt: null } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ compra: { fecha: 'asc' } }, { creadoEn: 'asc' }],
    });

    if (sublotes.length === 0) {
      throw new NotFoundException('No se encontraron sublotes para ese lote');
    }

    const sublotesOrganizacion = await this.prisma.sublote.findMany({
      where: {
        deletedAt: null,
        compra: {
          deletedAt: null,
          organizacionId,
        },
      },
      select: SUBLOTE_INVENTARIO_SELECT,
    });
    const sublotesOrganizacionIds = sublotesOrganizacion.map((sublote) => sublote.id);
    const [detallesVentaOrganizacion, gastosGenerales] = await this.prisma.$transaction([
      this.prisma.ventaDetalle.findMany({
        where: {
          deletedAt: null,
          subloteId: { in: sublotesOrganizacionIds },
        },
        select: {
          subloteId: true,
          pesoVendido: true,
          subtotal: true,
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

    const ventasOrganizacionPorSublote = new Map<string, VentaResumen>();
    for (const detalle of detallesVentaOrganizacion) {
      const actual = ventasOrganizacionPorSublote.get(detalle.subloteId) ?? {
        pesoVendido: 0,
        totalVentas: 0,
      };
      actual.pesoVendido += Number(detalle.pesoVendido);
      actual.totalVentas += Number(detalle.subtotal);
      ventasOrganizacionPorSublote.set(detalle.subloteId, actual);
    }

    const gastosGeneralesPorSublote = this.calcularGastosGeneralesPorSublote(
      gastosGenerales,
      sublotesOrganizacion,
      ventasOrganizacionPorSublote,
    );

    const primerSublote = sublotes[0];
    let pesoInicial = 0;
    let pesoActual = 0;
    let precioPonderado = 0;
    let humedadPonderada = 0;
    let pesoConHumedad = 0;
    let sublotesConHumedad = 0;
    let fechaPrimerIngreso = primerSublote.compra.fecha;
    let fechaUltimoIngreso = primerSublote.compra.fecha;
    let fecha = primerSublote.compra.fecha;
    let creadoEn = primerSublote.creadoEn;

    let totalVentas = 0;
    let totalGastos = 0;
    let utilidadNeta = 0;
    let mermaValor = 0;
    let mermaKg = 0;

    const detalleSublotes = sublotes.map((sublote, index) => {
      const pesoInicialSublote = Number(sublote.pesoInicial);
      const pesoActualSublote = Number(sublote.pesoActual);
      const precioKg = Number(sublote.precioKg);
      const humedad = this.normalizarNumeroNullable(sublote.humedad);
      const factor = this.normalizarNumeroNullable(sublote.factor);
      const fechaIngreso = sublote.compra.fecha;

      const financiero = this.sumarGastoFinanciero(
        this.calcularFinancieroSublote(sublote),
        gastosGeneralesPorSublote.get(sublote.id) ?? 0,
      );
      totalVentas += financiero.totalVentas;
      totalGastos += financiero.totalGastos;
      utilidadNeta += financiero.utilidadNeta;
      mermaValor += financiero.mermaValor;
      mermaKg += financiero.mermaKg;

      pesoInicial += pesoInicialSublote;
      pesoActual += pesoActualSublote;
      precioPonderado += precioKg * pesoInicialSublote;

      if (humedad !== null && pesoActualSublote > 0) {
        sublotesConHumedad += 1;
        humedadPonderada += humedad * pesoActualSublote;
        pesoConHumedad += pesoActualSublote;
      }

      if (fechaIngreso < fechaPrimerIngreso) fechaPrimerIngreso = fechaIngreso;
      if (fechaIngreso > fechaUltimoIngreso) fechaUltimoIngreso = fechaIngreso;
      if (fechaIngreso > fecha) fecha = fechaIngreso;
      if (sublote.creadoEn > creadoEn) creadoEn = sublote.creadoEn;

      return {
        id: sublote.id,
        etiqueta: `Sublote ${index + 1}`,
        tipoCafeId: sublote.tipoCafe.id,
        tipoCafe: sublote.tipoCafe.nombre,
        calidadId: sublote.calidad.id,
        calidad: sublote.calidad.nombre,
        pesoInicial: pesoInicialSublote,
        pesoActual: pesoActualSublote,
        precioKg,
        humedad,
        factor,
        fechaIngreso: fechaIngreso.toISOString(),
        diasEnBodega: this.calcularDiasEnBodega(fechaIngreso),
        creadoEn: sublote.creadoEn.toISOString(),
        ...financiero,
      };
    });

    return {
      lote: {
        id: primerSublote.idLote ?? `${tipoCafeId}::${calidadId}`,
        codigo:
          primerSublote.lote?.codigo ??
          `${primerSublote.tipoCafe.nombre} ${primerSublote.calidad.nombre}`,
        tipoCafeId,
        tipoCafe: primerSublote.tipoCafe.nombre,
        calidadId,
        calidad: primerSublote.calidad.nombre,
        sublotes: detalleSublotes.length,
        sublotesConHumedad,
        pesoInicial,
        pesoActual,
        precioPromedioKg: pesoInicial > 0 ? precioPonderado / pesoInicial : 0,
        humedadPromedio:
          pesoConHumedad > 0
            ? this.redondearUnDecimal(humedadPonderada / pesoConHumedad)
            : null,
        fecha: fecha.toISOString(),
        fechaPrimerIngreso: fechaPrimerIngreso.toISOString(),
        fechaUltimoIngreso: fechaUltimoIngreso.toISOString(),
        diasEnBodegaMin: this.calcularDiasEnBodega(fechaUltimoIngreso),
        diasEnBodegaMax: this.calcularDiasEnBodega(fechaPrimerIngreso),
        creadoEn: creadoEn.toISOString(),
        totalVentas,
        totalGastos,
        utilidadNeta,
        mermaValor,
        mermaKg,
      },
      sublotes: detalleSublotes,
    };
  }

  async findSublotesByLoteId(
    userId: string,
    loteId: string,
  ): Promise<LoteDetalleResponse> {
    const [tipoCafeId, calidadId] = loteId.includes('::')
      ? loteId.split('::', 2)
      : [null, null];

    if (tipoCafeId && calidadId) {
      return this.findSublotesByLote(userId, tipoCafeId, calidadId);
    }

    const organizacionId = await this.obtenerOrganizacionId(userId);
    const lote = await this.prisma.lote.findFirst({
      where: { id: loteId, organizacionId },
      select: {
        tipoCafeId: true,
        calidadId: true,
      },
    });

    if (!lote) {
      throw new NotFoundException('No se encontraron sublotes para ese lote');
    }

    return this.findSublotesByLote(userId, lote.tipoCafeId, lote.calidadId);
  }

  async obtenerResultadosFinancierosSublote(
    userId: string,
    subloteId: string,
  ): Promise<SubloteFinanciero & { subloteId: string }> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const sublote = await this.prisma.sublote.findFirst({
      where: {
        id: subloteId,
        deletedAt: null,
        compra: {
          deletedAt: null,
          organizacionId,
        },
      },
      select: {
        ...SUBLOTE_INVENTARIO_SELECT,
        detallesVenta: {
          where: { deletedAt: null },
        },
        gastosOperativos: {
          include: {
            gastoOperativo: {
              include: {
                sublotes: {
                  include: {
                    sublote: {
                      include: {
                        detallesVenta: { where: { deletedAt: null } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!sublote) {
      throw new NotFoundException(`Sublote con id "${subloteId}" no encontrado`);
    }

    const sublotesOrganizacion = await this.prisma.sublote.findMany({
      where: {
        deletedAt: null,
        compra: {
          deletedAt: null,
          organizacionId,
        },
      },
      select: SUBLOTE_INVENTARIO_SELECT,
    });
    const sublotesOrganizacionIds = sublotesOrganizacion.map((item) => item.id);
    const [detallesVentaOrganizacion, gastosGenerales] = await this.prisma.$transaction([
      this.prisma.ventaDetalle.findMany({
        where: {
          deletedAt: null,
          subloteId: { in: sublotesOrganizacionIds },
        },
        select: {
          subloteId: true,
          pesoVendido: true,
          subtotal: true,
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

    const ventasPorSublote = new Map<string, VentaResumen>();
    for (const detalle of detallesVentaOrganizacion) {
      const actual = ventasPorSublote.get(detalle.subloteId) ?? {
        pesoVendido: 0,
        totalVentas: 0,
      };
      actual.pesoVendido += Number(detalle.pesoVendido);
      actual.totalVentas += Number(detalle.subtotal);
      ventasPorSublote.set(detalle.subloteId, actual);
    }

    const gastosGeneralesPorSublote = this.calcularGastosGeneralesPorSublote(
      gastosGenerales,
      sublotesOrganizacion,
      ventasPorSublote,
    );
    const financiero = this.sumarGastoFinanciero(
      this.calcularFinancieroSublote(sublote),
      gastosGeneralesPorSublote.get(sublote.id) ?? 0,
    );

    return {
      subloteId: sublote.id,
      ...financiero,
    };
  }

  async actualizarHumedades(
    userId: string,
    sublotes: HumedadUpdateInput[],
  ): Promise<{ totalActualizados: number }> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const ids = sublotes.map((sublote) => sublote.id);
    const idsUnicos = [...new Set(ids)];

    if (ids.length !== idsUnicos.length) {
      throw new BadRequestException('Hay sublotes repetidos en la solicitud');
    }

    const existentes = await this.prisma.sublote.findMany({
      where: {
        id: { in: idsUnicos },
        deletedAt: null,
        compra: {
          deletedAt: null,
          organizacionId,
        },
      },
      select: { id: true },
    });

    if (existentes.length !== idsUnicos.length) {
      const encontrados = new Set(existentes.map((sublote) => sublote.id));
      const faltantes = idsUnicos.filter((id) => !encontrados.has(id));
      throw new NotFoundException(
        `No se encontraron sublotes validos: ${faltantes.join(', ')}`,
      );
    }

    await this.prisma.$transaction(
      sublotes.map((sublote) =>
        this.prisma.sublote.update({
          where: { id: sublote.id },
          data: {
            humedad:
              sublote.humedad === undefined || sublote.humedad === null
                ? null
                : sublote.humedad,
          },
        }),
      ),
    );

    return { totalActualizados: sublotes.length };
  }

  async actualizarFactores(
    userId: string,
    sublotes: FactorUpdateInput[],
  ): Promise<{ totalActualizados: number }> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const ids = sublotes.map((sublote) => sublote.id);
    const idsUnicos = [...new Set(ids)];

    if (ids.length !== idsUnicos.length) {
      throw new BadRequestException('Hay sublotes repetidos en la solicitud');
    }

    const existentes = await this.prisma.sublote.findMany({
      where: {
        id: { in: idsUnicos },
        deletedAt: null,
        compra: {
          deletedAt: null,
          organizacionId,
        },
      },
      select: { id: true },
    });

    if (existentes.length !== idsUnicos.length) {
      const encontrados = new Set(existentes.map((sublote) => sublote.id));
      const faltantes = idsUnicos.filter((id) => !encontrados.has(id));
      throw new NotFoundException(
        `No se encontraron sublotes validos: ${faltantes.join(', ')}`,
      );
    }

    await this.prisma.$transaction(
      sublotes.map((sublote) =>
        this.prisma.sublote.update({
          where: { id: sublote.id },
          data: {
            factor:
              sublote.factor === undefined || sublote.factor === null
                ? null
                : sublote.factor,
          },
        }),
      ),
    );

    return { totalActualizados: sublotes.length };
  }

  async actualizarPesos(
    userId: string,
    sublotes: PesoUpdateInput[],
  ): Promise<{ totalActualizados: number }> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const ids = sublotes.map((sublote) => sublote.id);
    const idsUnicos = [...new Set(ids)];

    if (ids.length !== idsUnicos.length) {
      throw new BadRequestException(
        'Hay sublotes repetidos. Revisa la seleccion e intenta guardar de nuevo.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const existentes = await tx.sublote.findMany({
        where: {
          id: { in: idsUnicos },
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
          tipoCafeId: true,
          calidadId: true,
        },
      });

      if (existentes.length !== idsUnicos.length) {
        const encontrados = new Set(existentes.map((sublote) => sublote.id));
        const faltantes = idsUnicos.filter((id) => !encontrados.has(id));
        throw new NotFoundException(
          `No encontramos algunos sublotes de esta solicitud: ${faltantes.join(', ')}. Actualiza el inventario e intenta nuevamente.`,
        );
      }

      const existentesPorId = new Map(existentes.map((sublote) => [sublote.id, sublote]));
      const deltaInventario = new Map<
        string,
        { tipoCafeId: string; calidadId: string; cantidad: number }
      >();

      for (const sublote of sublotes) {
        const existente = existentesPorId.get(sublote.id);
        const pesoActual = Number(sublote.pesoActual);

        if (!existente || !Number.isFinite(pesoActual) || pesoActual < 0) {
          throw new BadRequestException(
            'El peso ingresado no es valido. Revisa que sea un numero mayor o igual a cero.',
          );
        }

        if (pesoActual > Number(existente.pesoInicial)) {
          throw new BadRequestException(
            'El peso actual no puede superar el peso inicial del sublote. Ajusta el valor e intenta de nuevo.',
          );
        }

        const delta = pesoActual - Number(existente.pesoActual);
        const clave = `${existente.tipoCafeId}::${existente.calidadId}`;
        const actual = deltaInventario.get(clave) ?? {
          tipoCafeId: existente.tipoCafeId,
          calidadId: existente.calidadId,
          cantidad: 0,
        };
        actual.cantidad += delta;
        deltaInventario.set(clave, actual);

        await tx.sublote.update({
          where: { id: sublote.id },
          data: {
            pesoActual,
          },
        });
      }

      for (const movimiento of deltaInventario.values()) {
        if (Math.abs(movimiento.cantidad) < 0.0001) {
          continue;
        }

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
    }, { maxWait: 10000, timeout: 25000 });

    return { totalActualizados: sublotes.length };
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

  private calcularDiasEnBodega(fechaIngreso: Date): number {
    const hoy = new Date();
    const hoyUtc = Date.UTC(
      hoy.getUTCFullYear(),
      hoy.getUTCMonth(),
      hoy.getUTCDate(),
    );
    const ingresoUtc = Date.UTC(
      fechaIngreso.getUTCFullYear(),
      fechaIngreso.getUTCMonth(),
      fechaIngreso.getUTCDate(),
    );
    return Math.max(0, Math.floor((hoyUtc - ingresoUtc) / 86400000));
  }

  private normalizarNumeroNullable(
    valor: Prisma.Decimal | number | null | undefined,
  ): number | null {
    if (valor === null || valor === undefined) {
      return null;
    }

    return Number(valor);
  }

  private redondearUnDecimal(valor: number): number {
    return Number(valor.toFixed(1));
  }
}
