import { IsArray, ArrayMinSize, IsUUID } from 'class-validator';

export class StartSecadoDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  subloteIds!: string[];
}
