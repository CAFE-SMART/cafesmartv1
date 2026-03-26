// ============================================================
// auth.controller.ts — Las Rutas de Autenticación
// ============================================================
// El controlador es el "portero": recibe la petición HTTP,
// la valida con el DTO y la delega al AuthService.
//
// REGLA: El controlador NO tiene lógica de negocio.
// Solo recibe, valida y responde.
//
// Rutas definidas aquí:
//   POST /auth/register  →  Registrar organización + usuario admin
// ============================================================

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterGoogleDto } from './dto/register-google.dto';
import { LoginDto } from './auth.login.dto';
import { GoogleLoginDto } from './auth.google-login.dto';
import { CheckEmailDto } from './dto/check-email.dto';
import { UsersService } from 'src/users/user.services';

@Controller('auth')
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
    const user = await this.usersService.findByEmail(dto.correo.trim().toLowerCase());
    return { exists: Boolean(user) };
  }
}