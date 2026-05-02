import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  function crearServicioConMocks() {
    const prisma = {
      $transaction: jest.fn((operations: Array<Promise<unknown>>) => Promise.all(operations)),
      user: {
        findUnique: jest.fn().mockResolvedValue({ organizacionId: 'org-1' }),
      },
      compra: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      venta: {
        count: jest.fn(),
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      gastoOperativo: {
        count: jest.fn(),
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      sublote: {
        aggregate: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      ventaDetalle: {
        findMany: jest.fn(),
      },
      gastoSublote: {
        findMany: jest.fn(),
      },
      productor: {
        count: jest.fn(),
      },
      inventario: {
        aggregate: jest.fn(),
      },
    };

    const parametrosService = {
      getParametroString: jest.fn().mockResolvedValue('3000'),
    };

    const service = new DashboardService(prisma as never, parametrosService as never);

    return { service, prisma };
  }

  it('actualiza indicadores al volver a consultar despues de compra, venta y gasto', async () => {
    const { service, prisma } = crearServicioConMocks();
    const fecha = new Date('2026-04-30T14:00:00.000Z');

    prisma.compra.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    prisma.venta.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    prisma.gastoOperativo.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    prisma.sublote.aggregate
      .mockResolvedValueOnce({ _sum: { pesoInicial: null } })
      .mockResolvedValueOnce({ _sum: { pesoInicial: 120 } });
    prisma.gastoOperativo.aggregate
      .mockResolvedValueOnce({ _sum: { montoGasto: null } })
      .mockResolvedValueOnce({ _sum: { montoGasto: 45000 } });
    prisma.venta.aggregate
      .mockResolvedValueOnce({ _sum: { totalVenta: null } })
      .mockResolvedValueOnce({ _sum: { totalVenta: 700000 } });
    prisma.productor.count.mockResolvedValue(1);
    prisma.inventario.aggregate
      .mockResolvedValueOnce({ _sum: { pesoTotal: 0 } })
      .mockResolvedValueOnce({ _sum: { pesoTotal: 85 } });

    prisma.compra.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'compra-1',
          fecha,
          creadoEn: fecha,
          totalCompra: 600000,
          productor: { nombre: 'Finca Norte' },
          sublotes: [{ pesoInicial: 120 }],
        },
      ]);
    prisma.venta.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'venta-1',
          fecha,
          createdAt: new Date(fecha.getTime() + 1000),
          totalVenta: 700000,
          cliente: { nombre: 'Cliente Centro' },
          detalles: [{ pesoVendido: 35 }],
        },
      ]);
    prisma.gastoOperativo.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'gasto-1',
          conceptoGasto: 'Transporte',
          fechaGasto: fecha,
          createdAt: new Date(fecha.getTime() + 2000),
          montoGasto: 45000,
        },
      ]);

    const inicial = await service.obtenerResumen('user-1');
    const actualizado = await service.obtenerResumen('user-1');

    expect(inicial).toMatchObject({
      comprasHoy: 0,
      ventasHoy: 0,
      gastosHoy: 0,
      kgCompradosHoy: 0,
      totalGastosHoy: 0,
      kgActual: 0,
      movimientosRecientes: [],
    });

    expect(actualizado).toMatchObject({
      comprasHoy: 1,
      ventasHoy: 1,
      gastosHoy: 1,
      kgCompradosHoy: 120,
      totalGastosHoy: 45000,
      kgActual: 85,
    });
    expect(actualizado.movimientosRecientes).toEqual([
      expect.objectContaining({
        id: 'gasto-1',
        tipo: 'GASTO',
        nombre: 'Transporte',
        valor: 45000,
      }),
      expect.objectContaining({ id: 'venta-1', tipo: 'VENTA', kg: 35 }),
      expect.objectContaining({ id: 'compra-1', tipo: 'COMPRA', kg: 120 }),
    ]);
  });
});
