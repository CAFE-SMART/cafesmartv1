import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

export class VentaClienteDto {
  @IsString({ message: 'El nombre del cliente debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre del cliente es obligatorio' })
  nombre: string;

  @IsString({ message: 'El documento del cliente debe ser un texto' })
  @IsNotEmpty({ message: 'El documento del cliente es obligatorio' })
  documento: string;

  @IsOptional()
  @IsString({ message: 'El telefono del cliente debe ser un texto' })
  telefono?: string;

  @IsOptional()
  @IsString({ message: 'El detalle del cliente debe ser un texto' })
  detalle?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'rapido debe ser verdadero o falso' })
  rapido?: boolean;
}

export class VentaItemDto {
  @IsUUID('4', { message: 'tipoCafeId debe ser un UUID valido' })
  @IsNotEmpty({ message: 'tipoCafeId es obligatorio' })
  tipoCafeId: string;

  @IsUUID('4', { message: 'calidadId debe ser un UUID valido' })
  @IsNotEmpty({ message: 'calidadId es obligatorio' })
  calidadId: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'cantidadKg debe ser un numero' })
  @Min(0.01, { message: 'La cantidad debe ser mayor a 0' })
  @Max(100000, { message: 'La cantidad no puede exceder los 100,000 kg' })
  cantidadKg: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'precioKg debe ser un numero' })
  @Min(0.1, { message: 'El precio por kg debe ser mayor a 0' })
  @Max(100000, { message: 'El precio por kg no puede exceder los 100,000' })
  precioKg: number;
}

export class CreateVentaDto {
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe ser ISO 8601' })
  fecha?: string;

  @IsString({ message: 'deviceId de la venta debe ser un texto' })
  @IsNotEmpty({ message: 'deviceId de la venta es obligatorio' })
  deviceId: string;

  @IsString({ message: 'localId de la venta debe ser un texto' })
  @IsNotEmpty({ message: 'localId de la venta es obligatorio' })
  localId: string;

  @ValidateNested()
  @Type(() => VentaClienteDto)
  cliente: VentaClienteDto;

  @IsArray({ message: 'items debe ser un arreglo' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un item de venta' })
  @ValidateNested({ each: true })
  @Type(() => VentaItemDto)
  items: VentaItemDto[];
}
