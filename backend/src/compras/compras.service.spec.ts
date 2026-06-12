import { ComprasService } from './compras.service';

describe('ComprasService', () => {
  function crearServiceConPrisma(prisma: unknown) {
    return new ComprasService(prisma as never) as unknown as {
      obtenerCatalogos: (userId: string) => Promise<{
        tiposCafe: { id: string; nombre: string }[];
        calidades: { id: string; nombre: string }[];
      }>;
      obtenerContextoCapacidad: (
        tx: unknown,
        organizacionId: string,
      ) => Promise<{
        capacidadBodegaKg: number;
        inventarioActualKg: number;
      } | null>;
    };
  }

  it('incluye cafe trillado en los catalogos de compras para cuentas nuevas', async () => {
    const prisma = {
      tipoCafe: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'tipo-pasilla', nombre: 'PASILLA' },
          { id: 'tipo-trillado', nombre: 'TRILLADO' },
          { id: 'tipo-verde', nombre: 'VERDE' },
          { id: 'tipo-seco', nombre: 'SECO' },
        ]),
      },
      calidad: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'calidad-bueno', nombre: 'BUENO' },
          { id: 'calidad-regular', nombre: 'REGULAR' },
          { id: 'calidad-malo', nombre: 'MALO' },
        ]),
      },
    };
    const service = crearServiceConPrisma(prisma);

    const catalogos = await service.obtenerCatalogos('user-1');

    expect(catalogos.tiposCafe.map((tipoCafe) => tipoCafe.nombre)).toEqual([
      'VERDE',
      'SECO',
      'TRILLADO',
      'PASILLA',
    ]);
    expect(prisma.tipoCafe.createMany).toHaveBeenCalledWith({
      data: [
        { nombre: 'VERDE' },
        { nombre: 'SECO' },
        { nombre: 'TRILLADO' },
        { nombre: 'PASILLA' },
      ],
      skipDuplicates: true,
    });
  });

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
