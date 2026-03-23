// ============================================================
// users.service.ts — Lógica de acceso a la tabla de usuarios
// ============================================================
// Este servicio se encarga ÚNICAMENTE de leer y escribir
// usuarios en la base de datos. NO contiene lógica de negocio
// como encriptación de contraseñas.
//
// Principio de responsabilidad única (SRP):
//   - UsersService  → acceso a datos de usuario
//   - AuthService   → lógica de negocio de autenticación
// ============================================================

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

  async create(data: CrearUsuarioData, tx: Prisma.TransactionClient) {
    return tx.user.create({
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
