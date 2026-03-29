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
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TipoOrganizacion } from '@prisma/client';

export class RegisterDto {
  @IsString({ message: 'El nombre de la organizacion debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre de la organizacion es obligatorio.' })
  nombreOrganizacion: string;

  @IsEnum(TipoOrganizacion, {
    message: 'El tipo de organizacion debe ser COOPERATIVA, COMPRAVENTA u OTRO.',
  })
  @IsNotEmpty({ message: 'El tipo de organizacion es obligatorio.' })
  tipoOrganizacion: TipoOrganizacion;

  @ValidateIf((o) => o.tipoOrganizacion === TipoOrganizacion.OTRO)
  @IsString({ message: 'Debes especificar el tipo de negocio.' })
  @IsNotEmpty({
    message: 'El detalle del tipo de negocio es obligatorio cuando seleccionas "Otro".',
  })
  otroTipoDetalle?: string;

  @IsString({ message: 'El nombre del usuario debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre del usuario es obligatorio.' })
  nombre: string;

  @IsString({ message: 'El telefono debe ser texto.' })
  @IsNotEmpty({ message: 'El telefono es obligatorio.' })
  @Matches(/^(?:\+57\s?)?3\d{2}[\s-]?\d{3}[\s-]?\d{4}$/, {
    message: 'El telefono debe ser colombiano. Ejemplo: +57 300 123 4567',
  })
  telefono: string;

  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail({}, { message: 'El correo electronico no tiene un formato valido.' })
  @IsNotEmpty({ message: 'El correo electronico es obligatorio.' })
  correo: string;

  @IsString({ message: 'La contrasena debe ser texto.' })
  @MinLength(6, { message: 'La contrasena debe tener al menos 6 caracteres.' })
  @Matches(/(?=.*[a-z])/, {
    message: 'La contrasena debe incluir al menos una letra minuscula.',
  })
  @Matches(/(?=.*[A-Z])/, {
    message: 'La contrasena debe incluir al menos una letra mayuscula.',
  })
  @IsNotEmpty({ message: 'La contrasena es obligatoria.' })
  password: string;
}
