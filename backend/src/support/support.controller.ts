import { Body, Controller, Post } from '@nestjs/common';

type SupportErrorReport = {
  reportId?: string;
  operation?: string;
  userMessage?: string;
  technical?: unknown;
  createdAt?: string;
};

@Controller('support')
export class SupportController {
  @Post('error-report')
  createErrorReport(@Body() report: SupportErrorReport) {
    // Lightweight support intake that does not depend on the database.
    console.warn('Cafe Smart support error report', {
      reportId: report.reportId,
      operation: report.operation,
      userMessage: report.userMessage,
      technical: report.technical,
      createdAt: report.createdAt,
    });

    return { ok: true, reportId: report.reportId };
  }
}
