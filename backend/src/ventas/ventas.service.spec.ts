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

  it('responde 409 con code VENTA_SYNC_ELIMINADA cuando la venta fue previamente anulada (idempotencia)', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '5' }
    );
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ organizacionId: 'org-1' }),
      },
      venta: {
        findUnique: jest.fn().mockImplementation((args) => {
          return Promise.resolve({
            id: 'venta-id-1',
            deletedAt: new Date(),
            detalles: [],
          });
        }),
      },
      $transaction: jest.fn().mockRejectedValue(prismaError),
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
              pesoVendido: 10,
              precioKg: 12000,
            },
          ],
        },
        'user-1',
      );
      throw new Error('La venta debio fallar por idempotencia de venta anulada');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'VENTA_SYNC_ELIMINADA',
        message: 'Esta venta ya fue registrada y anulada anteriormente. Crea una nueva venta para continuar.',
      });
    }
  });
});
