/*
 * ========================================================
 * 📦 ARCHIVO: users.module.ts (El Empaque del Módulo de Usuarios)
 * ========================================================
 * ¿Para qué sirve?: Agrupa todo lo relacionado con usuarios en un solo
 * "paquete" que puede ser importado por otros módulos (especialmente por
 * AuthModule para poder buscar usuarios durante el login).
 *
 * ¿Qué se declara aquí?:
 *   - UsersController
 *   - UsersService (el user.services.ts)
 *   - Se exporta UsersService para que AuthModule lo pueda usar
 *
 * ¿Debo editarlo?: ✅ SÍ, pero solo al inicio. Una vez declarados el
 * controller y service, no se vuelve a tocar.
 *
 * ⚠️ Recuerda importar este módulo en app.module.ts.
 */

import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from './user.services';

@Module({
	providers: [UsersService, PrismaService],
	exports: [UsersService],
})
export class UsersModule {}
