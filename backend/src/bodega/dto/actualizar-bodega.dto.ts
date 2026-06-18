import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
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

  @Type(() => Number)
  @IsNumber({}, { message: 'Ingresa la capacidad máxima de la bodega.' })
  @Min(0.01, { message: 'La capacidad debe ser mayor que 0 kg.' })
  capacidadMaxKg: number;

  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser verdadero o falso.' })
  activa?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'La bodega principal debe ser verdadero o falso.' })
  esPrincipal?: boolean;
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
  @Type(() => Number)
  @IsNumber({}, { message: 'Ingresa la capacidad máxima de la bodega.' })
  @Min(0.01, { message: 'La capacidad debe ser mayor que 0 kg.' })
  capacidadMaxKg?: number;

  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser verdadero o falso.' })
  activa?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'La bodega principal debe ser verdadero o falso.' })
  esPrincipal?: boolean;
}
