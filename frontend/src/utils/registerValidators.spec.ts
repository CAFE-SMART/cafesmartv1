import { describe, expect, it } from 'vitest';
import {
  BUSINESS_NAME_ERROR,
  sanitizeBusinessNameInput,
  validateBusinessName,
} from './registerValidators';

describe('validateBusinessName', () => {
  it('acepta nombres cortos y reales de negocio', () => {
    ['C', 'JR', '3M', 'D1'].forEach((name) => {
      expect(validateBusinessName(name).isValid).toBe(true);
    });
  });

  it('acepta letras, numeros, espacios, acentos y signos comerciales comunes', () => {
    [
      'Café Los Alpes',
      'Compraventa JR & Asociados',
      "Cooperativa O'Campo",
      '3M Café.',
      'Café Ruta-24',
    ].forEach((name) => {
      expect(validateBusinessName(name).isValid).toBe(true);
    });
  });

  it('rechaza vacios, solo espacios y cadenas sin letras ni numeros', () => {
    ['', '   ', '---', '@@@@', '""""', '&.*'].forEach((name) => {
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
    expect(sanitizeBusinessNameInput('Café @@@ & Sol')).toBe('Café  & Sol');
    expect(sanitizeBusinessNameInput('D1 * Café- Ruta')).toBe('D1  Café- Ruta');
  });
});
