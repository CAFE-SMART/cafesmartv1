
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Servicio central de Prisma para toda la app.
// Abre la conexión al iniciar el módulo y la cierra al destruirse,
// evitando conexiones colgadas con Supabase.
@Injectable() export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy
{
  // Se ejecuta cuando Nest inicializa el módulo.
  async onModuleInit() {
    await this.$connect();
  }

  // Se ejecuta cuando Nest destruye el módulo (apagado/restart).
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
