import { BadRequestException } from '@nestjs/common';
import { TipoMovimientoInventario, TipoReferenciaInventario } from '@prisma/client';
import { SecadoService } from './secado.service';

describe('SecadoService', () => {
  function crearMocks() {
    const tx = {
      sublote: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      tipoCafe: {
        findUnique: jest.fn(),
      },
      calidad: {
        findMany: jest.fn(),
      },
      lote: {
        upsert: jest.fn(),
      },
      inventario: {
        updateMany: jest.fn(),
        upsert: jest.fn(),
      },
      inventarioMovimiento: {
        create: jest.fn(),
      },
    };

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ organizacionId: 'org-1' }),
      },
      sublote: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };

    return { prisma, tx, service: new SecadoService(prisma as never) };
  }

  it('valida que el sublote exista y tenga peso disponible', async () => {
    const { prisma, service } = crearMocks();
    prisma.sublote.findFirst.mockResolvedValue(null);

    await expect(
      service.crearSecado('user-1', {
        subloteId: '11111111-1111-4111-8111-111111111111',
        pesoSalida: 10,
        calidadSalida: 'BUENO',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.sublote.findFirst.mockResolvedValue({ id: 'sub-1', pesoActual: 0 });

    await expect(
      service.crearSecado('user-1', {
        subloteId: '11111111-1111-4111-8111-111111111111',
        pesoSalida: 10,
        calidadSalida: 'BUENO',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('transforma el sublote a seco, actualiza inventarios y registra trazabilidad', async () => {
    const { prisma, tx, service } = crearMocks();
    const subloteId = '11111111-1111-4111-8111-111111111111';

    prisma.sublote.findFirst.mockResolvedValue({
      id: subloteId,
      pesoActual: 100,
    });
    tx.sublote.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: subloteId,
          pesoActual: 100,
          pesoInicial: 100,
          precioKg: 5000,
          costoTotal: 500000,
          compraId: 'compra-1',
          tipoCafeId: 'tipo-verde',
          calidadId: 'calidad-bueno',
        },
      ]);
    tx.tipoCafe.findUnique.mockResolvedValue({ id: 'tipo-seco' });
    tx.calidad.findMany.mockResolvedValue([{ id: 'calidad-seco', nombre: 'BUENO' }]);
    tx.sublote.updateMany.mockResolvedValue({ count: 1 });
    tx.inventario.updateMany.mockResolvedValue({ count: 1 });
    tx.lote.upsert.mockResolvedValue({ id: 'lote-seco' });
    tx.sublote.create.mockResolvedValue({
      id: 'sublote-seco',
      pesoActual: 80,
    });

    const result = await service.crearSecado('user-1', {
      subloteId,
      pesoSalida: 80,
      calidadSalida: 'BUENO',
    });

    expect(result).toMatchObject({
      totalEntradaKg: 100,
      totalSalidaKg: 80,
      totalMermaKg: 20,
      alreadyProcessed: false,
    });
    expect(tx.sublote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: subloteId }),
        data: { pesoActual: { decrement: 100 } },
      }),
    );
    expect(tx.inventario.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tipoCafeId: 'tipo-verde' }),
        data: { pesoTotal: { decrement: 100 } },
      }),
    );
    expect(tx.inventario.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tipoCafeId: 'tipo-seco',
          pesoTotal: 80,
        }),
        update: { pesoTotal: { increment: 80 } },
      }),
    );
    expect(tx.inventarioMovimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subloteId,
          cantidad: -100,
          tipoMovimiento: TipoMovimientoInventario.SECADO,
          referenciaTipo: TipoReferenciaInventario.SECADO,
          referenciaId: subloteId,
        }),
      }),
    );
    expect(tx.inventarioMovimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subloteId: 'sublote-seco',
          cantidad: 80,
          tipoMovimiento: TipoMovimientoInventario.SECADO,
          referenciaTipo: TipoReferenciaInventario.SECADO,
          referenciaId: subloteId,
        }),
      }),
    );
  });
});
