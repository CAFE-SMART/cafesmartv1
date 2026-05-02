import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const counts = {
    compras: await prisma.compra.count(),
    sublotes: await prisma.sublote.count(),
    ventas: await prisma.venta.count(),
    gastos: await prisma.gastoOperativo.count(),
    inventario: await prisma.inventario.count(),
    movimientos: await prisma.inventarioMovimiento.count(),
    lotes: await prisma.lote.count(),
    productores: await prisma.productor.count(),
    clientes: await prisma.cliente.count(),
  };

  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
