import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sublotes = await prisma.sublote.findMany();
  let updated = 0;
  for (const s of sublotes) {
    const costo = Number(s.pesoInicial) * Number(s.precioKg);
    await prisma.sublote.update({
      where: { id: s.id },
      data: { costoTotal: costo }
    });
    updated++;
  }
  console.log(`Backfill complete: ${updated} sublotes updated.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
