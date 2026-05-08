import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class ActualizarBodegaDto {
  @IsString({ message: 'El nombre de la bodega debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre de la bodega es requerido' })
  nombreBodega: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'La capacidad debe ser un número' })
  @Min(0.01, { message: 'La capacidad debe ser mayor a 0' })
  capacidadKg: number;
}
