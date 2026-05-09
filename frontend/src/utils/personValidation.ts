export type PersonFieldValidation = {
  isValid: boolean;
  message?: string;
};

export type DocumentType = 'CEDULA' | 'NIT';

const NAME_ALLOWED_CHARS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'.-]+$/;

export function sanitizeNameInput(value: string) {
  return value.replace(/[0-9]/g, '');
}

export function sanitizeDigits(value: string, maxLength = 10) {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

export function formatPhoneNumber(value: string) {
  const digits = sanitizeDigits(value, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export function sanitizeDocumentInput(value: string, type: DocumentType) {
  if (type === 'NIT') {
    const limpio = value.replace(/[^\d-]/g, '');
    const [base = '', verificacion = ''] = limpio.split('-');
    const baseDigits = base.replace(/\D/g, '').slice(0, 9);
    const checkDigit = verificacion.replace(/\D/g, '').slice(0, 1);
    return limpio.includes('-') || checkDigit
      ? `${baseDigits}${checkDigit ? `-${checkDigit}` : '-'}`
      : baseDigits;
  }

  return sanitizeDigits(value, 10);
}

export function normalizeDocumentForStorage(value: string, type: DocumentType) {
  const documento = value.trim();
  if (type === 'NIT') {
    const [base = '', verificacion = ''] = documento.split('-');
    const baseDigits = base.replace(/\D/g, '').slice(0, 9);
    const checkDigit = verificacion.replace(/\D/g, '').slice(0, 1);
    return checkDigit ? `${baseDigits}-${checkDigit}` : baseDigits;
  }

  return sanitizeDigits(documento, 10);
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
      message: `${label} es obligatorio.`,
    };
  }

  if (/\d/.test(nombre)) {
    return {
      isValid: false,
      message: `${label} no debe tener números.`,
    };
  }

  if (!NAME_ALLOWED_CHARS.test(nombre)) {
    return {
      isValid: false,
      message: `${label} debe usar solo letras y espacios.`,
    };
  }

  return { isValid: true };
}

export function validatePhoneNumber(
  value: string,
  label = 'El teléfono',
  options: { optional?: boolean } = {},
): PersonFieldValidation {
  const telefonoTexto = value.trim();
  const telefono = sanitizeDigits(telefonoTexto, 10);

  if (!telefonoTexto) {
    return options.optional
      ? { isValid: true }
      : {
          isValid: false,
          message: `${label} es obligatorio.`,
        };
  }

  if (/[^\d\s]/.test(telefonoTexto)) {
    return {
      isValid: false,
      message: `${label} debe tener solo números.`,
    };
  }

  if (telefono.length !== 10) {
    return {
      isValid: false,
      message: 'Ingresa un número de celular de 10 dígitos.',
    };
  }

  if (!telefono.startsWith('3')) {
    return {
      isValid: false,
      message: `${label} debe empezar por 3.`,
    };
  }

  if (isRepeatedDigits(telefono)) {
    return {
      isValid: false,
      message: `${label} no parece válido.`,
    };
  }

  return { isValid: true };
}

export function validateDocumentNumber(
  value: string,
  label = 'El documento',
  options: { optional?: boolean; type?: DocumentType | null } = {},
): PersonFieldValidation {
  const documento = value.trim();

  if (!documento) {
    return options.optional
      ? { isValid: true }
      : {
          isValid: false,
          message: 'Ingresa un número de documento válido.',
        };
  }

  if (options.type === null) {
    return {
      isValid: false,
      message: 'Selecciona el tipo de documento.',
    };
  }

  const tipoDocumento = options.type ?? 'CEDULA';

  if (tipoDocumento === 'NIT') {
    if (!/^\d{8,9}-\d$/.test(documento)) {
      return {
        isValid: false,
        message: 'Para NIT usa el formato 900123456-7.',
      };
    }

    return { isValid: true };
  }

  if (/\D/.test(documento) || documento.length < 6 || documento.length > 10) {
    return {
      isValid: false,
      message: `${label} debe tener entre 6 y 10 dígitos.`,
    };
  }

  if (isRepeatedDigits(documento)) {
    return {
      isValid: false,
      message: `${label} no puede tener todos los dígitos iguales.`,
    };
  }

  return { isValid: true };
}
