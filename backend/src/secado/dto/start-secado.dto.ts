import {
  IsArray,
  ArrayMinSize,
  IsUUID,
  IsOptional,
  IsObject,
} from 'class-validator';

export class StartSecadoDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  subloteIds!: string[];

  @IsOptional()
  @IsObject()
  pesos?: Record<string, number>;
}
