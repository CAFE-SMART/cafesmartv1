import {
  IsArray,
  ArrayMinSize,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StartSecadoSubloteDto {
  @IsUUID('all')
  id!: string;

  @IsOptional()
  @IsString()
  codigo?: string;

  @IsString()
  etiqueta!: string;

  @IsOptional()
  @IsUUID('all')
  sourceLoteId?: string;

  @Type(() => Number)
  @IsNumber()
  pesoActual!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pesoSeleccionadoKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pesoDisponible?: number;

  @IsOptional()
  @IsIn(['TOTAL', 'PARCIAL'])
  modoSecado?: 'TOTAL' | 'PARCIAL';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  humedad?: number | null;

  @IsString()
  fechaIngreso!: string;

  @Type(() => Number)
  @IsNumber()
  diasEnBodega!: number;
}

export class StartSecadoDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  subloteIds!: string[];

  @IsOptional()
  @IsUUID('all')
  sessionId?: string;

  @IsOptional()
  @IsUUID('all')
  loteId?: string;

  @IsOptional()
  @IsString()
  loteCodigo?: string;

  @IsOptional()
  @IsString()
  tipoCafe?: string;

  @IsOptional()
  @IsString()
  calidad?: string;

  @IsOptional()
  @IsIn(['TOTAL', 'PARCIAL'])
  modoSecado?: 'TOTAL' | 'PARCIAL';

  @IsOptional()
  @IsString()
  fechaLote?: string;

  @IsOptional()
  @IsString()
  startedAt?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => StartSecadoSubloteDto)
  sublotes?: StartSecadoSubloteDto[];
}
