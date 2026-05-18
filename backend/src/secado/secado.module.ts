import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SecadoController } from './secado.controller';
import { SecadoService } from './secado.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [SecadoController],
  providers: [SecadoService],
  exports: [SecadoService],
})
export class SecadoModule {}
