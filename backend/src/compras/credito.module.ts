import { Module } from '@nestjs/common';
import { CreditoService } from './credito.service';
import { CreditoController } from './credito.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ParametrosModule } from '../parametros/parametros.module';

@Module({
  imports: [PrismaModule, ParametrosModule],
  controllers: [CreditoController],
  providers: [CreditoService],
  exports: [CreditoService],
})
export class CreditoModule {}
