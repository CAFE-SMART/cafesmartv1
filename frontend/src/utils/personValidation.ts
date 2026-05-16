export type PersonFieldValidation = {
  isValid: boolean;
  message?: string;
};

export type DocumentType = 'CEDULA' | 'NIT';

const NAME_ALLOWED_CHARS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]+$/;
const COMPANY_ALLOWED_CHARS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,&(){}[\]-]+$/;

export function normalizeHumanName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    .replace(/(^|[\s'-])([a-záéíóúüñ])/g, (match, separator, letter) =>
      `${separator}${letter.toLocaleUpperCase('es')}`,
    );
}

export function sanitizeNameInput(value: string) {
  return value.replace(/\s{2,}/g, ' ').slice(0, 60);
}

export function normalizeCompanyName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    .replace(/(^|[\s&.,()-])([a-záéíóúüñ])/g, (match, separator, letter) =>
      `${separator}${letter.toLocaleUpperCase('es')}`,
    );
}

function hasAlternatingCaseWord(value: string) {
  return value
    .split(/\s+/)
    .some((word) => {
      const letters = word.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
      if (letters.length < 4) return false;
      let changes = 0;
      for (let index = 1; index < letters.length; index += 1) {
        const previous = letters[index - 1];
        const current = letters[index];
        if (
          previous.toLocaleLowerCase('es') !== previous.toLocaleUpperCase('es') &&
          current.toLocaleLowerCase('es') !== current.toLocaleUpperCase('es') &&
          (previous === previous.toLocaleUpperCase('es')) !==
            (current === current.toLocaleUpperCase('es'))
        ) {
          changes += 1;
        }
      }
      return changes >= 3;
    });
}

export function validateCompanyName(value: string): PersonFieldValidation {
  const nombreOriginal = value;
  const nombre = normalizeCompanyName(value);

  if (!nombre) {
    return { isValid: false, message: 'El nombre de la empresa es obligatorio.' };
  }

  if (nombreOriginal !== nombreOriginal.trim() || /\s{2,}/.test(nombreOriginal)) {
    return { isValid: false, message: 'No uses espacios al inicio, al final ni dobles.' };
  }

  if (nombre.length < 3 || nombre.length > 100) {
    return { isValid: false, message: 'El nombre debe tener entre 3 y 100 caracteres.' };
  }

  if (/[()[\]{}]/.test(nombre)) {
    const pairs = [
      ['(', ')'],
      ['[', ']'],
      ['{', '}'],
    ] as const;
    for (const [open, close] of pairs) {
      const openCount = nombre.split(open).length - 1;
      const closeCount = nombre.split(close).length - 1;
      if (openCount !== closeCount) {
        return { isValid: false, message: 'Cierra bien los paréntesis o corchetes.' };
      }
    }
    if (/\(\s*\)|\[\s*\]|\{\s*\}/.test(nombre)) {
      return { isValid: false, message: 'No uses signos vacíos como ().' };
    }
  }

  if (/(.)\1\1\1/i.test(nombre)) {
    return { isValid: false, message: 'No repitas la misma letra más de 3 veces.' };
  }

  if (/[@$%*=_+?¿!¡|<>]/.test(nombre) || !COMPANY_ALLOWED_CHARS.test(nombre)) {
    return { isValid: false, message: 'Usa solo letras, números, espacios, puntos, comas, guiones y &.' };
  }

  if (hasAlternatingCaseWord(nombre)) {
    return { isValid: false, message: 'Evita mayúsculas alternadas en el nombre.' };
  }

  return { isValid: true };
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
  const nombreOriginal = value;
  const nombre = value.trim().replace(/\s+/g, ' ');

  if (!nombre) {
    return {
      isValid: false,
      message: `${label} es obligatorio.`,
    };
  }

  if (nombreOriginal !== nombreOriginal.trim() || /\s{2,}/.test(nombreOriginal)) {
    return {
      isValid: false,
      message: 'No uses espacios al inicio, al final ni dobles.',
    };
  }

  if (nombre.length < 2) {
    return {
      isValid: false,
      message: 'El nombre es demasiado corto.',
    };
  }

  if (nombre.length > 60) {
    return {
      isValid: false,
      message: 'El nombre no puede pasar de 60 caracteres.',
    };
  }

  if (/\d/.test(nombre)) {
    return {
      isValid: false,
      message: 'El nombre no puede contener números.',
    };
  }

  if (/[@$%*=*?¿!¡#_/\\.,()[\]{}]/.test(nombre) || !NAME_ALLOWED_CHARS.test(nombre)) {
    return {
      isValid: false,
      message: 'No uses símbolos especiales.',
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
