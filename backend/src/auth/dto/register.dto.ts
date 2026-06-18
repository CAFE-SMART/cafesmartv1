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
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TipoOrganizacion } from '@prisma/client';

export class RegisterDto {
  @Transform(({ value }) => String(value).trim().replace(/\s+/g, ' '))
  @IsString({ message: 'El nombre de la organizacion debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre de la organizacion es obligatorio.' })
  @MinLength(2, {
    message: 'El nombre de la organizacion debe tener al menos 2 caracteres.',
  })
  nombreOrganizacion: string;

  @IsEnum(TipoOrganizacion, {
    message:
      'El tipo de organizacion debe ser COOPERATIVA, COMPRAVENTA u OTRO.',
  })
  @IsNotEmpty({ message: 'El tipo de organizacion es obligatorio.' })
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

  @IsString({ message: 'El nombre del usuario debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre del usuario es obligatorio.' })
  nombre: string;

  @Transform(({ value }) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits.startsWith('57') ? digits.slice(2, 12) : digits.slice(0, 10);
  })
  @IsString({ message: 'El telefono debe ser texto.' })
  @IsNotEmpty({ message: 'El telefono es obligatorio.' })
  @Matches(/^3\d{9}$/, {
    message: 'El teléfono debe tener 10 dígitos y empezar por 3.',
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
