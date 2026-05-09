import { ComprasService } from './compras.service';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => Promise<void> | void) => void;
declare const expect: any;
declare const jest: {
  fn: (implementation?: (...args: any[]) => any) => any;
};

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

  it('usa el snapshot de inventario como fuente primaria de ocupacion', async () => {
    const prisma = {
      parametroOrganizacion: {
        findUnique: jest.fn().mockResolvedValue({ valor: '3000' }),
      },
      inventario: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { pesoTotal: 850 },
        }),
      },
      sublote: {
        aggregate: jest.fn(),
      },
    };
    const service = crearServiceConPrisma(prisma);

    await expect(
      service.obtenerContextoCapacidad(prisma, 'org-1'),
    ).resolves.toEqual({
      capacidadBodegaKg: 3000,
      inventarioActualKg: 850,
    });
    expect(prisma.sublote.aggregate).not.toHaveBeenCalled();
  });

  it('si el snapshot falla, calcula ocupacion desde sublotes activos', async () => {
    const prisma = {
      parametroOrganizacion: {
        findUnique: jest.fn().mockResolvedValue({ valor: '3000' }),
      },
      inventario: {
        aggregate: jest.fn().mockRejectedValue(new Error('timeout inventario')),
      },
      sublote: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { pesoActual: 420 },
        }),
      },
    };
    const service = crearServiceConPrisma(prisma);

    await expect(
      service.obtenerContextoCapacidad(prisma, 'org-1'),
    ).resolves.toEqual({
      capacidadBodegaKg: 3000,
      inventarioActualKg: 420,
    });
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
});
