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

import {
  Body,
  Controller,
  Delete,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';

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
      descripcionOrganizacion?: string | null;
      descripcion?: string | null;
    },
    @Req() req: { user: { sub: string } },
  ) {
    return this.usersService.updateOrganizationSettings(req.user.sub, dto);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @Body() dto: ActualizarPerfilDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.usersService.updateProfile(req.user.sub, dto);
  }

  @Post('profile/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  uploadAvatar(
    @UploadedFile() file: any,
    @Req() req: { user: { sub: string } },
  ) {
    return this.usersService.uploadAvatar(req.user.sub, file);
  }

  @Delete('profile/avatar')
  @UseGuards(JwtAuthGuard)
  removeAvatar(@Req() req: { user: { sub: string } }) {
    return this.usersService.removeAvatar(req.user.sub);
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
