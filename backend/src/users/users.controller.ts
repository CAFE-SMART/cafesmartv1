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
