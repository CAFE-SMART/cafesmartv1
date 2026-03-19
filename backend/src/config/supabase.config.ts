/*
 * ========================================================
 * ☁️ ARCHIVO: supabase.config.ts (El Conector a la Nube)
 * ========================================================
 * ¿Para qué sirve?: Configura e inicializa el cliente de Supabase para
 * ser usado en la sincronización de datos. Al final del día, cuando el
 * administrador tenga internet, los datos locales (SQLite) se subirán
 * a la base de datos en la nube usando este cliente.
 *
 * ¿Cuándo se usa?: Principalmente en la lógica de sincronización
 * Offline → Online. No se usa en las peticiones normales del sistema,
 * ya que el día a día usa Prisma con PostgreSQL/SQLite.
 *
 * ¿Debo editarlo?: ⚠️ CASI NO. Se configura una vez con las credenciales
 * de Supabase y no se vuelve a tocar.
 *
 * ⚠️ Las credenciales de Supabase (URL y ANON KEY) van en el archivo .env
 */
