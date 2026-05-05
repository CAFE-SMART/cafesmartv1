import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction([
    prisma.gastoSublote.deleteMany(),
    prisma.gastoOperativo.deleteMany(),
    prisma.inventarioMovimiento.deleteMany(),
    prisma.ventaDetalle.deleteMany(),
    prisma.venta.deleteMany(),
    prisma.sublote.deleteMany(),
    prisma.compra.deleteMany(),
    prisma.inventario.deleteMany(),
    prisma.lote.deleteMany(),
    prisma.productor.deleteMany(),
    prisma.cliente.deleteMany(),
  ]);

  console.log('Datos operativos eliminados correctamente.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
