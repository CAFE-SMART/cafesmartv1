import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orgId = 'b8386348-c08a-46d5-8f5f-a31f361314e7';

  // 1. Get all active sublotes grouped by type/quality
  const sublotes = await prisma.sublote.findMany({
    where: {
      deletedAt: null,
      compra: {
        deletedAt: null,
        organizacionId: orgId,
      },
    },
    include: {
      tipoCafe: true,
      calidad: true,
    },
  });

  console.log('--- SUM OF ACTIVE SUBLOTES WEIGHTS BY TYPE/QUALITY ---');
  const groupedSublotes: Record<string, number> = {};
  for (const s of sublotes) {
    const key = `${s.tipoCafe.nombre} - ${s.calidad.nombre} (Type ID: ${s.tipoCafeId}, Quality ID: ${s.calidadId})`;
    groupedSublotes[key] = (groupedSublotes[key] || 0) + Number(s.pesoActual);
  }
  console.log(groupedSublotes);

  // 2. Get all records from inventario table
  const inventarios = await prisma.inventario.findMany({
    where: { organizacionId: orgId },
    include: {
      tipoCafe: true,
      calidad: true,
    },
  });

  console.log('--- INVENTARIO TABLE RECORDS ---');
  console.log(
    inventarios.map((i) => ({
      id: i.id,
      tipo: i.tipoCafe.nombre,
      calidad: i.calidad.nombre,
      pesoTotal: Number(i.pesoTotal),
      tipoCafeId: i.tipoCafeId,
      calidadId: i.calidadId,
    })),
  );
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
