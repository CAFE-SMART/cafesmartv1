/*
 * ========================================================
 * ⚙️ ARCHIVO: env.config.ts (El Lector de Contraseñas Secretas)
 * ========================================================
 * ¿Para qué sirve?: Lee las variables de entorno del archivo ".env" y las
 * exporta de forma organizada para que el resto del backend las use sin
 * tener que leer el archivo .env directamente.
 *
 * Variables que se leerán aquí:
 *   - DATABASE_URL     → La URL de conexión a PostgreSQL (Supabase)
 *   - JWT_SECRET       → La clave secreta para firmar los tokens JWT
 *   - PORT             → El puerto en el que corre el servidor (default: 3000)
 *
 * ¿Debo editarlo?: ✅ SÍ, solo para agregar nuevas variables de entorno
 * cuando el proyecto las necesite.
 *
 * ⚠️ NUNCA escribas contraseñas o claves directamente aquí. Usar siempre process.env.VARIABLE
 * ⚠️ Este archivo SÍ puede subirse a GitHub (no tiene contraseñas, solo lee del .env)
 */
