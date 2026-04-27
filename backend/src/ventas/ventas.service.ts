import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Prisma,
  TipoMovimientoInventario,
  TipoReferenciaInventario,
} from '@prisma/client';
import { normalizarADosDecimales } from '../compras/procesar-compra';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVentaDto } from './dto/crear-venta.dto';

type VentaItemResumen = {
  tipoCafeId: string;
  calidadId: string;
  codigo: string;
  tipoCafe: string;
  calidad: string;
  cantidadKg: number;
  precioKg: number;
  subtotal: number;
};

type AsignacionSublote = {
  subloteId: string;
  cantidadVendida: number;
  precioKg: number;
  siguientePesoActual: number;
};

type MovimientoVenta = {
  tipoCafeId: string;
  calidadId: string;
  cantidad: number;
  tipoMovimiento: TipoMovimientoInventario;
  referenciaTipo: TipoReferenciaInventario;
};

function aCentiUnidades(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100);
}

function desdeCentiUnidades(valor: number): number {
  return valor / 100;
}

function resolverFechaVenta(fecha?: string): string {
  const texto = fecha?.trim();
  return texto ? texto : new Date().toISOString();
}

function resolverFechaVentaDate(fecha?: string): Date {
  return new Date(resolverFechaVenta(fecha));
}

@Injectable()
export class VentasService {
  constructor(private readonly prisma: PrismaService) {}

  async crearVenta(input: CreateVentaDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const organizacionId = await this.obtenerOrganizacionId(tx, userId);
      const referenciaId = this.construirReferenciaId(input);

      const yaRegistrada = await tx.venta.findFirst({
        where: {
          id_organizacion: organizacionId,
          device_id: input.deviceId,
          local_id: input.localId,
          deleted_at: null,
        },
        select: { id_venta: true },
      });

      this.validarItemsDuplicados(input);

      const lotesPorClave = await this.obtenerLotesPorCombinacion(tx, input);

      if (yaRegistrada) {
        return this.construirRespuestaVenta(input, referenciaId, lotesPorClave);
      }

      const sublotes = await tx.sublote.findMany({
        where: {
          deletedAt: null,
          pesoActual: { gt: 0 },
          OR: input.items.map((item) => ({
            tipoCafeId: item.tipoCafeId,
            calidadId: item.calidadId,
          })),
          compra: {
            deletedAt: null,
            organizacionId,
          },
        },
        include: {
          compra: {
            select: { fecha: true },
          },
        },
        orderBy: [{ compra: { fecha: 'asc' } }, { creadoEn: 'asc' }],
      });

      const sublotesPorClave = new Map<string, typeof sublotes>();
      for (const item of input.items) {
        const clave = this.construirClave(item.tipoCafeId, item.calidadId);
        const existentes = sublotesPorClave.get(clave);
        if (existentes) continue;
        sublotesPorClave.set(
          clave,
          sublotes.filter(
            (sublote) =>
              sublote.tipoCafeId === item.tipoCafeId &&
              sublote.calidadId === item.calidadId,
          ),
        );
      }

      const actualizaciones: AsignacionSublote[] = [];
      const movimientos: MovimientoVenta[] = [];

      for (const item of input.items) {
        const clave = this.construirClave(item.tipoCafeId, item.calidadId);
        const disponibles = sublotesPorClave.get(clave) ?? [];
        const disponibleCenti = disponibles.reduce(
          (sum, sublote) => sum + aCentiUnidades(Number(sublote.pesoActual)),
          0,
        );
        const solicitadoCenti = aCentiUnidades(item.cantidadKg);

        if (disponibleCenti < solicitadoCenti) {
          const lote = lotesPorClave.get(clave);
          throw new BadRequestException(
            `No hay stock suficiente para ${lote?.codigo ?? 'el lote seleccionado'}. Disponible: ${desdeCentiUnidades(disponibleCenti)} kg.`,
          );
        }

        let restanteCenti = solicitadoCenti;

        for (const sublote of disponibles) {
          if (restanteCenti <= 0) break;

          const actualCenti = aCentiUnidades(Number(sublote.pesoActual));
          if (actualCenti <= 0) continue;

          const descontarCenti = Math.min(actualCenti, restanteCenti);
          restanteCenti -= descontarCenti;

          actualizaciones.push({
            subloteId: sublote.id,
            cantidadVendida: desdeCentiUnidades(descontarCenti),
            precioKg: normalizarADosDecimales(item.precioKg),
            siguientePesoActual: desdeCentiUnidades(actualCenti - descontarCenti),
          });
        }

        movimientos.push({
          tipoCafeId: item.tipoCafeId,
          calidadId: item.calidadId,
          cantidad: normalizarADosDecimales(item.cantidadKg),
          tipoMovimiento: TipoMovimientoInventario.VENTA,
          referenciaTipo: TipoReferenciaInventario.VENTA,
        });
      }

      for (const actualizacion of actualizaciones) {
        await tx.sublote.update({
          where: { id: actualizacion.subloteId },
          data: { pesoActual: actualizacion.siguientePesoActual },
        });
      }

      const totalVenta = normalizarADosDecimales(
        input.items.reduce(
          (sum, item) => sum + item.cantidadKg * item.precioKg,
          0,
        ),
      );

      const venta = await tx.venta.create({
        data: {
          fecha: resolverFechaVentaDate(input.fecha),
          total_venta: totalVenta,
          device_id: input.deviceId,
          local_id: input.localId,
          id_organizacion: organizacionId,
          usuarioId: userId,
        },
      });

      await tx.venta_detalle.createMany({
        data: actualizaciones.map((actualizacion, index) => ({
          id_venta: venta.id_venta,
          id_sublote: actualizacion.subloteId,
          peso_vendido: actualizacion.cantidadVendida,
          precio_kg: actualizacion.precioKg,
          subtotal: normalizarADosDecimales(
            actualizacion.cantidadVendida * actualizacion.precioKg,
          ),
          device_id: input.deviceId,
          local_id: `${input.localId}:${index}`,
        })),
      });

      await this.recalcularInventario(tx, organizacionId, input);
      await this.registrarMovimientosInventario(
        tx,
        organizacionId,
        userId,
        referenciaId,
        movimientos,
      );

      return this.construirRespuestaVenta(input, referenciaId, lotesPorClave);
    });
  }

  private async obtenerOrganizacionId(
    tx: Prisma.TransactionClient | PrismaService,
    userId: string,
  ): Promise<string> {
    const usuario = await tx.user.findUnique({
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

  private validarItemsDuplicados(input: CreateVentaDto) {
    const vistos = new Set<string>();
    const duplicados = new Set<string>();

    for (const item of input.items) {
      const clave = this.construirClave(item.tipoCafeId, item.calidadId);
      if (vistos.has(clave)) {
        duplicados.add(clave);
        continue;
      }

      vistos.add(clave);
    }

    if (duplicados.size > 0) {
      throw new BadRequestException(
        `Hay lotes repetidos en la venta: ${[...duplicados].join(', ')}`,
      );
    }
  }

  private async obtenerLotesPorCombinacion(
    tx: Prisma.TransactionClient,
    input: CreateVentaDto,
  ) {
    const tipoCafeIds = [...new Set(input.items.map((item) => item.tipoCafeId))];
    const calidadIds = [...new Set(input.items.map((item) => item.calidadId))];

    const [tiposCafe, calidades] = await Promise.all([
      tx.tipoCafe.findMany({
        where: { id: { in: tipoCafeIds } },
        select: { id: true, nombre: true },
      }),
      tx.calidad.findMany({
        where: { id: { in: calidadIds } },
        select: { id: true, nombre: true },
      }),
    ]);

    const tipoCafePorId = new Map(
      tiposCafe.map((tipoCafe) => [tipoCafe.id, tipoCafe.nombre]),
    );
    const calidadPorId = new Map(
      calidades.map((calidad) => [calidad.id, calidad.nombre]),
    );

    const lotesPorClave = new Map<
      string,
      {
        codigo: string;
        tipoCafeId: string;
        tipoCafe: string;
        calidadId: string;
        calidad: string;
      }
    >();

    for (const item of input.items) {
      const tipoCafe = tipoCafePorId.get(item.tipoCafeId);
      const calidad = calidadPorId.get(item.calidadId);

      if (!tipoCafe || !calidad) {
        continue;
      }

      lotesPorClave.set(this.construirClave(item.tipoCafeId, item.calidadId), {
        codigo: `${tipoCafe} ${calidad}`.trim(),
        tipoCafeId: item.tipoCafeId,
        tipoCafe,
        calidadId: item.calidadId,
        calidad,
      });
    }

    if (lotesPorClave.size !== input.items.length) {
      const faltantes = input.items.filter(
        (item) => !lotesPorClave.has(this.construirClave(item.tipoCafeId, item.calidadId)),
      );
      throw new BadRequestException(
        `No se encontraron tipos/calidades validos para la venta: ${faltantes
          .map((item) => `${item.tipoCafeId}/${item.calidadId}`)
          .join(', ')}`,
      );
    }

    return lotesPorClave;
  }

  private async recalcularInventario(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    input: CreateVentaDto,
  ) {
    for (const item of input.items) {
      const total = await tx.sublote.aggregate({
        _sum: { pesoActual: true },
        where: {
          deletedAt: null,
          tipoCafeId: item.tipoCafeId,
          calidadId: item.calidadId,
          compra: {
            deletedAt: null,
            organizacionId,
          },
        },
      });

      await tx.inventario.upsert({
        where: {
          organizacionId_tipoCafeId_calidadId: {
            organizacionId,
            tipoCafeId: item.tipoCafeId,
            calidadId: item.calidadId,
          },
        },
        create: {
          organizacionId,
          tipoCafeId: item.tipoCafeId,
          calidadId: item.calidadId,
          pesoTotal: Number(total._sum.pesoActual ?? 0),
        },
        update: {
          pesoTotal: Number(total._sum.pesoActual ?? 0),
        },
      });
    }
  }

  private async registrarMovimientosInventario(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    usuarioId: string,
    referenciaId: string,
    movimientos: MovimientoVenta[],
  ) {
    await tx.inventarioMovimiento.createMany({
      data: movimientos.map((movimiento) => ({
        organizacionId,
        usuarioId,
        tipoCafeId: movimiento.tipoCafeId,
        calidadId: movimiento.calidadId,
        cantidad: movimiento.cantidad,
        tipoMovimiento: movimiento.tipoMovimiento,
        referenciaTipo: movimiento.referenciaTipo,
        referenciaId,
      })),
    });
  }

  private construirRespuestaVenta(
    input: CreateVentaDto,
    referenciaId: string,
    lotesPorClave: Map<
      string,
      {
        codigo: string;
        tipoCafeId: string;
        tipoCafe: string;
        calidadId: string;
        calidad: string;
      }
    >,
  ) {
    const items: VentaItemResumen[] = input.items.map((item) => {
      const lote = lotesPorClave.get(this.construirClave(item.tipoCafeId, item.calidadId));
      const cantidadKg = normalizarADosDecimales(item.cantidadKg);
      const precioKg = normalizarADosDecimales(item.precioKg);
      const subtotal = normalizarADosDecimales(cantidadKg * precioKg);

      return {
        tipoCafeId: item.tipoCafeId,
        calidadId: item.calidadId,
        codigo: lote?.codigo ?? 'Lote',
        tipoCafe: lote?.tipoCafe ?? 'Cafe',
        calidad: lote?.calidad ?? 'Calidad',
        cantidadKg,
        precioKg,
        subtotal,
      };
    });

    const totalKg = normalizarADosDecimales(
      items.reduce((sum, item) => sum + item.cantidadKg, 0),
    );
    const totalVenta = normalizarADosDecimales(
      items.reduce((sum, item) => sum + item.subtotal, 0),
    );

    return {
      venta: {
        referenciaId,
        fecha: resolverFechaVenta(input.fecha),
        totalKg,
        totalVenta,
        cliente: {
          nombre: input.cliente.nombre,
          documento: input.cliente.documento,
          telefono: input.cliente.telefono?.trim() || null,
          detalle: input.cliente.detalle?.trim() || null,
          rapido: Boolean(input.cliente.rapido),
        },
      },
      items,
    };
  }

  private construirClave(tipoCafeId: string, calidadId: string) {
    return `${tipoCafeId}::${calidadId}`;
  }

  private construirReferenciaId(input: CreateVentaDto) {
    return `venta:${input.deviceId}:${input.localId}`;
  }
}
