import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { TipoGasto, EstadoPago } from '@prisma/client';

const CONCEPTO_GASTO_VALIDO_REGEX = /^[\p{L}\s]+$/u;

@ValidatorConstraint({ name: 'ConceptoGastoValido', async: false })
class ConceptoGastoValidoConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    const concepto = value.trim();
    if (!concepto) {
      return false;
    }

    const lettersCount = (concepto.match(/\p{L}/gu) || []).length;

    return CONCEPTO_GASTO_VALIDO_REGEX.test(concepto) && lettersCount >= 3;
  }

  defaultMessage(args: ValidationArguments): string {
    const concepto = String(args.value ?? '').trim();
    const lettersCount = (concepto.match(/\p{L}/gu) || []).length;

    if (!concepto) {
      return 'Escribe el concepto del gasto.';
    }

    if (!CONCEPTO_GASTO_VALIDO_REGEX.test(concepto)) {
      return 'Solo se permiten letras y espacios en el concepto del gasto.';
    }

    if (lettersCount < 3) {
      return 'El concepto debe ser descriptivo (mínimo 3 letras).';
    }

    return 'Solo se permiten letras y espacios en el concepto del gasto.';
  }
}

export class CrearGastoDto {
  // ── Datos del gasto ──────────────────────────────────────────
  @IsString({ message: 'conceptoGasto debe ser un string' })
  @IsNotEmpty({ message: 'Escribe el concepto del gasto.' })
  @MaxLength(60, { message: 'Máximo 60 caracteres.' })
  @Validate(ConceptoGastoValidoConstraint)
  conceptoGasto: string;

  @IsOptional()
  @IsString({ message: 'descripcion debe ser un string' })
  @MaxLength(200, { message: 'Máximo 200 caracteres.' })
  descripcion?: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'montoGasto debe ser un número' })
  @Min(0.01, { message: 'El monto del gasto debe ser mayor a 0' })
  @Max(99999999, { message: 'El monto supera el máximo permitido' })
  montoGasto: number;

  @IsDateString({}, { message: 'fechaGasto debe ser una fecha ISO 8601' })
  @IsNotEmpty({ message: 'fechaGasto es obligatoria' })
  fechaGasto: string;

  @IsEnum(TipoGasto, {
    message: `tipoGasto debe ser uno de: ${Object.values(TipoGasto).join(', ')}`,
  })
  tipoGasto: TipoGasto;

  @IsEnum(EstadoPago, {
    message: `estadoPago debe ser PAGADO o PENDIENTE`,
  })
  estadoPago: EstadoPago;

  // ── Campos de sincronización offline-first ───────────────────
  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  localId?: string;

  @IsOptional()
  @IsString()
  syncStatus?: string;

  // ── Asociación a sublotes (opcional) ─────────────────────────
  /**
   * Si es true el gasto se asocia a sublotes específicos.
   * Si es false (o se omite) es un GASTO_GENERAL.
   */
  @IsOptional()
  @IsBoolean({ message: 'asociarASublotes debe ser un booleano' })
  asociarASublotes?: boolean;

  /**
   * Lista de IDs de sublotes a los que aplica el gasto.
   * Requerido si asociarASublotes = true.
   */
  @IsOptional()
  @IsArray({ message: 'subloteIds debe ser un arreglo de UUIDs' })
  @IsUUID('4', {
    each: true,
    message: 'Cada subloteId debe ser un UUID v4 válido',
  })
  subloteIds?: string[];
}
