import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const CAPACIDAD_BODEGA_MAX_KG = 999999;
const CAPACIDAD_BODEGA_INVALIDA = 'Ingresa una capacidad de bodega válida.';

export class ActualizarBodegaDto {
  @IsString({ message: 'El nombre de la bodega debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre de la bodega es requerido' })
  @MaxLength(50, { message: 'El nombre de la bodega no puede superar 50 caracteres' })
  nombreBodega: string;

  @Type(() => Number)
  @IsNumber({}, { message: CAPACIDAD_BODEGA_INVALIDA })
  @Min(0.01, { message: CAPACIDAD_BODEGA_INVALIDA })
  @Max(CAPACIDAD_BODEGA_MAX_KG, { message: CAPACIDAD_BODEGA_INVALIDA })
  capacidadKg: number;
}
