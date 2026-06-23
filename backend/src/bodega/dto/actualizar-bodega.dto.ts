import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';

export class ActualizarBodegaDto {
  @IsString({ message: 'El nombre de la bodega debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre de la bodega es requerido' })
  nombreBodega: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'La capacidad debe ser un número' })
  @Min(0.01, { message: 'La capacidad debe ser mayor a 0' })
  capacidadKg: number;
}

export class CrearBodegaDto {
  @IsString({ message: 'El nombre de la bodega debe ser un texto' })
  @IsNotEmpty({ message: 'Ingresa el nombre de la bodega.' })
  @MaxLength(80, { message: 'El nombre no debe superar 80 caracteres.' })
  nombre: string;

  @IsOptional()
  @IsString({ message: 'La ubicación debe ser un texto' })
  @MaxLength(120, { message: 'La ubicación no debe superar 120 caracteres.' })
  ubicacion?: string | null;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto' })
  @MaxLength(250, { message: 'La descripción no debe superar 250 caracteres.' })
  descripcion?: string | null;

  @Type(() => Number)
  @IsNumber({}, { message: 'Ingresa la capacidad máxima de la bodega.' })
  @Min(0.01, { message: 'Ingresa una capacidad válida mayor que cero' })
  capacidadMaxKg: number;

  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser verdadero o falso.' })
  activa?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'La bodega principal debe ser verdadero o falso.' })
  esPrincipal?: boolean;

  @IsOptional()
  @IsObject({ message: 'Los límites operativos deben ser un objeto válido.' })
  limitesOperativos?: {
    maxPesoKg?: number;
    maxPrecioKg?: number;
    maxPrecioVentaKg?: number;
  };

  @IsOptional()
  @IsObject({ message: 'Los límites de almacenamiento deben ser un objeto válido.' })
  limitesAlmacenamiento?: Partial<ActualizarLimitesBodegaDto>;
}

export class EditarBodegaDto {
  @IsOptional()
  @IsString({ message: 'El nombre de la bodega debe ser un texto' })
  @MaxLength(80, { message: 'El nombre no debe superar 80 caracteres.' })
  nombre?: string;

  @IsOptional()
  @IsString({ message: 'La ubicación debe ser un texto' })
  @MaxLength(120, { message: 'La ubicación no debe superar 120 caracteres.' })
  ubicacion?: string | null;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto' })
  @MaxLength(250, { message: 'La descripción no debe superar 250 caracteres.' })
  descripcion?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Ingresa la capacidad máxima de la bodega.' })
  @Min(0.01, { message: 'Ingresa una capacidad válida mayor que cero' })
  capacidadMaxKg?: number;

  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser verdadero o falso.' })
  activa?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'La bodega principal debe ser verdadero o falso.' })
  esPrincipal?: boolean;
}

export class ActualizarLimitesBodegaDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Ingresa un límite mínimo válido.' })
  @Min(0, { message: 'El límite mínimo debe ser igual o mayor que cero.' })
  limiteMinimoKg: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'Ingresa un límite máximo válido.' })
  @Min(0.01, { message: 'El límite máximo debe ser mayor que cero.' })
  limiteMaximoKg: number;

  @Type(() => Number)
  @IsInt({ message: 'El porcentaje preventivo debe ser un número entero.' })
  @Min(1, { message: 'La alerta preventiva debe ser mayor que 0%.' })
  @Max(100, { message: 'La alerta preventiva no debe superar 100%.' })
  alertaPreventivaPct: number;

  @Type(() => Number)
  @IsInt({ message: 'El porcentaje crítico debe ser un número entero.' })
  @Min(1, { message: 'El estado crítico debe ser mayor que 0%.' })
  @Max(100, { message: 'El estado crítico no debe superar 100%.' })
  alertaCriticaPct: number;

  @IsBoolean({ message: 'El bloqueo por capacidad debe ser verdadero o falso.' })
  bloquearAlSuperarCapacidad: boolean;

  @IsBoolean({ message: 'El estado de alertas debe ser verdadero o falso.' })
  alertasActivas: boolean;
}
