// ============================================================
// auth.module.ts — Módulo de Autenticación
// ============================================================
// Agrupa todo lo relacionado con autenticación:
//   - AuthController  → define las rutas (/auth/register)
//   - AuthService     → contiene la lógica de negocio
//
// Importa UsersModule para poder usar UsersService
// (ya no necesita importar PrismaModule porque es @Global())
// ============================================================

import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule, // necesario para que AuthService acceda a UsersService
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
