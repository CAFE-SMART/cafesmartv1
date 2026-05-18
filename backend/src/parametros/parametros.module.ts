import { Module } from '@nestjs/common';
import { ParametrosService } from './parametros.service';

@Module({
  providers: [ParametrosService],
  exports: [ParametrosService],
})
export class ParametrosModule {}
