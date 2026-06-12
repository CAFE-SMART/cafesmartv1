import { ClientesService } from './clientes.service';

describe('ClientesService', () => {
  function crearServiceConPrisma(prisma: unknown) {
    return new ClientesService(prisma as never);
  }

  it('lista clientes con busqueda, orden y paginacion', async () => {
    const createdAt = new Date('2026-06-01T12:00:00.000Z');
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ organizacionId: 'org-1' }),
      },
      cliente: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cliente-1',
            nombre: 'Cliente Alfa',
            documento: '123',
            telefono: '3001234567',
            createdAt,
          },
        ]),
      },
    };
    const service = crearServiceConPrisma(prisma);

    await expect(
      service.listar('user-1', {
        q: 'alfa',
        limit: 10,
        offset: 5,
        orden: 'az',
      }),
    ).resolves.toEqual([
      {
        id: 'cliente-1',
        nombre: 'Cliente Alfa',
        documento: '123',
        telefono: '3001234567',
        createdAt: createdAt.toISOString(),
      },
    ]);

    expect(prisma.cliente.findMany).toHaveBeenCalledWith({
      where: {
        organizacionId: 'org-1',
        deletedAt: null,
        OR: [
          { nombre: { contains: 'alfa', mode: 'insensitive' } },
          { documento: { contains: 'alfa', mode: 'insensitive' } },
          { telefono: { contains: 'alfa', mode: 'insensitive' } },
        ],
      },
      orderBy: [{ nombre: 'asc' }, { createdAt: 'desc' }],
      take: 10,
      skip: 5,
      select: {
        id: true,
        nombre: true,
        documento: true,
        telefono: true,
        createdAt: true,
      },
    });
  });
});
