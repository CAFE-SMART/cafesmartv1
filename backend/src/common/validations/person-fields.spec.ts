import { BadRequestException } from '@nestjs/common';
import {
  normalizarDocumentoPersona,
  normalizarNombrePersona,
  normalizarTelefonoPersona,
} from './person-fields';

describe('person-fields validation', () => {
  it('rechaza nombres con numeros', () => {
    expect(() => normalizarNombrePersona('', 'cliente')).toThrow(
      'Escribe el nombre y apellido para continuar.',
    );
    expect(() => normalizarNombrePersona('Andres 123', 'cliente')).toThrow(
      BadRequestException,
    );
    expect(() => normalizarNombrePersona('---', 'productor')).toThrow(
      BadRequestException,
    );
  });

  it('normaliza nombres validos', () => {
    expect(normalizarNombrePersona(' Andres Lopez ', 'cliente')).toBe(
      'Andres Lopez',
    );
    expect(
      normalizarNombrePersona(' Café Los Alpes 24 ', 'productor', {
        tipoDocumento: 'NIT',
      }),
    ).toBe('Café Los Alpes 24');
    expect(() =>
      normalizarNombrePersona('Juan', 'productor', { tipoDocumento: 'CC' }),
    ).toThrow('Completa el nombre y apellido para continuar.');
    expect(() =>
      normalizarNombrePersona('Juan 123', 'productor', { tipoDocumento: 'CC' }),
    ).toThrow('Revisa el nombre e inténtalo nuevamente.');
    expect(() =>
      normalizarNombrePersona('---', 'productor', { tipoDocumento: 'NIT' }),
    ).toThrow('Ingresa un nombre de empresa válido.');
  });

  it('rechaza telefonos demasiado cortos o con letras', () => {
    expect(() => normalizarTelefonoPersona('abc123', 'cliente')).toThrow(
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
    expect(normalizarTelefonoPersona('+57 300 123 4567', 'productor')).toBe(
      '573001234567',
    );
  });

  it('rechaza documentos largos o cortos', () => {
    expect(() =>
      normalizarDocumentoPersona('12345678901', 'productor', {
        required: true,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      normalizarDocumentoPersona('123', 'productor', { required: true }),
    ).toThrow(BadRequestException);
    expect(() =>
      normalizarDocumentoPersona('12345', 'productor', { required: true }),
    ).toThrow('Verifica que el documento esté completo.');
    expect(() =>
      normalizarDocumentoPersona('ABC123', 'productor', {
        required: true,
        tipoDocumento: 'CC',
      }),
    ).toThrow('Revisa el número de documento e inténtalo nuevamente.');
  });

  it('permite formatos de documento segun el tipo', () => {
    expect(
      normalizarDocumentoPersona('1111111', 'productor', {
        required: true,
        tipoDocumento: 'CC',
      }),
    ).toBe('1111111');
    expect(
      normalizarDocumentoPersona('123456', 'productor', {
        required: true,
        tipoDocumento: 'CC',
      }),
    ).toBe('123456');
    expect(
      normalizarDocumentoPersona('900123456-7', 'productor', {
        required: true,
        tipoDocumento: 'NIT',
      }),
    ).toBe('900123456-7');
    expect(
      normalizarDocumentoPersona('9001234567', 'productor', {
        required: true,
        tipoDocumento: 'NIT',
      }),
    ).toBe('9001234567');
    expect(() =>
      normalizarDocumentoPersona('900.123.456', 'productor', {
        required: true,
        tipoDocumento: 'NIT',
      }),
    ).toThrow('Revisa el número de documento e inténtalo nuevamente.');
    expect(
      normalizarDocumentoPersona('A1234567', 'productor', {
        required: true,
        tipoDocumento: 'CE',
      }),
    ).toBe('A1234567');
  });

  it('permite documento opcional vacio', () => {
    expect(normalizarDocumentoPersona('', 'cliente')).toBeNull();
  });
});
