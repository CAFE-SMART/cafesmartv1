import { describe, expect, it } from 'vitest';
import { classifyHumidity, getHumidityAlertMessage } from './humidity';

describe('classifyHumidity', () => {
  it('clasifica humedad buena entre 10% y 12% incluyendo limites', () => {
    expect(classifyHumidity(10).quality).toBe('buena');
    expect(classifyHumidity(11.2).quality).toBe('buena');
    expect(classifyHumidity(12).quality).toBe('buena');
  });

  it('clasifica advertencias entre 8% y menor a 10%, y descuento sobre 12% hasta 14%', () => {
    expect(classifyHumidity(8).quality).toBe('advertencia');
    expect(classifyHumidity(9.9).quality).toBe('advertencia');
    expect(classifyHumidity(12.1).quality).toBe('descuento');
    expect(classifyHumidity(14).quality).toBe('descuento');
  });

  it('clasifica como rechazada humedades menores a 8% o mayores a 14%', () => {
    expect(classifyHumidity(7.9).quality).toBe('rechazada');
    expect(classifyHumidity(14.1).quality).toBe('rechazada');
  });

  it('expone mensajes reutilizables para compras, inventario y secado', () => {
    expect(getHumidityAlertMessage(9)).toContain('Humedad baja');
    expect(getHumidityAlertMessage(13)).toContain('Humedad alta');
    expect(getHumidityAlertMessage(14.1)).toContain('supera 14%');
  });
});
