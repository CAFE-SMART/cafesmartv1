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
