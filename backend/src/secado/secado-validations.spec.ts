import {
  SecadoValidacionCriticaError,
  validarResultadosSecadoCriticos,
} from './secado-validations';

describe('validarResultadosSecadoCriticos', () => {
  it('bloquea salida mayor que entrada', () => {
    expect(() =>
      validarResultadosSecadoCriticos(100, {
        outputBuenoKg: 80,
        outputRegularKg: 30,
      }),
    ).toThrow(SecadoValidacionCriticaError);
  });

  it('bloquea salida total menor o igual a cero', () => {
    expect(() =>
      validarResultadosSecadoCriticos(100, {
        outputBuenoKg: 0,
        outputRegularKg: 0,
      }),
    ).toThrow(SecadoValidacionCriticaError);
  });

  it('permite una merma positiva y coherente', () => {
    expect(() =>
      validarResultadosSecadoCriticos(100, {
        outputBuenoKg: 70,
        outputRegularKg: 20,
      }),
    ).not.toThrow();
  });
});
