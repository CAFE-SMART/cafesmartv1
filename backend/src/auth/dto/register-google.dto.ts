import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
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

  @Transform(({ value }) => String(value).trim().replace(/\s+/g, ' '))
  @IsString({ message: 'El nombre de la organizacion es obligatorio.' })
  @IsNotEmpty()
  @MinLength(2, {
    message: 'El nombre de la organizacion debe tener al menos 2 caracteres.',
  })
  nombreOrganizacion: string;

  @IsEnum(TipoOrganizacion, {
    message:
      'El tipo de organizacion debe ser COOPERATIVA, COMPRAVENTA u OTRO.',
  })
  @IsNotEmpty()
  tipoOrganizacion: TipoOrganizacion;

  @IsOptional()
  @IsString({ message: 'Debes especificar el tipo de negocio.' })
  otroTipoDetalle?: string;

  @Transform(({ value }) => String(value ?? '').trim().replace(/\s+/g, ' '))
  @IsOptional()
  @IsString({ message: 'La descripcion del negocio debe ser texto.' })
  @MaxLength(200, {
    message: 'La descripcion no puede superar los 200 caracteres.',
  })
  descripcionOrganizacion?: string;

  @Transform(({ value }) => String(value ?? '').trim().replace(/\s+/g, ' '))
  @IsOptional()
  @IsString({ message: 'La descripcion del negocio debe ser texto.' })
  @MaxLength(200, {
    message: 'La descripcion no puede superar los 200 caracteres.',
  })
  descripcion?: string;

  @Transform(({ value }) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits.startsWith('57') ? digits.slice(2, 12) : digits.slice(0, 10);
  })
  @IsString({ message: 'El telefono es obligatorio.' })
  @IsNotEmpty()
  @Matches(/^3\d{9}$/, {
    message: 'El teléfono debe tener 10 dígitos y empezar por 3.',
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
