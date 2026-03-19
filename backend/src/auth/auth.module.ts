/*
 * ========================================================
 * 📦 ARCHIVO: auth.module.ts (El Empaque del Módulo de Autenticación)
 * ========================================================
 * ¿Para qué sirve?: En NestJS, cada funcionalidad del sistema se organiza
 * en "Módulos". Este archivo es el que empaca todo lo relacionado con
 * autenticación (el Controller, el Service y las librerías de JWT).
 *
 * ¿Qué se importa aquí?:
 *   - JwtModule (para poder generar y validar tokens)
 *   - UsersModule (para poder buscar usuarios al hacer login)
 *   - El propio AuthController y AuthService
 *
 * ¿Debo editarlo?: ✅ SÍ, pero solo para agregar dependencias. Una vez
 * configurado correctamente, generalmente no se toca más.
 *
 * ⚠️ No olvides importar este módulo en app.module.ts para que funcione.
 */
