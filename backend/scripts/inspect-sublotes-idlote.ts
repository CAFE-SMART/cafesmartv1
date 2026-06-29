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
      idLote: true,
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

  console.log('Sublotes con idLote:');
  console.log(
    sublotes.map((s) => ({
      id: s.id,
      idLote: s.idLote,
      tipo: s.tipoCafe.nombre,
      calidad: s.calidad.nombre,
      pesoActual: Number(s.pesoActual),
      orgId: s.compra.organizacionId,
    })),
  );
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
