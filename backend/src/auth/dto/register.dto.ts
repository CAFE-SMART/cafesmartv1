// ============================================================
// register.dto.ts - Datos esperados para el registro
// ============================================================
// DTO (Data Transfer Object): define exactamente que datos
// debe mandar el frontend al registrarse.
//
// class-validator verifica automaticamente que:
//   - Los campos esten presentes
//   - El correo tenga formato valido
//   - La contrasena tenga al menos 6 caracteres
//   - El tipo de organizacion sea uno de los valores validos
//
// Si alguna validacion falla, NestJS responde con error 400
// ANTES de que el codigo llegue al servicio.
// ============================================================

import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TipoOrganizacion } from '@prisma/client';

const BUSINESS_NAME_PATTERN = /^(?=.*\p{L})(?=(?:\D*\d){0,5}\D*$)[\p{L}0-9 ]+$/u;
const ADMIN_NAME_PATTERN = /^(?=.*\p{L})[\p{L} ]+$/u;
const BUSINESS_NAME_MESSAGE = 'Ingresa un nombre de negocio válido.';
const ADMIN_NAME_MESSAGE = 'El nombre del administrador solo puede tener letras y espacios.';
const BUSINESS_NAME_MAX_LENGTH_MESSAGE =
  'El nombre del negocio no puede superar 30 caracteres.';

function normalizeBusinessName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
}

export class RegisterDto {
  @Transform(({ value }) => normalizeBusinessName(value))
  @IsString({ message: BUSINESS_NAME_MESSAGE })
  @IsNotEmpty({ message: BUSINESS_NAME_MESSAGE })
  @MaxLength(30, { message: BUSINESS_NAME_MAX_LENGTH_MESSAGE })
  @Matches(/\p{L}/u, { message: BUSINESS_NAME_MESSAGE })
  @Matches(BUSINESS_NAME_PATTERN, { message: BUSINESS_NAME_MESSAGE })
  nombreOrganizacion: string;

  @IsEnum(TipoOrganizacion, {
    message:
      'El tipo de organizacion debe ser COOPERATIVA, COMPRAVENTA u OTRO.',
  })
  @IsNotEmpty({ message: 'El tipo de organizacion es obligatorio.' })
  tipoOrganizacion: TipoOrganizacion;

  @ValidateIf((o) => o.tipoOrganizacion === TipoOrganizacion.OTRO)
  @IsString({ message: 'Debes especificar el tipo de negocio.' })
  @MaxLength(50, {
    message: 'El detalle del tipo de negocio no puede superar 50 caracteres.',
  })
  @IsNotEmpty({
    message:
      'El detalle del tipo de negocio es obligatorio cuando seleccionas "Otro".',
  })
  otroTipoDetalle?: string;

  @IsString({ message: 'El nombre del usuario debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre del usuario es obligatorio.' })
  @MaxLength(70, { message: 'El nombre no puede superar 70 caracteres.' })
  @Matches(ADMIN_NAME_PATTERN, { message: ADMIN_NAME_MESSAGE })
  nombre: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El telefono debe ser texto.' })
  @IsNotEmpty({ message: 'El telefono es obligatorio.' })
  @MaxLength(10, { message: 'El telefono no puede superar 10 digitos.' })
  @Matches(/^3\d{9}$/, {
    message: 'El telefono debe tener 10 digitos y empezar con 3.',
  })
  telefono: string;

  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail({}, { message: 'El correo electronico no tiene un formato valido.' })
  @IsNotEmpty({ message: 'El correo electronico es obligatorio.' })
  @MaxLength(100, { message: 'El correo no puede superar 100 caracteres.' })
  correo: string;

  @IsString({ message: 'La contrasena debe ser texto.' })
  @MinLength(6, { message: 'La contrasena debe tener al menos 6 caracteres.' })
  @MaxLength(72, { message: 'La contrasena no puede superar 72 caracteres.' })
  @Matches(/(?=.*[a-z])/, {
    message: 'La contrasena debe incluir al menos una letra minuscula.',
  })
  @Matches(/(?=.*[A-Z])/, {
    message: 'La contrasena debe incluir al menos una letra mayuscula.',
  })
  @IsNotEmpty({ message: 'La contrasena es obligatoria.' })
  password: string;
}
