import { BadRequestException } from '@nestjs/common';
import { apiError } from '../errors/api-error';

type PersonaEntidad = 'cliente' | 'productor';

const NAME_ALLOWED_CHARS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'.-]+$/;

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

export function normalizarDocumentoPersona(
  valor: string | undefined,
  entidad: PersonaEntidad,
  options: { required?: boolean } = {},
) {
  const documento = valor?.trim() ?? '';

  if (!documento) {
    if (!options.required) return null;

    throwPersonValidation(
      entidad,
      'DOCUMENTO_INVALIDO',
      'La cédula o NIT es obligatoria.',
      'documento',
    );
  }

  if (/\D/.test(documento)) {
    throwPersonValidation(
      entidad,
      'DOCUMENTO_INVALIDO',
      'La cédula o NIT debe tener solo números.',
      'documento',
    );
  }

  if (documento.length < 6 || documento.length > 10) {
    throwPersonValidation(
      entidad,
      'DOCUMENTO_INVALIDO',
      'La cédula o NIT debe tener entre 6 y 10 dígitos.',
      'documento',
    );
  }

  if (hasRepeatedDigits(documento)) {
    throwPersonValidation(
      entidad,
      'DOCUMENTO_INVALIDO',
      'La cédula o NIT no puede tener todos los dígitos iguales.',
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
      'El teléfono debe tener 10 dígitos.',
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
