/*
 * ========================================================
 * 🔌 ARCHIVO: prisma.service.ts (El Cable a la Base de Datos)
 * ========================================================
 * ¿Para qué sirve?: Es el único archivo que se conecta directamente a la
 * base de datos usando Prisma. Todos los servicios del backend (auth, users,
 * lotes, ventas) usarán ESTE archivo para hablar con la base de datos.
 *
 * Es como un enchufe: se instala una sola vez y todos los que necesitan
 * electricidad (datos) lo usan.
 *
 * ¿Debo editarlo?: ⛔ NO. Este archivo se crea una vez y no se modifica.
 * Solo se inyecta (importa) en los módulos que lo necesiten.
 *
 * ¿Cómo se usa en otro servicio?:
 *   constructor(private prisma: PrismaService) {}
 *   // Luego puedes usar: this.prisma.user.findMany()
 */
