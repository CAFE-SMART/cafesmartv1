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