import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AiService } from './ai.service';
import { AiChatDto } from './dto/ai-chat.dto';
import { FinancialAnalysisDto } from './dto/financial-analysis.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  chat(@Body() dto: AiChatDto) {
    return this.aiService.generateChatResponse(dto);
  }

  @Post('financial-analysis')
  financialAnalysis(@Body() dto: FinancialAnalysisDto) {
    return this.aiService.generateFinancialAnalysis(dto);
  }
}
