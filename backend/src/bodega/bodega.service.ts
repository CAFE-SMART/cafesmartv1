import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ParametrosService } from '../parametros/parametros.service';
import {
  ActualizarBodegaDto,
  CrearBodegaDto,
  EditarBodegaDto,
} from './dto/actualizar-bodega.dto';
import {
  PESO_MAXIMO_ENTRADA_KG,
  PESO_MAXIMO_OPERATIVO_DEFAULT_KG,
  PESO_MINIMO_KG,
} from '../common/business-rules';
import { apiError } from '../common/errors/api-error';

export type ConfiguracionBodega = {
  nombreBodega: string;
  capacidadKg: number | null;
  maxPesoKg: number;
  maxPrecioKg: number;
  maxPrecioVentaKg: number;
  updatedAt: string;
};

export type BodegaItem = {
  id: string;
  nombre: string;
  ubicacion: string | null;
  capacidadMaxKg: number;
  cafeAlmacenadoKg: number;
  disponibleKg: number;
  ocupacionPct: number;
  activa: boolean;
  esPrincipal: boolean;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class BodegaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametrosService: ParametrosService,
  ) {}

  /**
   * Obtiene la configuración de bodega de una organización.
   */
  async obtenerConfiguracion(
    organizacionId: string,
  ): Promise<ConfiguracionBodega> {
    const [
      nombreBodega,
      capacidadKgStr,
      maxPesoKgStr,
      maxPrecioKgStr,
      maxPrecioVentaKgStr,
    ] = await Promise.all([
      this.parametrosService.getParametroString(
        'nombre_bodega',
        organizacionId,
        'Bodega principal',
      ),
      this.parametrosService.getParametroString(
        'capacidad_bodega',
        organizacionId,
      ),
      this.parametrosService.getParametroString('max_peso_kg', organizacionId),
      this.parametrosService.getParametroString(
        'max_precio_kg',
        organizacionId,
      ),
      this.parametrosService.getParametroString(
        'max_precio_venta_kg',
        organizacionId,
      ),
    ]);

    const parsed = Number(capacidadKgStr);
    const capacidadKg =
      capacidadKgStr && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    const parsedMaxPeso = Number(maxPesoKgStr);
    const maxPesoKg =
      maxPesoKgStr &&
      Number.isFinite(parsedMaxPeso) &&
      parsedMaxPeso > 0 &&
      parsedMaxPeso <= PESO_MAXIMO_ENTRADA_KG
        ? parsedMaxPeso
        : PESO_MAXIMO_OPERATIVO_DEFAULT_KG;
    const parsedMaxPrecio = Number(maxPrecioKgStr);
    const maxPrecioKg =
      maxPrecioKgStr && Number.isFinite(parsedMaxPrecio) && parsedMaxPrecio > 0
        ? parsedMaxPrecio
        : 100000;
    const parsedMaxPrecioVenta = Number(maxPrecioVentaKgStr);
    const maxPrecioVentaKg =
      maxPrecioVentaKgStr &&
      Number.isFinite(parsedMaxPrecioVenta) &&
      parsedMaxPrecioVenta > 0
        ? parsedMaxPrecioVenta
        : 100000;

    return {
      nombreBodega: nombreBodega || 'Bodega principal',
      capacidadKg,
      maxPesoKg,
      maxPrecioKg,
      maxPrecioVentaKg,
      updatedAt: new Date().toISOString(),
    };
  }

  async listarBodegas(organizacionId: string): Promise<BodegaItem[]> {
    await this.ensureBodegaPrincipal(organizacionId);
    const bodegas = await this.prisma.bodega.findMany({
      where: { organizacionId, deletedAt: null },
      orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'asc' }],
    });
    const inventarioPrincipal = await this.obtenerInventarioActualKg(
      organizacionId,
    );

    return bodegas.map((bodega) =>
      this.mapBodega(
        bodega,
        bodega.esPrincipal ? inventarioPrincipal : 0,
      ),
    );
  }

  async obtenerBodega(
    organizacionId: string,
    bodegaId: string,
  ): Promise<BodegaItem> {
    await this.ensureBodegaPrincipal(organizacionId);
    const bodega = await this.prisma.bodega.findFirst({
      where: { id: bodegaId, organizacionId, deletedAt: null },
    });
    if (!bodega) {
      throw new NotFoundException(
        apiError('BODEGA_NO_ENCONTRADA', 'No encontramos esta bodega.'),
      );
    }
    const inventarioPrincipal = bodega.esPrincipal
      ? await this.obtenerInventarioActualKg(organizacionId)
      : 0;
    return this.mapBodega(bodega, inventarioPrincipal);
  }

  async crearBodega(
    organizacionId: string,
    dto: CrearBodegaDto,
  ): Promise<BodegaItem> {
    const nombre = this.normalizeNombre(dto.nombre);
    const ubicacion = this.normalizeUbicacion(dto.ubicacion);
    const capacidadMaxKg = this.normalizeCapacidad(dto.capacidadMaxKg);
    const existingCount = await this.prisma.bodega.count({
      where: { organizacionId, deletedAt: null },
    });
    const esPrincipal = dto.esPrincipal === true || existingCount === 0;

    const bodega = await this.prisma.$transaction(async (tx) => {
      if (esPrincipal) {
        await tx.bodega.updateMany({
          where: { organizacionId, deletedAt: null },
          data: { esPrincipal: false },
        });
      }

      return tx.bodega.create({
        data: {
          organizacionId,
          nombre,
          ubicacion,
          capacidadMaxKg,
          activa: dto.activa ?? true,
          esPrincipal,
        },
      });
    });

    return this.mapBodega(bodega, esPrincipal ? await this.obtenerInventarioActualKg(organizacionId) : 0);
  }

  async editarBodega(
    organizacionId: string,
    bodegaId: string,
    dto: EditarBodegaDto,
  ): Promise<BodegaItem> {
    const actual = await this.prisma.bodega.findFirst({
      where: { id: bodegaId, organizacionId, deletedAt: null },
    });
    if (!actual) {
      throw new NotFoundException(
        apiError('BODEGA_NO_ENCONTRADA', 'No encontramos esta bodega.'),
      );
    }

    const inventarioActual = actual.esPrincipal
      ? await this.obtenerInventarioActualKg(organizacionId)
      : 0;
    const capacidadMaxKg =
      typeof dto.capacidadMaxKg === 'number'
        ? this.normalizeCapacidad(dto.capacidadMaxKg)
        : undefined;

    if (
      typeof capacidadMaxKg === 'number' &&
      capacidadMaxKg < inventarioActual
    ) {
      throw new BadRequestException(
        apiError(
          'BODEGA_CAPACIDAD_MENOR_A_INVENTARIO',
          'La capacidad no puede ser menor al café almacenado actualmente.',
          { field: 'capacidadMaxKg' },
        ),
      );
    }

    const nextPrincipal = dto.esPrincipal === true;
    const bodega = await this.prisma.$transaction(async (tx) => {
      if (nextPrincipal) {
        await tx.bodega.updateMany({
          where: { organizacionId, deletedAt: null, id: { not: bodegaId } },
          data: { esPrincipal: false },
        });
      }

      return tx.bodega.update({
        where: { id: bodegaId },
        data: {
          ...(typeof dto.nombre === 'string'
            ? { nombre: this.normalizeNombre(dto.nombre) }
            : {}),
          ...(typeof dto.ubicacion !== 'undefined'
            ? { ubicacion: this.normalizeUbicacion(dto.ubicacion) }
            : {}),
          ...(typeof capacidadMaxKg === 'number' ? { capacidadMaxKg } : {}),
          ...(typeof dto.activa === 'boolean' ? { activa: dto.activa } : {}),
          ...(nextPrincipal ? { esPrincipal: true } : {}),
        },
      });
    });

    if (bodega.esPrincipal) {
      await this.sincronizarParametrosBodegaPrincipal(organizacionId, bodega);
    }

    return this.mapBodega(
      bodega,
      bodega.esPrincipal ? await this.obtenerInventarioActualKg(organizacionId) : 0,
    );
  }

  async eliminarBodega(organizacionId: string, bodegaId: string) {
    const bodegas = await this.prisma.bodega.findMany({
      where: { organizacionId, deletedAt: null },
      orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'asc' }],
    });
    if (bodegas.length <= 1) {
      throw new ConflictException(
        apiError(
          'BODEGA_UNICA_NO_ELIMINABLE',
          'No puedes eliminar la única bodega registrada.',
        ),
      );
    }

    const bodega = bodegas.find((item) => item.id === bodegaId);
    if (!bodega) {
      throw new NotFoundException(
        apiError('BODEGA_NO_ENCONTRADA', 'No encontramos esta bodega.'),
      );
    }

    const inventarioActual = bodega.esPrincipal
      ? await this.obtenerInventarioActualKg(organizacionId)
      : 0;
    if (inventarioActual > 0) {
      throw new ConflictException(
        apiError(
          'BODEGA_CON_INVENTARIO_ACTIVO',
          'No puedes eliminar esta bodega porque tiene inventario activo.',
        ),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.bodega.update({
        where: { id: bodegaId },
        data: { deletedAt: new Date(), activa: false, esPrincipal: false },
      });

      if (bodega.esPrincipal) {
        const replacement = bodegas.find((item) => item.id !== bodegaId);
        if (replacement) {
          await tx.bodega.update({
            where: { id: replacement.id },
            data: { esPrincipal: true, activa: true },
          });
        }
      }
    });

    return { ok: true };
  }

  /**
   * Actualiza la configuración de bodega de una organización.
   */
  async actualizarConfiguracion(
    organizacionId: string,
    dto: ActualizarBodegaDto,
  ): Promise<ConfiguracionBodega> {
    // Validaciones
    if (!dto.nombreBodega || dto.nombreBodega.trim().length === 0) {
      throw new BadRequestException('El nombre de la bodega es requerido');
    }

    if (!Number.isFinite(dto.capacidadKg) || dto.capacidadKg <= 0) {
      throw new BadRequestException('La capacidad debe ser un número positivo');
    }

    // Guardar en base de datos
    await Promise.all([
      this.parametrosService.setParametro(
        'nombre_bodega',
        dto.nombreBodega.trim(),
        organizacionId,
      ),
      this.parametrosService.setParametro(
        'capacidad_bodega',
        dto.capacidadKg.toString(),
        organizacionId,
      ),
    ]);

    return {
      nombreBodega: dto.nombreBodega.trim(),
      capacidadKg: dto.capacidadKg,
      maxPesoKg: PESO_MAXIMO_OPERATIVO_DEFAULT_KG,
      maxPrecioKg: 100000,
      maxPrecioVentaKg: 100000,
      updatedAt: new Date().toISOString(),
    };
  }

  async actualizarLimites(
    organizacionId: string,
    maxPesoKg: number,
    maxPrecioKg: number,
    maxPrecioVentaKg: number,
  ): Promise<{
    maxPesoKg: number;
    maxPrecioKg: number;
    maxPrecioVentaKg: number;
  }> {
    if (
      !Number.isFinite(maxPesoKg) ||
      maxPesoKg < PESO_MINIMO_KG ||
      maxPesoKg > PESO_MAXIMO_ENTRADA_KG
    ) {
      throw new BadRequestException(
        `El peso máximo debe estar entre ${PESO_MINIMO_KG} y ${PESO_MAXIMO_ENTRADA_KG} kg`,
      );
    }

    if (!Number.isFinite(maxPrecioKg) || maxPrecioKg <= 0) {
      throw new BadRequestException(
        'El precio máximo de compra debe ser mayor que 0',
      );
    }

    if (!Number.isFinite(maxPrecioVentaKg) || maxPrecioVentaKg <= 0) {
      throw new BadRequestException(
        'El precio máximo de venta debe ser mayor que 0',
      );
    }

    await Promise.all([
      this.parametrosService.setParametro(
        'max_peso_kg',
        maxPesoKg.toString(),
        organizacionId,
      ),
      this.parametrosService.setParametro(
        'max_precio_kg',
        maxPrecioKg.toString(),
        organizacionId,
      ),
      this.parametrosService.setParametro(
        'max_precio_venta_kg',
        maxPrecioVentaKg.toString(),
        organizacionId,
      ),
    ]);

    return { maxPesoKg, maxPrecioKg, maxPrecioVentaKg };
  }

  private async ensureBodegaPrincipal(organizacionId: string) {
    const existing = await this.prisma.bodega.findFirst({
      where: { organizacionId, deletedAt: null },
      select: { id: true },
    });
    if (existing) return;

    const config = await this.obtenerConfiguracion(organizacionId);
    await this.prisma.bodega.create({
      data: {
        organizacionId,
        nombre: config.nombreBodega || 'Bodega principal',
        capacidadMaxKg: config.capacidadKg ?? 3000,
        ubicacion: null,
        activa: true,
        esPrincipal: true,
      },
    });
  }

  private normalizeNombre(value: string) {
    const nombre = String(value ?? '').trim().replace(/\s+/g, ' ');
    if (!nombre || nombre.length < 2) {
      throw new BadRequestException(
        apiError('BODEGA_NOMBRE_REQUERIDO', 'Ingresa el nombre de la bodega.', {
          field: 'nombre',
        }),
      );
    }
    return nombre.slice(0, 80);
  }

  private normalizeUbicacion(value?: string | null) {
    const ubicacion = String(value ?? '').trim().replace(/\s+/g, ' ');
    return ubicacion ? ubicacion.slice(0, 120) : null;
  }

  private normalizeCapacidad(value: number) {
    const capacidad = Number(value);
    if (!Number.isFinite(capacidad)) {
      throw new BadRequestException(
        apiError(
          'BODEGA_CAPACIDAD_REQUERIDA',
          'Ingresa la capacidad máxima de la bodega.',
          { field: 'capacidadMaxKg' },
        ),
      );
    }
    if (capacidad <= 0) {
      throw new BadRequestException(
        apiError(
          'BODEGA_CAPACIDAD_INVALIDA',
          'La capacidad debe ser mayor que 0 kg.',
          { field: 'capacidadMaxKg' },
        ),
      );
    }
    return new Prisma.Decimal(capacidad);
  }

  private async obtenerInventarioActualKg(organizacionId: string) {
    const result = await this.prisma.inventario.aggregate({
      where: { organizacionId },
      _sum: { pesoTotal: true },
    });
    return Number(result._sum.pesoTotal ?? 0);
  }

  private async sincronizarParametrosBodegaPrincipal(
    organizacionId: string,
    bodega: { nombre: string; capacidadMaxKg: Prisma.Decimal | number },
  ) {
    await Promise.all([
      this.parametrosService.setParametro(
        'nombre_bodega',
        bodega.nombre,
        organizacionId,
      ),
      this.parametrosService.setParametro(
        'capacidad_bodega',
        String(Number(bodega.capacidadMaxKg)),
        organizacionId,
      ),
    ]);
  }

  private mapBodega(
    bodega: {
      id: string;
      nombre: string;
      ubicacion: string | null;
      capacidadMaxKg: Prisma.Decimal | number;
      activa: boolean;
      esPrincipal: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    cafeAlmacenadoKg: number,
  ): BodegaItem {
    const capacidadMaxKg = Number(bodega.capacidadMaxKg);
    const disponibleKg = Math.max(0, capacidadMaxKg - cafeAlmacenadoKg);
    const ocupacionPct =
      capacidadMaxKg > 0
        ? Math.min(100, Math.round((cafeAlmacenadoKg / capacidadMaxKg) * 100))
        : 0;
    return {
      id: bodega.id,
      nombre: bodega.nombre,
      ubicacion: bodega.ubicacion,
      capacidadMaxKg,
      cafeAlmacenadoKg,
      disponibleKg,
      ocupacionPct,
      activa: bodega.activa,
      esPrincipal: bodega.esPrincipal,
      createdAt: bodega.createdAt.toISOString(),
      updatedAt: bodega.updatedAt.toISOString(),
    };
  }
}
