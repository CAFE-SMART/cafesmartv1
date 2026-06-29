import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sublote = await prisma.sublote.findUnique({
    where: { id: '2428de61-37a8-4764-a3f3-72baf0e098c6' },
    include: {
      compra: true,
      tipoCafe: true,
      calidad: true,
    },
  });

  if (!sublote) {
    console.log('Sublote no encontrado');
    return;
  }

  console.log('Sublote details:');
  console.log('ID:', sublote.id);
  console.log(
    'pesoActual:',
    sublote.pesoActual,
    'Type:',
    typeof sublote.pesoActual,
    'Constructor:',
    sublote.pesoActual?.constructor?.name,
  );
  console.log('pesoInicial:', sublote.pesoInicial);
  console.log('deletedAt:', sublote.deletedAt);
  console.log('compra.id:', sublote.compra.id);
  console.log('compra.organizacionId:', sublote.compra.organizacionId);
  console.log('compra.deletedAt:', sublote.compra.deletedAt);
  console.log('tipo:', sublote.tipoCafe.nombre);
  console.log('calidad:', sublote.calidad.nombre);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
