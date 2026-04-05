import { PrismaClient, TipoOrganizacion, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // ── 1. Catálogos: TipoCafe ──
  const tiposCafe = ['VERDE', 'SECO', 'PASILLA', 'TRILLADO'];
  for (const nombre of tiposCafe) {
    await prisma.tipoCafe.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }
  console.log('Tipos de café creados:', tiposCafe.join(', '));

  // ── 2. Catálogos: Calidad ──
  const calidades = ['BUENO', 'REGULAR', 'MALO'];
  for (const nombre of calidades) {
    await prisma.calidad.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }
  console.log('Calidades creadas:', calidades.join(', '));

  // ── 3. Organización de prueba ──
  const org = await prisma.organization.create({
    data: {
      nombre: 'Organización Principal',
      tipo: TipoOrganizacion.OTRO,
      otroTipoDetalle: 'Central',
    },
  });
  console.log('Organización creada:', org.id);

  // ── 4. Parámetro: capacidad_bodega para la organización ──
  await prisma.parametroOrganizacion.upsert({
    where: {
      organizacionId_nombre: {
        organizacionId: org.id,
        nombre: 'capacidad_bodega',
      },
    },
    update: {},
    create: {
      nombre: 'capacidad_bodega',
      valor: '10000', // 10,000 kg
      organizacionId: org.id,
    },
  });
  console.log('Parámetro capacidad_bodega creado: 10000 kg');

  // ── 5. Usuario admin de prueba ──
  const hashedPassword = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { correo: 'admin@cafesmart.com' },
    update: {},
    create: {
      correo: 'admin@cafesmart.com',
      nombre: 'Admin Test',
      password: hashedPassword,
      telefono: '0000000000',
      rol: RolUsuario.ADMIN,
      organizacionId: org.id,
    },
  });
  console.log('Usuario de prueba creado: admin@cafesmart.com / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
