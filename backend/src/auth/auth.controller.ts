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
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterGoogleDto } from './dto/register-google.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { CheckEmailDto } from './dto/check-email.dto';
import { UsersService } from '../users/users.service';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { JwtAuthGuard } from './jwt.guard';

@Controller('auth')
@UseGuards(AuthRateLimitGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('register/google')
  @HttpCode(HttpStatus.CREATED)
  registerGoogle(@Body() dto: RegisterGoogleDto) {
    return this.authService.registerGoogle(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('login/google')
  @HttpCode(HttpStatus.OK)
  loginWithGoogle(@Body() googleLoginDto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(googleLoginDto);
  }

  @Post('check-email')
  @HttpCode(HttpStatus.OK)
  async checkEmail(@Body() dto: CheckEmailDto) {
    const user = await this.usersService.findByEmail(
      dto.correo.trim().toLowerCase(),
    );
    return { exists: Boolean(user) };
  }

  @Post('verify-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  verifyPassword(
    @Body() dto: { password?: string },
    @Req() req: { user: { sub: string } },
  ) {
    return this.authService.verifyCurrentPassword(
      req.user.sub,
      dto.password ?? '',
    );
  }
}
