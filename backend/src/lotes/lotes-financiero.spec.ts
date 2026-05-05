import { LotesService } from './lotes.service';

const USER_ID = 'user-1';
const ORGANIZATION_ID = 'org-1';
const SUBLOTE_ID = '11111111-1111-4111-8111-111111111111';

function createDecimal(value: number) {
  return value as any;
}

function createSublote(gastoAsociado = 0) {
  const detallesVenta = [
    {
      pesoVendido: createDecimal(50),
      subtotal: createDecimal(200000),
    },
  ];

  return {
    id: SUBLOTE_ID,
    pesoInicial: createDecimal(100),
    pesoActual: createDecimal(40),
    precioKg: createDecimal(1000),
    costoTotal: createDecimal(100000),
    humedad: null,
    factor: null,
    idLote: null,
    tipoCafeId: 'tipo-1',
    calidadId: 'calidad-1',
    creadoEn: new Date('2026-04-01T12:00:00Z'),
    compra: { fecha: new Date('2026-04-01T12:00:00Z') },
    lote: null,
    tipoCafe: { id: 'tipo-1', nombre: 'Verde' },
    calidad: { id: 'calidad-1', nombre: 'Bueno' },
    detallesVenta,
    gastosOperativos:
      gastoAsociado > 0
        ? [
            {
              gastoOperativo: {
                montoGasto: createDecimal(gastoAsociado),
                sublotes: [
                  {
                    sublote: {
                      pesoActual: createDecimal(40),
                      detallesVenta,
                    },
                  },
                ],
              },
            },
          ]
        : [],
  };
}

function createPrismaMock(options: { gastoGeneral?: number; gastoAsociado?: number }) {
  const sublote = createSublote(options.gastoAsociado ?? 0);

  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({ organizacionId: ORGANIZATION_ID }),
    },
    sublote: {
      findFirst: jest.fn().mockResolvedValue(sublote),
      findMany: jest.fn().mockResolvedValue([sublote]),
    },
    ventaDetalle: {
      findMany: jest.fn().mockResolvedValue([
        {
          subloteId: SUBLOTE_ID,
          pesoVendido: createDecimal(50),
          subtotal: createDecimal(200000),
        },
      ]),
    },
    gastoOperativo: {
      findMany: jest.fn().mockResolvedValue(
        options.gastoGeneral
          ? [{ montoGasto: createDecimal(options.gastoGeneral) }]
          : [],
      ),
    },
    $transaction: jest.fn((queries: Array<Promise<unknown>>) => Promise.all(queries)),
  };
}

describe('LotesService - resultados financieros por sublote', () => {
  it('calcula utilidad sin gastos', async () => {
    const service = new LotesService(createPrismaMock({}) as any);

    const result = await service.obtenerResultadosFinancierosSublote(USER_ID, SUBLOTE_ID);

    expect(result.mermaKg).toBe(10);
    expect(result.mermaValor).toBe(10000);
    expect(result.totalGastos).toBe(0);
    expect(result.utilidadNeta).toBe(140000);
  });

  it('recalcula utilidad con gasto general asignado al sublote', async () => {
    const service = new LotesService(createPrismaMock({ gastoGeneral: 10000 }) as any);

    const result = await service.obtenerResultadosFinancierosSublote(USER_ID, SUBLOTE_ID);

    expect(result.totalGastos).toBe(10000);
    expect(result.utilidadNeta).toBe(130000);
  });

  it('recalcula utilidad con gasto asociado al sublote', async () => {
    const service = new LotesService(createPrismaMock({ gastoAsociado: 5000 }) as any);

    const result = await service.obtenerResultadosFinancierosSublote(USER_ID, SUBLOTE_ID);

    expect(result.totalGastos).toBe(5000);
    expect(result.utilidadNeta).toBe(135000);
  });
});
