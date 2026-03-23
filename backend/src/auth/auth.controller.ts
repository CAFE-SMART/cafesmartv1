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

/*
 * ========================================================
 * 🚪 ARCHIVO: auth.controller.ts (El Portero del Sistema)
 * ========================================================
 * ¿Para qué sirve?: Define las rutas HTTP que permiten a los usuarios
 * registrarse e iniciar sesión. Recibe las peticiones del Frontend
 * y se las delega al AuthService para procesarlas.
 *
 * Rutas que vivirán aquí:
 *   POST /auth/register  →  Registrar un usuario nuevo
 *   POST /auth/login     →  Iniciar sesión y obtener un token JWT
 *
 * ¿Debo editarlo?: ✅ SÍ. Un compañero de Backend debe crear las funciones
 * register() y login() aquí dentro, decoradas con @Post('register') y @Post('login').
 */