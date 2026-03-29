import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterGoogleDto } from './dto/register-google.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private getGoogleAudiences(): string | string[] {
    const list = (this.configService.get<string>('GOOGLE_CLIENT_IDS') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (list.length > 0) {
      return list;
    }

    const single = this.configService.get<string>('GOOGLE_CLIENT_ID')?.trim();
    if (!single) {
      throw new UnauthorizedException({
        message: 'Configuracion de Google incompleta en el servidor',
      });
    }

    return single;
  }

  private getGoogleClient() {
    return new OAuth2Client(this.configService.get<string>('GOOGLE_CLIENT_ID'));
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

    let user;
    try {
      user = await this.usersService.createAdminWithOrganization({
        nombreOrganizacion: dto.nombreOrganizacion,
        tipoOrganizacion: dto.tipoOrganizacion,
        otroTipoDetalle: dto.otroTipoDetalle,
        nombre: dto.nombre,
        correo: normalizedEmail,
        telefono: dto.telefono,
        password: hashedPassword,
      });
    } catch (error) {
      this.throwIfUniqueConstraint(error);
      throw error;
    }

    return this.buildAuthResponse(user, 'Registro exitoso');
  }

  async registerGoogle(dto: RegisterGoogleDto) {
    const ticket = await this.getGoogleClient().verifyIdToken({
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
    let user;
    try {
      user = await this.usersService.createAdminWithOrganization({
        nombreOrganizacion: dto.nombreOrganizacion,
        tipoOrganizacion: dto.tipoOrganizacion,
        otroTipoDetalle: dto.otroTipoDetalle,
        nombre: dto.nombre,
        correo: googleEmail,
        telefono: dto.telefono,
        password: hashedPassword,
        googleId: payload.sub ?? null,
      });
    } catch (error) {
      this.throwIfUniqueConstraint(error);
      throw error;
    }

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
    const ticket = await this.getGoogleClient().verifyIdToken({
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

  private throwIfUniqueConstraint(error: unknown): never | void {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      (error as { code?: string }).code !== 'P2002'
    ) {
      return;
    }

    const metaTarget = (error as { meta?: { target?: string[] | string } }).meta?.target;
    const targets = Array.isArray(metaTarget)
      ? metaTarget.map((item) => String(item))
      : metaTarget
        ? [String(metaTarget)]
        : [];

    if (targets.some((target) => target.includes('correo'))) {
      throw new HttpException(
        {
          message: 'El correo ya esta registrado',
          field: 'email',
        },
        HttpStatus.CONFLICT,
      );
    }

    if (targets.some((target) => target.includes('google'))) {
      throw new HttpException(
        {
          message: 'Esta cuenta de Google ya esta vinculada',
          field: 'email',
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  private buildAuthResponse(user: { id: number; correo: string; nombre: string; organizacionId: number | null }, message: string) {
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


