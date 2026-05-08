export type PersonFieldValidation = {
  isValid: boolean;
  message?: string;
};

const NAME_ALLOWED_CHARS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'.-]+$/;

export function sanitizeNameInput(value: string) {
  return value.replace(/[0-9]/g, '');
}

export function sanitizeDigits(value: string, maxLength = 10) {
  return value.replace(/\D/g, '').slice(0, maxLength);
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
    return {
      isValid: false,
      message: `${label} debe tener solo números.`,
    };
  }

  if (telefono.length !== 10) {
    return {
      isValid: false,
      message: `${label} debe tener 10 dígitos.`,
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
  label = 'La cédula o NIT',
  options: { optional?: boolean } = {},
): PersonFieldValidation {
  const documento = value.trim();

  if (!documento) {
    return options.optional
      ? { isValid: true }
      : {
          isValid: false,
          message: `${label} es obligatorio.`,
        };
  }

  if (/\D/.test(documento)) {
    return {
      isValid: false,
      message: `${label} debe tener solo números.`,
    };
  }

  if (documento.length < 6 || documento.length > 10) {
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
