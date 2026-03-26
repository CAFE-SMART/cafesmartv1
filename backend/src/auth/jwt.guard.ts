/*
 * ========================================================
 * 🛡️ ARCHIVO: jwt.guard.ts (El Guardia de Seguridad)
 * ========================================================
 * ¿Para qué sirve?: Protege las rutas privadas del sistema. Cuando alguien
 * intenta acceder a una ruta protegida (como /inventario o /ventas), 
 * este guardia revisa que el usuario traiga un Token JWT válido.
 * Si no lo trae, o el token está vencido: acceso denegado.
 *
 * ¿Cómo se usa?: Se "pega" encima de cualquier ruta que quieras proteger
 * usando el decorador @UseGuards(JwtAuthGuard).
 *
 * Ejemplo:
 *   @UseGuards(JwtAuthGuard)
 *   @Get('/lotes')
 *   getLotes() { ... }
 *
 * ¿Debo editarlo?: ⚠️ CASI NO. Una vez creado el guardia, no se toca. 
 * Solo se usa (aplicándolo a rutas con @UseGuards).
 */

import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
	constructor(private readonly jwtService: JwtService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const authHeader = request.headers?.authorization as string | undefined;

		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			throw new UnauthorizedException({ message: 'Token no proporcionado' });
		}

		const token = authHeader.slice('Bearer '.length).trim();
		if (!token) {
			throw new UnauthorizedException({ message: 'Token inválido' });
		}

		try {
			const payload = await this.jwtService.verifyAsync(token, {
				secret: process.env.JWT_SECRET || 'dev-secret-change-me',
			});

			request.user = payload;
			return true;
		} catch {
			throw new UnauthorizedException({ message: 'Token inválido o expirado' });
		}
	}
}
