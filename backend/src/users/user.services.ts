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
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, RolUsuario } from '@prisma/client';

// Tipo para los datos de creación de usuario
// Prisma.TransactionClient permite ejecutar dentro de una transacción
type CrearUsuarioData = {
  nombre: string;
  correo: string;
  password: string; 
  telefono: string;
  rol: RolUsuario;
  organizacionId: number;
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ----------------------------------------------------------
  // findByEmail
  // Busca un usuario por su correo electrónico.
  // Retorna null si no existe (no lanza error).
  // Se usa en AuthService para verificar si el correo ya existe.
  // ----------------------------------------------------------
  async findByEmail(correo: string) {
    return this.prisma.user.findUnique({
      where: { correo },
    });
  }

  // ----------------------------------------------------------
  // create
  // Crea un nuevo usuario en la base de datos.
  // Recibe un cliente de transacción (tx) para garantizar
  // consistencia: si algo falla, la operación se revierte.
  // ----------------------------------------------------------
  async create(data: CrearUsuarioData, tx: Prisma.TransactionClient) {
    return tx.user.create({
      data: {
        nombre: data.nombre,
        correo: data.correo,
        password: data.password,
        telefono: data.telefono,
        rol: data.rol,
        organizacionId: data.organizacionId,
      },
      // Solo retornamos los campos seguros (nunca el password)
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

/*
 * ========================================================
 * 🧠 ARCHIVO: user.services.ts (El Asistente de Usuarios)
 * ========================================================
 * ¿Para qué sirve?: Contiene la lógica de acceso a la tabla "User" en la
 * base de datos. Cualquier parte del backend que necesite buscar, crear
 * o modificar un usuario, llama a este servicio.
 *
 * Funciones que vivirán aquí:
 *   - findByEmail(email)  →  Buscar un usuario por su correo (para el login)
 *   - create(data)        →  Crear un usuario nuevo (para el registro)
 *
 * ¿Debo editarlo?: ✅ SÍ. La compañera de Backend debe implementar
 * las funciones de crear y buscar usuarios usando Prisma.
 *
 * ⚠️ Este servicio NO encripta contraseñas. Eso lo hace el AuthService.
 * Este servicio solo guarda y lee de la base de datos tal cual.
 */