import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VentasService } from './ventas.service';

describe('VentasService - errores de inventario', () => {
  it('responde 409 con code INSUFFICIENT_STOCK cuando no hay inventario suficiente', async () => {
    const tx = {
      venta: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 'sub-1',
          pesoActual: new Prisma.Decimal(20),
          tipoCafeId: 'tipo-1',
          calidadId: 'calidad-1',
        },
      ]),
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ organizacionId: 'org-1' }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new VentasService(prisma as never);

    try {
      await service.crearVenta(
        {
          deviceId: 'device-1',
          localId: 'venta-local-1',
          detalles: [
            {
              subloteId: 'sub-1',
              pesoVendido: 40,
              precioKg: 12000,
            },
          ],
        },
        'user-1',
      );
      throw new Error('La venta debio fallar por inventario insuficiente');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'INSUFFICIENT_STOCK',
        message: 'No hay suficiente inventario para realizar la venta',
      });
    }
  });
});
