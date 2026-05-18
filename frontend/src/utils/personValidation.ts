export type PersonFieldValidation = {
  isValid: boolean;
  message?: string;
};

export type DocumentType = 'CC' | 'CE' | 'NIT' | 'OTRO';
export const PERSON_NAME_MAX_LENGTH = 30;
const COMPANY_NAME_ALLOWED_CHARS = /^[\p{L}0-9\s&.'/-]+$/u;
const COMPANY_HAS_LETTER = /\p{L}/u;

const NAME_ALLOWED_CHARS = /^[\p{L}\s'.-]+$/u;
const BUSINESS_NAME_ALLOWED_CHARS = /^[A-Za-zÃÃ‰ÃÃ“ÃšÃœÃ‘Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±0-9\s&.'-]+$/;
const HAS_LETTER = /\p{L}/u;
export const COMPANY_NAME_MAX_LENGTH = PERSON_NAME_MAX_LENGTH;
const REQUIRED_NAME_ERROR = 'Ingresa el nombre para continuar.';
const GENERAL_NAME_ERROR = 'Ingresa un nombre válido para continuar.';
const REQUIRED_COMPANY_NAME_ERROR =
  'Ingresa el nombre de la empresa para continuar.';
const REQUIRED_FULL_NAME_ERROR =
  'Escribe el nombre y apellido para continuar.';
const INCOMPLETE_FULL_NAME_ERROR =
  'Completa el nombre y apellido para continuar.';
const INVALID_FULL_NAME_ERROR = 'Revisa el nombre e inténtalo nuevamente.';
const GENERAL_COMPANY_NAME_ERROR = 'Ingresa un nombre de empresa válido.';
const REQUIRED_DOCUMENT_ERROR =
  'Escribe el número de documento para continuar.';
const INCOMPLETE_DOCUMENT_ERROR = 'Verifica que el documento esté completo.';
const GENERAL_DOCUMENT_ERROR =
  'Revisa el número de documento e inténtalo nuevamente.';
const GENERAL_PHONE_ERROR = 'Ingresa un teléfono válido o deja el campo vacío.';

export function sanitizeNameInput(value: string) {
  return value.replace(/[0-9]/g, '').slice(0, PERSON_NAME_MAX_LENGTH);
}

export function sanitizeCompanyNameInput(value: string) {
  return value
    .replace(/[^\p{L}0-9\s&.'/-]/gu, '')
    .slice(0, COMPANY_NAME_MAX_LENGTH);
}

export function sanitizeProducerNameInput(value: string, type: DocumentType) {
  if (type === 'NIT' || type === 'OTRO') {
    return sanitizeCompanyNameInput(value);
  }

  return value.replace(/[^\p{L}\s'.-]/gu, '').slice(0, PERSON_NAME_MAX_LENGTH);
}

export function sanitizeDigits(value: string, maxLength = 10) {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

export function sanitizeDocumentInput(value: string, type: DocumentType) {
  const clean = value.trimStart();

  if (type === 'CC') {
    return clean.replace(/\D/g, '').slice(0, 10);
  }

  if (type === 'NIT') {
    return clean.replace(/[^\d-]/g, '').slice(0, 17);
  }

  return clean.replace(/[^A-Za-zÃÃ‰ÃÃ“ÃšÃœÃ‘Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±0-9 .'-]/g, '').slice(0, 40);
}

export function normalizeDocumentValue(value: string, type: DocumentType) {
  const clean = value.trim().replace(/\s+/g, ' ');

  if (type === 'CC') {
    return clean.replace(/\D/g, '');
  }

  if (type === 'NIT') {
    return clean.replace(/\s/g, '');
  }

  return clean;
}

function isRepeatedDigits(value: string) {
  return /^(\d)\1+$/.test(value);
}

export function validatePersonName(
  value: string,
  label = 'El nombre',
): PersonFieldValidation {
  const nombre = value.trim();

  if (!nombre) {
    return {
      isValid: false,
      message: REQUIRED_NAME_ERROR,
    };
  }

  if (/\d/.test(nombre)) {
    return {
      isValid: false,
      message: GENERAL_NAME_ERROR,
    };
  }

  if (!NAME_ALLOWED_CHARS.test(nombre) || !HAS_LETTER.test(nombre)) {
    return {
      isValid: false,
      message: GENERAL_NAME_ERROR,
    };
  }

  return { isValid: true };
}

export function validateProducerName(
  value: string,
  type: DocumentType,
): PersonFieldValidation {
  const nombre = value.trim().replace(/\s+/g, ' ');
  const isCompany = type === 'NIT' || type === 'OTRO';

  if (!nombre) {
    return {
      isValid: false,
      message: isCompany ? REQUIRED_COMPANY_NAME_ERROR : REQUIRED_FULL_NAME_ERROR,
    };
  }

  if (isCompany) {
    if (nombre.length > COMPANY_NAME_MAX_LENGTH) {
      return {
        isValid: false,
        message: `Máximo ${COMPANY_NAME_MAX_LENGTH} caracteres.`,
      };
    }

    if (
      !COMPANY_NAME_ALLOWED_CHARS.test(nombre) ||
      !COMPANY_HAS_LETTER.test(nombre)
    ) {
      return {
        isValid: false,
        message: GENERAL_COMPANY_NAME_ERROR,
      };
    }

    return { isValid: true };
  }

  const words = nombre.split(/\s+/).filter(Boolean);

  if (/\d/.test(nombre) || !NAME_ALLOWED_CHARS.test(nombre)) {
    return {
      isValid: false,
      message: INVALID_FULL_NAME_ERROR,
    };
  }

  if (
    words.length < 2 ||
    words.some(
      (word) => word.replace(/[^\p{L}]/gu, '').length < 2,
    )
  ) {
    return {
      isValid: false,
      message: INCOMPLETE_FULL_NAME_ERROR,
    };
  }

  return { isValid: true };
}

export function validatePhoneNumber(
  value: string,
  label = 'El telÃ©fono',
  options: { optional?: boolean } = {},
): PersonFieldValidation {
  const telefono = value.trim();

  if (!telefono) {
    return options.optional
      ? { isValid: true }
      : {
          isValid: false,
          message: `${label} es obligatorio.`,
        };
  }

  if (/\D/.test(telefono)) {
    const compact = telefono.replace(/[\s()+-]/g, '');
    if (!compact || /\D/.test(compact)) {
      return {
        isValid: false,
        message: GENERAL_PHONE_ERROR,
      };
    }
  }

  const digits = telefono.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) {
    return {
      isValid: false,
      message: GENERAL_PHONE_ERROR,
    };
  }

  if (isRepeatedDigits(digits)) {
    return {
      isValid: false,
      message: GENERAL_PHONE_ERROR,
    };
  }

  return { isValid: true };
}

export function validateDocumentNumber(
  value: string,
  label = 'El documento',
  options: { optional?: boolean; documentType?: DocumentType } = {},
): PersonFieldValidation {
  const type = options.documentType ?? 'CC';
  const documento = value.trim();
  const alphanumeric = documento.replace(/[^A-Za-z0-9]/g, '');

  if (!documento) {
    return options.optional
      ? { isValid: true }
      : {
          isValid: false,
          message: REQUIRED_DOCUMENT_ERROR,
        };
  }

  if (alphanumeric.length < 4) {
    return {
      isValid: false,
      message: INCOMPLETE_DOCUMENT_ERROR,
    };
  }

  if (type === 'CC') {
    if (!/^\d+$/.test(documento)) {
      return {
        isValid: false,
        message: GENERAL_DOCUMENT_ERROR,
      };
    }

    if (documento.length < 6) {
      return {
        isValid: false,
        message: INCOMPLETE_DOCUMENT_ERROR,
      };
    }

    if (documento.length > 10) {
      return {
        isValid: false,
        message: GENERAL_DOCUMENT_ERROR,
      };
    }

    return { isValid: true };
  }

  if (type === 'NIT') {
    const digits = documento.replace(/\D/g, '');

    if (!/^\d+(?:-\d+)?$/.test(documento)) {
      return {
        isValid: false,
        message:
          digits.length > 0 && digits.length < 5
            ? INCOMPLETE_DOCUMENT_ERROR
            : GENERAL_DOCUMENT_ERROR,
      };
    }

    if (digits.length < 5) {
      return {
        isValid: false,
        message: INCOMPLETE_DOCUMENT_ERROR,
      };
    }

    if (digits.length > 15) {
      return {
        isValid: false,
        message: GENERAL_DOCUMENT_ERROR,
      };
    }

    return { isValid: true };
  }

  if (!/[A-Za-z0-9]/.test(documento)) {
    return {
      isValid: false,
      message: GENERAL_DOCUMENT_ERROR,
    };
  }

  if (!/^[A-Za-zÃÃ‰ÃÃ“ÃšÃœÃ‘Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±0-9 .'-]+$/.test(documento)) {
    return {
      isValid: false,
      message: GENERAL_DOCUMENT_ERROR,
    };
  }

  return { isValid: true };
}
