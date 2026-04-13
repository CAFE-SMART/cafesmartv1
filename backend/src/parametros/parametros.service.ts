import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ParametrosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene un parámetro específico de una organización.
   * Valida existencia, valor no vacío y conversión numérica.
   * 
   * @param nombre Nombre del parámetro a consultar.
   * @param organizacionId UUID de la organización.
   * @returns El valor del parámetro convertido a número.
   * @throws InternalServerErrorException en cualquier caso de error.
   */
  async getParametro(nombre: string, organizacionId: string): Promise<number> {
    const parametro = await this.prisma.parametroOrganizacion.findUnique({
      where: {
        organizacionId_nombre: {
          organizacionId,
          nombre,
        },
      },
    });

    if (
      !parametro ||
      parametro.valor === null ||
      parametro.valor === undefined ||
      parametro.valor.trim() === ''
    ) {
      throw new InternalServerErrorException(
        `El parametro '${nombre}' no existe o esta vacio para la organizacion.`,
      );
    }

    const valorNumerico = Number(parametro.valor);

    if (Number.isNaN(valorNumerico)) {
      throw new InternalServerErrorException(
        `El parametro '${nombre}' no tiene un valor numerico valido: ${parametro.valor}`,
      );
    }

    return valorNumerico;
  }
}
