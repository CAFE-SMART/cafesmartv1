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
        compra: { select: { fecha: true } },
        lote: { select: { id: true, codigo: true } },
        tipoCafe: { select: { id: true, nombre: true } },
        calidad: { select: { id: true, nombre: true } },
      },
      orderBy: [{ compra: { fecha: 'asc' } }, { creadoEn: 'asc' }],
    });

    const lotesAgrupados = new Map<string, LoteAcumulado>();

    for (const sublote of sublotes) {
      const claveCompuesta = `${sublote.tipoCafeId}::${sublote.calidadId}`;
      const clave = sublote.loteId ?? claveCompuesta;

      const pesoInicial = Number(sublote.pesoInicial);
      const pesoActual = Number(sublote.pesoActual);
      const precioKg = Number(sublote.precioKg);
      const humedad = this.normalizarNumeroNullable(sublote.humedad);
      const fechaIngreso = sublote.compra.fecha;

      const actual = lotesAgrupados.get(clave);

      if (!actual) {
        lotesAgrupados.set(clave, {
          id: sublote.loteId ?? claveCompuesta,
          codigo:
            sublote.lote?.codigo ??
            `${sublote.tipoCafe.nombre} ${sublote.calidad.nombre}`,
          tipoCafeId: sublote.tipoCafeId,
          tipoCafe: sublote.tipoCafe.nombre,
          calidadId: sublote.calidadId,
          calidad: sublote.calidad.nombre,
          sublotes: 1,
          sublotesConHumedad: humedad !== null && pesoActual > 0 ? 1 : 0,
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
      if (fechaIngreso < actual.fechaPrimerIngreso)
        actual.fechaPrimerIngreso = fechaIngreso;
      if (fechaIngreso > actual.fechaUltimoIngreso)
        actual.fechaUltimoIngreso = fechaIngreso;
      if (sublote.creadoEn > actual.creadoEn)
        actual.creadoEn = sublote.creadoEn;
    }

    return [...lotesAgrupados.values()].map((lote) => ({
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
        lote.pesoInicial > 0
          ? lote.precioPonderado / lote.pesoInicial
          : 0,
      humedadPromedio:
        lote.pesoConHumedad > 0
          ? this.redondearUnDecimal(
              lote.humedadPonderada / lote.pesoConHumedad,
            )
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
        compra: { select: { fecha: true } },
        lote: { select: { id: true, codigo: true } },
        tipoCafe: { select: { id: true, nombre: true } },
        calidad: { select: { id: true, nombre: true } },
      },
    });

    if (!sublotes.length) {
      throw new NotFoundException('No hay sublotes');
    }

    const primerSublote = sublotes[0];

    return {
      lote: {
        id: primerSublote.loteId ?? `${tipoCafeId}::${calidadId}`,
        codigo:
          primerSublote.lote?.codigo ??
          `${primerSublote.tipoCafe.nombre} ${primerSublote.calidad.nombre}`,
        tipoCafeId,
        tipoCafe: primerSublote.tipoCafe.nombre,
        calidadId,
        calidad: primerSublote.calidad.nombre,
        sublotes: sublotes.length,
        sublotesConHumedad: 0,
        pesoInicial: 0,
        pesoActual: 0,
        precioPromedioKg: 0,
        humedadPromedio: null,
        fecha: new Date().toISOString(),
        fechaPrimerIngreso: new Date().toISOString(),
        fechaUltimoIngreso: new Date().toISOString(),
        diasEnBodegaMin: 0,
        diasEnBodegaMax: 0,
        creadoEn: primerSublote.creadoEn.toISOString(),
      },
      sublotes: [],
    };
  }

  private async obtenerOrganizacionId(userId: string): Promise<string> {
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizacionId: true },
    });

    if (!usuario) throw new UnauthorizedException();
    if (!usuario.organizacionId) throw new BadRequestException();

    return usuario.organizacionId;
  }

  private calcularDiasEnBodega(fecha: Date): number {
    return Math.floor(
      (Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  private normalizarNumeroNullable(valor: any): number | null {
    return valor != null ? Number(valor) : null;
  }

  private redondearUnDecimal(valor: number): number {
    return Number(valor.toFixed(1));
  }

  // =========================
  //  ACTUALIZAR HUMEDADES (FIX FINAL)
  // =========================
  async actualizarHumedades(
    userId: string,
    sublotes: { id: string; humedad?: number }[],
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizacionId: true },
    });

    if (!user?.organizacionId) {
      throw new BadRequestException('Usuario sin organización');
    }

    // 🔥 VALIDACIÓN
    const invalid = sublotes.find(
      (s) => s.humedad === undefined || s.humedad === null,
    );

    if (invalid) {
      throw new BadRequestException(
        `El sublote ${invalid.id} no tiene humedad`,
      );
    }

    return this.prisma.$transaction(
      sublotes.map((s) =>
        this.prisma.sublote.update({
          where: { id: s.id },
          data: {
            humedad: s.humedad!, // 🔥 ya validado
          },
        }),
      ),
    );
  }
}