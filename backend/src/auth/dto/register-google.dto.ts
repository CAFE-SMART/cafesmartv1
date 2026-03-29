import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TipoOrganizacion } from '@prisma/client';

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

  @IsString({ message: 'El nombre de la organizacion es obligatorio.' })
  @IsNotEmpty()
  nombreOrganizacion: string;

  @IsEnum(TipoOrganizacion, {
    message: 'El tipo de organizacion debe ser COOPERATIVA, COMPRAVENTA u OTRO.',
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
    message: 'La contrasena debe incluir al menos una minuscula y una mayuscula.',
  })
  password: string;
}
