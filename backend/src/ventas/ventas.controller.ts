import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateVentaDto } from './dto/crear-venta.dto';
import { VentasService } from './ventas.service';

@ApiTags('Ventas')
@Controller('ventas')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar una nueva venta de café' })
  async crear(
    @Body() dto: CreateVentaDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.ventasService.crearVenta(dto, req.user.sub);
  }
}
