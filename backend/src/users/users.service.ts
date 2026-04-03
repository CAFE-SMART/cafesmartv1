import { Injectable } from '@nestjs/common';
import { Prisma, RolUsuario, TipoOrganizacion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CrearUsuarioData = {
  nombre: string;
  correo: string;
  password: string | null;
  googleId?: string | null;
  telefono: string;
  rol: RolUsuario;
  organizacionId: number;
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

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(correo: string) {
    return this.prisma.user.findUnique({
      where: { correo: correo.trim().toLowerCase() },
    });
  }

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

  async linkGoogleAccount(userId: number, googleId: string) {
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
}
