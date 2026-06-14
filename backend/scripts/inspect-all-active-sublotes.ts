import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sublotes = await prisma.sublote.findMany({
    where: {
      deletedAt: null,
      pesoActual: { gt: 0 },
    },
    select: {
      id: true,
      pesoActual: true,
      tipoCafe: { select: { nombre: true } },
      calidad: { select: { nombre: true } },
      compra: {
        select: {
          id: true,
          deletedAt: true,
          organizacionId: true,
        },
      },
    },
  });

  console.log('Sublotes con pesoActual > 0 y deletedAt == null:');
  console.log(
    sublotes.map((s) => ({
      id: s.id,
      tipo: s.tipoCafe.nombre,
      calidad: s.calidad.nombre,
      pesoActual: Number(s.pesoActual),
      compraDeletedAt: s.compra.deletedAt,
      orgId: s.compra.organizacionId,
    })),
  );
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
