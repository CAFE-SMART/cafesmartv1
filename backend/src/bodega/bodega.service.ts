import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParametrosService } from '../parametros/parametros.service';
import { ActualizarBodegaDto } from './dto/actualizar-bodega.dto';
import {
  PESO_MAXIMO_ENTRADA_KG,
  PESO_MAXIMO_OPERATIVO_DEFAULT_KG,
  PESO_MINIMO_KG,
} from '../common/business-rules';

export type ConfiguracionBodega = {
  nombreBodega: string;
  capacidadKg: number | null;
  maxPesoKg: number;
  maxPrecioKg: number;
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
}
