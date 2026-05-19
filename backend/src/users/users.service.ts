import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, RolUsuario, TipoOrganizacion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { apiError } from '../common/errors/api-error';

type CrearUsuarioData = {
  nombre: string;
  correo: string;
  password: string | null;
  googleId?: string | null;
  telefono: string;
  rol: RolUsuario;
  organizacionId: string;
};

type CreateAdminWithOrganizationInput = {
  nombreOrganizacion: string;
  tipoOrganizacion: TipoOrganizacion;
  otroTipoDetalle?: string | null;
  nombre: string;
  correo: string;
  telefono: string;
  password: string;
  googleId?: string | null;
};

type UpdateOrganizationSettingsInput = {
  nombreOrganizacion: string;
  tipoOrganizacion: string;
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Busca un usuario por correo normalizando mayusculas y espacios.
   */
  async findByEmail(correo: string) {
    const normalizedEmail = correo.trim().toLowerCase();

    return this.prisma.user.findFirst({
      where: {
        correo: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
      include: {
        organizacion: {
          select: {
            id: true,
            nombre: true,
            tipo: true,
            otroTipoDetalle: true,
          },
        },
      },
    });
  }

  async findSessionById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nombre: true,
        correo: true,
        telefono: true,
        organizacionId: true,
        organizacion: {
          select: {
            id: true,
            nombre: true,
            tipo: true,
            otroTipoDetalle: true,
          },
        },
      },
    });
  }

  async findPasswordById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
      },
    });
  }

  async updatePassword(userId: string, hashedPassword: string) {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
        select: { id: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return null;
      }

      throw error;
    }
  }

  /**
   * Crea un usuario en la transaccion actual o en el cliente principal si no se provee una.
   */
  async create(data: CrearUsuarioData, tx?: Prisma.TransactionClient) {
    const prismaClient = tx ? tx : this.prisma;
    return prismaClient.user.create({
      data: {
        nombre: data.nombre,
        correo: data.correo.trim().toLowerCase(),
        password: data.password,
        googleId: data.googleId,
        telefono: data.telefono,
        rol: data.rol,
        organizacionId: data.organizacionId,
      },
      select: {
        id: true,
        nombre: true,
        correo: true,
        telefono: true,
        rol: true,
        organizacionId: true,
        googleId: true,
      },
    });
  }

  /**
   * Registra la organizacion inicial y su administrador dentro de una misma transaccion.
   */
  async createAdminWithOrganization(input: CreateAdminWithOrganizationInput) {
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          nombre: input.nombreOrganizacion,
          tipo: input.tipoOrganizacion,
          otroTipoDetalle: input.otroTipoDetalle ?? null,
        },
      });

      return tx.user.create({
        data: {
          nombre: input.nombre,
          correo: input.correo.trim().toLowerCase(),
          telefono: input.telefono,
          password: input.password,
          googleId: input.googleId ?? null,
          rol: RolUsuario.ADMIN,
          organizacionId: organization.id,
        },
        select: {
          id: true,
          nombre: true,
          correo: true,
          telefono: true,
          rol: true,
          organizacionId: true,
          googleId: true,
        },
      });
    });
  }

  async linkGoogleAccount(userId: string, googleId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { googleId },
      select: {
        id: true,
        nombre: true,
        correo: true,
        telefono: true,
        rol: true,
        organizacionId: true,
        googleId: true,
      },
    });
  }

  async updateProfile(
    userId: string,
    input: {
      nombre: string;
      correo: string;
      telefono?: string | null;
    },
  ) {
    const nombre = input.nombre.trim();
    const correo = input.correo.trim().toLowerCase();
    const telefono = input.telefono?.trim() ?? '';

    if (!nombre) {
      throw new BadRequestException(
        apiError('USUARIO_NOMBRE_REQUERIDO', 'Escribe tu nombre.'),
      );
    }

    if (!correo) {
      throw new BadRequestException(
        apiError('USUARIO_CORREO_REQUERIDO', 'Escribe un correo electrónico.'),
      );
    }

    try {
      return this.prisma.user.update({
        where: { id: userId },
        data: {
          nombre,
          correo,
          telefono,
        },
        select: {
          id: true,
          nombre: true,
          correo: true,
          telefono: true,
          organizacionId: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          apiError('USUARIO_CORREO_DUPLICADO', 'El correo ya está en uso.'),
        );
      }

      throw error;
    }
  }

  async updateOrganizationSettings(
    userId: string,
    input: UpdateOrganizationSettingsInput,
  ) {
    const nombre = input.nombreOrganizacion.trim();
    const tipo = this.normalizeTipoOrganizacion(input.tipoOrganizacion);

    if (!nombre) {
      throw new BadRequestException(
        apiError('ORGANIZACION_NOMBRE_REQUERIDO', 'Escribe el nombre de la empresa.'),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { organizacionId: true },
      });

      if (!user?.organizacionId) {
        throw new BadRequestException(
          apiError('ORGANIZACION_REQUERIDA', 'Usuario sin organizacion.'),
        );
      }

      return tx.organization.update({
        where: { id: user.organizacionId },
        data: {
          nombre,
          tipo,
        },
        select: {
          id: true,
          nombre: true,
          tipo: true,
          otroTipoDetalle: true,
        },
      });
    });
  }

  private normalizeTipoOrganizacion(value: string): TipoOrganizacion {
    const normalized = value.trim().toUpperCase();

    if (normalized.includes('COOPERATIVA')) return TipoOrganizacion.COOPERATIVA;
    if (normalized.includes('COMPRAVENTA')) return TipoOrganizacion.COMPRAVENTA;
    if (normalized === 'OTRO') return TipoOrganizacion.OTRO;

    return TipoOrganizacion.OTRO;
  }
}
