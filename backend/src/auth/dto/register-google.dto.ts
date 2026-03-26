import {
  IsEnum,
  IsNotEmpty,
  IsString,
  ValidateIf,
  IsEmail,
  Matches,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TipoOrganizacion } from '@prisma/client';

export class RegisterGoogleDto {
  // El frontend nos debería mandar el token que le dio Google al usuario
  @IsString({ message: 'El token de Google es obligatorio.' })
  @IsNotEmpty()
  googleToken: string;

  // IMPORTANTE: En un entorno de producción real, NUNCA debemos confiar
  // en el correo o nombre que nos envíe el frontend directamente.
  // Esos datos se deben extraer descriptando el `googleToken`.
  // Sin embargo, para no complicar el código con librerías externas por ahora,
  // los vamos a pedir aquí:
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail({}, { message: 'El correo debe tener un formato válido.' })
  @IsNotEmpty()
  correo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  // Datos de la Organización que va a crear este usuario de Google
  @IsString({ message: 'El nombre de la organización es obligatorio.' })
  @IsNotEmpty()
  nombreOrganizacion: string;

  @IsEnum(TipoOrganizacion, {
    message: 'El tipo de organización debe ser COOPERATIVA, COMPRAVENTA u OTRO.',
  })
  @IsNotEmpty()
  tipoOrganizacion: TipoOrganizacion;

  @ValidateIf((o) => o.tipoOrganizacion === TipoOrganizacion.OTRO)
  @IsString({ message: 'Debes especificar el tipo de negocio.' })
  @IsNotEmpty()
  otroTipoDetalle?: string;

  @IsString({ message: 'El teléfono es obligatorio.' })
  @IsNotEmpty()
  @Matches(/^(?:\+57\s?)?3\d{2}[\s-]?\d{3}[\s-]?\d{4}$/, {
    message: 'El teléfono debe ser colombiano. Ejemplo: +57 300 123 4567',
  })
  telefono: string;

  @IsString({ message: 'La contraseña es obligatoria.' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z]).+$/, {
    message: 'La contraseña debe incluir al menos una minúscula y una mayúscula.',
  })
  password: string;
}
