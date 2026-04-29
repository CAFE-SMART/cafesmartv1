import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class ActualizarFactorSubloteDto {
  @IsUUID('4', { message: 'El id del sublote debe ser un UUID valido' })
  id!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsNumber({}, { message: 'El factor debe ser un numero' })
  @Min(0, { message: 'El factor no puede ser negativo' })
  factor?: number | null;
}

export class ActualizarFactoresDto {
  @IsArray({ message: 'sublotes debe ser un arreglo' })
  @ArrayMinSize(1, { message: 'Debes enviar al menos un sublote' })
  @ValidateNested({ each: true })
  @Type(() => ActualizarFactorSubloteDto)
  sublotes!: ActualizarFactorSubloteDto[];
}
