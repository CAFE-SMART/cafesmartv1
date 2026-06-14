import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  const subloteId = '2428de61-37a8-4764-a3f3-72baf0e098c6';
  const orgId = 'b8386348-c08a-46d5-8f5f-a31f361314e7';
  const pesoVendido = 50.0;

  // Let's first inspect the sublote directly
  const subloteBefore = await prisma.sublote.findFirst({
    where: {
      id: subloteId,
      deletedAt: null,
      compra: {
        is: {
          organizacionId: orgId,
          deletedAt: null,
        },
      },
    },
  });

  console.log('Sublote exists with where criteria?', subloteBefore !== null);
  if (subloteBefore) {
    console.log('Sublote pesoActual:', subloteBefore.pesoActual);
  }

  // Now, simulate the update query
  const count = await prisma.sublote.updateMany({
    where: {
      id: subloteId,
      deletedAt: null,
      pesoActual: {
        gte: new Prisma.Decimal(pesoVendido.toFixed(2)),
      },
      compra: {
        is: {
          organizacionId: orgId,
          deletedAt: null,
        },
      },
    },
    data: {
      pesoActual: {
        decrement: new Prisma.Decimal(pesoVendido.toFixed(2)),
      },
    },
  });

  console.log('Update count:', count.count);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
