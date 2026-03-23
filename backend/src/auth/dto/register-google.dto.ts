import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  IsEmail,
} from 'class-validator';
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
  telefono: string;
}
