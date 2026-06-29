import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sublotes = await prisma.sublote.findMany({
    where: {
      deletedAt: null,
      pesoActual: { gt: 0 },
      tipoCafe: { nombre: { in: ['SECO', 'Seco'] } },
      calidad: { nombre: { in: ['REGULAR', 'Regular'] } },
    },
    select: {
      id: true,
      idLote: true,
      pesoActual: true,
      compra: {
        select: {
          id: true,
          organizacionId: true,
          organizacion: { select: { nombre: true } },
        },
      },
    },
  });

  console.log('SECO REGULAR sublotes:');
  console.log(
    sublotes.map((s) => ({
      id: s.id,
      idLote: s.idLote,
      pesoActual: Number(s.pesoActual),
      orgName: s.compra.organizacion.nombre,
      orgId: s.compra.organizacionId,
    })),
  );
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
