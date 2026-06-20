import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ContactosController } from './contactos.controller';
import { ContactosService } from './contactos.service';

@Module({
  imports: [PrismaModule],
  controllers: [ContactosController],
  providers: [ContactosService],
  exports: [ContactosService],
})
export class ContactosModule {}
