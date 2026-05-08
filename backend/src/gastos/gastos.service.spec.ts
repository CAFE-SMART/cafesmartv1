import { TipoGasto, EstadoPago } from '@prisma/client';
import { GastosService } from './gastos.service';

describe('GastosService - asociacion de sublotes', () => {
  const dtoBase = {
    conceptoGasto: 'Transporte',
    montoGasto: 50000,
    fechaGasto: '2026-05-07T12:00:00.000Z',
    tipoGasto: TipoGasto.TRANSPORTE,
    estadoPago: EstadoPago.PAGADO,
    asociarASublotes: true,
    subloteIds: ['sub-1'],
  };

  it('bloquea gastos asociados a sublotes sin inventario disponible', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ organizacionId: 'org-1' }),
      },
      sublote: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sub-1',
            pesoActual: 0,
          },
        ]),
      },
      $transaction: jest.fn(),
    };
    const service = new GastosService(prisma as never);

    await expect(service.crearGasto(dtoBase, 'user-1')).rejects.toMatchObject({
      response: {
        code: 'SUBLOTE_SIN_INVENTARIO',
        message:
          'No se pueden asociar gastos a sublotes que ya fueron vendidos.',
        field: 'subloteIds',
        details: {
          subloteIds: ['sub-1'],
        },
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('mantiene permitidos los gastos asociados a sublotes con inventario', async () => {
    const now = new Date('2026-05-07T12:00:00.000Z');
    const gastoGuardado = {
      id: 'gasto-1',
      conceptoGasto: 'Transporte',
      descripcion: null,
      montoGasto: 50000,
      fechaGasto: now,
      tipoGasto: TipoGasto.TRANSPORTE,
      estadoPago: EstadoPago.PAGADO,
      createdAt: now,
      updatedAt: now,
      sublotes: [
        {
          sublote: {
            id: 'sub-1',
            pesoActual: 25,
            tipoCafe: { nombre: 'VERDE' },
            calidad: { nombre: 'BUENO' },
          },
        },
      ],
    };
    const tx = {
      gastoOperativo: {
        create: jest.fn().mockResolvedValue({ id: 'gasto-1' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(gastoGuardado),
      },
      gastoSublote: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ organizacionId: 'org-1' }),
      },
      sublote: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sub-1',
            pesoActual: 25,
          },
        ]),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new GastosService(prisma as never);

    await expect(service.crearGasto(dtoBase, 'user-1')).resolves.toMatchObject({
      id: 'gasto-1',
      sublotes: [
        {
          id: 'sub-1',
          pesoActual: 25,
        },
      ],
    });
    expect(tx.gastoSublote.createMany).toHaveBeenCalledWith({
      data: [
        {
          gastoOperativoId: 'gasto-1',
          subloteId: 'sub-1',
        },
      ],
    });
  });
});
