import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class ActualizarHumedadSubloteDto {
  @IsUUID('4', { message: 'El id del sublote debe ser un UUID valido' })
  id: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsNumber({}, { message: 'La humedad debe ser un numero' })
  @Min(0, { message: 'La humedad no puede ser negativa' })
  @Max(100, { message: 'La humedad no puede superar el 100%' })
  humedad?: number | null;
}

export class ActualizarHumedadesDto {
  @IsArray({ message: 'sublotes debe ser un arreglo' })
  @ArrayMinSize(1, { message: 'Debes enviar al menos un sublote' })
  @ValidateNested({ each: true })
  @Type(() => ActualizarHumedadSubloteDto)
  sublotes: ActualizarHumedadSubloteDto[];
}
