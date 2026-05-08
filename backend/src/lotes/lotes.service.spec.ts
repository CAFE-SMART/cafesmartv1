import { LotesService } from './lotes.service';

describe('LotesService - resultados financieros por sublote', () => {
  const service = new LotesService({} as never);

  const calcularGastosPorSublote = (
    service as unknown as {
      calcularGastosPorSublote: (
        gastosSublote: Array<{
          gastoOperativoId: string;
          subloteId: string;
          gastoOperativo: { montoGasto: number };
        }>,
        sublotes: Array<{ id: string; pesoActual: number }>,
        ventasPorSublote: Map<
          string,
          { pesoVendido: number; totalVentas: number }
        >,
        gastosGenerales?: Array<{ montoGasto: number }>,
      ) => Map<string, number>;
      calcularGastosGeneralesPorSublote: (
        gastosGenerales: Array<{ montoGasto: number }>,
        sublotes: Array<{ id: string; pesoActual: number }>,
        ventasPorSublote: Map<
          string,
          { pesoVendido: number; totalVentas: number }
        >,
      ) => Map<string, number>;
      combinarGastosPorSublote: (
        gastosAsociados: Map<string, number>,
        gastosGenerales: Map<string, number>,
      ) => Map<string, number>;
      calcularFinancieroSubloteResumen: (
        sublote: {
          costoTotal: number;
          pesoInicial: number;
          pesoActual: number;
        },
        venta: { pesoVendido: number; totalVentas: number } | undefined,
        totalGastos: number,
      ) => {
        totalGastos: number;
        utilidadNeta: number;
        mermaKg: number;
        mermaPorcentaje: number;
        mermaValor: number;
      };
    }
  ).calcularGastosPorSublote.bind(service);

  const calcularGastosGeneralesPorSublote = (
    service as unknown as {
      calcularGastosGeneralesPorSublote: (
        gastosGenerales: Array<{ montoGasto: number }>,
        sublotes: Array<{ id: string; pesoActual: number }>,
        ventasPorSublote: Map<
          string,
          { pesoVendido: number; totalVentas: number }
        >,
      ) => Map<string, number>;
    }
  ).calcularGastosGeneralesPorSublote.bind(service);

  const combinarGastosPorSublote = (
    service as unknown as {
      combinarGastosPorSublote: (
        gastosAsociados: Map<string, number>,
        gastosGenerales: Map<string, number>,
      ) => Map<string, number>;
    }
  ).combinarGastosPorSublote.bind(service);

  const calcularFinancieroSubloteResumen = (
    service as unknown as {
      calcularFinancieroSubloteResumen: (
        sublote: {
          costoTotal: number;
          pesoInicial: number;
          pesoActual: number;
        },
        venta: { pesoVendido: number; totalVentas: number } | undefined,
        totalGastos: number,
      ) => {
        totalGastos: number;
        utilidadNeta: number;
        mermaKg: number;
        mermaPorcentaje: number;
        mermaValor: number;
      };
    }
  ).calcularFinancieroSubloteResumen.bind(service);

  const subloteBase = {
    costoTotal: 1000,
    pesoInicial: 100,
    pesoActual: 90,
  };

  const venta = {
    pesoVendido: 10,
    totalVentas: 1500,
  };

  const sublotes = [
    { id: 'sub-1', pesoActual: 90 },
    { id: 'sub-2', pesoActual: 100 },
  ];

  const ventasPorSublote = new Map([
    ['sub-1', venta],
    ['sub-2', { pesoVendido: 0, totalVentas: 0 }],
  ]);

  it('calcula utilidad y merma sin gastos', () => {
    const gastosPorSublote = calcularGastosPorSublote(
      [],
      sublotes,
      ventasPorSublote,
    );
    const resultado = calcularFinancieroSubloteResumen(
      subloteBase,
      venta,
      gastosPorSublote.get('sub-1') ?? 0,
    );

    expect(resultado.totalGastos).toBe(0);
    expect(resultado.mermaKg).toBe(0);
    expect(resultado.mermaPorcentaje).toBe(0);
    expect(resultado.mermaValor).toBe(0);
    expect(resultado.utilidadNeta).toBe(1400);
  });

  it('prorratea un gasto general por peso base y recalcula utilidad', () => {
    const gastosPorSublote = combinarGastosPorSublote(
      calcularGastosPorSublote([], sublotes, ventasPorSublote),
      calcularGastosGeneralesPorSublote(
        [{ montoGasto: 200 }],
        sublotes,
        ventasPorSublote,
      ),
    );
    const resultado = calcularFinancieroSubloteResumen(
      subloteBase,
      venta,
      gastosPorSublote.get('sub-1') ?? 0,
    );

    expect(resultado.totalGastos).toBe(100);
    expect(resultado.utilidadNeta).toBe(1300);
  });

  it('combina gastos asociados y generales para el mismo sublote', () => {
    const gastosAsociados = calcularGastosPorSublote(
      [
        {
          gastoOperativoId: 'gasto-sub-1',
          subloteId: 'sub-1',
          gastoOperativo: { montoGasto: 60 },
        },
      ],
      sublotes,
      ventasPorSublote,
    );
    const gastosGenerales = calcularGastosGeneralesPorSublote(
      [{ montoGasto: 200 }],
      sublotes,
      ventasPorSublote,
    );
    const gastosPorSublote = combinarGastosPorSublote(
      gastosAsociados,
      gastosGenerales,
    );
    const resultado = calcularFinancieroSubloteResumen(
      subloteBase,
      venta,
      gastosPorSublote.get('sub-1') ?? 0,
    );

    expect(resultado.totalGastos).toBe(160);
    expect(resultado.utilidadNeta).toBe(1240);
  });

  it('asigna un gasto asociado al sublote y recalcula utilidad', () => {
    const sinGasto = calcularFinancieroSubloteResumen(subloteBase, venta, 0);
    const gastosPorSublote = calcularGastosPorSublote(
      [
        {
          gastoOperativoId: 'gasto-sub-1',
          subloteId: 'sub-1',
          gastoOperativo: { montoGasto: 60 },
        },
      ],
      sublotes,
      ventasPorSublote,
    );
    const conGasto = calcularFinancieroSubloteResumen(
      subloteBase,
      venta,
      gastosPorSublote.get('sub-1') ?? 0,
    );

    expect(conGasto.totalGastos).toBe(60);
    expect(conGasto.utilidadNeta).toBe(1340);
    expect(conGasto.utilidadNeta).toBe(sinGasto.utilidadNeta - 60);
  });
});
