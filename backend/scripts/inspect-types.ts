import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const types = await prisma.tipoCafe.findMany();
  const qualities = await prisma.calidad.findMany();

  console.log('--- Tipos de Cafe ---');
  console.log(types);
  console.log('--- Calidades ---');
  console.log(qualities);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
