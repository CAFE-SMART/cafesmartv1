import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ActualizarPesoSubloteDto {
  @IsUUID('4', { message: 'El id del sublote debe ser un UUID válido' })
  id!: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'El peso debe ser un número' })
  @Min(0, { message: 'El peso no puede ser negativo' })
  @Max(99999, { message: 'El peso no puede superar los 99.999 kg' })
  pesoActual!: number;

  @IsOptional()
  @IsString({ message: 'El motivo debe ser texto' })
  @MaxLength(40, { message: 'El motivo no puede superar 40 caracteres' })
  motivo?: string;
}

export class ActualizarPesosDto {
  @IsArray({ message: 'sublotes debe ser un arreglo' })
  @ArrayMinSize(1, { message: 'Debes enviar al menos un sublote' })
  @ValidateNested({ each: true })
  @Type(() => ActualizarPesoSubloteDto)
  sublotes!: ActualizarPesoSubloteDto[];
}
