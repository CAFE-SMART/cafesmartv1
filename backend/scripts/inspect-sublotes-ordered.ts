import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orgId = 'b8386348-c08a-46d5-8f5f-a31f361314e7';

  const tipoCafe = await prisma.tipoCafe.findFirst({
    where: { nombre: { equals: 'Seco', mode: 'insensitive' } },
  });
  const calidad = await prisma.calidad.findFirst({
    where: { nombre: { equals: 'Regular', mode: 'insensitive' } },
  });

  if (!tipoCafe || !calidad) {
    console.log('Tipo o calidad no encontrado');
    return;
  }

  const sublotes = await prisma.sublote.findMany({
    where: {
      deletedAt: null,
      pesoActual: { gt: 0 },
      tipoCafeId: tipoCafe.id,
      calidadId: calidad.id,
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

  console.log('Ordered sublotes:');
  console.log(
    sublotes.map((s, index) => ({
      etiqueta: `sr-${index + 1}`,
      id: s.id,
      pesoActual: Number(s.pesoActual),
      fechaCompra: s.compra.fecha,
      creadoEn: s.creadoEn,
    })),
  );
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
