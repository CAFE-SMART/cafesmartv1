import { IsObject, IsOptional } from 'class-validator';
import { AiBusinessContextDto } from './ai-context.dto';

export class FinancialAnalysisDto {
  @IsOptional()
  @IsObject()
  context?: AiBusinessContextDto;
}
