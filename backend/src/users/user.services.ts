/*
 * ========================================================
 * 🧠 ARCHIVO: user.services.ts (El Asistente de Usuarios)
 * ========================================================
 * ¿Para qué sirve?: Contiene la lógica de acceso a la tabla "User" en la
 * base de datos. Cualquier parte del backend que necesite buscar, crear
 * o modificar un usuario, llama a este servicio.
 *
 * Funciones que vivirán aquí:
 *   - findByEmail(email)  →  Buscar un usuario por su correo (para el login)
 *   - create(data)        →  Crear un usuario nuevo (para el registro)
 *
 * ¿Debo editarlo?: ✅ SÍ. La compañera de Backend debe implementar
 * las funciones de crear y buscar usuarios usando Prisma.
 *
 * ⚠️ Este servicio NO encripta contraseñas. Eso lo hace el AuthService.
 * Este servicio solo guarda y lee de la base de datos tal cual.
 */