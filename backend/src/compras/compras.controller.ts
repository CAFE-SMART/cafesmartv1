import {
  Body,
  Controller,
  Get,
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

  @Get()
  @UseGuards(JwtAuthGuard)
  async listar(@Req() req: { user: { sub: string } }) {
    return this.comprasService.listarCompras(req.user.sub);
  }

  @Get('catalogos')
  @UseGuards(JwtAuthGuard)
  async catalogos(@Req() req: { user: { sub: string } }) {
    return this.comprasService.obtenerCatalogos(req.user.sub);
  }

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
