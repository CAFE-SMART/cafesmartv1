// ============================================================
// auth.controller.ts - Las rutas de autenticacion
// ============================================================
// El controlador recibe la peticion HTTP,
// la valida con el DTO y la delega al AuthService.
//
// REGLA: El controlador NO tiene logica de negocio.
// Solo recibe, valida y responde.
// ============================================================

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterGoogleDto } from './dto/register-google.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { CheckEmailDto } from './dto/check-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UsersService } from '../users/users.service';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { JwtAuthGuard } from './jwt.guard';

@ApiTags('Autenticación')
@Controller('auth')
@UseGuards(AuthRateLimitGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un nuevo administrador y su organización' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('register/google')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar administrador y organización usando Google OAuth' })
  registerGoogle(@Body() dto: RegisterGoogleDto) {
    return this.authService.registerGoogle(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión con correo y contraseña' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('login/google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión usando Google OAuth' })
  loginWithGoogle(@Body() googleLoginDto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(googleLoginDto);
  }

  @Post('check-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar si un correo electrónico ya está registrado' })
  async checkEmail(@Body() dto: CheckEmailDto) {
    const user = await this.usersService.findByEmail(
      dto.correo.trim().toLowerCase(),
    );
    return {
      exists: Boolean(user),
      organizacion: user?.organizacion
        ? {
            nombre: user.organizacion.nombre,
            tipo: user.organizacion.tipo,
            otroTipoDetalle: user.organizacion.otroTipoDetalle,
          }
        : null,
    };
  }

  @Post('verify-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validar la contraseña actual de un usuario autenticado' })
  verifyPassword(
    @Body() dto: { password?: string },
    @Req() req: { user: { sub: string } },
  ) {
    return this.authService.verifyCurrentPassword(
      req.user.sub,
      dto.password ?? '',
    );
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar código de recuperación de contraseña' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restablecer contraseña con el código de recuperación' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.code, dto.password);
  }
}
