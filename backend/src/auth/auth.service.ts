import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { UsersService } from '../users/user.services';
import { RegisterDto } from './dto/register.dto';
import { RegisterGoogleDto } from './dto/register-google.dto';

@Injectable()
export class AuthService {
  private googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  private getGoogleAudiences(): string | string[] {
    const list = (process.env.GOOGLE_CLIENT_IDS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (list.length > 0) {
      return list;
    }

    const single = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!single) {
      throw new UnauthorizedException({
        message: 'Configuracion de Google incompleta en el servidor',
      });
    }

    return single;
  }

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.correo.trim().toLowerCase();
    const existingUser = await this.usersService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new HttpException(
        {
          message: 'El correo ya esta registrado',
          field: 'email',
        },
        HttpStatus.CONFLICT,
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.createAdminWithOrganization({
      nombreOrganizacion: dto.nombreOrganizacion,
      tipoOrganizacion: dto.tipoOrganizacion,
      otroTipoDetalle: dto.otroTipoDetalle,
      nombre: dto.nombre,
      correo: normalizedEmail,
      telefono: dto.telefono,
      password: hashedPassword,
    });

    return this.buildAuthResponse(user, 'Registro exitoso');
  }

  async registerGoogle(dto: RegisterGoogleDto) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken: dto.googleToken,
      audience: this.getGoogleAudiences(),
    });

    const payload = ticket.getPayload();
    if (!payload?.email || payload.email_verified !== true) {
      throw new UnauthorizedException({ message: 'Token de Google invalido' });
    }

    const googleEmail = payload.email.trim().toLowerCase();
    const existingUser = await this.usersService.findByEmail(googleEmail);
    if (existingUser) {
      throw new HttpException(
        {
          message: 'El correo ya esta registrado',
          field: 'email',
        },
        HttpStatus.CONFLICT,
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.createAdminWithOrganization({
      nombreOrganizacion: dto.nombreOrganizacion,
      tipoOrganizacion: dto.tipoOrganizacion,
      otroTipoDetalle: dto.otroTipoDetalle,
      nombre: dto.nombre,
      correo: googleEmail,
      telefono: dto.telefono,
      password: hashedPassword,
      googleId: payload.sub ?? null,
    });

    return this.buildAuthResponse(user, 'Registro con Google exitoso');
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email.trim().toLowerCase());

    if (!user) {
      throw new UnauthorizedException({
        message: 'Correo incorrecto',
        field: 'email',
      });
    }

    if (!user.password) {
      throw new UnauthorizedException({
        message: 'Esta cuenta usa inicio de sesion con Google',
        field: 'email',
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException({
        message: 'Contrasena incorrecta',
        field: 'password',
      });
    }

    return this.buildAuthResponse(user, 'Login exitoso');
  }

  async loginWithGoogle(googleData: { idToken: string }) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken: googleData.idToken,
      audience: this.getGoogleAudiences(),
    });

    const payload = ticket.getPayload();
    if (!payload?.email || payload.email_verified !== true) {
      throw new UnauthorizedException({
        message: 'Token de Google invalido',
      });
    }

    const user = await this.usersService.findByEmail(payload.email.trim().toLowerCase());

    if (!user) {
      throw new UnauthorizedException({
        message: 'No encontramos tu cuenta en Google',
        action: 'register',
      });
    }

    if (!user.googleId || user.googleId !== payload.sub) {
      throw new UnauthorizedException({
        message: 'Esta cuenta no esta vinculada con Google',
        field: 'email',
      });
    }

    return this.buildAuthResponse(user, 'Login con Google exitoso');
  }

  private buildAuthResponse(user: any, message: string) {
    const payload = { sub: user.id, email: user.correo };
    const token = this.jwtService.sign(payload);

    return {
      message,
      access_token: token,
      hasCompany: Boolean(user.organizacionId),
      user: {
        id: user.id,
        email: user.correo,
        name: user.nombre,
      },
    };
  }
}
