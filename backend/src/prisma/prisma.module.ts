// ============================================================
// prisma.module.ts — Módulo Global de Base de Datos
// ============================================================
// Al marcarlo como @Global(), PrismaService queda disponible
// en todo el backend sin necesidad de importarlo módulo a módulo.
//
// Solo se importa UNA VEZ en app.module.ts y listo.
// ============================================================

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // disponible en todos los módulos automáticamente
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // permite que otros módulos lo inyecten
})
export class PrismaModule {}
