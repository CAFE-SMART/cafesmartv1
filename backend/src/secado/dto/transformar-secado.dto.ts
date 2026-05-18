import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class TransformarSecadoFuenteDto {
  @IsUUID('4', { message: 'El sublote origen no es valido' })
  @IsNotEmpty({ message: 'El sublote origen es obligatorio' })
  id: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'El peso de entrada debe ser un numero' })
  @Min(0.01, { message: 'El peso de entrada debe ser mayor a 0' })
  @Max(99999, { message: 'El peso de entrada no puede superar los 99.999 kg' })
  pesoKg: number;
}

export class TransformarSecadoSalidaDto {
  @IsIn(['BUENO', 'REGULAR', 'MALO'], {
    message: 'La calidad de salida no es valida',
  })
  calidad: 'BUENO' | 'REGULAR' | 'MALO';

  @Type(() => Number)
  @IsNumber({}, { message: 'El peso de salida debe ser un numero' })
  @Min(0.01, { message: 'El peso de salida debe ser mayor a 0' })
  @Max(99999, { message: 'El peso de salida no puede superar los 99.999 kg' })
  pesoKg: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La humedad debe ser un numero' })
  @Min(0, { message: 'La humedad no puede ser negativa' })
  @Max(100, { message: 'La humedad no puede superar 100%' })
  humedad?: number | null;
}

export class TransformarSecadoDto {
  @IsString({ message: 'sessionId debe ser texto' })
  @IsNotEmpty({ message: 'sessionId es obligatorio' })
  sessionId: string;

  @IsString({ message: 'deviceId debe ser texto' })
  @IsNotEmpty({ message: 'deviceId es obligatorio' })
  deviceId: string;

  @IsArray({ message: 'fuentes debe ser una lista' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un sublote origen' })
  @ValidateNested({ each: true })
  @Type(() => TransformarSecadoFuenteDto)
  fuentes: TransformarSecadoFuenteDto[];

  @IsArray({ message: 'salidas debe ser una lista' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos una salida seca' })
  @ValidateNested({ each: true })
  @Type(() => TransformarSecadoSalidaDto)
  salidas: TransformarSecadoSalidaDto[];
}
