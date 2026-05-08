import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParametrosService } from '../parametros/parametros.service';
import { ActualizarBodegaDto } from './dto/actualizar-bodega.dto';

export type ConfiguracionBodega = {
  nombreBodega: string;
  capacidadKg: number | null;
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
    const [nombreBodega, capacidadKgStr] = await Promise.all([
      this.parametrosService.getParametroString(
        'nombre_bodega',
        organizacionId,
        'Bodega principal',
      ),
      this.parametrosService.getParametroString(
        'capacidad_bodega',
        organizacionId,
      ),
    ]);

    const parsed = Number(capacidadKgStr);
    const capacidadKg =
      capacidadKgStr && Number.isFinite(parsed) && parsed > 0 ? parsed : null;

    return {
      nombreBodega: nombreBodega || 'Bodega principal',
      capacidadKg,
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
      updatedAt: new Date().toISOString(),
    };
  }
}
