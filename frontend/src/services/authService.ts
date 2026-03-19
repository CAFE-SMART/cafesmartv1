/*
 * ========================================================
 * 📡 ARCHIVO: authService.ts (El Mensajero de Autenticación)
 * ========================================================
 * ¿Para qué sirve?: Contiene las funciones que se comunican con el
 * Backend para todo lo relacionado con autenticación. Cuando el usuario
 * hace clic en "Registrarse" o "Iniciar Sesión", las pantallas llaman
 * a las funciones de ESTE archivo.
 *
 * Funciones que vivirán aquí:
 *   - register(nombre, email, password)  →  Llama a POST /auth/register
 *   - login(email, password)             →  Llama a POST /auth/login
 *                                           y guarda el token en localStorage
 *
 * ¿Debo editarlo?: ✅ SÍ. La compañera de Frontend debe implementar
 * estas funciones usando fetch() o axios.
 *
 * ⚠️ No hagas lógica visual aquí (no alertas, no redirecciones).
 * Solo manda la petición y devuelve la respuesta. La pantalla decide qué hacer con ella.
 */