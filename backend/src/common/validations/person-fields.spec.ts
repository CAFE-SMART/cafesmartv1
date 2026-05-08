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

  it('rechaza telefonos que no empiezan por 3 o no tienen 10 digitos', () => {
    expect(() => normalizarTelefonoPersona('2001234567', 'cliente')).toThrow(
      BadRequestException,
    );
    expect(() => normalizarTelefonoPersona('300123', 'cliente')).toThrow(
      BadRequestException,
    );
  });

  it('normaliza telefono valido', () => {
    expect(normalizarTelefonoPersona('3001234567', 'productor')).toBe(
      '3001234567',
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
