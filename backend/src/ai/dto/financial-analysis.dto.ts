import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { AiBusinessContextDto } from './ai-context.dto';

export class FinancialAnalysisDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  question?: string;

  @IsOptional()
  @IsObject()
  context?: AiBusinessContextDto;
}
