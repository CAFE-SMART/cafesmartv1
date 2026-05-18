import { Module } from '@nestjs/common';
import { BodegaService } from './bodega.service';
import { BodegaController } from './bodega.controller';
import { ParametrosModule } from '../parametros/parametros.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ParametrosModule, PrismaModule, AuthModule],
  providers: [BodegaService],
  controllers: [BodegaController],
})
export class BodegaModule {}
