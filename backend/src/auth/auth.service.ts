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
import { sendRecoveryEmail } from './mail.helper';

@Injectable()
export class AuthService {
  private resetTokens = new Map<string, { code: string; expiresAt: Date }>();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Resuelve los Client ID validos para Google OAuth.
   * Prioriza la lista multiple y, si no existe, usa el Client ID unico.
   */
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

  /**
   * Registra un administrador nuevo junto con su organizacion inicial.
   */
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

  /**
   * Registra o vincula una cuenta usando el token emitido por Google.
   */
  async registerGoogle(dto: RegisterGoogleDto) {
    const ticket = await this.verifyGoogleToken(dto.googleToken);

    const payload = ticket.getPayload();
    if (!payload?.email || payload.email_verified !== true) {
      throw new UnauthorizedException({ message: 'Token de Google invalido' });
    }

    const googleEmail = payload.email.trim().toLowerCase();
    const googleSubject = payload.sub?.trim();
    if (!googleSubject) {
      throw new UnauthorizedException({ message: 'Token de Google invalido' });
    }

    const existingUser = await this.usersService.findByEmail(googleEmail);
    if (existingUser) {
      if (existingUser.googleId && existingUser.googleId !== googleSubject) {
        throw new HttpException(
          {
            message: 'Este correo ya esta vinculado con otra cuenta de Google',
            field: 'email',
          },
          HttpStatus.CONFLICT,
        );
      }

      const linkedUser =
        existingUser.googleId === googleSubject
          ? existingUser
          : await this.usersService.linkGoogleAccount(
              existingUser.id,
              googleSubject,
            );

      return this.buildAuthResponse(linkedUser, 'Cuenta vinculada con Google');
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
        googleId: googleSubject,
      });
    } catch (error) {
      this.throwIfUniqueConstraint(error);
      throw error;
    }

    return this.buildAuthResponse(user, 'Registro con Google exitoso');
  }

  /**
   * Valida credenciales tradicionales y devuelve el contrato unificado de sesion.
   */
  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(
      email.trim().toLowerCase(),
    );

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

  /**
   * Autentica una cuenta existente a partir de un token valido de Google.
   * Si el usuario no existe, retorna un error con action:'register' para permitir que el
   * frontend rediriga al flujo de registro.
   */
  async loginWithGoogle(googleData: { idToken: string }) {
    const ticket = await this.verifyGoogleToken(googleData.idToken);

    const payload = ticket.getPayload();
    if (!payload?.email || payload.email_verified !== true) {
      throw new UnauthorizedException({
        message: 'Token de Google invalido',
      });
    }

    const googleSubject = payload.sub?.trim();
    if (!googleSubject) {
      throw new UnauthorizedException({
        message: 'Token de Google invalido',
      });
    }

    const normalizedEmail = payload.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    // Si el usuario no existe, lanzar error con accion de registro
    if (!user) {
      throw new UnauthorizedException({
        message: 'No encontramos tu cuenta. Por favor, registrate primero.',
        action: 'register',
      });
    }

    // Si el usuario ya está vinculado a otra cuenta de Google, lanzar error
    if (user.googleId && user.googleId !== googleSubject) {
      throw new UnauthorizedException({
        message: 'Esta cuenta ya esta vinculada con otra cuenta de Google',
        field: 'email',
      });
    }

    // Vincular Google si aún no está vinculado, o simplemente devolver el usuario si ya lo está
    const linkedUser =
      user.googleId === googleSubject
        ? user
        : await this.usersService.linkGoogleAccount(user.id, googleSubject);

    return this.buildAuthResponse(linkedUser, 'Login con Google exitoso');
  }

  async verifyCurrentPassword(userId: string, password: string) {
    const user = await this.usersService.findPasswordById(userId);

    if (!user?.password) {
      throw new UnauthorizedException({
        message: 'Esta cuenta no tiene contrasena local configurada',
        field: 'password',
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException({
        message: 'Contrasena incorrecta',
        field: 'password',
      });
    }

    return { valid: true };
  }

  /**
   * Traduce errores de unicidad de Prisma a mensajes funcionales para el cliente.
   */
  private throwIfUniqueConstraint(error: unknown): never | void {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      (error as { code?: string }).code !== 'P2002'
    ) {
      return;
    }

    const metaTarget = (error as { meta?: { target?: string[] | string } }).meta
      ?.target;
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

  private async verifyGoogleToken(idToken: string) {
    try {
      return await this.getGoogleClient().verifyIdToken({
        idToken,
        audience: this.getGoogleAudiences(),
      });
    } catch {
      throw new UnauthorizedException({
        message:
          'No pudimos validar tu cuenta de Google. Revisa tu conexion a internet e intenta nuevamente.',
        field: 'google',
      });
    }
  }

  private async buildAuthResponse(
    user: {
      id: string;
      correo: string;
      nombre: string;
      organizacionId: string | null;
    },
    message: string,
  ) {
    const payload = { sub: user.id, email: user.correo };
    const token = this.jwtService.sign(payload);

    // Intentar cargar datos adicionales de sesión (organización, tipo, etc.)
    // pero usar los datos del usuario como fuente de verdad principal
    const sessionData: {
      organizacion?: { tipo?: string; otroTipoDetalle?: string | null };
    } = {};
    try {
      const sessionUser = await this.usersService.findSessionById(user.id);
      if (sessionUser?.organizacion) {
        sessionData.organizacion = sessionUser.organizacion;
      }
    } catch {
      // Silenciar errores en sesión auxiliar
    }

    // hasCompany se basa SIEMPRE en si el usuario tiene una organizacionId
    // El usuario.organizacionId es la fuente de verdad
    const hasCompany = Boolean(user.organizacionId);

    return {
      message,
      access_token: token,
      hasCompany,
      user: {
        id: user.id,
        email: user.correo,
        name: user.nombre,
        organizacionId: user.organizacionId ?? null,
        tipoOrganizacion: sessionData.organizacion?.tipo ?? null,
        otroTipoDetalle: sessionData.organizacion?.otroTipoDetalle ?? null,
      },
    };
  }

  async forgotPassword(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      return { message: 'Código de recuperación enviado' };
    }

    // Generate a 6-digit numeric code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in memory map with 15 minutes expiration
    this.resetTokens.set(normalizedEmail, {
      code,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    await sendRecoveryEmail(this.configService, normalizedEmail, code);

    return { message: 'Código de recuperación enviado' };
  }

  async resetPassword(email: string, code: string, passwordNew: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const entry = this.resetTokens.get(normalizedEmail);

    if (!entry) {
      throw new HttpException(
        { message: 'El código de recuperación es inválido o ha expirado.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (entry.expiresAt < new Date()) {
      this.resetTokens.delete(normalizedEmail);
      throw new HttpException(
        { message: 'El código de recuperación ha expirado.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (entry.code !== code.trim()) {
      throw new HttpException(
        { message: 'El código de recuperación es incorrecto.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const hashedPassword = await bcrypt.hash(passwordNew, 10);
    await this.usersService.updatePasswordByEmail(
      normalizedEmail,
      hashedPassword,
    );
    this.resetTokens.delete(normalizedEmail);

    return { message: 'Contraseña restablecida con éxito' };
  }
}
