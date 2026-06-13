import { describe, expect, it } from 'vitest';
import { applySecadoToLots, applySecadoToDetalle } from './secadoFlow';

describe('secadoFlow', () => {
  it('applySecadoToLots returns lots unmodified', () => {
    const mockLots: any[] = [{ id: '1', pesoActual: 10 }];
    expect(applySecadoToLots(mockLots)).toEqual(mockLots);
  });

  it('applySecadoToDetalle returns detail unmodified', () => {
    const mockDetail: any = { lote: { id: '1' }, sublotes: [] };
    expect(applySecadoToDetalle(mockDetail, 'tipo', 'calidad')).toEqual(mockDetail);
  });
});
