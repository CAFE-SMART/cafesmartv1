import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sales = await prisma.venta.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      organizacion: true,
      creador: true,
      detalles: {
        include: {
          sublote: {
            include: {
              tipoCafe: true,
              calidad: true,
            },
          },
        },
      },
    },
  });

  console.log('Recent sales:');
  console.log(
    sales.map((v) => ({
      id: v.id,
      fecha: v.fecha,
      totalVenta: Number(v.totalVenta),
      createdAt: v.createdAt,
      userCorreo: v.creador.correo,
      orgNombre: v.organizacion.nombre,
      detalles: v.detalles.map((d) => ({
        subloteId: d.subloteId,
        pesoVendido: Number(d.pesoVendido),
        precioKg: Number(d.precioKg),
      })),
    })),
  );
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
