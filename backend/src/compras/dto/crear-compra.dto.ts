import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateSubloteDto {
  @IsUUID('4', { message: 'tipoCafeId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'tipoCafeId es obligatorio' })
  tipoCafeId: string;

  @IsUUID('4', { message: 'calidadId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'calidadId es obligatorio' })
  calidadId: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'pesoInicial debe ser un número' })
  @Min(0.01, { message: 'El peso inicial debe ser mayor a 0' })
  @Max(100000, { message: 'El peso inicial no puede exceder los 100,000 kg' })
  pesoInicial: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'precioKg debe ser un número' })
  @Min(0.1, { message: 'El precio por kg debe ser mayor a 0' })
  @Max(100000, { message: 'El precio por kg no puede exceder los 100,000' })
  precioKg: number;

  @IsString({ message: 'deviceId del sublote debe ser un string' })
  @IsNotEmpty({ message: 'deviceId del sublote es obligatorio' })
  deviceId: string;

  @IsString({ message: 'localId del sublote debe ser un string' })
  @IsNotEmpty({ message: 'localId del sublote es obligatorio' })
  localId: string;
}

export class CreateCompraDto {
  @IsDateString({}, { message: 'La fecha debe ser ISO 8601' })
  @IsNotEmpty({ message: 'La fecha es obligatoria' })
  fecha: string;

  @IsString({ message: 'deviceId de la compra debe ser un string' })
  @IsNotEmpty({ message: 'deviceId de la compra es obligatorio' })
  deviceId: string;

  @IsString({ message: 'localId de la compra debe ser un string' })
  @IsNotEmpty({ message: 'localId de la compra es obligatorio' })
  localId: string;

  @IsArray({ message: 'sublotes debe ser un arreglo' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un sublote' })
  @ValidateNested({ each: true })
  @Type(() => CreateSubloteDto)
  sublotes: CreateSubloteDto[];
}
