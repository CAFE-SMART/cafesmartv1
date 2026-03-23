/*
 * ========================================================
 * 🧠 ARCHIVO: auth.service.ts (El Cerebro de la Autenticación)
 * ========================================================
 * ¿Para qué sirve?: Contiene TODA la lógica relacionada con autenticación.
 * El Controller solo "atiende la puerta", pero este archivo es el que 
 * toma las decisiones.
 *
 * Lógica que vivirá aquí:
 *   - Recibir datos del registro → encriptar la contraseña con bcrypt → guardar usuario
 *   - Recibir datos del login → comparar contraseña con bcrypt → si es correcta, generar token JWT
 *   - Si algo falla → lanzar un error con mensaje legible (no técnico)
 *
 * ¿Debo editarlo?: ✅ SÍ. Es el archivo más importante del módulo de auth.
 * Aquí es donde se programa la lógica de negocio de la autenticación.
 *
 * ⚠️ IMPORTANTE: Nunca guardes la contraseña en texto plano. Siempre usa bcrypt.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/user.services';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library'; 

@Injectable()

export class AuthService {
    private googleClient =new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  
    constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // 🔑 Login normal
  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException({
        message: 'Correo incorrecto',
        field: 'email',
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException({
        message: 'Contraseña incorrecta',
        field: 'password',
      });
    }

    return this.buildLoginResponse(user, 'Login exitoso');
  }

  // 🔑 Login con Google
  async loginWithGoogle(googleData: { idToken: string }) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken: googleData.idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email){
        throw new UnauthorizedException({
            message: 'Token de Google inválido',
            field: 'idToken',
          });
    }
    
    const user = await this.usersService.findByEmail(ticket.getPayload().email);

    if (!user) {
      throw new UnauthorizedException({
        message: 'No encontramos tu cuenta en Google',
        action: 'register',
      });
    }

    return this.buildLoginResponse(user, 'Login con Google exitoso');
  }

  // 🛠️ Método común para construir la respuesta
  private buildLoginResponse(user: any, message: string) {
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    return {
      message,
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }
}
