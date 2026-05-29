import { COMPANY_NAME_MAX_LENGTH } from './personValidation';

export type RegisterLocationState = {
  googleToken?: string;
  googlePrefill?: {
    correo?: string;
    nombre?: string;
    apellidos?: string;
  };
  registerDraft?: {
    nombreOrganizacion?: string;
    tipoOrganizacion?: 'COOPERATIVA' | 'COMPRAVENTA' | 'PERSONALIZADO';
    otroTipoDetalle?: string;
    nombre?: string;
    telefono?: string;
    correo?: string;
    password?: string;
  };
};

export type TipoOrg = 'COOPERATIVA' | 'COMPRAVENTA' | 'PERSONALIZADO';
export type TipoOrgSelection = TipoOrg | '';

export type StepOneErrors = {
  nombreOrganizacion?: string;
  tipoOrganizacion?: string;
  otroTipoDetalle?: string;
};

export type StepTwoErrors = {
  nombre?: string;
  apellidos?: string;
  telefono?: string;
  correo?: string;
  password?: string;
  confirmPassword?: string;
};

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const BUSINESS_NAME_MAX_LENGTH = COMPANY_NAME_MAX_LENGTH;
export const BUSINESS_NAME_MAX_DIGITS = 5;
export const CUSTOM_BUSINESS_TYPE_MAX_LENGTH = 50;
export const ADMIN_NAME_MAX_LENGTH = 30;
export const ADMIN_LASTNAME_MAX_LENGTH = 45;
export const REGISTER_PHONE_MAX_LENGTH = 10;
export const EMAIL_MAX_LENGTH = 100;
export const PASSWORD_MAX_LENGTH = 72;
const BUSINESS_NAME_REGEX = /^(?=.*\p{L})[\p{L}0-9 ]+$/u;
const ADMIN_NAME_REGEX = /^(?=.*\p{L})[\p{L} ]+$/u;
export const BUSINESS_NAME_ERROR = 'Ingresa un nombre de negocio válido.';
export const ADMIN_NAME_ERROR = 'Usa solo letras y espacios.';

function countDigits(value: string) {
  return (value.match(/\d/g) ?? []).length;
}

export function validateBusinessName(value: string) {
  const name = value.trim().replace(/\s+/g, ' ');

  if (!name) {
    return {
      isValid: false,
      value: name,
      message: BUSINESS_NAME_ERROR,
    };
  }

  if (name.length > BUSINESS_NAME_MAX_LENGTH) {
    return {
      isValid: false,
      value: name,
      message: `Máximo ${BUSINESS_NAME_MAX_LENGTH} caracteres.`,
    };
  }

  if (
    !BUSINESS_NAME_REGEX.test(name) ||
    countDigits(name) > BUSINESS_NAME_MAX_DIGITS
  ) {
    return {
      isValid: false,
      value: name,
      message: BUSINESS_NAME_ERROR,
    };
  }

  return {
    isValid: true,
    value: name,
  };
}

export function sanitizeBusinessNameInput(value: string) {
  let digitCount = 0;
  let sanitized = '';

  for (const char of value) {
    if (/\d/.test(char)) {
      if (digitCount < BUSINESS_NAME_MAX_DIGITS) {
        sanitized += char;
        digitCount += 1;
      }
      continue;
    }

    if (/[\p{L} ]/u.test(char)) {
      sanitized += char;
    }
  }

  return sanitized.slice(0, BUSINESS_NAME_MAX_LENGTH);
}

export function sanitizeRegisterPhoneInput(value: string) {
  const digits = value.replace(/\D/g, '');
  const nationalDigits =
    digits.startsWith('57') && digits.charAt(2) === '3'
      ? digits.slice(2)
      : digits;

  return nationalDigits.slice(0, REGISTER_PHONE_MAX_LENGTH);
}

export function sanitizeAdminNameInput(value: string, maxLength: number) {
  return [...value]
    .filter((char) => /[\p{L} ]/u.test(char))
    .join('')
    .slice(0, maxLength);
}

export function validateAdminName(value: string, maxLength: number) {
  const name = value.trim().replace(/\s+/g, ' ');

  if (!name) {
    return {
      isValid: false,
      value: name,
      message: 'Completa este campo.',
    };
  }

  if (name.length > maxLength) {
    return {
      isValid: false,
      value: name,
      message: `Máximo ${maxLength} caracteres.`,
    };
  }

  if (!ADMIN_NAME_REGEX.test(name)) {
    return {
      isValid: false,
      value: name,
      message: ADMIN_NAME_ERROR,
    };
  }

  return {
    isValid: true,
    value: name,
  };
}

export function hasAtLeastOneSurname(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  return parts.length >= 1;
}

export const hasAtLeastTwoSurnames = hasAtLeastOneSurname;

export function isValidPhone(value: string) {
  return /^3\d{9}$/.test(value);
}

export function getPasswordChecks(value: string) {
  return {
    minLength: value.length >= 6,
    hasLower: /[a-z]/.test(value),
    hasUpper: /[A-Z]/.test(value),
    hasNumber: /\d/.test(value),
  };
}

export function getPasswordStrength(value: string) {
  const checks = getPasswordChecks(value);
  const score = Object.values(checks).filter(Boolean).length;

  if (!value) {
    return { score: 0, label: 'Sin evaluar' };
  }

  if (score <= 1) {
    return { score, label: 'Muy dÃ©bil' };
  }

  if (score === 2) {
    return { score, label: 'DÃ©bil' };
  }

  if (score === 3) {
    return { score, label: 'Media' };
  }

  return { score, label: 'Fuerte' };
}
