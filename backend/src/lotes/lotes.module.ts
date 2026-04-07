import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LotesController } from './lotes.controller';
import { LotesService } from './lotes.service';

@Module({
  imports: [AuthModule],
  controllers: [LotesController],
  providers: [LotesService],
})
export class LotesModule {}
