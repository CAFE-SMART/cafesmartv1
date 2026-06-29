import { describe, expect, it } from 'vitest';
import { applySecadoToLots, applySecadoToDetalle } from './secadoFlow';
import type { LoteResumen, LoteDetalle } from '../services/lotesService';

describe('secadoFlow', () => {
  it('applySecadoToLots returns lots unmodified', () => {
    const mockLots = [{ id: '1', pesoActual: 10 }] as unknown as LoteResumen[];
    expect(applySecadoToLots(mockLots)).toEqual(mockLots);
  });

  it('applySecadoToDetalle returns detail unmodified', () => {
    const mockDetail = {
      lote: { id: '1' },
      sublotes: [],
    } as unknown as LoteDetalle;
    expect(applySecadoToDetalle(mockDetail, 'tipo', 'calidad')).toEqual(
      mockDetail,
    );
  });
});
