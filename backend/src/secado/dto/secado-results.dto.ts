import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class SecadoResultsDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'La salida buena debe ser un numero' })
  @Min(0, { message: 'La salida buena no puede ser negativa' })
  outputBuenoKg!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La humedad buena debe ser un numero' })
  @Min(0, { message: 'La humedad buena no puede ser negativa' })
  @Max(100, { message: 'La humedad buena no puede superar 100%' })
  outputBuenoHumedad?: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'La salida regular debe ser un numero' })
  @Min(0, { message: 'La salida regular no puede ser negativa' })
  outputRegularKg!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La humedad regular debe ser un numero' })
  @Min(0, { message: 'La humedad regular no puede ser negativa' })
  @Max(100, { message: 'La humedad regular no puede superar 100%' })
  outputRegularHumedad?: number;
}
