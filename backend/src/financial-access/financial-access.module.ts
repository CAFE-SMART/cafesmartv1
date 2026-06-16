import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinancialAccessController } from './financial-access.controller';
import { FinancialAccessService } from './financial-access.service';

@Module({
  imports: [AuthModule],
  controllers: [FinancialAccessController],
  providers: [FinancialAccessService],
})
export class FinancialAccessModule {}
