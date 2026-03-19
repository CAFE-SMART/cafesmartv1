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