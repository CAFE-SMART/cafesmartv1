import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParametrosService } from '../parametros/parametros.service';
import { ActualizarBodegaDto } from './dto/actualizar-bodega.dto';
import {
  PESO_MAXIMO_ENTRADA_KG,
  PESO_MAXIMO_OPERATIVO_DEFAULT_KG,
  PESO_MINIMO_KG,
  PRECIO_MINIMO_KG,
} from '../common/business-rules';

const CAPACIDAD_BODEGA_MAX_KG = 999999;
const MAX_PESO_ENTRADA_KG = PESO_MAXIMO_ENTRADA_KG;
const MAX_PESO_OPERATIVO_DEFAULT_KG = PESO_MAXIMO_OPERATIVO_DEFAULT_KG;
const CAPACIDAD_BODEGA_INVALIDA = 'Ingresa una capacidad de bodega válida.';
const CAPACIDAD_BODEGA_MENOR_INVENTARIO =
  'La capacidad no puede ser menor al café almacenado actualmente.';

export type ConfiguracionBodega = {
  nombreBodega: string;
  capacidadKg: number | null;
  minPesoKg: number;
  maxPesoKg: number;
  minPrecioKg: number;
  maxPrecioKg: number;
  minPrecioVentaKg: number;
  maxPrecioVentaKg: number;
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
      minPesoKgStr,
      maxPesoKgStr,
      minPrecioKgStr,
      maxPrecioKgStr,
      minPrecioVentaKgStr,
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
      this.parametrosService.getParametroString('min_peso_kg', organizacionId),
      this.parametrosService.getParametroString('max_peso_kg', organizacionId),
      this.parametrosService.getParametroString(
        'min_precio_kg',
        organizacionId,
      ),
      this.parametrosService.getParametroString(
        'max_precio_kg',
        organizacionId,
      ),
      this.parametrosService.getParametroString(
        'min_precio_venta_kg',
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

    const parsedMinPeso = Number(minPesoKgStr);
    const minPesoKg =
      minPesoKgStr && Number.isFinite(parsedMinPeso) && parsedMinPeso > 0
        ? parsedMinPeso
        : PESO_MINIMO_KG;

    const defaultMaxPeso = MAX_PESO_OPERATIVO_DEFAULT_KG;
    const parsedMaxPeso = Number(maxPesoKgStr);
    const maxPesoKg =
      maxPesoKgStr &&
      Number.isFinite(parsedMaxPeso) &&
      parsedMaxPeso > 0 &&
      parsedMaxPeso <= MAX_PESO_ENTRADA_KG
        ? parsedMaxPeso
        : defaultMaxPeso;

    const parsedMinPrecio = Number(minPrecioKgStr);
    const minPrecioKg =
      minPrecioKgStr && Number.isFinite(parsedMinPrecio) && parsedMinPrecio > 0
        ? parsedMinPrecio
        : PRECIO_MINIMO_KG;

    const parsedMaxPrecio = Number(maxPrecioKgStr);
    const maxPrecioKg =
      maxPrecioKgStr && Number.isFinite(parsedMaxPrecio) && parsedMaxPrecio > 0
        ? parsedMaxPrecio
        : 100000;

    const parsedMinPrecioVenta = Number(minPrecioVentaKgStr);
    const minPrecioVentaKg =
      minPrecioVentaKgStr &&
      Number.isFinite(parsedMinPrecioVenta) &&
      parsedMinPrecioVenta > 0
        ? parsedMinPrecioVenta
        : PRECIO_MINIMO_KG;

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
      minPesoKg,
      maxPesoKg,
      minPrecioKg,
      maxPrecioKg,
      minPrecioVentaKg,
      maxPrecioVentaKg,
      updatedAt: new Date().toISOString(),
    };
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

    if (
      !Number.isFinite(dto.capacidadKg) ||
      dto.capacidadKg <= 0 ||
      dto.capacidadKg > CAPACIDAD_BODEGA_MAX_KG
    ) {
      throw new BadRequestException(CAPACIDAD_BODEGA_INVALIDA);
    }

    const inventarioActualKg =
      await this.obtenerInventarioActualKg(organizacionId);

    if (dto.capacidadKg < inventarioActualKg) {
      throw new BadRequestException(CAPACIDAD_BODEGA_MENOR_INVENTARIO);
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

    return this.obtenerConfiguracion(organizacionId);
  }

  private async obtenerInventarioActualKg(
    organizacionId: string,
  ): Promise<number> {
    const inventario = await this.prisma.sublote.aggregate({
      where: {
        deletedAt: null,
        compra: {
          organizacionId,
          deletedAt: null,
        },
      },
      _sum: { pesoActual: true },
    });

    const pesoTotal = Number(inventario._sum.pesoActual ?? 0);
    return Number.isFinite(pesoTotal) ? pesoTotal : 0;
  }

  /**
   * Actualiza los límites de entrada de una organización.
   */
  async actualizarLimites(
    organizacionId: string,
    minPesoKg: number,
    maxPesoKg: number,
    minPrecioKg: number,
    maxPrecioKg: number,
    minPrecioVentaKg: number,
    maxPrecioVentaKg: number,
  ): Promise<{
    minPesoKg: number;
    maxPesoKg: number;
    minPrecioKg: number;
    maxPrecioKg: number;
    minPrecioVentaKg: number;
    maxPrecioVentaKg: number;
  }> {
    if (!Number.isFinite(minPesoKg) || minPesoKg <= 0) {
      throw new BadRequestException(
        'El peso mínimo debe ser un número positivo',
      );
    }

    if (
      !Number.isFinite(maxPesoKg) ||
      maxPesoKg < minPesoKg ||
      maxPesoKg > MAX_PESO_ENTRADA_KG
    ) {
      throw new BadRequestException(
        `El peso máximo debe estar entre el peso mínimo (${minPesoKg} kg) y ${MAX_PESO_ENTRADA_KG} kg`,
      );
    }

    if (!Number.isFinite(minPrecioKg) || minPrecioKg <= 0) {
      throw new BadRequestException(
        'El precio mínimo de compra debe ser un número positivo',
      );
    }

    if (!Number.isFinite(maxPrecioKg) || maxPrecioKg < minPrecioKg) {
      throw new BadRequestException(
        'El precio máximo de compra debe ser mayor o igual al precio mínimo',
      );
    }

    if (!Number.isFinite(minPrecioVentaKg) || minPrecioVentaKg <= 0) {
      throw new BadRequestException(
        'El precio mínimo de venta debe ser un número positivo',
      );
    }

    if (
      !Number.isFinite(maxPrecioVentaKg) ||
      maxPrecioVentaKg < minPrecioVentaKg
    ) {
      throw new BadRequestException(
        'El precio máximo de venta debe ser mayor o igual al precio mínimo',
      );
    }

    await Promise.all([
      this.parametrosService.setParametro(
        'min_peso_kg',
        minPesoKg.toString(),
        organizacionId,
      ),
      this.parametrosService.setParametro(
        'max_peso_kg',
        maxPesoKg.toString(),
        organizacionId,
      ),
      this.parametrosService.setParametro(
        'min_precio_kg',
        minPrecioKg.toString(),
        organizacionId,
      ),
      this.parametrosService.setParametro(
        'max_precio_kg',
        maxPrecioKg.toString(),
        organizacionId,
      ),
      this.parametrosService.setParametro(
        'min_precio_venta_kg',
        minPrecioVentaKg.toString(),
        organizacionId,
      ),
      this.parametrosService.setParametro(
        'max_precio_venta_kg',
        maxPrecioVentaKg.toString(),
        organizacionId,
      ),
    ]);

    return {
      minPesoKg,
      maxPesoKg,
      minPrecioKg,
      maxPrecioKg,
      minPrecioVentaKg,
      maxPrecioVentaKg,
    };
  }
}
