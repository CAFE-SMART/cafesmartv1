import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sublotes = await prisma.sublote.findMany({
    where: {
      deletedAt: null,
      tipoCafe: { nombre: { in: ['SECO', 'Seco'] } },
      calidad: { nombre: { in: ['REGULAR', 'Regular'] } },
    },
    include: {
      tipoCafe: true,
      calidad: true,
      compra: true,
    },
  });

  console.log('All Seco Regular sublotes in DB:');
  console.log(
    sublotes.map((s) => ({
      id: s.id,
      pesoActual: Number(s.pesoActual),
      tipoCafeName: s.tipoCafe.nombre,
      tipoCafeId: s.tipoCafeId,
      calidadName: s.calidad.nombre,
      calidadId: s.calidadId,
      compraOrgId: s.compra.organizacionId,
    })),
  );
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
