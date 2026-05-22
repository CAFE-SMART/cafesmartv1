import { describe, expect, it } from 'vitest';
import {
  BUSINESS_NAME_ERROR,
  isValidPhone,
  sanitizeAdminNameInput,
  sanitizeBusinessNameInput,
  sanitizeRegisterPhoneInput,
  validateAdminName,
  validateBusinessName,
} from './registerValidators';

describe('validateBusinessName', () => {
  it('acepta nombres cortos y reales de negocio', () => {
    ['C', 'JR', '3M', 'D1'].forEach((name) => {
      expect(validateBusinessName(name).isValid).toBe(true);
    });
  });

  it('acepta letras, numeros, espacios y acentos sin caracteres especiales', () => {
    [
      'Café Los Alpes',
      'Compraventa JR Asociados',
      '3M Café',
      'Café Ruta 24',
      'Cafe Ruta 12345',
    ].forEach((name) => {
      expect(validateBusinessName(name).isValid).toBe(true);
    });
  });

  it('rechaza vacios, caracteres especiales y mas de cinco numeros', () => {
    ['', '   ', '---', '@@@@', '""""', '&.*', 'Cafe Smart!', 'Cafe Ruta 123456'].forEach((name) => {
      const result = validateBusinessName(name);
      expect(result.isValid).toBe(false);
      expect(result.message).toBe(BUSINESS_NAME_ERROR);
    });
  });

  it('rechaza nombres compuestos solo por numeros', () => {
    ['999999999', '123456', '000000', '43252566362232626'].forEach((name) => {
      const result = validateBusinessName(name);
      expect(result.isValid).toBe(false);
      expect(result.message).toBe(BUSINESS_NAME_ERROR);
    });
  });

  it('limpia caracteres no permitidos al escribir en ajustes', () => {
    expect(sanitizeBusinessNameInput('Café @@@ & Sol')).toBe('Café   Sol');
    expect(sanitizeBusinessNameInput('D1 * Café- Ruta 234567')).toBe(
      'D1  Café Ruta 2345',
    );
  });

  it('limita telefono de registro a 10 digitos y exige que empiece por 3', () => {
    expect(sanitizeRegisterPhoneInput('+57 300 123 4567')).toBe('3001234567');
    expect(sanitizeRegisterPhoneInput('300123456789')).toBe('3001234567');
    expect(isValidPhone('3001234567')).toBe(true);
    expect(isValidPhone('2001234567')).toBe(false);
    expect(isValidPhone('+57 300 123 4567')).toBe(false);
  });

  it('permite solo letras y espacios en nombres de administrador', () => {
    expect(sanitizeAdminNameInput('Laura 123 Pérez!', 30)).toBe('Laura  Pérez');
    expect(validateAdminName('Laura Pérez', 30).isValid).toBe(true);
    expect(validateAdminName('Laura 2', 30).isValid).toBe(false);
    expect(validateAdminName('Laura-Pérez', 30).isValid).toBe(false);
  });
});
