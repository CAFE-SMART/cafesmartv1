import {
  COMPANY_NAME_MAX_LENGTH,
  sanitizeCompanyNameInput,
  validateProducerName,
} from './personValidation';

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
const BUSINESS_NAME_REGEX = /^(?=.*[A-Za-zÃÃ‰ÃÃ“ÃšÃœÃ‘Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±])[A-Za-zÃÃ‰ÃÃ“ÃšÃœÃ‘Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±0-9 &.'-]+$/;
export const BUSINESS_NAME_ERROR = 'Ingresa un nombre de negocio válido.';

export function validateBusinessName(value: string) {
  const name = value.trim();
  const companyValidation = validateProducerName(name, 'NIT');

  if (!name) {
    return {
      isValid: false,
      value: name,
      message: BUSINESS_NAME_ERROR,
    };
  }

  if (!companyValidation.isValid) {
    return {
      isValid: false,
      value: name,
      message:
        name.length > BUSINESS_NAME_MAX_LENGTH
          ? `Máximo ${BUSINESS_NAME_MAX_LENGTH} caracteres.`
          : BUSINESS_NAME_ERROR,
    };
  }

  if (name.length > BUSINESS_NAME_MAX_LENGTH) {
    return {
      isValid: false,
      value: name,
      message: `Máximo ${BUSINESS_NAME_MAX_LENGTH} caracteres.`,
    };
  }

  return {
    isValid: true,
    value: name,
  };
}

export function sanitizeBusinessNameInput(value: string) {
  return sanitizeCompanyNameInput(value);
}

export function hasAtLeastOneSurname(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  return parts.length >= 1;
}

export const hasAtLeastTwoSurnames = hasAtLeastOneSurname;

export function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return /^3\d{9}$/.test(digits);
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
