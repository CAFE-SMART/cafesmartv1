import { Injectable } from '@nestjs/common';
import { Prisma, RolUsuario, TipoOrganizacion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CrearUsuarioData = {
  nombre: string;
  correo: string;
  password: string | null;
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
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(correo: string) {
    return this.prisma.user.findUnique({
      where: { correo: correo.trim().toLowerCase() },
      select: {
        id: true,
        nombre: true,
        correo: true,
        password: true,
        telefono: true,
        rol: true,
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

  async findSessionById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nombre: true,
        correo: true,
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

  async create(data: CrearUsuarioData, tx?: Prisma.TransactionClient) {
    const prismaClient = tx ? tx : this.prisma;

    return prismaClient.user.create({
      data: {
        nombre: data.nombre,
        correo: data.correo.trim().toLowerCase(),
        password: data.password,
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
      },
    });
  }

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
        },
      });
    });
  }

  async linkGoogleAccount(userId: string, googleId: string) {
    void googleId;

    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        nombre: true,
        correo: true,
        telefono: true,
        rol: true,
        organizacionId: true,
      },
    });
  }
}
