import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsUUID, Max, Min } from 'class-validator';

export class CrearSecadoDto {
  @IsUUID('4', { message: 'El sublote origen no es valido' })
  @IsNotEmpty({ message: 'El sublote origen es obligatorio' })
  subloteId: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'El peso de salida debe ser un numero' })
  @Min(0.01, { message: 'El peso de salida debe ser mayor a 0' })
  @Max(99999, { message: 'El peso de salida no puede superar los 99.999 kg' })
  pesoSalida: number;

  @IsIn(['BUENO', 'REGULAR', 'MALO'], {
    message: 'La calidad de salida no es valida',
  })
  calidadSalida: 'BUENO' | 'REGULAR' | 'MALO';
}
