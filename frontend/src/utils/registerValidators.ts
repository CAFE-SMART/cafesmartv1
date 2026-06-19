export type RegisterLocationState = {
  googleToken?: string;
  googlePrefill?: {
    correo?: string;
    nombre?: string;
    apellidos?: string;
  };
  registerDraft?: {
    authMode?: 'register';
    currentStep?: 1 | 2;
    nombreOrganizacion?: string;
    descripcionOrganizacion?: string;
    tipoOrganizacion?: 'COOPERATIVA' | 'COMPRAVENTA' | 'PERSONALIZADO';
    otroTipoDetalle?: string;
    nombre?: string;
    apellidos?: string;
    telefono?: string;
    correo?: string;
    password?: string;
  };
};

export type TipoOrg = 'COOPERATIVA' | 'COMPRAVENTA' | 'PERSONALIZADO';
export type TipoOrgSelection = TipoOrg | '';

export type StepOneErrors = {
  nombreOrganizacion?: string;
  descripcionOrganizacion?: string;
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
export const BUSINESS_NAME_MIN_LENGTH = 3;
export const BUSINESS_NAME_MAX_LENGTH = 100;
export const BUSINESS_DESCRIPTION_MAX_LENGTH = 200;
export const PERSON_NAME_MIN_LENGTH = 2;
export const PERSON_NAME_MAX_LENGTH = 60;
export const PERSON_LASTNAME_MAX_LENGTH = 60;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 32;

const BUSINESS_NAME_ALLOWED_REGEX = /^[\p{L}\p{N} .,&()[\]{}-]+$/u;
const PERSON_NAME_ALLOWED_REGEX = /^[\p{L} '-]+$/u;

function hasExcessiveRepetition(value: string) {
  const normalized = value.trim().toLowerCase();
  if (/(.)\1{7,}/u.test(normalized)) {
    return true;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 4) {
    return false;
  }

  return words.some(
    (word) => words.filter((current) => current === word).length >= 4,
  );
}

export function normalizeBusinessNameInput(value: string) {
  return value.replace(/\s{2,}/g, ' ').slice(0, BUSINESS_NAME_MAX_LENGTH);
}

export function normalizeBusinessDescriptionInput(value: string) {
  return value.replace(/\s{2,}/g, ' ').slice(0, BUSINESS_DESCRIPTION_MAX_LENGTH);
}

export function validateBusinessDescription(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (value !== value.trim()) {
    return 'No uses espacios al inicio ni al final.';
  }

  if (normalized.length > BUSINESS_DESCRIPTION_MAX_LENGTH) {
    return 'La descripción no puede superar los 200 caracteres.';
  }

  return null;
}

export function normalizeHumanNameInput(value: string) {
  return value.replace(/\s{2,}/g, ' ').slice(0, PERSON_NAME_MAX_LENGTH);
}

export function normalizeHumanNameForSave(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    .replace(/(^|[\s'-])(\p{L})/gu, (match, separator, letter) =>
      `${separator}${letter.toLocaleUpperCase('es')}`,
    );
}

export function normalizeBusinessNameForSave(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    .replace(/(^|[\s&.,()-])(\p{L})/gu, (match, separator, letter) =>
      `${separator}${letter.toLocaleUpperCase('es')}`,
    );
}

export function validateBusinessName(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return 'Escribe el nombre de tu negocio para continuar.';
  }

  if (normalized.length < BUSINESS_NAME_MIN_LENGTH) {
    return 'Usa al menos 3 caracteres.';
  }

  if (/\s{2,}/.test(value) || value !== value.trim()) {
    return 'No uses espacios al inicio, al final ni dobles.';
  }

  if (normalized.length > BUSINESS_NAME_MAX_LENGTH) {
    return 'El nombre del negocio es demasiado largo. Usa máximo 100 caracteres.';
  }

  if (/[#@$%*=_+?¿!¡|<>/\\]/.test(normalized) || !BUSINESS_NAME_ALLOWED_REGEX.test(normalized)) {
    return 'No uses símbolos especiales.';
  }

  if (/\(\s*\)|\[\s*\]|\{\s*\}/.test(normalized)) {
    return 'No uses signos vacíos como ().';
  }

  for (const [open, close] of [
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
  ] as const) {
    if (normalized.split(open).length !== normalized.split(close).length) {
      return 'Cierra bien los paréntesis o corchetes.';
    }
  }

  if (hasExcessiveRepetition(normalized)) {
    return 'Usa un nombre claro y fácil de reconocer.';
  }

  return null;
}

export function validatePersonName(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return 'Escribe tu nombre para continuar.';
  }

  if (normalized.length < PERSON_NAME_MIN_LENGTH) {
    return 'Usa al menos 2 caracteres.';
  }

  if (normalized.length > PERSON_NAME_MAX_LENGTH) {
    return 'El nombre es demasiado largo. Usa máximo 60 caracteres.';
  }

  if (/\d/.test(normalized)) {
    return 'El nombre no puede contener números.';
  }

  if (/\s{2,}/.test(value) || value !== value.trim()) {
    return 'No uses espacios al inicio, al final ni dobles.';
  }

  if (/[@$%*=*?¿!¡#_/\\.,()[\]{}]/.test(normalized) || !PERSON_NAME_ALLOWED_REGEX.test(normalized)) {
    return 'No uses símbolos especiales.';
  }

  if (hasExcessiveRepetition(normalized)) {
    return 'Usa un nombre claro y fácil de reconocer.';
  }

  return null;
}

export function validatePersonLastName(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return 'Escribe tus apellidos para completar tu cuenta.';
  }

  if (normalized.length < PERSON_NAME_MIN_LENGTH) {
    return 'Usa al menos 2 caracteres.';
  }

  if (normalized.length > PERSON_LASTNAME_MAX_LENGTH) {
    return 'Los apellidos superan el límite permitido. Usa máximo 60 caracteres.';
  }

  if (/\d/.test(normalized)) {
    return 'El nombre no puede contener números.';
  }

  if (/\s{2,}/.test(value) || value !== value.trim()) {
    return 'No uses espacios al inicio, al final ni dobles.';
  }

  if (/[@$%*=*?¿!¡#_/\\.,()[\]{}]/.test(normalized) || !PERSON_NAME_ALLOWED_REGEX.test(normalized)) {
    return 'No uses símbolos especiales.';
  }

  if (hasExcessiveRepetition(normalized)) {
    return 'Usa apellidos claros y fáciles de reconocer.';
  }

  return null;
}

export function hasAtLeastOneSurname(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  return parts.length >= 1;
}

export const hasAtLeastTwoSurnames = hasAtLeastOneSurname;

export function isValidPhone(value: string) {
  const parsed = parsePhoneNumberFromString(value, 'CO');
  return parsed?.isValid() ?? false;
}

export function getPasswordChecks(value: string) {
  return {
    minLength: value.length >= PASSWORD_MIN_LENGTH,
    maxLength: value.length <= PASSWORD_MAX_LENGTH,
    hasLower: /[a-z]/.test(value),
    hasUpper: /[A-Z]/.test(value),
    hasNumber: /\d/.test(value),
  };
}

export function getPasswordStrength(value: string) {
  const checks = getPasswordChecks(value);
  const score = [
    checks.minLength,
    checks.hasUpper,
    checks.hasLower,
    checks.hasNumber,
    checks.maxLength,
  ].filter(Boolean).length;

  if (!value) {
    return { score: 0, label: 'Sin evaluar' };
  }

  if (score <= 2) {
    return { score, label: 'Muy débil' };
  }

  if (score === 3) {
    return { score, label: 'Débil' };
  }

  if (score === 4) {
    return { score, label: 'Media' };
  }

  return { score, label: 'Fuerte' };
}
import { parsePhoneNumberFromString } from 'libphonenumber-js';
