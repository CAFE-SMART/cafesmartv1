import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { AiBusinessContextDto } from './ai-context.dto';

export class AiChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question!: string;

  @IsOptional()
  @IsObject()
  context?: AiBusinessContextDto;
}
