import { PrismaClient, RolUsuario } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      nombre: 'Cafetal Test',
      tipo: 'COMPRAVENTA',
    },
  });
  console.log('Organizacion:', org.nombre);

  await prisma.parametroOrganizacion.upsert({
    where: { organizacionId_nombre: { organizacionId: org.id, nombre: 'capacidad_bodega' } },
    update: {},
    create: { nombre: 'capacidad_bodega', valor: '10000', organizacionId: org.id },
  });
  console.log('capacidad_bodega');

  await prisma.parametroOrganizacion.upsert({
    where: { organizacionId_nombre: { organizacionId: org.id, nombre: 'CREDITO_LIMITE' } },
    update: {},
    create: { nombre: 'CREDITO_LIMITE', valor: '0', organizacionId: org.id },
  });
  console.log('CREDITO_LIMITE');

  await prisma.parametroOrganizacion.upsert({
    where: { organizacionId_nombre: { organizacionId: org.id, nombre: 'PENALIDAD_KG_MAXIMO' } },
    update: {},
    create: { nombre: 'PENALIDAD_KG_MAXIMO', valor: '20000', organizacionId: org.id },
  });
  console.log('PENALIDAD_KG_MAXIMO');

  await prisma.parametroOrganizacion.upsert({
    where: { organizacionId_nombre: { organizacionId: org.id, nombre: 'PRECIO_KG_MAXIMO' } },
    update: {},
    create: { nombre: 'PRECIO_KG_MAXIMO', valor: '100000', organizacionId: org.id },
  });
  console.log('PRECIO_KG_MAXIMO');

  await prisma.parametroOrganizacion.upsert({
    where: { organizacionId_nombre: { organizacionId: org.id, nombre: 'STOCK_DIAS_LIMITE' } },
    update: {},
    create: { nombre: 'STOCK_DIAS_LIMITE', valor: '14', organizacionId: org.id },
  });
  console.log('STOCK_DIAS_LIMITE');

  try {
    const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
    const hashedPassword = await bcrypt.hash(seedAdminPassword, 10);
    await prisma.user.upsert({
      where: { correo: 'admin@cafesmart.com' },
      update: {},
      create: { correo: 'admin@cafesmart.com', nombre: 'Admin Test', password: hashedPassword, telefono: '0000000000', rol: RolUsuario.ADMIN, organizacionId: org.id },
    });
    console.log('Admin user');
  } catch (err) {
    console.log('Admin skip:', err.message);
  }

  const tiposCafe = ['Verde', 'Seco'];
  const calidades = ['Bueno', 'Regular'];
  for (const tipo of tiposCafe) {
    await prisma.tipoCafe.upsert({ where: { nombre: tipo }, update: {}, create: { nombre: tipo } });
  }
  for (const cal of calidades) {
    await prisma.calidad.upsert({ where: { nombre: cal }, update: {}, create: { nombre: cal } });
  }
  console.log('Tipos y calidades');

  console.log('Seed completado!');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });