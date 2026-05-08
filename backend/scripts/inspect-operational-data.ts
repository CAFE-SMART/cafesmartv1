import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const compras = await prisma.compra.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      fecha: true,
      totalCompra: true,
      deviceId: true,
      localId: true,
      creadoEn: true,
      sublotes: {
        where: { deletedAt: null },
        select: {
          id: true,
          pesoInicial: true,
          pesoActual: true,
          precioKg: true,
          deviceId: true,
          localId: true,
          creadoEn: true,
          tipoCafe: { select: { nombre: true } },
          calidad: { select: { nombre: true } },
        },
        orderBy: { creadoEn: 'asc' },
      },
    },
    orderBy: [{ creadoEn: 'desc' }],
  });

  const resumen = compras.map((compra) => ({
    compraId: compra.id,
    fecha: compra.fecha.toISOString(),
    totalCompra: Number(compra.totalCompra),
    localId: compra.localId,
    creadoEn: compra.creadoEn.toISOString(),
    sublotes: compra.sublotes.map((sublote) => ({
      subloteId: sublote.id,
      tipo: sublote.tipoCafe.nombre,
      calidad: sublote.calidad.nombre,
      pesoInicial: Number(sublote.pesoInicial),
      pesoActual: Number(sublote.pesoActual),
      precioKg: Number(sublote.precioKg),
      localId: sublote.localId,
      creadoEn: sublote.creadoEn.toISOString(),
    })),
  }));

  console.log(JSON.stringify(resumen, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
