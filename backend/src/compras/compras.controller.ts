import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ComprasService } from './compras.service';
import { CreateCompraDto } from './dto/crear-compra.dto';

@Controller('compras')
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async crear(
    @Body() dto: CreateCompraDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.comprasService.crearCompra(dto, req.user.sub);
  }
}
