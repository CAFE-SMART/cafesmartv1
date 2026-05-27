import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  function crearServicioConMocks() {
    const prisma = {
      $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
      user: {
        findUnique: jest.fn().mockResolvedValue({ organizacionId: 'org-1' }),
      },
      compra: {
        count: jest.fn(),
        aggregate: jest.fn(),
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

    const service = new DashboardService(
      prisma as never,
      parametrosService as never,
    );

    return { service, prisma };
  }

  it('actualiza indicadores al volver a consultar despues de compra, venta y gasto', async () => {
    const { service, prisma } = crearServicioConMocks();
    const fecha = new Date('2026-04-30T14:00:00.000Z');

    prisma.compra.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    prisma.venta.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    prisma.gastoOperativo.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    prisma.sublote.aggregate
      .mockResolvedValueOnce({ _sum: { pesoInicial: null } })
      .mockResolvedValueOnce({ _sum: { pesoInicial: 120 } });
    prisma.compra.aggregate
      .mockResolvedValueOnce({ _sum: { totalCompra: null } })
      .mockResolvedValueOnce({ _sum: { totalCompra: 600000 } });
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
    prisma.sublote.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'sublote-1',
        pesoInicial: 120,
        pesoActual: 85,
        costoTotal: 600000,
        tipoCafeId: 'tipo-seco',
        tipoCafe: { nombre: 'SECO' },
      },
    ]);
    prisma.ventaDetalle.findMany.mockResolvedValue([]);
    prisma.gastoSublote.findMany.mockResolvedValue([]);

    prisma.compra.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'compra-1',
        fecha,
        creadoEn: fecha,
        totalCompra: 600000,
        productor: { nombre: 'Finca Norte' },
        sublotes: [{ pesoInicial: 120 }],
      },
    ]);
    prisma.venta.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
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
      .mockResolvedValue([])
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
      totalComprasHoy: 0,
      totalGastosHoy: 0,
      kgActual: 0,
      movimientosRecientes: [],
    });

    expect(actualizado).toMatchObject({
      comprasHoy: 1,
      ventasHoy: 1,
      gastosHoy: 1,
      kgCompradosHoy: 120,
      totalComprasHoy: 600000,
      totalGastosHoy: 45000,
      kgActual: 85,
    });
    expect(actualizado.inventarioPorTipo).toEqual([
      {
        tipoCafeId: 'tipo-seco',
        tipoCafe: 'SECO',
        kgDisponible: 85,
      },
    ]);
    expect(prisma.inventario.aggregate).not.toHaveBeenCalled();
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

  it('no descuenta gastos de inventario no vendido en la utilidad realizada', async () => {
    const { service, prisma } = crearServicioConMocks();

    prisma.compra.count.mockResolvedValue(1);
    prisma.venta.count.mockResolvedValue(0);
    prisma.gastoOperativo.count.mockResolvedValue(1);
    prisma.sublote.aggregate.mockResolvedValue({ _sum: { pesoInicial: 100 } });
    prisma.compra.aggregate.mockResolvedValue({
      _sum: { totalCompra: 900000 },
    });
    prisma.venta.aggregate.mockResolvedValue({ _sum: { totalVenta: null } });
    prisma.gastoOperativo.aggregate.mockResolvedValue({
      _sum: { montoGasto: 100000 },
    });
    prisma.productor.count.mockResolvedValue(1);
    prisma.inventario.aggregate.mockResolvedValue({ _sum: { pesoTotal: 100 } });
    prisma.compra.findMany.mockResolvedValue([]);
    prisma.venta.findMany.mockResolvedValue([]);
    prisma.gastoOperativo.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ montoGasto: 100000 }]);
    prisma.sublote.findMany.mockResolvedValue([
      {
        id: 'sublote-1',
        pesoInicial: 100,
        pesoActual: 100,
        costoTotal: 900000,
        tipoCafeId: 'tipo-verde',
        tipoCafe: { nombre: 'VERDE' },
      },
    ]);
    prisma.ventaDetalle.findMany.mockResolvedValue([]);
    prisma.gastoSublote.findMany.mockResolvedValue([]);

    const resumen = await service.obtenerResumen('user-1');

    expect(resumen.utilidadTotalAcumulada).toBe(0);
    expect(resumen.mermaTotalKg).toBe(0);
  });

  it('calcula utilidad realizada con ventas, costo vendido y gasto proporcional', async () => {
    const { service, prisma } = crearServicioConMocks();

    prisma.compra.count.mockResolvedValue(1);
    prisma.venta.count.mockResolvedValue(1);
    prisma.gastoOperativo.count.mockResolvedValue(1);
    prisma.sublote.aggregate.mockResolvedValue({ _sum: { pesoInicial: 100 } });
    prisma.compra.aggregate.mockResolvedValue({
      _sum: { totalCompra: 900000 },
    });
    prisma.venta.aggregate.mockResolvedValue({ _sum: { totalVenta: 1904000 } });
    prisma.gastoOperativo.aggregate.mockResolvedValue({
      _sum: { montoGasto: 100000 },
    });
    prisma.productor.count.mockResolvedValue(1);
    prisma.inventario.aggregate.mockResolvedValue({ _sum: { pesoTotal: 40 } });
    prisma.compra.findMany.mockResolvedValue([]);
    prisma.venta.findMany.mockResolvedValue([]);
    prisma.gastoOperativo.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ montoGasto: 100000 }]);
    prisma.sublote.findMany.mockResolvedValue([
      {
        id: 'sublote-1',
        pesoInicial: 100,
        pesoActual: 40,
        costoTotal: 900000,
        tipoCafeId: 'tipo-verde',
        tipoCafe: { nombre: 'VERDE' },
      },
    ]);
    prisma.ventaDetalle.findMany.mockResolvedValue([
      {
        subloteId: 'sublote-1',
        pesoVendido: 60,
        subtotal: 1904000,
      },
    ]);
    prisma.gastoSublote.findMany.mockResolvedValue([]);

    const resumen = await service.obtenerResumen('user-1');

    expect(resumen.utilidadTotalAcumulada).toBe(1304000);
    expect(resumen.mermaTotalKg).toBe(0);
  });

  it('devuelve inicio completo con bodega vacia y sin movimientos', async () => {
    const { service, prisma } = crearServicioConMocks();

    prisma.compra.count.mockResolvedValue(0);
    prisma.venta.count.mockResolvedValue(0);
    prisma.gastoOperativo.count.mockResolvedValue(0);
    prisma.sublote.aggregate.mockResolvedValue({ _sum: { pesoInicial: null } });
    prisma.compra.aggregate.mockResolvedValue({ _sum: { totalCompra: null } });
    prisma.venta.aggregate.mockResolvedValue({ _sum: { totalVenta: null } });
    prisma.gastoOperativo.aggregate.mockResolvedValue({
      _sum: { montoGasto: null },
    });
    prisma.productor.count.mockResolvedValue(0);
    prisma.compra.findMany.mockResolvedValue([]);
    prisma.venta.findMany.mockResolvedValue([]);
    prisma.gastoOperativo.findMany.mockResolvedValue([]);
    prisma.sublote.findMany.mockResolvedValue([]);
    prisma.ventaDetalle.findMany.mockResolvedValue([]);
    prisma.gastoSublote.findMany.mockResolvedValue([]);

    const inicio = await service.obtenerInicio('user-1');

    expect(inicio).toMatchObject({
      comprasHoy: 0,
      ventasHoy: 0,
      gastosHoy: 0,
      kgCompradosHoy: 0,
      totalComprasHoy: 0,
      totalVentasHoy: 0,
      totalGastosHoy: 0,
      totalProductores: 0,
      kgActual: 0,
      kgCapacidad: 3000,
      inventarioPorTipo: [],
      inventarioBodega: [],
      movimientosRecientes: [],
    });
    expect(typeof inicio.updatedAt).toBe('string');
  });
});
