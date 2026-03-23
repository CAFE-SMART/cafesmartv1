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
    // PASO 1: Verificar que el correo no esté en uso
    const usuarioExistente = await this.usersService.findByEmail(dto.correo);
    if (usuarioExistente) {
      // Error amigable: el usuario ya existe
      throw new ConflictException(
        'Ya existe una cuenta registrada con ese correo electrónico.',
      );
    }

    try {
      // PASO 2: Ejecutar todo dentro de una transacción
      // Si cualquier paso falla, Prisma revierte todo automáticamente.
      const resultado = await this.prisma.$transaction(async (tx) => {
        // PASO 2a: Crear la organización primero
        const organizacion = await tx.organization.create({
          data: {
            nombre: dto.nombreOrganizacion,
            tipo: dto.tipoOrganizacion,
            otroTipoDetalle: dto.otroTipoDetalle,
          },
        });


        // PASO 2b: Hashear la contraseña (nunca se guarda en texto plano)
        // El número 10 indica la "dificultad" del hash (estándar seguro)
        const passwordHasheado = await bcrypt.hash(dto.password, 10);

        // PASO 2c: Crear el usuario administrador vinculado a la organización
        // El rol ADMIN se asigna automáticamente — el usuario NO lo elige.
        const usuario = await this.usersService.create(
          {
            nombre: dto.nombre,
            correo: dto.correo,
            password: passwordHasheado,
            telefono: dto.telefono,
            rol: RolUsuario.ADMIN,
            organizacionId: organizacion.id,
          },
          tx, // pasamos el cliente de transacción
        );

        return { organizacion, usuario };
      });

      // PASO 3: Retornar respuesta limpia y amigable
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
      // Si el error ya es un error de NestJS (ConflictException, etc.), lo relanzamos
      if (error.status) throw error;

      // Cualquier otro error inesperado → mensaje genérico (no técnico)
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
    // 1. Aquí validaríamos el googleToken de verdad y sacaríamos 
    // su google_id único. Por ahora, crearemos uno ficticio.
    const mockGoogleId = `google_user_${Math.floor(Math.random() * 1000000)}`;

    const usuarioExistente = await this.usersService.findByEmail(dto.correo);
    if (usuarioExistente) {
      throw new ConflictException(
        'Ya existe una cuenta registrada con este correo.',
      );
    }

    try {
      const resultado = await this.prisma.$transaction(async (tx) => {
        // Creamos la organización igual que antes
        const organizacion = await tx.organization.create({
          data: {
            nombre: dto.nombreOrganizacion,
            tipo: dto.tipoOrganizacion,
            otroTipoDetalle: dto.otroTipoDetalle,
          },
        });

        // NOTA: ¡No hacemos hash con bcrypt porque NO hay contraseña!
        // Le mandamos undefined o null a password y el googleId.
        const usuario = await this.usersService.create(
          {
            nombre: dto.nombre,
            correo: dto.correo,
            password: null as any, // Ya que Prism no deja mandar null directamente si el DTO de users no lo permite, forzamos si es necesario, pero Prisma sí lo permite en la DB.
            telefono: dto.telefono,
            rol: RolUsuario.ADMIN,
            organizacionId: organizacion.id,
          },
          tx, 
        );

        // Como `this.usersService.create` no tiene soporte directo para `googleId` en su DTO original tal vez,
        // vamos a actualizarlo justo después para guardar el googleId 
        // (o podrías modificar usersService.create si prefieres).
        await tx.user.update({
          where: { id: usuario.id },
          data: { googleId: mockGoogleId }
        });

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

/*
 * ========================================================
 * 🧠 ARCHIVO: auth.service.ts (El Cerebro de la Autenticación)
 * ========================================================
 * ¿Para qué sirve?: Contiene TODA la lógica relacionada con autenticación.
 * El Controller solo "atiende la puerta", pero este archivo es el que 
 * toma las decisiones.
 *
 * Lógica que vivirá aquí:
 *   - Recibir datos del registro → encriptar la contraseña con bcrypt → guardar usuario
 *   - Recibir datos del login → comparar contraseña con bcrypt → si es correcta, generar token JWT
 *   - Si algo falla → lanzar un error con mensaje legible (no técnico)
 *
 * ¿Debo editarlo?: ✅ SÍ. Es el archivo más importante del módulo de auth.
 * Aquí es donde se programa la lógica de negocio de la autenticación.
 *
 * ⚠️ IMPORTANTE: Nunca guardes la contraseña en texto plano. Siempre usa bcrypt.
 */