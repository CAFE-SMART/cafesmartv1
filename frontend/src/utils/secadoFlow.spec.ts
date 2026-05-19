import { beforeEach, describe, expect, it } from 'vitest';
import type {
  LoteDetalle,
  LoteResumen,
  SubloteDetalle,
} from '../services/lotesService';
import {
  applySecadoToDetalle,
  applySecadoToLots,
  clearSecadoSessions,
  createSecadoDraftWithWeights,
  finalizeSecado,
  saveSecadoResults,
  startSecadoProcess,
  startSecadoWithWeights,
} from './secadoFlow';

const FECHA = '2026-05-06T12:00:00.000Z';

function lote(overrides: Partial<LoteResumen> = {}): LoteResumen {
  return {
    id: 'lote-verde-bueno',
    codigo: 'VERDE BUENO',
    tipoCafeId: 'tipo-verde',
    tipoCafe: 'VERDE',
    calidadId: 'calidad-bueno',
    calidad: 'BUENO',
    sublotes: 1,
    sublotesConHumedad: 0,
    pesoInicial: 300,
    pesoActual: 300,
    precioPromedioKg: 12000,
    humedadPromedio: null,
    fecha: FECHA,
    fechaPrimerIngreso: FECHA,
    fechaUltimoIngreso: FECHA,
    diasEnBodegaMin: 0,
    diasEnBodegaMax: 0,
    creadoEn: FECHA,
    totalVentas: 0,
    totalGastos: 0,
    utilidadNeta: 0,
    mermaValor: 0,
    mermaKg: 0,
    ...overrides,
  };
}

function sublote(overrides: Partial<SubloteDetalle> = {}): SubloteDetalle {
  return {
    id: 'sub-verde-1',
    etiqueta: 'SUB-VERDE-1',
    tipoCafeId: 'tipo-verde',
    tipoCafe: 'VERDE',
    calidadId: 'calidad-bueno',
    calidad: 'BUENO',
    pesoInicial: 300,
    pesoActual: 300,
    precioKg: 12000,
    humedad: null,
    factor: null,
    fechaIngreso: FECHA,
    diasEnBodega: 0,
    creadoEn: FECHA,
    costoTotal: 3600000,
    totalVentas: 0,
    pesoVendido: 0,
    totalGastos: 0,
    mermaKg: 0,
    mermaPorcentaje: 0,
    mermaValor: 0,
    utilidadNeta: 0,
    costoPorKg: 12000,
    ...overrides,
  };
}

function detalleVerde(): LoteDetalle {
  return {
    lote: lote(),
    sublotes: [sublote()],
  };
}

function detalleVerdeDosSublotes(): LoteDetalle {
  return {
    lote: lote({
      sublotes: 2,
      pesoInicial: 300,
      pesoActual: 300,
    }),
    sublotes: [
      sublote({
        id: 'sub-verde-1',
        etiqueta: 'SUB-VERDE-1',
        pesoInicial: 200,
        pesoActual: 200,
        costoTotal: 2400000,
      }),
      sublote({
        id: 'sub-verde-2',
        etiqueta: 'SUB-VERDE-2',
        pesoInicial: 100,
        pesoActual: 100,
        costoTotal: 1200000,
      }),
    ],
  };
}

function detalleVerdeCuatroSublotes(): LoteDetalle {
  const sublotes = [
    sublote({
      id: 'sub-verde-1',
      etiqueta: 'SUB-VERDE-1',
      pesoInicial: 32,
      pesoActual: 32,
      costoTotal: 384000,
    }),
    sublote({
      id: 'sub-verde-2',
      etiqueta: 'SUB-VERDE-2',
      pesoInicial: 35,
      pesoActual: 35,
      costoTotal: 420000,
    }),
    sublote({
      id: 'sub-verde-3',
      etiqueta: 'SUB-VERDE-3',
      pesoInicial: 50,
      pesoActual: 50,
      costoTotal: 600000,
    }),
    sublote({
      id: 'sub-verde-4',
      etiqueta: 'SUB-VERDE-4',
      pesoInicial: 10,
      pesoActual: 10,
      costoTotal: 120000,
    }),
  ];

  return {
    lote: lote({
      sublotes: sublotes.length,
      pesoInicial: 127,
      pesoActual: 127,
    }),
    sublotes,
  };
}

describe('secadoFlow', () => {
  beforeEach(() => {
    clearSecadoSessions();
  });

  it('ignora sesiones completadas locales para no crear inventario seco fantasma', () => {
    const session = startSecadoWithWeights(detalleVerde(), {
      'sub-verde-1': 200,
    });
    saveSecadoResults(session.id, {
      outputBuenoKg: 180,
      outputBuenoHumedad: null,
      outputRegularKg: 0,
      outputRegularHumedad: null,
      outputMaloKg: 0,
      outputMaloHumedad: null,
    });
    finalizeSecado(session.id);

    const lotes = applySecadoToLots([
      lote(),
      lote({
        id: 'lote-seco-bueno',
        codigo: 'SECO BUENO',
        tipoCafeId: 'tipo-seco',
        tipoCafe: 'SECO',
        pesoInicial: 30,
        pesoActual: 30,
      }),
    ]);
    const verde = lotes.find((item) => item.id === 'lote-verde-bueno');
    const seco = lotes.find((item) => item.id === 'lote-seco-bueno');

    expect(verde?.pesoActual).toBe(300);
    expect(seco?.pesoActual).toBe(30);

    const detalleSeco = applySecadoToDetalle(
      {
        lote: lote({
          id: 'lote-seco-bueno',
          codigo: 'SECO BUENO',
          tipoCafeId: 'tipo-seco',
          tipoCafe: 'SECO',
          pesoInicial: 30,
          pesoActual: 30,
        }),
        sublotes: [
          sublote({
            id: 'sub-seco-real-1',
            etiqueta: 'SUB-SECO-REAL-1',
            tipoCafeId: 'tipo-seco',
            tipoCafe: 'SECO',
            pesoInicial: 30,
            pesoActual: 30,
          }),
        ],
      },
      'tipo-seco',
      'calidad-bueno',
    );

    expect(detalleSeco?.sublotes.map((item) => item.id)).toEqual([
      'sub-seco-real-1',
    ]);
  });

  it('mantiene ventas sin sublotes secos virtuales aunque exista una sesion local completada', () => {
    const session = startSecadoWithWeights(detalleVerde(), {
      'sub-verde-1': 200,
    });
    saveSecadoResults(session.id, {
      outputBuenoKg: 180,
      outputBuenoHumedad: null,
      outputRegularKg: 0,
      outputRegularHumedad: null,
      outputMaloKg: 0,
      outputMaloHumedad: null,
    });
    finalizeSecado(session.id);

    const lotesVenta = applySecadoToLots(
      [
        lote(),
        lote({
          id: 'lote-seco-bueno',
          codigo: 'SECO BUENO',
          tipoCafeId: 'tipo-seco',
          tipoCafe: 'SECO',
          pesoInicial: 30,
          pesoActual: 30,
        }),
      ],
      { includeGeneratedOutputs: false },
    );
    const verde = lotesVenta.find((item) => item.id === 'lote-verde-bueno');
    const seco = lotesVenta.find((item) => item.id === 'lote-seco-bueno');

    expect(verde?.pesoActual).toBe(300);
    expect(seco?.pesoActual).toBe(30);

    const detalleSecoVenta = applySecadoToDetalle(
      {
        lote: lote({
          id: 'lote-seco-bueno',
          codigo: 'SECO BUENO',
          tipoCafeId: 'tipo-seco',
          tipoCafe: 'SECO',
          pesoInicial: 30,
          pesoActual: 30,
        }),
        sublotes: [
          sublote({
            id: 'sub-seco-real-1',
            etiqueta: 'SUB-SECO-REAL-1',
            tipoCafeId: 'tipo-seco',
            tipoCafe: 'SECO',
            pesoInicial: 30,
            pesoActual: 30,
          }),
        ],
      },
      'tipo-seco',
      'calidad-bueno',
      { includeGeneratedOutputs: false },
    );

    expect(detalleSecoVenta?.sublotes.map((item) => item.id)).toEqual([
      'sub-seco-real-1',
    ]);
  });

  it('mantiene el contador del resumen igual al detalle mientras un sublote verde esta en secado', () => {
    startSecadoWithWeights(detalleVerdeDosSublotes(), { 'sub-verde-1': 200 });

    const lotes = applySecadoToLots([
      lote({
        sublotes: 2,
        pesoInicial: 300,
        pesoActual: 300,
      }),
    ]);
    const verde = lotes.find((item) => item.id === 'lote-verde-bueno');
    const enSecado = lotes.find((item) => item.tipoCafe === 'EN SECADO');
    const detalle = applySecadoToDetalle(
      detalleVerdeDosSublotes(),
      'tipo-verde',
      'calidad-bueno',
    );

    expect(verde?.pesoActual).toBe(100);
    expect(verde?.sublotes).toBe(1);
    expect(enSecado?.pesoActual).toBe(200);
    expect(detalle?.sublotes).toHaveLength(1);
    expect(detalle?.sublotes[0].pesoActual).toBe(100);
  });

  it('al secar parcialmente un sublote solo descuenta los kilos seleccionados y conserva los demas', () => {
    const detalle = detalleVerdeCuatroSublotes();

    const session = startSecadoWithWeights(detalle, { 'sub-verde-1': 10 });
    const lotes = applySecadoToLots([detalle.lote]);
    const verde = lotes.find((item) => item.id === 'lote-verde-bueno');
    const enSecado = lotes.find((item) => item.tipoCafe === 'EN SECADO');
    const detalleActualizado = applySecadoToDetalle(
      detalle,
      'tipo-verde',
      'calidad-bueno',
    );

    expect(session.sublotes).toHaveLength(1);
    expect(session.sublotes[0]).toMatchObject({
      id: 'sub-verde-1',
      pesoActual: 10,
      pesoDisponible: 32,
    });
    expect(verde?.pesoActual).toBe(117);
    expect(verde?.sublotes).toBe(4);
    expect(enSecado?.pesoActual).toBe(10);
    expect(enSecado?.sublotes).toBe(1);
    expect(detalleActualizado?.sublotes.map((item) => [item.id, item.pesoActual])).toEqual([
      ['sub-verde-1', 22],
      ['sub-verde-2', 35],
      ['sub-verde-3', 50],
      ['sub-verde-4', 10],
    ]);
  });

  it('mantiene los borradores fuera del inventario hasta iniciar el proceso', () => {
    const detalle = detalleVerdeCuatroSublotes();

    const draft = createSecadoDraftWithWeights(detalle, { 'sub-verde-1': 10 });
    const lotesConBorrador = applySecadoToLots([detalle.lote]);
    const detalleConBorrador = applySecadoToDetalle(
      detalle,
      'tipo-verde',
      'calidad-bueno',
    );

    expect(draft.estado).toBe('DRAFT');
    expect(lotesConBorrador.find((item) => item.id === 'lote-verde-bueno')?.pesoActual).toBe(127);
    expect(lotesConBorrador.some((item) => item.tipoCafe === 'EN SECADO')).toBe(false);
    expect(detalleConBorrador?.sublotes.map((item) => [item.id, item.pesoActual])).toEqual([
      ['sub-verde-1', 32],
      ['sub-verde-2', 35],
      ['sub-verde-3', 50],
      ['sub-verde-4', 10],
    ]);

    startSecadoProcess(draft.id, FECHA);
    const lotesIniciados = applySecadoToLots([detalle.lote]);
    const detalleIniciado = applySecadoToDetalle(
      detalle,
      'tipo-verde',
      'calidad-bueno',
    );

    expect(lotesIniciados.find((item) => item.id === 'lote-verde-bueno')?.pesoActual).toBe(117);
    expect(lotesIniciados.find((item) => item.tipoCafe === 'EN SECADO')?.pesoActual).toBe(10);
    expect(detalleIniciado?.sublotes.map((item) => [item.id, item.pesoActual])).toEqual([
      ['sub-verde-1', 22],
      ['sub-verde-2', 35],
      ['sub-verde-3', 50],
      ['sub-verde-4', 10],
    ]);
  });
});
