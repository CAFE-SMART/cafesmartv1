// ============================================================
// prisma.service.ts — El Cable a la Base de Datos
// ============================================================
// Este archivo crea una sola conexión con la base de datos
// y la comparte con todo el backend. Es como el enchufe
// central: se instala una vez y todos lo usan.
//
// ¿Cómo se inyecta en otro servicio?
//   constructor(private prisma: PrismaService) {}
//   await this.prisma.user.findMany()
// ============================================================

import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  // Se ejecuta automáticamente cuando NestJS levanta el módulo.
  // Abre la conexión con la base de datos.
  async onModuleInit() {
    await this.$connect();
  }
}

/*
 * ========================================================
 * 🔌 ARCHIVO: prisma.service.ts (El Cable a la Base de Datos)
 * ========================================================
 * ¿Para qué sirve?: Es el único archivo que se conecta directamente a la
 * base de datos usando Prisma. Todos los servicios del backend (auth, users,
 * lotes, ventas) usarán ESTE archivo para hablar con la base de datos.
 *
 * Es como un enchufe: se instala una sola vez y todos los que necesitan
 * electricidad (datos) lo usan.
 *
 * ¿Debo editarlo?: ⛔ NO. Este archivo se crea una vez y no se modifica.
 * Solo se inyecta (importa) en los módulos que lo necesiten.
 *
 * ¿Cómo se usa en otro servicio?:
 *   constructor(private prisma: PrismaService) {}
 *   // Luego puedes usar: this.prisma.user.findMany()
 */