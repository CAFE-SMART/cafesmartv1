import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';

export class CrearSecadoDto {
  @IsUUID('4', { message: 'El sublote no es valido' })
  @IsNotEmpty({ message: 'El sublote es obligatorio' })
  subloteId: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'El peso de salida debe ser un numero' })
  @Min(0.01, { message: 'El peso de salida debe ser mayor a 0' })
  pesoSalida: number;

  @IsIn(['BUENO', 'REGULAR', 'MALO'], {
    message: 'La calidad de salida no es valida',
  })
  calidadSalida: 'BUENO' | 'REGULAR' | 'MALO';
}
