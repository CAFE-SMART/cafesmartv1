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
  @Min(8, { message: 'La humedad debe ser mínimo 8%' })
  @Max(14, { message: 'La humedad no puede superar el 14%' })
  humedad?: number | null;
}

export class ActualizarHumedadesDto {
  @IsArray({ message: 'sublotes debe ser un arreglo' })
  @ArrayMinSize(1, { message: 'Debes enviar al menos un sublote' })
  @ValidateNested({ each: true })
  @Type(() => ActualizarHumedadSubloteDto)
  sublotes: ActualizarHumedadSubloteDto[];
}
