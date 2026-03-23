// ============================================================
// auth.service.ts — El Cerebro del Registro
// ============================================================
// Aquí vive la lógica de negocio del registro:
//   1. Verificar que el correo no esté registrado
//   2. Iniciar una transacción en la base de datos
//      a. Crear la organización
//      b. Hashear la contraseña con bcrypt
//      c. Crear el usuario (ADMIN) vinculado a esa organización
//   3. Si algo falla → todo se revierte, nada se guarda
//   4. Retornar respuesta limpia (sin contraseña)
//
// El controlador NUNCA toca lógica. Solo llama a este servicio.
// ============================================================

import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { RolUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/user.services';
import { RegisterDto } from './dto/register.dto';
import { RegisterGoogleDto } from './dto/register-google.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

  // ----------------------------------------------------------
  // register
  // Registra una nueva organización y su primer usuario admin.
  // ----------------------------------------------------------
  async register(dto: RegisterDto) {
    const usuarioExistente = await this.usersService.findByEmail(dto.correo);
    if (usuarioExistente) {
      throw new ConflictException(
        'Ya existe una cuenta registrada con ese correo electrónico.',
      );
    }

    try {
      const resultado = await this.prisma.$transaction(async (tx) => {
        const organizacion = await tx.organization.create({
          data: {
            nombre: dto.nombreOrganizacion,
            tipo: dto.tipoOrganizacion,
            otroTipoDetalle: dto.otroTipoDetalle,
          },
        });

        const passwordHasheado = await bcrypt.hash(dto.password, 10);

        const usuario = await this.usersService.create(
          {
            nombre: dto.nombre,
            correo: dto.correo,
            password: passwordHasheado,
            telefono: dto.telefono,
            rol: RolUsuario.ADMIN,
            organizacionId: organizacion.id,
          },
          tx,
        );

        return { organizacion, usuario };
      });

      return {
        mensaje: 'Cuenta creada exitosamente. ¡Bienvenido a Café Smart!',
        organizacion: {
          id: resultado.organizacion.id,
          nombre: resultado.organizacion.nombre,
          tipo: resultado.organizacion.tipo,
        },
        usuario: {
          id: resultado.usuario.id,
          nombre: resultado.usuario.nombre,
          correo: resultado.usuario.correo,
          rol: resultado.usuario.rol,
        },
      };
    } catch (error) {
      if (error.status) throw error;

      throw new InternalServerErrorException(
        'Ocurrió un error al crear la cuenta. Por favor intenta de nuevo.',
      );
    }
  }

  // ----------------------------------------------------------
  // registerGoogle
  // Lógica para registrar un usuario que inició sesión con Google.
  // IMPORTANTE: En producción usarías google-auth-library para
  // validar el `googleToken` de forma segura.
  // ----------------------------------------------------------
  async registerGoogle(dto: RegisterGoogleDto) {
    const mockGoogleId = `google_user_${randomUUID()}`;

    const usuarioExistente = await this.usersService.findByEmail(dto.correo);
    if (usuarioExistente) {
      throw new ConflictException(
        'Ya existe una cuenta registrada con este correo.',
      );
    }

    try {
      const resultado = await this.prisma.$transaction(async (tx) => {
        const organizacion = await tx.organization.create({
          data: {
            nombre: dto.nombreOrganizacion,
            tipo: dto.tipoOrganizacion,
            otroTipoDetalle: dto.otroTipoDetalle,
          },
        });

        const usuario = await this.usersService.create(
          {
            nombre: dto.nombre,
            correo: dto.correo,
            password: null,
            googleId: mockGoogleId,
            telefono: dto.telefono,
            rol: RolUsuario.ADMIN,
            organizacionId: organizacion.id,
          },
          tx,
        );

        return { organizacion, usuario };
      });

      return {
        mensaje: 'Cuenta de Google registrada exitosamente. ¡Bienvenido!',
        organizacion: {
          id: resultado.organizacion.id,
          nombre: resultado.organizacion.nombre,
        },
        usuario: {
          id: resultado.usuario.id,
          nombre: resultado.usuario.nombre,
          correo: resultado.usuario.correo,
        },
      };
    } catch (error) {
      if (error.status) throw error;
      throw new InternalServerErrorException(
        'Ocurrió un error registrando la cuenta de Google.',
      );
    }
  }
}
