import { Prisma } from '@prisma/client';
import { procesarVenta } from './procesar-venta';

describe('procesarVenta - inventario de bodega', () => {
  it('descuenta el peso vendido del sublote y del inventario agregado', async () => {
    const tx = {
      venta: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'venta-1',
          totalVenta: new Prisma.Decimal(480000),
        }),
      },
      sublote: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
      },
      ventaDetalle: {
        create: jest.fn().mockResolvedValue({
          id: 'detalle-1',
          ventaId: 'venta-1',
          subloteId: 'sub-1',
          pesoVendido: new Prisma.Decimal(40),
          precioKg: new Prisma.Decimal(12000),
          subtotal: new Prisma.Decimal(480000),
        }),
      },
      inventarioMovimiento: {
        create: jest.fn().mockResolvedValue({ id: 'mov-1' }),
      },
      inventario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inventario-1',
          pesoTotal: new Prisma.Decimal(100),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      cliente: {
        findFirst: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 'sub-1',
          pesoActual: new Prisma.Decimal(100),
          tipoCafeId: 'tipo-1',
          calidadId: 'calidad-1',
        },
      ]),
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };

    await procesarVenta(
      {
        organizacionId: 'org-1',
        userId: 'user-1',
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
      prisma as never,
    );

    expect(tx.sublote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          pesoActual: {
            decrement: 40,
          },
        },
      }),
    );
    expect(tx.inventario.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          pesoTotal: {
            decrement: 40,
          },
        },
      }),
    );
    expect(tx.inventarioMovimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cantidad: 40,
          referenciaId: 'venta-1',
        }),
      }),
    );
  });
});
