import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterGoogleDto } from './dto/register-google.dto';
import { apiError } from '../common/errors/api-error';

const PASSWORD_RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
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
    const descripcionOrganizacion =
      dto.descripcionOrganizacion ?? dto.descripcion ?? undefined;
    console.log('[CafeSmart][register] etapa 1: payload recibido', {
      correo: dto.correo,
      nombrePresent: Boolean(dto.nombre?.trim()),
      telefonoPresent: Boolean(dto.telefono?.trim()),
      nombreOrganizacionPresent: Boolean(dto.nombreOrganizacion?.trim()),
      tipoOrganizacion: dto.tipoOrganizacion,
      descripcionPresent: Boolean(descripcionOrganizacion?.trim()),
      hasPassword: Boolean(dto.password),
    });

    console.log('[CafeSmart][register] etapa 2: validando email');
    const normalizedEmail = dto.correo.trim().toLowerCase();
    console.log('[CafeSmart][register] etapa 3: validando duplicado');
    const existingUser = await this.usersService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new HttpException(
        {
          message: 'Ya existe una cuenta registrada con este correo.',
          field: 'email',
        },
        HttpStatus.CONFLICT,
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    let user;
    try {
      console.log('[CafeSmart][register] etapa 4: creando usuario');
      console.log('[CafeSmart][register] etapa 5: creando organización');
      console.log('[CafeSmart][register] etapa 6: creando configuración inicial');
      user = await this.usersService.createAdminWithOrganization({
        nombreOrganizacion: dto.nombreOrganizacion,
        tipoOrganizacion: dto.tipoOrganizacion,
        otroTipoDetalle: dto.otroTipoDetalle,
        descripcionOrganizacion,
        nombre: dto.nombre,
        correo: normalizedEmail,
        telefono: dto.telefono,
        password: hashedPassword,
      });
      console.log('[CafeSmart][register] etapa 7: registro completado', {
        userId: user.id,
        organizacionId: user.organizacionId,
      });
    } catch (error) {
      console.error('[CafeSmart][register] error real:', error);
      if (
        typeof error === 'object' &&
        error &&
        ('code' in error || 'meta' in error)
      ) {
        console.error('[CafeSmart][register] prisma error:', {
          code: (error as { code?: string }).code,
          message: error instanceof Error ? error.message : String(error),
          meta: (error as { meta?: unknown }).meta,
        });
      }
      this.throwIfUniqueConstraint(error);
      throw error;
    }

    return this.buildAuthResponse(user, 'Registro exitoso');
  }

  /**
   * Registra o vincula una cuenta usando el token emitido por Google.
   */
  async registerGoogle(dto: RegisterGoogleDto) {
    const descripcionOrganizacion =
      dto.descripcionOrganizacion ?? dto.descripcion ?? undefined;
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
        descripcionOrganizacion,
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
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(
      normalizedEmail,
    );

    if (!user) {
      throw new UnauthorizedException({
        message: 'No encontramos una cuenta con este correo.',
        field: 'email',
      });
    }

    if (!user.password) {
      throw new UnauthorizedException({
        message: 'Esta cuenta usa inicio de sesion con Google',
        field: 'email',
      });
    }

    const valid = await this.validatePassword(password, user.password, user.id);
    if (!valid) {
      throw new UnauthorizedException({
        message: 'La contraseña no coincide.',
        field: 'password',
      });
    }

    return this.buildAuthResponse(user, 'Login exitoso');
  }

  private async validatePassword(
    candidatePassword: string,
    storedPassword: string,
    userId: string,
  ) {
    const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(storedPassword);

    if (isBcryptHash) {
      try {
        return await bcrypt.compare(candidatePassword, storedPassword);
      } catch (error) {
        this.logger.warn(
          JSON.stringify({
            event: 'login_password_compare_failed',
            userId,
            reason: error instanceof Error ? error.message : String(error),
          }),
        );
        return false;
      }
    }

    const isLegacyPlainTextMatch = candidatePassword === storedPassword;
    if (isLegacyPlainTextMatch) {
      const hashedPassword = await bcrypt.hash(candidatePassword, 10);
      await this.usersService.updatePassword(userId, hashedPassword);
      this.logger.warn(
        JSON.stringify({
          event: 'login_password_legacy_hash_migrated',
          userId,
        }),
      );
      return true;
    }

    return false;
  }

  async forgotPassword(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    if (!user) {
      throw new NotFoundException({
        code: 'EMAIL_NOT_FOUND',
        message: 'El correo ingresado no se encuentra registrado en el sistema.',
        field: 'email',
      });
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashPasswordResetToken(token);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });
    });

    const resetUrl = this.buildPasswordResetUrl(token);

    if (!isProduction) {
      this.logger.log(
        JSON.stringify({
          event: 'password_reset_requested',
          email: normalizedEmail,
          provider: this.getEmailProviderName(),
          resetUrl: this.redactResetUrl(resetUrl),
        }),
      );
    }

    try {
      await this.sendPasswordResetEmail(normalizedEmail, resetUrl);
    } catch (error) {
      if (!isProduction) {
        this.logger.error(
          JSON.stringify({
            event: 'password_reset_email_failed',
            email: normalizedEmail,
            provider: this.getEmailProviderName(),
            error: this.formatEmailError(error),
          }),
        );
      }

      throw new ServiceUnavailableException({
        code: 'PASSWORD_RESET_EMAIL_FAILED',
        message:
          'No pudimos enviar el correo de recuperación. Intenta nuevamente o contacta a soporte.',
        field: 'email',
      });
    }

    if (!isProduction) {
      this.logger.log(
        JSON.stringify({
          event: 'password_reset_email_sent',
          email: normalizedEmail,
          provider: this.getEmailProviderName(),
        }),
      );
    }

    return {
      message:
        'Enlace enviado. Revisa tu bandeja de entrada o la carpeta de spam para restablecer tu contraseña.',
    };
  }

  async validateResetPasswordToken(token: string) {
    await this.getValidPasswordResetToken(token);
    return { valid: true };
  }

  async resetPassword(token: string, nuevaPassword: string) {
    const resetToken = await this.getValidPasswordResetToken(token);

    const hashedPassword = await bcrypt.hash(nuevaPassword, 10);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.updateMany({
        where: {
          id: resetToken.userId,
          activo: true,
        },
        data: {
          password: hashedPassword,
        },
      });

      if (updatedUser.count === 0) {
        throw this.buildInvalidResetTokenError();
      }

      const updatedToken = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          usedAt: now,
        },
      });

      if (updatedToken.count === 0) {
        throw this.buildInvalidResetTokenError();
      }
    });

    return { message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' };
  }

  private buildInvalidResetTokenError() {
    return new BadRequestException(
      apiError(
        'PASSWORD_RESET_TOKEN_INVALID',
        'El enlace no es válido. Revisa el correo o solicita uno nuevo.',
        { field: 'token' },
      ),
    );
  }

  private buildExpiredResetTokenError() {
    return new BadRequestException(
      apiError(
        'PASSWORD_RESET_TOKEN_EXPIRED',
        'Este enlace ya venció. Solicita uno nuevo para restablecer tu contraseña.',
        { field: 'token' },
      ),
    );
  }

  private buildUsedResetTokenError() {
    return new BadRequestException(
      apiError(
        'PASSWORD_RESET_TOKEN_USED',
        'Este enlace ya fue utilizado. Solicita uno nuevo si necesitas cambiar tu contraseña otra vez.',
        { field: 'token' },
      ),
    );
  }

  private buildRevokedResetTokenError() {
    return new BadRequestException(
      apiError(
        'PASSWORD_RESET_TOKEN_REVOKED',
        'Este enlace ya no está activo. Solicita uno nuevo para restablecer tu contraseña.',
        { field: 'token' },
      ),
    );
  }

  private hashPasswordResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async getValidPasswordResetToken(token: string) {
    const cleanToken = token.trim();
    if (!cleanToken) {
      throw this.buildInvalidResetTokenError();
    }

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: {
        tokenHash: this.hashPasswordResetToken(cleanToken),
      },
      include: {
        user: {
          select: {
            id: true,
            activo: true,
          },
        },
      },
    });

    if (!resetToken || !resetToken.user?.activo) {
      throw this.buildInvalidResetTokenError();
    }

    if (resetToken.usedAt) {
      throw this.buildUsedResetTokenError();
    }

    if (resetToken.revokedAt) {
      throw this.buildRevokedResetTokenError();
    }

    if (resetToken.expiresAt <= new Date()) {
      throw this.buildExpiredResetTokenError();
    }

    return resetToken;
  }

  private buildPasswordResetUrl(token: string) {
    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:5173'
    ).replace(/\/$/, '');

    return `${frontendUrl}/restablecer?token=${encodeURIComponent(token)}`;
  }

  private getEmailProviderName() {
    if (this.configService.get<string>('RESEND_API_KEY')) return 'resend';
    if (this.configService.get<string>('SENDGRID_API_KEY')) return 'sendgrid';
    return 'not-configured';
  }

  private async sendPasswordResetEmail(email: string, resetUrl: string) {
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    const sendgridApiKey = this.configService.get<string>('SENDGRID_API_KEY');
    const from =
      this.configService.get<string>('EMAIL_FROM') ||
      'Cafe Smart <soporte@cafesmart.com>';

    if (resendApiKey) {
      await this.sendWithResend(resendApiKey, from, email, resetUrl);
      return;
    }

    if (sendgridApiKey) {
      await this.sendWithSendgrid(sendgridApiKey, from, email, resetUrl);
      return;
    }

    throw new Error(
      'No hay proveedor de correo configurado. Define RESEND_API_KEY o SENDGRID_API_KEY.',
    );
  }

  private async sendWithResend(
    apiKey: string,
    from: string,
    to: string,
    resetUrl: string,
  ) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: 'Recupera tu contraseña de Cafe Smart',
        html: this.buildPasswordResetEmailHtml(resetUrl),
      }),
    });

    if (!response.ok) {
      let details = '';
      try {
        const body = await response.text();
        details = body ? `: ${body}` : '';
      } catch {
        details = '';
      }

      throw new Error(
        `Resend rechazo el envio con estado ${response.status}${details}`,
      );
    }
  }

  private async sendWithSendgrid(
    apiKey: string,
    from: string,
    to: string,
    resetUrl: string,
  ) {
    const fromEmail = this.extractEmailAddress(from);
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail },
        subject: 'Recupera tu contraseña de Cafe Smart',
        content: [
          {
            type: 'text/html',
            value: this.buildPasswordResetEmailHtml(resetUrl),
          },
        ],
      }),
    });

    if (!response.ok) {
      let details = '';
      try {
        const body = await response.text();
        details = body ? `: ${body}` : '';
      } catch {
        details = '';
      }

      throw new Error(
        `SendGrid rechazo el envio con estado ${response.status}${details}`,
      );
    }
  }

  private buildPasswordResetEmailHtml(resetUrl: string) {
    return `
      <p>Recibimos una solicitud para restablecer tu contraseña en Cafe Smart.</p>
      <p>Usa este enlace durante los proximos 15 minutos:</p>
      <p><a href="${resetUrl}">Restablecer contraseña</a></p>
      <p>Si no solicitaste este cambio, ignora este correo.</p>
    `;
  }

  private extractEmailAddress(value: string) {
    const match = value.match(/<([^>]+)>/);
    return (match?.[1] ?? value).trim();
  }

  private formatEmailError(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private redactResetUrl(resetUrl: string) {
    try {
      const url = new URL(resetUrl);
      if (url.searchParams.has('token')) {
        url.searchParams.set('token', '[redacted]');
      }
      return url.toString();
    } catch {
      return '[redacted-reset-url]';
    }
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
        message: 'La contraseña no coincide.',
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
      avatarUrl?: string | null;
    },
    message: string,
  ) {
    const payload = { sub: user.id, email: user.correo };
    const token = this.jwtService.sign(payload);

    // Intentar cargar datos adicionales de sesión (organización, tipo, etc.)
    // pero usar los datos del usuario como fuente de verdad principal
    const sessionData: {
      avatarUrl?: string | null;
      organizacion?: {
        nombre?: string;
        tipo?: string;
        otroTipoDetalle?: string | null;
        descripcion?: string | null;
      };
    } = {};
    try {
      const sessionUser = await this.usersService.findSessionById(user.id);
      sessionData.avatarUrl = sessionUser?.avatarUrl ?? user.avatarUrl ?? null;
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
        nombreOrganizacion: sessionData.organizacion?.nombre ?? null,
        tipoOrganizacion: sessionData.organizacion?.tipo ?? null,
        otroTipoDetalle: sessionData.organizacion?.otroTipoDetalle ?? null,
        descripcionOrganizacion: sessionData.organizacion?.descripcion ?? null,
        avatarUrl: sessionData.avatarUrl ?? null,
      },
    };
  }
}
