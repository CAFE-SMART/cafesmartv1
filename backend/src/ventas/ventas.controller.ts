import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateVentaDto } from './dto/crear-venta.dto';
import { VentasService } from './ventas.service';

@Controller('ventas')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async listar(
    @Req() req: { user: { sub: string } },
    @Query('fecha') fecha?: string,
    @Query('orden') orden?: 'recent' | 'oldest',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNumber = page ? Number(page) : undefined;
    const limitNumber = limit ? Number(limit) : undefined;

    return this.ventasService.listarVentas(req.user.sub, {
      fecha,
      orden,
      page: Number.isFinite(pageNumber) ? pageNumber : undefined,
      limit: Number.isFinite(limitNumber) ? limitNumber : undefined,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async crear(
    @Body() dto: CreateVentaDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.ventasService.crearVenta(dto, req.user.sub);
  }
}
