import { PrismaClient, TipoOrganizacion, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const org = await prisma.organization.create({
    data: {
      nombre: 'Organización Principal',
      tipo: TipoOrganizacion.OTRO,
      otroTipoDetalle: 'Central',
    }
  });

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
