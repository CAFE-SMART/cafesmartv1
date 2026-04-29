import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ParametrosModule } from '../parametros/parametros.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PrismaModule, ParametrosModule, AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
