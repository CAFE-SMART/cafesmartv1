import { BadRequestException } from '@nestjs/common';
import { apiError } from '../errors/api-error';

type PersonaEntidad = 'cliente' | 'productor';
type TipoDocumento = 'CEDULA' | 'NIT';

const NAME_ALLOWED_CHARS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'.-]+$/;
const COMPANY_ALLOWED_CHARS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,&()-]+$/;

function prefix(entidad: PersonaEntidad) {
  return entidad === 'cliente' ? 'CLIENTE' : 'PRODUCTOR';
}

function label(entidad: PersonaEntidad) {
  return entidad === 'cliente' ? 'cliente' : 'productor';
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
) {
  const nombre = valor.trim();

  if (!nombre) {
    throwPersonValidation(
      entidad,
      'NOMBRE_INVALIDO',
      `El nombre del ${label(entidad)} es obligatorio.`,
      'nombre',
    );
  }

  if (/\d/.test(nombre)) {
    throwPersonValidation(
      entidad,
      'NOMBRE_INVALIDO',
      `El nombre del ${label(entidad)} no debe tener números.`,
      'nombre',
    );
  }

  if (!NAME_ALLOWED_CHARS.test(nombre)) {
    throwPersonValidation(
      entidad,
      'NOMBRE_INVALIDO',
      `El nombre del ${label(entidad)} debe usar solo letras y espacios.`,
      'nombre',
    );
  }

  return nombre;
}

export function normalizarNombreEmpresaPersona(
  valor: string,
  entidad: PersonaEntidad,
) {
  const nombre = valor.trim().replace(/\s+/g, ' ');

  if (!nombre) {
    throwPersonValidation(
      entidad,
      'NOMBRE_INVALIDO',
      `El nombre del ${label(entidad)} es obligatorio.`,
      'nombre',
    );
  }

  if (valor !== valor.trim() || /\s{2,}/.test(valor)) {
    throwPersonValidation(
      entidad,
      'NOMBRE_INVALIDO',
      'No uses espacios al inicio, al final ni dobles.',
      'nombre',
    );
  }

  if (nombre.length < 3 || nombre.length > 100) {
    throwPersonValidation(
      entidad,
      'NOMBRE_INVALIDO',
      'El nombre debe tener entre 3 y 100 caracteres.',
      'nombre',
    );
  }

  if (/[@$%*=_+?¿!¡|<>]/.test(nombre) || !COMPANY_ALLOWED_CHARS.test(nombre)) {
    throwPersonValidation(
      entidad,
      'NOMBRE_INVALIDO',
      'Usa solo letras, números, espacios, puntos, comas, guiones y &.',
      'nombre',
    );
  }

  return nombre;
}

export function normalizarDocumentoPersona(
  valor: string | undefined,
  entidad: PersonaEntidad,
  options: { required?: boolean; tipoDocumento?: TipoDocumento } = {},
) {
  const documento = valor?.trim() ?? '';

  if (!documento) {
    if (!options.required) return null;

    throwPersonValidation(
      entidad,
      'DOCUMENTO_INVALIDO',
        'Ingresa un número de documento válido.',
        'documento',
      );
  }

  if (!options.tipoDocumento) {
    throwPersonValidation(
      entidad,
      'DOCUMENTO_INVALIDO',
      'Selecciona el tipo de documento.',
      'documento',
    );
  }

  if (options.tipoDocumento === 'NIT') {
    const nit = documento.includes('-')
      ? documento
      : documento.length >= 9
        ? `${documento.slice(0, -1)}-${documento.slice(-1)}`
        : documento;

    if (!/^\d{8,9}-\d$/.test(nit)) {
      throwPersonValidation(
        entidad,
        'DOCUMENTO_INVALIDO',
        'Para NIT usa el formato 900123456-7.',
        'documento',
      );
    }

    return nit;
  }

  if (/\D/.test(documento) || documento.length < 6 || documento.length > 10) {
    throwPersonValidation(
      entidad,
      'DOCUMENTO_INVALIDO',
      'Ingresa un número de documento válido.',
      'documento',
    );
  }

  if (hasRepeatedDigits(documento)) {
    throwPersonValidation(
      entidad,
      'DOCUMENTO_INVALIDO',
      'Ingresa un número de documento válido.',
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
    throwPersonValidation(
      entidad,
      'TELEFONO_INVALIDO',
      'El teléfono debe tener solo números.',
      'telefono',
    );
  }

  if (telefono.length !== 10) {
    throwPersonValidation(
      entidad,
      'TELEFONO_INVALIDO',
      'Ingresa un número de celular de 10 dígitos.',
      'telefono',
    );
  }

  if (!telefono.startsWith('3')) {
    throwPersonValidation(
      entidad,
      'TELEFONO_INVALIDO',
      'El teléfono debe empezar por 3.',
      'telefono',
    );
  }

  if (hasRepeatedDigits(telefono)) {
    throwPersonValidation(
      entidad,
      'TELEFONO_INVALIDO',
      'El teléfono no parece válido.',
      'telefono',
    );
  }

  return telefono;
}
