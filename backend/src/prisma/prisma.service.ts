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
