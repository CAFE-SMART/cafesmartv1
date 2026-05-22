import { Type } from 'class-transformer';
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
import {
  PESO_MINIMO_KG,
  PRECIO_MAXIMO_KG,
  PRECIO_MINIMO_KG,
} from '../../common/business-rules';

export class CreateVentaDetalleDto {
  @IsUUID('4', { message: 'El sublote seleccionado no es valido' })
  @IsNotEmpty({ message: 'Debe seleccionar un sublote' })
  subloteId: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'El peso vendido debe ser un numero' })
  @Min(PESO_MINIMO_KG, { message: 'El peso vendido debe ser minimo 5 kg' })
  pesoVendido: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'El precio por kg debe ser un numero' })
  @Min(PRECIO_MINIMO_KG, { message: 'El precio por kg debe ser minimo $1.000' })
  @Max(PRECIO_MAXIMO_KG, { message: 'El precio por kg no puede superar los 100.000' })
  precioKg: number;
}

export class CreateVentaDto {
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener un formato valido' })
  fecha?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El cliente seleccionado no es valido' })
  @IsString({ message: 'clienteId debe ser un texto' })
  @IsNotEmpty({ message: 'clienteId no puede venir vacio' })
  clienteId?: string;

  @IsArray({ message: 'Los detalles deben venir en una lista' })
  @ArrayMinSize(1, { message: 'Debe registrar al menos un detalle de venta' })
  @ValidateNested({ each: true })
  @Type(() => CreateVentaDetalleDto)
  detalles: CreateVentaDetalleDto[];

  @IsString({ message: 'deviceId debe ser un texto' })
  @IsNotEmpty({ message: 'deviceId es obligatorio' })
  deviceId: string;

  @IsString({ message: 'localId debe ser un texto' })
  @IsNotEmpty({ message: 'localId es obligatorio' })
  localId: string;
}
