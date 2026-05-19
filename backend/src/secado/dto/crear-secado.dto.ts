import { Transform, Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsUUID, Max, Min } from 'class-validator';

const MAX_PESO_SECADO_KG = 100000;

export class CrearSecadoDto {
  @IsUUID('4', { message: 'El sublote no es valido' })
  @IsNotEmpty({ message: 'El sublote es obligatorio' })
  subloteId: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'El peso de salida debe ser un numero' })
  @IsNotEmpty({ message: 'El peso de salida es obligatorio' })
  @Min(0.1, { message: 'El peso de salida debe ser minimo 0.1 kg' })
  @Max(MAX_PESO_SECADO_KG, {
    message: `El peso de salida no puede superar ${MAX_PESO_SECADO_KG} kg`,
  })
  pesoSalida: number;

  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsNotEmpty({ message: 'La calidad de salida es obligatoria' })
  @IsIn(['BUENO', 'REGULAR', 'MALO'], {
    message: 'La calidad de salida no es valida',
  })
  calidadSalida: 'BUENO' | 'REGULAR' | 'MALO';

  @Type(() => Number)
  @IsNumber({}, { message: 'La humedad debe ser un numero' })
  @IsNotEmpty({ message: 'La humedad es obligatoria' })
  @Min(8, { message: 'La humedad debe ser minimo 8%' })
  @Max(14, { message: 'La humedad no puede superar 14%' })
  humedad: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'El factor debe ser un numero' })
  @IsNotEmpty({ message: 'El factor es obligatorio' })
  @Min(80, { message: 'El factor no puede ser menor a 80' })
  @Max(120, { message: 'El factor no puede ser mayor a 120' })
  factor: number;
}
