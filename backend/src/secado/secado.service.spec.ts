import { BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TipoMovimientoInventario, TipoReferenciaInventario } from '@prisma/client';
import { CrearSecadoDto } from './dto/crear-secado.dto';
import { SecadoService } from './secado.service';

describe('SecadoService', () => {
  function crearMocks() {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ organizacionId: 'org-1' }),
      },
      sublote: {
        findFirst: jest.fn(),
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
      secadoSesion: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };

    return { prisma, tx, service: new SecadoService(prisma as never) };
  }

  const subloteId = '11111111-1111-4111-8111-111111111111';

  function fuenteVerde(overrides: Record<string, unknown> = {}) {
    return {
      id: subloteId,
      pesoActual: 32,
      pesoInicial: 32,
      precioKg: 5000,
      costoTotal: 160000,
      compraId: 'compra-1',
      tipoCafeId: 'tipo-verde',
      calidadId: 'calidad-bueno',
      tipoCafe: { nombre: 'VERDE' },
      calidad: { nombre: 'BUENO' },
      ...overrides,
    };
  }

  function prepararTransformacion(
    tx: ReturnType<typeof crearMocks>['tx'],
    fuentes: Array<Record<string, unknown>>,
  ) {
    tx.sublote.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(fuentes);
    tx.tipoCafe.findUnique.mockResolvedValue({ id: 'tipo-seco' });
    tx.calidad.findMany.mockResolvedValue([
      { id: 'calidad-seco', nombre: 'BUENO' },
    ]);
    tx.sublote.updateMany.mockResolvedValue({ count: 1 });
    tx.inventario.updateMany.mockResolvedValue({ count: 1 });
    tx.lote.upsert.mockResolvedValue({ id: 'lote-seco' });
    tx.sublote.create.mockResolvedValue({
      id: 'sublote-seco',
      pesoActual: 8,
    });
  }

  it('valida que el sublote exista y tenga peso disponible', async () => {
    const { tx, service } = crearMocks();
    tx.sublote.findFirst.mockResolvedValue(null);

    await expect(
      service.crearSecado('user-1', {
        subloteId: '11111111-1111-4111-8111-111111111111',
        pesoSalida: 10,
        calidadSalida: 'BUENO',
        humedad: 11,
        factor: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    tx.sublote.findFirst.mockResolvedValue({
      id: 'sub-1',
      pesoActual: 0,
      tipoCafe: { nombre: 'VERDE' },
    });

    await expect(
      service.crearSecado('user-1', {
        subloteId: '11111111-1111-4111-8111-111111111111',
        pesoSalida: 10,
        calidadSalida: 'BUENO',
        humedad: 11,
        factor: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza cuando el peso de salida supera el peso disponible', async () => {
    const { tx, service } = crearMocks();
    tx.sublote.findFirst.mockResolvedValue({
      id: 'sub-1',
      pesoActual: 100,
      tipoCafe: { nombre: 'VERDE' },
    });

    await expect(
      service.crearSecado('user-1', {
        subloteId: '11111111-1111-4111-8111-111111111111',
        pesoSalida: 120,
        calidadSalida: 'BUENO',
        humedad: 11,
        factor: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.sublote.updateMany).not.toHaveBeenCalled();
  });

  it('permite secado parcial, deja peso en origen, actualiza inventarios y registra trazabilidad', async () => {
    const { tx, service } = crearMocks();
    const subloteId = '11111111-1111-4111-8111-111111111111';

    tx.sublote.findFirst.mockResolvedValue({
      id: subloteId,
      pesoActual: 100,
      tipoCafe: { nombre: 'VERDE' },
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
          tipoCafe: { nombre: 'VERDE' },
          calidad: { nombre: 'BUENO' },
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
      humedad: 11,
      factor: 100,
    });

    expect(result).toMatchObject({
      totalEntradaKg: 80,
      totalSalidaKg: 80,
      totalMermaKg: 0,
      alreadyProcessed: false,
    });
    expect(tx.sublote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: subloteId,
          pesoActual: { gte: 80 },
        }),
        data: { pesoActual: 20 },
      }),
    );
    expect(tx.inventario.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tipoCafeId: 'tipo-verde' }),
        data: { pesoTotal: { decrement: 80 } },
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
          cantidad: -80,
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

  it('secado parcial conserva restante, crea seco y registra merma exacta', async () => {
    const { tx, service } = crearMocks();
    prepararTransformacion(tx, [fuenteVerde()]);
    tx.sublote.create.mockResolvedValue({
      id: 'sublote-seco',
      pesoActual: 8,
    });

    const result = await service.transformarSecado('user-1', {
      sessionId: 'secado-parcial-1',
      deviceId: 'device-1',
      fuentes: [{ id: subloteId, pesoKg: 10 }],
      salidas: [{ calidad: 'BUENO', pesoKg: 8, humedad: 11, factor: 100 }],
    });

    expect(result).toMatchObject({
      totalEntradaKg: 10,
      totalSalidaKg: 8,
      totalMermaKg: 2,
    });
    expect(tx.sublote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: subloteId,
          pesoActual: { gte: 10 },
        }),
        data: { pesoActual: 22 },
      }),
    );
    expect(tx.sublote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pesoInicial: 8,
          pesoActual: 8,
        }),
      }),
    );
    expect(tx.inventarioMovimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cantidad: 2,
          tipoMovimiento: TipoMovimientoInventario.MERMA_SECADO,
        }),
      }),
    );
  });

  it('secado total deja el origen en cero, crea seco y registra merma', async () => {
    const { tx, service } = crearMocks();
    prepararTransformacion(tx, [fuenteVerde()]);
    tx.sublote.create.mockResolvedValue({
      id: 'sublote-seco',
      pesoActual: 27,
    });

    const result = await service.transformarSecado('user-1', {
      sessionId: 'secado-total-1',
      deviceId: 'device-1',
      fuentes: [{ id: subloteId, pesoKg: 32 }],
      salidas: [{ calidad: 'BUENO', pesoKg: 27, humedad: 11, factor: 100 }],
    });

    expect(result).toMatchObject({
      totalEntradaKg: 32,
      totalSalidaKg: 27,
      totalMermaKg: 5,
    });
    expect(tx.sublote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { pesoActual: 0 },
      }),
    );
    expect(tx.inventario.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ pesoTotal: 27 }),
        update: { pesoTotal: { increment: 27 } },
      }),
    );
    expect(tx.inventarioMovimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cantidad: 5,
          tipoMovimiento: TipoMovimientoInventario.MERMA_SECADO,
        }),
      }),
    );
  });

  it('rechaza peso mayor al disponible sin crear seco ni actualizar inventario', async () => {
    const { tx, service } = crearMocks();
    prepararTransformacion(tx, [fuenteVerde()]);

    await expect(
      service.transformarSecado('user-1', {
        sessionId: 'secado-peso-mayor',
        deviceId: 'device-1',
        fuentes: [{ id: subloteId, pesoKg: 40 }],
        salidas: [{ calidad: 'BUENO', pesoKg: 30, humedad: 11, factor: 100 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.sublote.updateMany).not.toHaveBeenCalled();
    expect(tx.sublote.create).not.toHaveBeenCalled();
    expect(tx.inventario.updateMany).not.toHaveBeenCalled();
    expect(tx.inventario.upsert).not.toHaveBeenCalled();
  });

  it('solo modifica los sublotes enviados como fuente de secado', async () => {
    const { tx, service } = crearMocks();
    prepararTransformacion(tx, [fuenteVerde({ id: 'VB-01' })]);

    await service.transformarSecado('user-1', {
      sessionId: 'secado-solo-vb01',
      deviceId: 'device-1',
      fuentes: [{ id: 'VB-01', pesoKg: 10 }],
      salidas: [{ calidad: 'BUENO', pesoKg: 8, humedad: 11, factor: 100 }],
    });

    expect(tx.sublote.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.sublote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'VB-01' }),
      }),
    );
    expect(tx.sublote.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'VB-02' }),
      }),
    );
    expect(tx.sublote.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'VB-03' }),
      }),
    );
  });

  it('evita duplicar una sesion ya registrada y no descuenta inventario otra vez', async () => {
    const { tx, service } = crearMocks();
    tx.sublote.findMany.mockResolvedValueOnce([
      { id: 'sublote-seco-existente', localId: 'secado-duplicado-BUENO' },
    ]);

    await expect(
      service.transformarSecado('user-1', {
        sessionId: 'secado-duplicado',
        deviceId: 'device-1',
        fuentes: [{ id: subloteId, pesoKg: 10 }],
        salidas: [{ calidad: 'BUENO', pesoKg: 8, humedad: 11, factor: 100 }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.sublote.updateMany).not.toHaveBeenCalled();
    expect(tx.sublote.create).not.toHaveBeenCalled();
    expect(tx.inventario.updateMany).not.toHaveBeenCalled();
    expect(tx.inventarioMovimiento.create).not.toHaveBeenCalled();
  });

  it('usa transaccion y revierte efectos persistentes si falla la creacion del sublote seco', async () => {
    const { prisma, tx, service } = crearMocks();
    const persistedEffects: string[] = [];

    prisma.$transaction.mockImplementation(async (callback) => {
      try {
        return await callback(tx);
      } catch (error) {
        persistedEffects.length = 0;
        throw error;
      }
    });
    prepararTransformacion(tx, [fuenteVerde()]);
    tx.sublote.updateMany.mockImplementation(async () => {
      persistedEffects.push('origen-actualizado');
      return { count: 1 };
    });
    tx.inventario.updateMany.mockImplementation(async () => {
      persistedEffects.push('inventario-verde-actualizado');
      return { count: 1 };
    });
    tx.sublote.create.mockRejectedValue(new Error('fallo creando seco'));

    await expect(
      service.transformarSecado('user-1', {
        sessionId: 'secado-transaccion',
        deviceId: 'device-1',
        fuentes: [{ id: subloteId, pesoKg: 10 }],
        salidas: [{ calidad: 'BUENO', pesoKg: 8, humedad: 11, factor: 100 }],
      }),
    ).rejects.toThrow('fallo creando seco');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.sublote.create).toHaveBeenCalled();
    expect(persistedEffects).toEqual([]);
  });

  it('registra la merma de secado como movimiento trazable sin descontar inventario dos veces', async () => {
    const { tx, service } = crearMocks();
    const subloteId = '11111111-1111-4111-8111-111111111111';

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
          tipoCafe: { nombre: 'VERDE' },
          calidad: { nombre: 'BUENO' },
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

    const result = await service.transformarSecado('user-1', {
      sessionId: 'secado-session-1',
      deviceId: 'device-1',
      fuentes: [{ id: subloteId, pesoKg: 100 }],
      salidas: [
        {
          calidad: 'BUENO',
          pesoKg: 80,
          humedad: 11,
          factor: 100,
        },
      ],
    });

    expect(result).toMatchObject({
      totalEntradaKg: 100,
      totalSalidaKg: 80,
      totalMermaKg: 20,
      alreadyProcessed: false,
    });
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
          cantidad: 20,
          tipoMovimiento: TipoMovimientoInventario.MERMA_SECADO,
          referenciaTipo: TipoReferenciaInventario.SECADO,
          referenciaId: 'secado-session-1',
        }),
      }),
    );
    expect(tx.inventarioMovimiento.create).toHaveBeenCalledTimes(3);
  });

  it('valida humedad, factor y peso en el DTO de creacion', async () => {
    const dto = plainToInstance(CrearSecadoDto, {
      subloteId: '11111111-1111-4111-8111-111111111111',
      pesoSalida: 0.01,
      calidadSalida: 'BUENO',
      humedad: 16,
      factor: 121,
    });

    const errors = await validate(dto);
    const messages = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );

    expect(messages).toEqual(
      expect.arrayContaining([
        'El peso de salida debe ser minimo 0.1 kg',
        'La humedad no puede superar 14%',
        'El factor no puede ser mayor a 120',
      ]),
    );
  });
});
