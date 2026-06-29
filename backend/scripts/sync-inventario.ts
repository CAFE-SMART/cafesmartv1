import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting inventario synchronization...');

  // 1. Fetch all organizations
  const organizations = await prisma.organization.findMany();

  for (const org of organizations) {
    console.log(
      `\nSyncing inventario for organization: ${org.nombre} (${org.id})`,
    );

    // 2. Fetch all active sublotes for this organization
    const sublotes = await prisma.sublote.findMany({
      where: {
        deletedAt: null,
        pesoActual: { gt: 0 },
        compra: {
          deletedAt: null,
          organizacionId: org.id,
        },
      },
    });

    // 3. Compute expected weights by type and quality
    const expectedWeights: Record<
      string,
      { tipoCafeId: string; calidadId: string; sum: number }
    > = {};
    for (const s of sublotes) {
      const key = `${s.tipoCafeId}::${s.calidadId}`;
      if (!expectedWeights[key]) {
        expectedWeights[key] = {
          tipoCafeId: s.tipoCafeId,
          calidadId: s.calidadId,
          sum: 0,
        };
      }
      expectedWeights[key].sum += Number(s.pesoActual);
    }

    // 4. Update or create inventario records for active groups
    for (const key of Object.keys(expectedWeights)) {
      const { tipoCafeId, calidadId, sum } = expectedWeights[key];
      const normalizedSum = parseFloat(sum.toFixed(2));

      const existing = await prisma.inventario.findUnique({
        where: {
          organizacionId_tipoCafeId_calidadId: {
            organizacionId: org.id,
            tipoCafeId,
            calidadId,
          },
        },
      });

      if (existing) {
        await prisma.inventario.update({
          where: { id: existing.id },
          data: { pesoTotal: normalizedSum },
        });
        console.log(
          `Updated inventario for Type: ${tipoCafeId}, Quality: ${calidadId} to ${normalizedSum} kg (was ${existing.pesoTotal} kg)`,
        );
      } else {
        await prisma.inventario.create({
          data: {
            organizacionId: org.id,
            tipoCafeId,
            calidadId,
            pesoTotal: normalizedSum,
          },
        });
        console.log(
          `Created inventario for Type: ${tipoCafeId}, Quality: ${calidadId} with ${normalizedSum} kg`,
        );
      }
    }

    // 5. Zero out any other inventario records that don't have active sublotes
    const activeKeys = new Set(Object.keys(expectedWeights));
    const allInventarios = await prisma.inventario.findMany({
      where: { organizacionId: org.id },
    });

    for (const inv of allInventarios) {
      const key = `${inv.tipoCafeId}::${inv.calidadId}`;
      if (!activeKeys.has(key) && Number(inv.pesoTotal) > 0) {
        await prisma.inventario.update({
          where: { id: inv.id },
          data: { pesoTotal: 0 },
        });
        console.log(
          `Zeroed out inventario for Type: ${inv.tipoCafeId}, Quality: ${inv.calidadId} (was ${inv.pesoTotal} kg)`,
        );
      }
    }
  }

  console.log('\nSynchronization completed successfully.');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
