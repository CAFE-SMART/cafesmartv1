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

import { Controller } from '@nestjs/common';
import { UsersService } from './user.services';

@Controller('users') // prefijo base: /users
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Las rutas de gestión de usuarios se agregarán en futuras
  // iteraciones del proyecto (perfil, listado, etc.)
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