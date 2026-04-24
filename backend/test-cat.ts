import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const org = await prisma.organization.findFirst();
    const user = await prisma.user.findFirst();
    if (!org || !user) {
      console.log('No org or user');
      return;
    }
    console.log('User:', user.id, 'Org:', org.id);

    const TIPOS_CAFE_BASE = ['VERDE', 'SECO', 'TRILLADO', 'PASILLA'];
    const CALIDADES_BASE = ['BUENO', 'REGULAR', 'MALO'];

    await prisma.tipoCafe.createMany({
      data: TIPOS_CAFE_BASE.map((nombre) => ({ nombre })),
      skipDuplicates: true,
    });
    
    await prisma.calidad.createMany({
      data: CALIDADES_BASE.map((nombre) => ({ nombre })),
      skipDuplicates: true,
    });

    console.log('Catalogos generados');

    const tipos = await prisma.tipoCafe.findMany();
    console.log('Tipos:', tipos);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
