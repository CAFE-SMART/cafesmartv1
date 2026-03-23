import { Injectable } from '@nestjs/common';
import { Prisma, RolUsuario } from '@prisma/client';
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

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(correo: string) {
    return this.prisma.user.findUnique({
      where: { correo },
    });
  }

  async create(data: CrearUsuarioData, tx?: Prisma.TransactionClient) {
    const prismaClient = tx ? tx : this.prisma;
    return prismaClient.user.create({
      data: {
        nombre: data.nombre,
        correo: data.correo,
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
      },
    });
  }
}
