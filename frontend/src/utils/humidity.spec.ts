import { describe, expect, it } from 'vitest';
import { classifyHumidity } from './humidity';

describe('classifyHumidity', () => {
  it('clasifica humedad buena entre 10% y 12% incluyendo limites', () => {
    expect(classifyHumidity(10).quality).toBe('buena');
    expect(classifyHumidity(11.2).quality).toBe('buena');
    expect(classifyHumidity(12).quality).toBe('buena');
  });

  it('clasifica humedad regular entre 9% y menor a 10%, y mayor a 12% hasta 12.5%', () => {
    expect(classifyHumidity(9).quality).toBe('regular');
    expect(classifyHumidity(9.9).quality).toBe('regular');
    expect(classifyHumidity(12.1).quality).toBe('regular');
    expect(classifyHumidity(12.5).quality).toBe('regular');
  });

  it('clasifica como deficiente humedades menores a 9% o mayores a 12.5%', () => {
    expect(classifyHumidity(8.9).quality).toBe('deficiente');
    expect(classifyHumidity(12.6).quality).toBe('deficiente');
  });
});
