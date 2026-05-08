import { describe, expect, it } from 'vitest';
import {
  sanitizeDigits,
  sanitizeNameInput,
  validateDocumentNumber,
  validatePersonName,
  validatePhoneNumber,
} from './personValidation';

describe('personValidation', () => {
  it('remueve numeros de nombres', () => {
    expect(sanitizeNameInput('Andres 123 Lopez')).toBe('Andres  Lopez');
  });

  it('valida nombres sin numeros', () => {
    expect(validatePersonName('Andres Lopez').isValid).toBe(true);
    expect(validatePersonName('Andres 123').isValid).toBe(false);
  });

  it('normaliza campos numericos a maximo 10 digitos', () => {
    expect(sanitizeDigits('300 123 4567 extra')).toBe('3001234567');
  });

  it('valida telefono colombiano movil', () => {
    expect(validatePhoneNumber('3001234567').isValid).toBe(true);
    expect(validatePhoneNumber('2001234567').isValid).toBe(false);
    expect(validatePhoneNumber('300123').isValid).toBe(false);
    expect(validatePhoneNumber('3333333333').isValid).toBe(false);
  });

  it('valida documento entre 6 y 10 digitos y evita repetidos', () => {
    expect(validateDocumentNumber('1111111111').isValid).toBe(false);
    expect(validateDocumentNumber('0000000').isValid).toBe(false);
    expect(validateDocumentNumber('12345678901').isValid).toBe(false);
    expect(validateDocumentNumber('114059596').isValid).toBe(true);
  });
});
