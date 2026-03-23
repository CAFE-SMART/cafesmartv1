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

@Controller('auth') // prefijo base: /auth
export class AuthController {
  constructor(private authService: AuthService) {}

  // ----------------------------------------------------------
  // POST /auth/register
  // Recibe los datos del formulario, los valida con RegisterDto
  // y le pasa el control a AuthService para crear la cuenta.
  // ----------------------------------------------------------
  @Post('register')
  @HttpCode(HttpStatus.CREATED) // responde con código 201
  async register(@Body() dto: RegisterDto) {
    // El decorador @Body() extrae el cuerpo del JSON de la petición.
    // NestJS valida automáticamente que el DTO sea correcto gracias
    // al ValidationPipe activado en main.ts.
    return this.authService.register(dto);
  }

  // ----------------------------------------------------------
  // POST /auth/register/google
  // ----------------------------------------------------------
  @Post('register/google')
  @HttpCode(HttpStatus.CREATED)
  async registerGoogle(@Body() dto: RegisterGoogleDto) {
    return this.authService.registerGoogle(dto);
  }
}