import { BadRequestException } from '@nestjs/common';
import {
  Prisma,
  TipoMovimientoInventario,
  TipoReferenciaInventario,
} from '@prisma/client';
import { SecadoService } from './secado.service';

describe('SecadoService - POST /secado', () => {
  function crearTxMock(overrides: Record<string, unknown> = {}) {
    return {
      user: {
        findUnique: jest.fn().mockResolvedValue({ organizacionId: 'org-1' }),
      },
      sublote: {
        findFirst: jest.fn().mockResolvedValue({
          id: '11111111-1111-4111-8111-111111111111',
          pesoActual: new Prisma.Decimal(100),
          pesoInicial: new Prisma.Decimal(100),
          precioKg: new Prisma.Decimal(12000),
          costoTotal: new Prisma.Decimal(1200000),
          compraId: 'compra-1',
          tipoCafeId: 'tipo-verde',
          calidadId: 'calidad-bueno',
          deviceId: 'device-1',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({
          id: '22222222-2222-4222-8222-222222222222',
          pesoInicial: new Prisma.Decimal(80),
          pesoActual: new Prisma.Decimal(80),
          tipoCafeId: 'tipo-seco',
          calidadId: 'calidad-regular',
        }),
      },
      tipoCafe: {
        findUnique: jest.fn().mockResolvedValue({ id: 'tipo-seco' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'tipo-seco' }),
      },
      calidad: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'calidad-regular', nombre: 'REGULAR' }),
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'calidad-regular', nombre: 'REGULAR' }),
      },
      inventario: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      lote: {
        upsert: jest.fn().mockResolvedValue({ id: 'lote-seco' }),
      },
      inventarioMovimiento: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      ...overrides,
    };
  }

  it('transforma un sublote completo dentro de una transaccion y registra trazabilidad', async () => {
    const tx = crearTxMock();
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new SecadoService(prisma as never);

    const result = await service.crearSecado('user-1', {
      subloteId: '11111111-1111-4111-8111-111111111111',
      pesoSalida: 80,
      calidadSalida: 'REGULAR',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.sublote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { pesoActual: { decrement: expect.any(Object) } },
      }),
    );
    expect(tx.inventario.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { pesoTotal: { decrement: expect.any(Object) } },
      }),
    );
    expect(tx.inventario.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ pesoTotal: 80 }),
        update: { pesoTotal: { increment: 80 } },
      }),
    );
    expect(tx.inventarioMovimiento.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          cantidad: -100,
          referenciaId: '11111111-1111-4111-8111-111111111111',
          subloteId: '11111111-1111-4111-8111-111111111111',
          tipoMovimiento: TipoMovimientoInventario.SECADO,
          referenciaTipo: TipoReferenciaInventario.SECADO,
        }),
        expect.objectContaining({
          cantidad: 80,
          referenciaId: '11111111-1111-4111-8111-111111111111',
          subloteId: '22222222-2222-4222-8222-222222222222',
          tipoMovimiento: TipoMovimientoInventario.SECADO,
          referenciaTipo: TipoReferenciaInventario.SECADO,
        }),
      ]),
    });
    expect(result).toMatchObject({
      subloteOrigenId: '11111111-1111-4111-8111-111111111111',
      pesoEntradaKg: 100,
      pesoSalidaKg: 80,
      mermaKg: 20,
    });
  });

  it('rechaza una salida mayor al peso actual antes de crear movimientos', async () => {
    const tx = crearTxMock();
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new SecadoService(prisma as never);

    await expect(
      service.crearSecado('user-1', {
        subloteId: '11111111-1111-4111-8111-111111111111',
        pesoSalida: 120,
        calidadSalida: 'REGULAR',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.sublote.updateMany).not.toHaveBeenCalled();
    expect(tx.inventarioMovimiento.createMany).not.toHaveBeenCalled();
  });
});
