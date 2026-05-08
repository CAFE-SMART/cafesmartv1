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
    return { score, label: 'Muy débil' };
  }

  if (score === 2) {
    return { score, label: 'Débil' };
  }

  if (score === 3) {
    return { score, label: 'Media' };
  }

  return { score, label: 'Fuerte' };
}
