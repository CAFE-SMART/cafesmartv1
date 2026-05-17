// ============================================================
// users.controller.ts — Controlador de Gestión de Usuarios
// ============================================================
// Rutas para gestionar el perfil de los usuarios autenticados.
// Nota: el REGISTRO no va aquí, va en auth.controller.ts
//
// Rutas futuras:
//   GET /users/me     →  Ver perfil del usuario logueado
//   GET /users        →  Listar usuarios de la organización (solo ADMIN)
// ============================================================

import { Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('users') // prefijo base: /users
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Patch('organization')
  @UseGuards(JwtAuthGuard)
  updateOrganization(
    @Body()
    dto: {
      nombreOrganizacion: string;
      tipoOrganizacion: string;
    },
    @Req() req: { user: { sub: string } },
  ) {
    return this.usersService.updateOrganizationSettings(req.user.sub, dto);
  }
}

/*
 * ========================================================
 * 🚪 ARCHIVO: users.controller.ts (Las Rutas del Módulo de Usuarios)
 * ========================================================
 * ¿Para qué sirve?: Define las rutas HTTP relacionadas directamente con
 * los usuarios (no con la autenticación). Por ejemplo: obtener el perfil
 * del usuario logueado, o listar todos los usuarios (solo admin).
 *
 * Rutas que podrían vivir aquí:
 *   GET  /users/me     →  Ver el perfil del usuario autenticado
 *   GET  /users        →  Listar todos los usuarios (solo ADMIN)
 *
 * ¿Debo editarlo?: ✅ SÍ, cuando necesiten agregar rutas de gestión
 * de usuarios más allá del login/registro.
 *
 * ⚠️ Las rutas de registro e inicio de sesión van en auth.controller.ts,
 * NO aquí. Este archivo es para gestión de perfiles de usuario.
 */
