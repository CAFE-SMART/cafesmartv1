import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ActualizarPesoSubloteDto {
  @IsUUID('4', { message: 'El id del sublote debe ser un UUID valido' })
  id!: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'El peso debe ser un numero' })
  @Min(0, { message: 'El peso no puede ser negativo' })
  pesoActual!: number;

  @IsOptional()
  @IsString({ message: 'El motivo debe ser texto' })
  motivo?: string;
}

export class ActualizarPesosDto {
  @IsArray({ message: 'sublotes debe ser un arreglo' })
  @ArrayMinSize(1, { message: 'Debes enviar al menos un sublote' })
  @ValidateNested({ each: true })
  @Type(() => ActualizarPesoSubloteDto)
  sublotes!: ActualizarPesoSubloteDto[];
}
