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
  Min,
} from 'class-validator';
import { TipoGasto, EstadoPago } from '@prisma/client';

export class CrearGastoDto {
  // ── Datos del gasto ──────────────────────────────────────────
  @IsString({ message: 'conceptoGasto debe ser un string' })
  @IsNotEmpty({ message: 'conceptoGasto es obligatorio' })
  conceptoGasto: string;

  @IsOptional()
  @IsString({ message: 'descripcion debe ser un string' })
  descripcion?: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'montoGasto debe ser un número' })
  @Min(0.01, { message: 'El monto del gasto debe ser mayor a 0' })
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
  clientMutationId?: string;

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
