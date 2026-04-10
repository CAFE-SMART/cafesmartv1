import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ParametrosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene un parametro numerico por organizacion y valida que tenga contenido util.
   *
   * @param nombre Nombre del parametro a consultar.
   * @param organizacionId UUID de la organizacion.
   * @returns El valor del parametro convertido a numero.
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
