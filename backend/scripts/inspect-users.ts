import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      organizacion: true,
    },
  });

  console.log('Users in database:');
  console.log(
    users.map((u) => ({
      id: u.id,
      correo: u.correo,
      nombre: u.nombre,
      orgId: u.organizacionId,
      orgNombre: u.organizacion?.nombre,
    })),
  );
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
