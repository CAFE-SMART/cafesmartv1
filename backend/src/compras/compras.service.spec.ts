import { ComprasService } from './compras.service';

describe('ComprasService - validacion de capacidad fail-safe', () => {
  function crearServiceConPrisma(prisma: unknown) {
    return new ComprasService(prisma as never) as unknown as {
      obtenerContextoCapacidad: (
        tx: unknown,
        organizacionId: string,
      ) => Promise<{
        capacidadBodegaKg: number;
        inventarioActualKg: number;
      } | null>;
    };
  }

  it('calcula ocupacion desde sublotes activos para evitar snapshots viejos', async () => {
    const prisma = {
      parametroOrganizacion: {
        findUnique: jest.fn().mockResolvedValue({ valor: '3000' }),
      },
      inventario: {
        aggregate: jest.fn(),
      },
      sublote: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { pesoActual: 850 },
        }),
      },
    };
    const service = crearServiceConPrisma(prisma);

    await expect(
      service.obtenerContextoCapacidad(prisma, 'org-1'),
    ).resolves.toEqual({
      capacidadBodegaKg: 3000,
      inventarioActualKg: 850,
    });
    expect(prisma.inventario.aggregate).not.toHaveBeenCalled();
    expect(prisma.sublote.aggregate).toHaveBeenCalledWith({
      _sum: { pesoActual: true },
      where: {
        deletedAt: null,
        compra: {
          organizacionId: 'org-1',
          deletedAt: null,
        },
      },
    });
  });

  it('propaga errores si no puede calcular los sublotes activos', async () => {
    const prisma = {
      parametroOrganizacion: {
        findUnique: jest.fn().mockResolvedValue({ valor: '3000' }),
      },
      inventario: {
        aggregate: jest.fn(),
      },
      sublote: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { pesoActual: Number.NaN },
        }),
      },
    };
    const service = crearServiceConPrisma(prisma);

    await expect(
      service.obtenerContextoCapacidad(prisma, 'org-1'),
    ).rejects.toThrow('El fallback de sublotes devolvio un valor invalido');
  });
});
