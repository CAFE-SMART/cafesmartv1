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

//comtroller-->crea rutas del backend
//Post-->define una ruta  tipo POST (enviar datos al servidor)
//Body-->define los datos del request (email, password)
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './auth.login.dto';
import { GoogleLoginDto } from './auth.google-login.dto';

@Controller('auth') 
// Ruta base → todas las rutas de este controller empezarán con /auth

export class AuthController {

  constructor(private readonly authService: AuthService) {} 
  // Inyecta el servicio


  @Post('login') 
  // Ruta completa → /auth/login
  login(@Body() loginDto: LoginDto) { 
  // Recibe email y password desde el frontend
    return this.authService.login(loginDto.email, loginDto.password ); 
    // Envía los datos al service

  }
  @Post('login/google')
  loginWithGoogle(@Body() googleLoginDto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(googleLoginDto);
  }
}