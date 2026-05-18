import { BadRequestException } from '@nestjs/common';
import { apiError } from '../errors/api-error';

type PersonaEntidad = 'cliente' | 'productor';
export type TipoDocumentoPersona = 'CC' | 'CE' | 'NIT' | 'OTRO';
const COMPANY_NAME_ALLOWED_CHARS = /^[\p{L}0-9\s&.'/-]+$/u;
const COMPANY_HAS_LETTER = /\p{L}/u;

const NAME_ALLOWED_CHARS = /^[\p{L}\s'.-]+$/u;
const BUSINESS_NAME_ALLOWED_CHARS = /^[A-Za-zÃÃ‰ÃÃ“ÃšÃœÃ‘Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±0-9\s&.'-]+$/;
const HAS_LETTER = /\p{L}/u;

const COMPANY_NAME_MAX_LENGTH = 30;

function prefix(entidad: PersonaEntidad) {
  return entidad === 'cliente' ? 'CLIENTE' : 'PRODUCTOR';
}

function throwPersonValidation(
  entidad: PersonaEntidad,
  suffix: string,
  message: string,
  field: 'nombre' | 'documento' | 'telefono',
): never {
  throw new BadRequestException(
    apiError(`${prefix(entidad)}_${suffix}`, message, { field }),
  );
}

function hasRepeatedDigits(value: string) {
  return /^(\d)\1+$/.test(value);
}

export function normalizarNombrePersona(
  valor: string,
  entidad: PersonaEntidad,
  options: { tipoDocumento?: TipoDocumentoPersona } = {},
) {
  const nombre = valor.trim();
  const tipoDocumento = options.tipoDocumento ?? 'CC';
  const isCompany = tipoDocumento === 'NIT' || tipoDocumento === 'OTRO';

  if (!nombre) {
    throwPersonValidation(
      entidad,
      'NOMBRE_INVALIDO',
      isCompany
        ? 'Ingresa el nombre de la empresa para continuar.'
        : 'Escribe el nombre y apellido para continuar.',
      'nombre',
    );
  }

  if (isCompany) {
    if (nombre.length > COMPANY_NAME_MAX_LENGTH) {
      throwPersonValidation(
        entidad,
        'NOMBRE_INVALIDO',
        `El nombre de la empresa no puede superar ${COMPANY_NAME_MAX_LENGTH} caracteres.`,
        'nombre',
      );
    }

    if (
      !COMPANY_NAME_ALLOWED_CHARS.test(nombre) ||
      !COMPANY_HAS_LETTER.test(nombre)
    ) {
      throwPersonValidation(
        entidad,
        'NOMBRE_INVALIDO',
        'Ingresa un nombre de empresa válido.',
        'nombre',
      );
    }

    return nombre;
  }

  const words = nombre.split(/\s+/).filter(Boolean);
  if (
    /\d/.test(nombre) ||
    !NAME_ALLOWED_CHARS.test(nombre) ||
    !HAS_LETTER.test(nombre)
  ) {
    throwPersonValidation(
      entidad,
      'NOMBRE_INVALIDO',
      'Revisa el nombre e inténtalo nuevamente.',
      'nombre',
    );
  }

  if (
    words.length < 2 ||
    words.some(
      (word) => word.replace(/[^\p{L}]/gu, '').length < 2,
    )
  ) {
    throwPersonValidation(
      entidad,
      'NOMBRE_INVALIDO',
      'Completa el nombre y apellido para continuar.',
      'nombre',
    );
  }

  return nombre;
}

export function normalizarDocumentoPersona(
  valor: string | undefined,
  entidad: PersonaEntidad,
  options: { required?: boolean; tipoDocumento?: TipoDocumentoPersona } = {},
) {
  const documento = valor?.trim() ?? '';
  const tipoDocumento = options.tipoDocumento ?? 'CC';
  const alfanumerico = documento.replace(/[^A-Za-z0-9]/g, '');

  if (!documento) {
    if (!options.required) return null;

    throwPersonValidation(
      entidad,
      'DOCUMENTO_INVALIDO',
      'Escribe el número de documento para continuar.',
      'documento',
    );
  }

  if (alfanumerico.length < 4) {
    throwPersonValidation(
      entidad,
      'DOCUMENTO_INVALIDO',
      'Verifica que el documento esté completo.',
      'documento',
    );
  }

  if (tipoDocumento === 'CC') {
    if (
      !/^\d+$/.test(documento)
    ) {
      throwPersonValidation(
        entidad,
        'DOCUMENTO_INVALIDO',
        'Revisa el número de documento e inténtalo nuevamente.',
        'documento',
      );
    }

    if (documento.length < 6) {
      throwPersonValidation(
        entidad,
        'DOCUMENTO_INVALIDO',
        'Verifica que el documento esté completo.',
        'documento',
      );
    }

    if (documento.length > 10) {
      throwPersonValidation(
        entidad,
        'DOCUMENTO_INVALIDO',
        'Revisa el número de documento e inténtalo nuevamente.',
        'documento',
      );
    }

    return documento;
  }

  if (tipoDocumento === 'NIT') {
    const digits = documento.replace(/\D/g, '');

    if (
      !/^\d+(?:-\d+)?$/.test(documento)
    ) {
      throwPersonValidation(
        entidad,
        'DOCUMENTO_INVALIDO',
        digits.length > 0 && digits.length < 5
          ? 'Verifica que el documento esté completo.'
          : 'Revisa el número de documento e inténtalo nuevamente.',
        'documento',
      );
    }

    if (digits.length < 5) {
      throwPersonValidation(
        entidad,
        'DOCUMENTO_INVALIDO',
        'Verifica que el documento esté completo.',
        'documento',
      );
    }

    if (digits.length > 15) {
      throwPersonValidation(
        entidad,
        'DOCUMENTO_INVALIDO',
        'Revisa el número de documento e inténtalo nuevamente.',
        'documento',
      );
    }

    return documento.replace(/\s/g, '');
  }

  if (
    !/[A-Za-z0-9]/.test(documento) ||
    !/^[A-Za-zÃÃ‰ÃÃ“ÃšÃœÃ‘Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±0-9 .'-]+$/.test(documento)
  ) {
    throwPersonValidation(
      entidad,
      'DOCUMENTO_INVALIDO',
      'Revisa el número de documento e inténtalo nuevamente.',
      'documento',
    );
  }

  return documento;
}

export function normalizarTelefonoPersona(
  valor: string | undefined,
  entidad: PersonaEntidad,
) {
  const telefono = valor?.trim() ?? '';

  if (!telefono) return null;

  if (/\D/.test(telefono)) {
    const compact = telefono.replace(/[\s()+-]/g, '');

    if (!compact || /\D/.test(compact)) {
      throwPersonValidation(
        entidad,
        'TELEFONO_INVALIDO',
        'Ingresa un teléfono válido o deja el campo vacío.',
        'telefono',
      );
    }
  }

  const digits = telefono.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) {
    throwPersonValidation(
      entidad,
      'TELEFONO_INVALIDO',
      'Ingresa un teléfono válido o deja el campo vacío.',
      'telefono',
    );
  }

  if (hasRepeatedDigits(digits)) {
    throwPersonValidation(
      entidad,
      'TELEFONO_INVALIDO',
      'Ingresa un teléfono válido o deja el campo vacío.',
      'telefono',
    );
  }

  return digits;
}
