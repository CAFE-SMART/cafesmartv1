import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { RolUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/user.services';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { RegisterDto } from './dto/register.dto';
import { RegisterGoogleDto } from './dto/register-google.dto';

@Injectable()
export class AuthService {
  private googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // ----------------------------------------------------------
  // LOGIN NORMAL
  // ----------------------------------------------------------
  async login(email: string, passwordString: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException({
        message: 'Correo incorrecto',
        field: 'email',
      });
    }

    if (!user.password) {
      throw new UnauthorizedException({
        message: 'Esta cuenta usa inicio de sesión con Google.',
        field: 'password',
      });
    }

    const valid = await bcrypt.compare(passwordString, user.password);
    if (!valid) {
      throw new UnauthorizedException({
        message: 'Contraseña incorrecta',
        field: 'password',
      });
    }

    return this.buildLoginResponse(user, 'Login exitoso');
  }

  // ----------------------------------------------------------
  // LOGIN GOOGLE
  // ----------------------------------------------------------
  async loginWithGoogle(googleData: { idToken: string }) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken: googleData.idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new UnauthorizedException({
        message: 'Token de Google inválido',
        field: 'idToken',
      });
    }

    const user = await this.usersService.findByEmail(payload.email);

    if (!user) {
      throw new UnauthorizedException({
        message: 'No encontramos tu cuenta en Google',
        action: 'register',
      });
    }

    return this.buildLoginResponse(user, 'Login con Google exitoso');
  }

  // ----------------------------------------------------------
  // REGISTRO NORMAL
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
  // REGISTRO GOOGLE
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

  // ----------------------------------------------------------
  // HELPER PARA CONSTRUIR LA RESPUESTA DE LOGIN
  // ----------------------------------------------------------
  private buildLoginResponse(user: any, message: string) {
    const payload = { sub: user.id, email: user.correo }; 
    const token = this.jwtService.sign(payload);

    return {
      message,
      access_token: token,
      user: {
        id: user.id,
        email: user.correo, 
      },
    };
  }
}
