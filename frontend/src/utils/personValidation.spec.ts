import { describe, expect, it } from 'vitest';
import {
  sanitizeDigits,
  sanitizeNameInput,
  validateDocumentNumber,
  validatePersonName,
  validatePhoneNumber,
  validateProducerName,
} from './personValidation';

describe('personValidation', () => {
  it('remueve numeros de nombres', () => {
    expect(sanitizeNameInput('Andres 123 Lopez')).toBe('Andres  Lopez');
  });

  it('valida nombres sin numeros', () => {
    expect(validatePersonName('Andres Lopez').isValid).toBe(true);
    expect(validatePersonName('').message).toBe(
      'Ingresa el nombre para continuar.',
    );
    expect(validatePersonName('Andres 123').message).toBe(
      'Ingresa un nombre válido para continuar.',
    );
    expect(validatePersonName('---').isValid).toBe(false);
    expect(validatePersonName('@@@').isValid).toBe(false);
  });

  it('valida nombre de productor segun tipo de documento', () => {
    expect(validateProducerName('', 'CC').message).toBe(
      'Escribe el nombre y apellido para continuar.',
    );
    expect(validateProducerName('Juan', 'CC').message).toBe(
      'Completa el nombre y apellido para continuar.',
    );
    expect(validateProducerName('Juan 123', 'CC').message).toBe(
      'Revisa el nombre e inténtalo nuevamente.',
    );
    expect(validateProducerName('Juan Pérez', 'CC').isValid).toBe(true);
    expect(validateProducerName('Café Los Alpes 24', 'NIT').isValid).toBe(true);
    expect(validateProducerName('---', 'NIT').message).toBe(
      'Ingresa un nombre de empresa válido.',
    );
  });

  it('normaliza campos numericos a maximo 10 digitos', () => {
    expect(sanitizeDigits('300 123 4567 extra')).toBe('3001234567');
  });

  it('valida telefono de contacto opcional', () => {
    expect(validatePhoneNumber('3001234567').isValid).toBe(true);
    expect(validatePhoneNumber('+57 300 123 4567').isValid).toBe(true);
    expect(validatePhoneNumber('abc123').isValid).toBe(false);
    expect(validatePhoneNumber('300123').isValid).toBe(false);
    expect(validatePhoneNumber('3333333333').isValid).toBe(false);
  });

  it('valida documento por tipo y evita valores demasiado cortos', () => {
    expect(validateDocumentNumber('1111111111').isValid).toBe(true);
    expect(validateDocumentNumber('0000000').isValid).toBe(true);
    expect(validateDocumentNumber('').message).toBe(
      'Escribe el número de documento para continuar.',
    );
    expect(validateDocumentNumber('123').message).toBe(
      'Verifica que el documento esté completo.',
    );
    expect(validateDocumentNumber('12345').message).toBe(
      'Verifica que el documento esté completo.',
    );
    expect(validateDocumentNumber('12345678901').isValid).toBe(false);
    expect(validateDocumentNumber('123456').isValid).toBe(true);
    expect(validateDocumentNumber('114059596').isValid).toBe(true);
    expect(
      validateDocumentNumber('A1234567', 'El documento', {
        documentType: 'CE',
      }).isValid,
    ).toBe(true);
    expect(
      validateDocumentNumber('900123456-7', 'El documento', {
        documentType: 'NIT',
      }).isValid,
    ).toBe(true);
    expect(
      validateDocumentNumber('ABC123', 'El documento', {
        documentType: 'CC',
      }).message,
    ).toBe('Revisa el número de documento e inténtalo nuevamente.');
    expect(
      validateDocumentNumber('900123456-7', 'El documento', {
        documentType: 'NIT',
      }).isValid,
    ).toBe(true);
    expect(
      validateDocumentNumber('9001234567', 'El documento', {
        documentType: 'NIT',
      }).isValid,
    ).toBe(true);
    expect(
      validateDocumentNumber('900.123.456', 'El documento', {
        documentType: 'NIT',
      }).message,
    ).toBe('Revisa el número de documento e inténtalo nuevamente.');
  });
});
