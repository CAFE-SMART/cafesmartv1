import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PRECIO_MINIMO_KG } from '../../common/business-rules';

function parseNumeroColombiano(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const limpio = value.trim().replace(/\s/g, '');

  if (!limpio) {
    return value;
  }

  if (limpio.includes(',')) {
    return Number(limpio.replace(/\./g, '').replace(',', '.'));
  }

  if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) {
    return Number(limpio.replace(/\./g, ''));
  }

  return Number(limpio);
}

export class CreateSubloteDto {
  @IsUUID('4', { message: 'tipoCafeId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'tipoCafeId es obligatorio' })
  tipoCafeId: string;

  @IsUUID('4', { message: 'calidadId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'calidadId es obligatorio' })
  calidadId: string;

  @Transform(({ value }) => parseNumeroColombiano(value))
  @IsNumber({}, { message: 'pesoInicial debe ser un número' })
  @Min(0.01, { message: 'El peso inicial debe ser mayor a 0' })
  @Max(2000000000, {
    message: 'Revisa la cantidad ingresada. Parece demasiado alta.',
  })
  pesoInicial: number;

  @Transform(({ value }) => parseNumeroColombiano(value))
  @IsNumber({}, { message: 'precioKg debe ser un número' })
  @Min(PRECIO_MINIMO_KG, { message: 'El precio por kg debe ser mínimo $1,000' })
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
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe ser ISO 8601' })
  fecha?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El productor seleccionado no es valido' })
  @IsString({ message: 'productorId debe ser un string' })
  @IsNotEmpty({ message: 'productorId no puede venir vacio' })
  productorId?: string;

  @IsString({ message: 'deviceId de la compra debe ser un string' })
  @IsNotEmpty({ message: 'deviceId de la compra es obligatorio' })
  deviceId: string;

  @IsString({ message: 'localId de la compra debe ser un string' })
  @IsNotEmpty({ message: 'localId de la compra es obligatorio' })
  localId: string;

  @IsOptional()
  @IsString({ message: 'clientMutationId de la compra debe ser un string' })
  clientMutationId?: string;

  @IsArray({ message: 'sublotes debe ser un arreglo' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un sublote' })
  @ValidateNested({ each: true })
  @Type(() => CreateSubloteDto)
  sublotes: CreateSubloteDto[];
}
