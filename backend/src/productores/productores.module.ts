import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductoresController } from './productores.controller';
import { ProductoresService } from './productores.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ProductoresController],
  providers: [ProductoresService],
  exports: [ProductoresService],
})
export class ProductoresModule {}
