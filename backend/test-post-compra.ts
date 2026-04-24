import { PrismaClient } from '@prisma/client';
import { ComprasService } from './src/compras/compras.service';

const prisma = new PrismaClient();

async function main() {
  try {
    const comprasService = new ComprasService(prisma as any);
    
    const user = await prisma.user.findFirst();
    const tipos = await prisma.tipoCafe.findMany();
    const calidades = await prisma.calidad.findMany();
    
    console.log('Testing createCompra');
    
    const res = await comprasService.crearCompra({
      deviceId: '123',
      localId: '123' + Date.now(),
      fecha: new Date().toISOString(),
      sublotes: [
        {
          deviceId: '123',
          localId: 'sub123' + Date.now(),
          pesoInicial: 24.99,
          precioKg: 13699,
          tipoCafeId: tipos[0].id,
          calidadId: calidades[0].id,
        }
      ]
    }, user!.id);
    
    console.log('Success!', res.compra.id);
  } catch (error: any) {
    console.error('Raw Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
