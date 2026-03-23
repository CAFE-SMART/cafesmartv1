import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@cafesmart.com' },
    update: {},
    create: {
      email: 'admin@cafesmart.com',
      name: 'Admin Test',
      password: hashedPassword,
      role: 'ADMIN',
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
