import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orgId = 'b8386348-c08a-46d5-8f5f-a31f361314e7';

  // 1. Restore the 50 kg sublote if needed
  const targetSubloteId = '2428de61-37a8-4764-a3f3-72baf0e098c6';
  const updated = await prisma.sublote.updateMany({
    where: { id: targetSubloteId },
    data: { pesoActual: 50.0 },
  });
  console.log(
    `Restored target sublote weight: ${updated.count} row(s) updated.`,
  );

  // 2. Query all sublotes for the organization, sorted by purchase date and creation date
  const sublotes = await prisma.sublote.findMany({
    where: {
      deletedAt: null,
      compra: {
        deletedAt: null,
        organizacionId: orgId,
      },
    },
    include: {
      compra: true,
      tipoCafe: true,
      calidad: true,
    },
    orderBy: [{ compra: { fecha: 'asc' } }, { creadoEn: 'asc' }],
  });

  console.log('All active sublotes for organization:');
  console.log(
    sublotes.map((s, index) => ({
      index: index + 1,
      id: s.id,
      pesoActual: Number(s.pesoActual),
      pesoInicial: Number(s.pesoInicial),
      tipoCafe: s.tipoCafe.nombre,
      calidad: s.calidad.nombre,
      fechaCompra: s.compra.fecha,
      creadoEn: s.creadoEn,
    })),
  );
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
