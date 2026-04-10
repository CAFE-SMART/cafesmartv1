import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
  fechaIngreso: string;
  diasEnBodega: number;
  creadoEn: string;
};

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
};

type HumedadUpdateInput = {
  id: string;
  humedad?: number | null;
};

@Injectable()
export class LotesService {
  constructor(private readonly prisma: PrismaService) {}

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
      include: {
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
      },
      orderBy: [{ compra: { fecha: 'asc' } }, { creadoEn: 'asc' }],
    });

    const lotesAgrupados = new Map<string, LoteAcumulado>();

    for (const sublote of sublotes) {
      const claveCompuesta = `${sublote.tipoCafeId}::${sublote.calidadId}`;
      const clave = sublote.idLote ?? claveCompuesta;
      const pesoInicial = Number(sublote.pesoInicial);
      const pesoActual = Number(sublote.pesoActual);
      const precioKg = Number(sublote.precioKg);
      const humedad = this.normalizarNumeroNullable(sublote.humedad);
      const fechaIngreso = sublote.compra.fecha;

      const actual = lotesAgrupados.get(clave);
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
        });
        continue;
      }

      actual.sublotes += 1;
      actual.pesoInicial += pesoInicial;
      actual.pesoActual += pesoActual;
      actual.precioPonderado += precioKg * pesoInicial;

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
      include: {
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
      },
      orderBy: [{ compra: { fecha: 'asc' } }, { creadoEn: 'asc' }],
    });

    if (sublotes.length === 0) {
      throw new NotFoundException('No se encontraron sublotes para ese lote');
    }

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

    const detalleSublotes = sublotes.map((sublote, index) => {
      const pesoInicialSublote = Number(sublote.pesoInicial);
      const pesoActualSublote = Number(sublote.pesoActual);
      const precioKg = Number(sublote.precioKg);
      const humedad = this.normalizarNumeroNullable(sublote.humedad);
      const fechaIngreso = sublote.compra.fecha;

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
        tipoCafeId: sublote.tipoCafeId,
        tipoCafe: sublote.tipoCafe.nombre,
        calidadId: sublote.calidadId,
        calidad: sublote.calidad.nombre,
        pesoInicial: pesoInicialSublote,
        pesoActual: pesoActualSublote,
        precioKg,
        humedad,
        fechaIngreso: fechaIngreso.toISOString(),
        diasEnBodega: this.calcularDiasEnBodega(fechaIngreso),
        creadoEn: sublote.creadoEn.toISOString(),
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
      },
      sublotes: detalleSublotes,
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
