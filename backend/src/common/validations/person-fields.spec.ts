import { BadRequestException } from '@nestjs/common';
import {
  normalizarDocumentoPersona,
  normalizarNombrePersona,
  normalizarTelefonoPersona,
} from './person-fields';

describe('person-fields validation', () => {
  it('rechaza nombres con numeros', () => {
    expect(() => normalizarNombrePersona('Andres 123', 'cliente')).toThrow(
      BadRequestException,
    );
  });

  it('normaliza nombres validos', () => {
    expect(normalizarNombrePersona(' Andres Lopez ', 'cliente')).toBe(
      'Andres Lopez',
    );
  });

  it('acepta teléfonos nacionales e internacionales válidos', () => {
    expect(normalizarTelefonoPersona('3001234567', 'cliente')).toBe(
      '+573001234567',
    );
    expect(normalizarTelefonoPersona('6011234567', 'cliente')).toBe(
      '+576011234567',
    );
    expect(normalizarTelefonoPersona('+12025550123', 'cliente')).toBe(
      '+12025550123',
    );
  });

  it('rechaza teléfonos incompletos o con letras', () => {
    expect(() => normalizarTelefonoPersona('300123', 'cliente')).toThrow(
      BadRequestException,
    );
    expect(() => normalizarTelefonoPersona('abc123', 'cliente')).toThrow(
      BadRequestException,
    );
  });

  it('guarda teléfono válido en formato E.164', () => {
    expect(normalizarTelefonoPersona('3001234567', 'productor')).toBe(
      '+573001234567',
    );
  });

  it('rechaza documentos largos o repetidos', () => {
    expect(() =>
      normalizarDocumentoPersona('12345678901', 'productor', {
        required: true,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      normalizarDocumentoPersona('1111111', 'productor', { required: true }),
    ).toThrow(BadRequestException);
  });

  it('permite documento opcional vacio', () => {
    expect(normalizarDocumentoPersona('', 'cliente')).toBeNull();
  });
});
