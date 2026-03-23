// ============================================================
// users.module.ts — Módulo de Usuarios
// ============================================================
// Agrupa el controlador y servicio de usuarios en un módulo
// que puede ser importado por otros módulos del sistema
// (especialmente AuthModule para buscar usuarios al hacer login).
// ============================================================

import { Module } from '@nestjs/common';
import { UsersService } from './user.services';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // AuthModule puede usar UsersService
})
export class UsersModule {}
