import { describe, expect, it } from 'vitest';
import {
  sanitizeDigits,
  sanitizeNameInput,
  validateDocumentNumber,
  validatePersonName,
  validatePhoneNumber,
  normalizePhoneNumberForStorage,
} from './personValidation';

describe('personValidation', () => {
  it('normaliza espacios del nombre sin validar su contenido', () => {
    expect(sanitizeNameInput('Andres  123 Lopez')).toBe('Andres 123 Lopez');
  });

  it('valida nombres sin numeros', () => {
    expect(validatePersonName('Andres Lopez').isValid).toBe(true);
    expect(validatePersonName('Andres 123').isValid).toBe(false);
  });

  it('normaliza campos numericos a maximo 10 digitos', () => {
    expect(sanitizeDigits('300 123 4567 extra')).toBe('3001234567');
  });

  it('valida teléfonos nacionales e internacionales', () => {
    expect(validatePhoneNumber('3001234567').isValid).toBe(true);
    expect(normalizePhoneNumberForStorage('3001234567')).toBe('+573001234567');
    expect(validatePhoneNumber('6011234567').isValid).toBe(true);
    expect(normalizePhoneNumberForStorage('6011234567')).toBe('+576011234567');
    expect(validatePhoneNumber('+57 300 123 4567').isValid).toBe(true);
    expect(validatePhoneNumber('+12025550123').isValid).toBe(true);
    expect(normalizePhoneNumberForStorage('+12025550123')).toBe('+12025550123');
    expect(validatePhoneNumber('300123').isValid).toBe(false);
    expect(validatePhoneNumber('abc123').isValid).toBe(false);
    expect(validatePhoneNumber('3333333333').isValid).toBe(false);
  });

  it('valida documento entre 6 y 10 digitos y evita repetidos', () => {
    expect(validateDocumentNumber('1111111111').isValid).toBe(false);
    expect(validateDocumentNumber('0000000').isValid).toBe(false);
    expect(validateDocumentNumber('12345678901').isValid).toBe(false);
    expect(validateDocumentNumber('114059596').isValid).toBe(true);
    expect(validateDocumentNumber('ABC12345', 'El pasaporte', { type: 'PASAPORTE' }).isValid).toBe(true);
    expect(validateDocumentNumber('12345678', 'La TI', { type: 'TI' }).isValid).toBe(true);
    expect(validateDocumentNumber('PEP-123456', 'El PEP', { type: 'PEP' }).isValid).toBe(true);
  });
});
