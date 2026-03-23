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

/*
 * ========================================================
 * 📦 ARCHIVO: auth.module.ts (El Empaque del Módulo de Autenticación)
 * ========================================================
 * ¿Para qué sirve?: En NestJS, cada funcionalidad del sistema se organiza
 * en "Módulos". Este archivo es el que empaca todo lo relacionado con
 * autenticación (el Controller, el Service y las librerías de JWT).
 *
 * ¿Qué se importa aquí?:
 *   - JwtModule (para poder generar y validar tokens)
 *   - UsersModule (para poder buscar usuarios al hacer login)
 *   - El propio AuthController y AuthService
 *
 * ¿Debo editarlo?: ✅ SÍ, pero solo para agregar dependencias. Una vez
 * configurado correctamente, generalmente no se toca más.
 *
 * ⚠️ No olvides importar este módulo en app.module.ts para que funcione.
 */