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

const BUSINESS_NAME_PATTERN = /^(?=.*\p{L})[\p{L}0-9 &.'/-]+$/u;
const BUSINESS_NAME_MESSAGE = 'Ingresa un nombre de negocio válido.';
const BUSINESS_NAME_MAX_LENGTH_MESSAGE =
  'El nombre del negocio no puede superar 30 caracteres.';

function normalizeBusinessName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
}

export class RegisterGoogleDto {
  @IsString({ message: 'El token de Google es obligatorio.' })
  @IsNotEmpty()
  googleToken: string;

  // Por compatibilidad con el frontend actual mantenemos estos campos,
  // pero el correo definitivo se valida con el token de Google en el servicio.
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail({}, { message: 'El correo debe tener un formato valido.' })
  @IsNotEmpty()
  correo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

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
  @IsNotEmpty()
  tipoOrganizacion: TipoOrganizacion;

  @ValidateIf((o) => o.tipoOrganizacion === TipoOrganizacion.OTRO)
  @IsString({ message: 'Debes especificar el tipo de negocio.' })
  @IsNotEmpty()
  otroTipoDetalle?: string;

  @IsString({ message: 'El telefono es obligatorio.' })
  @IsNotEmpty()
  @Matches(/^(?:\+57\s?)?3\d{2}[\s-]?\d{3}[\s-]?\d{4}$/, {
    message: 'El telefono debe ser colombiano. Ejemplo: +57 300 123 4567',
  })
  telefono: string;

  @IsString({ message: 'La contrasena es obligatoria.' })
  @IsNotEmpty({ message: 'La contrasena es obligatoria.' })
  @MinLength(6, { message: 'La contrasena debe tener al menos 6 caracteres.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z]).+$/, {
    message:
      'La contrasena debe incluir al menos una minuscula y una mayuscula.',
  })
  password: string;
}
