// ============================================================
// register.dto.ts — Datos esperados para el registro
// ============================================================
// DTO (Data Transfer Object): define exactamente qué datos
// debe mandar el frontend al registrarse.
//
// class-validator verifica automáticamente que:
//   - Los campos estén presentes
//   - El correo tenga formato válido
//   - La contraseña tenga al menos 6 caracteres
//   - El tipo de organización sea uno de los valores válidos
//
// Si alguna validación falla, NestJS responde con error 400
// ANTES de que el código llegue al servicio.
// ============================================================

import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { TipoOrganizacion } from '@prisma/client';

export class RegisterDto {
  // ---- Datos de la organización ----

  @IsString({ message: 'El nombre de la organización debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre de la organización es obligatorio.' })
  nombreOrganizacion: string;

  @IsEnum(TipoOrganizacion, {
    message: 'El tipo de organización debe ser COOPERATIVA, COMPRAVENTA u OTRO.',
  })
  @IsNotEmpty({ message: 'El tipo de organización es obligatorio.' })
  tipoOrganizacion: TipoOrganizacion;

  // Si el tipo es OTRO, pedimos el detalle
  @ValidateIf((o) => o.tipoOrganizacion === TipoOrganizacion.OTRO)
  @IsString({ message: 'Debes especificar el tipo de negocio.' })
  @IsNotEmpty({ message: 'El detalle del tipo de negocio es obligatorio cuando seleccionas "Otro".' })
  otroTipoDetalle?: string;

  // ---- Datos del usuario administrador ----


  // Nombre completo del administrador
  @IsString({ message: 'El nombre del usuario debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre del usuario es obligatorio.' })
  nombre: string;

  // Teléfono de contacto
  @IsString({ message: 'El teléfono debe ser texto.' })
  @IsNotEmpty({ message: 'El teléfono es obligatorio.' })
  telefono: string;

  // Correo electrónico (debe ser único en el sistema)
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  correo: string;

  // Contraseña: mínimo 6 caracteres
  @IsString({ message: 'La contraseña debe ser texto.' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  password: string;
}
