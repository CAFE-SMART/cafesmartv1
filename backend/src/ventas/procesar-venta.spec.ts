import { Prisma } from '@prisma/client';
import {
  InventarioInconsistenteError,
  procesarVenta,
  StockInsuficienteError,
  SubloteNoEncontradoError,
  VentaConSublotesDuplicadosError,
  VentaValidacionCriticaError,
} from './procesar-venta';

describe('procesarVenta - inventario de bodega', () => {
  it('bloquea una venta con cantidad menor o igual a cero antes de tocar la base de datos', async () => {
    const prisma = {
      $transaction: jest.fn(),
    };

    await expect(
      procesarVenta(
        {
          organizacionId: 'org-1',
          userId: 'user-1',
          deviceId: 'device-1',
          localId: 'venta-local-1',
          detalles: [
            {
              subloteId: 'sub-1',
              pesoVendido: 0,
              precioKg: 12000,
            },
          ],
        },
        prisma as never,
      ),
    ).rejects.toBeInstanceOf(VentaValidacionCriticaError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('bloquea una venta con cantidad total menor a 5 kg antes de tocar la base de datos', async () => {
    const prisma = {
      $transaction: jest.fn(),
    };

    await expect(
      procesarVenta(
        {
          organizacionId: 'org-1',
          userId: 'user-1',
          deviceId: 'device-1',
          localId: 'venta-local-1',
          detalles: [
            {
              subloteId: 'sub-1',
              pesoVendido: 4,
              precioKg: 12000,
            },
          ],
        },
        prisma as never,
      ),
    ).rejects.toBeInstanceOf(VentaValidacionCriticaError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('bloquea una venta con precio menor a 1000 antes de tocar la base de datos', async () => {
    const prisma = {
      $transaction: jest.fn(),
    };

    await expect(
      procesarVenta(
        {
          organizacionId: 'org-1',
          userId: 'user-1',
          deviceId: 'device-1',
          localId: 'venta-local-1',
          detalles: [
            {
              subloteId: 'sub-1',
              pesoVendido: 10,
              precioKg: 999,
            },
          ],
        },
        prisma as never,
      ),
    ).rejects.toBeInstanceOf(VentaValidacionCriticaError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('bloquea una venta con el mismo sublote repetido antes de abrir transaccion', async () => {
    const prisma = {
      $transaction: jest.fn(),
    };

    await expect(
      procesarVenta(
        {
          organizacionId: 'org-1',
          userId: 'user-1',
          deviceId: 'device-1',
          localId: 'venta-local-1',
          detalles: [
            {
              subloteId: 'sub-1',
              pesoVendido: 10,
              precioKg: 12000,
            },
            {
              subloteId: 'sub-1',
              pesoVendido: 5,
              precioKg: 12000,
            },
          ],
        },
        prisma as never,
      ),
    ).rejects.toBeInstanceOf(VentaConSublotesDuplicadosError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('bloquea sublotes con SELECT FOR UPDATE en orden ascendente para evitar deadlocks', async () => {
    const tx = {
      venta: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };

    await expect(
      procesarVenta(
        {
          organizacionId: 'org-1',
          userId: 'user-1',
          deviceId: 'device-1',
          localId: 'venta-local-1',
          detalles: [
            {
              subloteId: 'sub-b',
              pesoVendido: 10,
              precioKg: 12000,
            },
            {
              subloteId: 'sub-a',
              pesoVendido: 10,
              precioKg: 12000,
            },
          ],
        },
        prisma as never,
      ),
    ).rejects.toBeInstanceOf(SubloteNoEncontradoError);

    const rawQuery = tx.$queryRaw.mock.calls[0][0] as {
      sql: string;
      values: string[];
    };
    expect(rawQuery.sql).toContain('ORDER BY s.id_sublote');
    expect(rawQuery.sql).toContain('FOR UPDATE');
    expect(rawQuery.values).toEqual(['sub-a', 'sub-b', 'org-1']);
  });

  it('bloquea una venta cuando la cantidad supera el inventario disponible', async () => {
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
      $transaction: jest.fn((callback) => callback(tx)),
    };

    await expect(
      procesarVenta(
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
      ),
    ).rejects.toBeInstanceOf(StockInsuficienteError);
  });

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

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxWait: 10000,
        timeout: 25000,
      }),
    );
    expect(tx.sublote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          pesoActual: {
            decrement: new Prisma.Decimal('40.00'),
          },
        },
      }),
    );
    expect(tx.inventario.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          pesoTotal: {
            decrement: new Prisma.Decimal('40.00'),
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

  it('rechaza la venta si el decremento atomico del sublote no encuentra stock suficiente', async () => {
    const tx = {
      venta: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'venta-1',
          totalVenta: new Prisma.Decimal(480000),
        }),
      },
      sublote: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue({
          pesoActual: new Prisma.Decimal(20),
        }),
      },
      ventaDetalle: {
        create: jest.fn(),
      },
      inventarioMovimiento: {
        create: jest.fn(),
      },
      inventario: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
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

    await expect(
      procesarVenta(
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
      ),
    ).rejects.toBeInstanceOf(StockInsuficienteError);

    expect(tx.sublote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'sub-1',
          pesoActual: {
            gte: new Prisma.Decimal('40.00'),
          },
        }),
      }),
    );
    expect(tx.ventaDetalle.create).not.toHaveBeenCalled();
    expect(tx.inventarioMovimiento.create).not.toHaveBeenCalled();
    expect(tx.inventario.updateMany).not.toHaveBeenCalled();
  });

  it('revierte la venta si el inventario agregado no puede descontarse en la misma transaccion', async () => {
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
          pesoTotal: new Prisma.Decimal(20),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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

    await expect(
      procesarVenta(
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
      ),
    ).rejects.toBeInstanceOf(InventarioInconsistenteError);

    expect(tx.inventario.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          pesoTotal: {
            gte: new Prisma.Decimal('40.00'),
          },
        }),
        data: {
          pesoTotal: {
            decrement: new Prisma.Decimal('40.00'),
          },
        },
      }),
    );
  });

  it('vende todo el inventario disponible repartido en varios sublotes del mismo grupo', async () => {
    const tx = {
      venta: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'venta-1',
          totalVenta: new Prisma.Decimal(4776000),
        }),
      },
      sublote: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
      },
      ventaDetalle: {
        create: jest.fn(({ data }) =>
          Promise.resolve({
            id: `detalle-${data.subloteId}`,
            ...data,
          }),
        ),
      },
      inventarioMovimiento: {
        create: jest.fn().mockResolvedValue({ id: 'mov-1' }),
      },
      inventario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inventario-1',
          pesoTotal: new Prisma.Decimal(398),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      cliente: {
        findFirst: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 'sub-seco-1',
          pesoActual: new Prisma.Decimal(200),
          tipoCafeId: 'tipo-seco',
          calidadId: 'calidad-bueno',
        },
        {
          id: 'sub-seco-2',
          pesoActual: new Prisma.Decimal(198),
          tipoCafeId: 'tipo-seco',
          calidadId: 'calidad-bueno',
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
            subloteId: 'sub-seco-1',
            pesoVendido: 200,
            precioKg: 12000,
          },
          {
            subloteId: 'sub-seco-2',
            pesoVendido: 198,
            precioKg: 12000,
          },
        ],
      },
      prisma as never,
    );

    expect(tx.sublote.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.ventaDetalle.create).toHaveBeenCalledTimes(2);
    expect(tx.inventarioMovimiento.create).toHaveBeenCalledTimes(2);
    expect(tx.inventario.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.inventario.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tipoCafeId: 'tipo-seco',
          calidadId: 'calidad-bueno',
          pesoTotal: {
            gte: new Prisma.Decimal('398.00'),
          },
        }),
        data: {
          pesoTotal: {
            decrement: new Prisma.Decimal('398.00'),
          },
        },
      }),
    );
  });

  it('serializa dos ventas concurrentes del mismo sublote y rechaza la segunda sin dejar inventario negativo', async () => {
    let sublotePesoActual = 100;
    let inventarioPesoTotal = 100;
    let ventaSeq = 0;
    let lockTail = Promise.resolve();

    const prisma = {
      $transaction: jest.fn(async (callback) => {
        let liberarBloqueo: (() => void) | null = null;

        const tx = {
          venta: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn(({ data }) =>
              Promise.resolve({
                id: `venta-${++ventaSeq}`,
                totalVenta: data.totalVenta,
              }),
            ),
          },
          sublote: {
            updateMany: jest.fn(({ where, data }) => {
              const solicitado = Number(where.pesoActual.gte);

              if (sublotePesoActual < solicitado) {
                return Promise.resolve({ count: 0 });
              }

              sublotePesoActual -= Number(data.pesoActual.decrement);
              return Promise.resolve({ count: 1 });
            }),
            findFirst: jest.fn().mockImplementation(() =>
              Promise.resolve({
                pesoActual: new Prisma.Decimal(sublotePesoActual),
              }),
            ),
          },
          ventaDetalle: {
            create: jest.fn(({ data }) =>
              Promise.resolve({
                id: `detalle-${data.ventaId}`,
                ...data,
              }),
            ),
          },
          inventarioMovimiento: {
            create: jest.fn().mockResolvedValue({ id: 'mov-1' }),
          },
          inventario: {
            findUnique: jest.fn().mockImplementation(() =>
              Promise.resolve({
                id: 'inventario-1',
                pesoTotal: new Prisma.Decimal(inventarioPesoTotal),
              }),
            ),
            updateMany: jest.fn(({ where, data }) => {
              const solicitado = Number(where.pesoTotal.gte);

              if (inventarioPesoTotal < solicitado) {
                return Promise.resolve({ count: 0 });
              }

              inventarioPesoTotal -= Number(data.pesoTotal.decrement);
              return Promise.resolve({ count: 1 });
            }),
          },
          cliente: {
            findFirst: jest.fn(),
          },
          $queryRaw: jest.fn(async () => {
            const bloqueoAnterior = lockTail;
            let liberarActual!: () => void;
            const bloqueoActual = new Promise<void>((resolve) => {
              liberarActual = resolve;
            });

            lockTail = bloqueoAnterior.then(() => bloqueoActual);
            await bloqueoAnterior;
            liberarBloqueo = liberarActual;

            return [
              {
                id: 'sub-1',
                pesoActual: new Prisma.Decimal(sublotePesoActual),
                tipoCafeId: 'tipo-1',
                calidadId: 'calidad-1',
              },
            ];
          }),
        };

        try {
          return await callback(tx);
        } finally {
          liberarBloqueo?.();
        }
      }),
    };

    const ventaA = procesarVenta(
      {
        organizacionId: 'org-1',
        userId: 'user-1',
        deviceId: 'device-1',
        localId: 'venta-local-a',
        detalles: [
          {
            subloteId: 'sub-1',
            pesoVendido: 80,
            precioKg: 12000,
          },
        ],
      },
      prisma as never,
    );
    const ventaB = procesarVenta(
      {
        organizacionId: 'org-1',
        userId: 'user-1',
        deviceId: 'device-1',
        localId: 'venta-local-b',
        detalles: [
          {
            subloteId: 'sub-1',
            pesoVendido: 50,
            precioKg: 12000,
          },
        ],
      },
      prisma as never,
    );

    const resultados = await Promise.allSettled([ventaA, ventaB]);
    const exitosas = resultados.filter(
      (resultado) => resultado.status === 'fulfilled',
    );
    const fallidas = resultados.filter(
      (resultado): resultado is PromiseRejectedResult =>
        resultado.status === 'rejected',
    );

    expect(exitosas).toHaveLength(1);
    expect(fallidas).toHaveLength(1);
    expect(fallidas[0].reason).toBeInstanceOf(StockInsuficienteError);
    expect(sublotePesoActual).toBe(20);
    expect(inventarioPesoTotal).toBe(20);
    expect(sublotePesoActual).toBeGreaterThanOrEqual(0);
    expect(inventarioPesoTotal).toBeGreaterThanOrEqual(0);
  });
});
