import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ActualizarEstadoGastoDto } from './dto/actualizar-estado-gasto.dto';
import { CrearGastoDto } from './dto/crear-gasto.dto';
import { GastosService } from './gastos.service';

@Controller('gastos')
export class GastosController {
  constructor(private readonly gastosService: GastosService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async crear(
    @Body() dto: CrearGastoDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.gastosService.crearGasto(dto, req.user.sub);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async listar(
    @Req() req: { user: { sub: string } },
    @Query('subloteId') subloteId?: string,
    @Query('fecha') fecha?: string,
    @Query('tipo') tipo?: string,
    @Query('orden') orden?: 'recent' | 'oldest',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.gastosService.listarGastos(req.user.sub, {
      subloteId,
      fecha,
      tipo,
      orden,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('sublote/:subloteId')
  @UseGuards(JwtAuthGuard)
  async listarPorSublote(
    @Param('subloteId', new ParseUUIDPipe({ version: '4' })) subloteId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.gastosService.listarGastosPorSublote(subloteId, req.user.sub);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async obtener(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.gastosService.obtenerGasto(id, req.user.sub);
  }

  @Patch(':id/estado')
  @UseGuards(JwtAuthGuard)
  async actualizarEstado(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ActualizarEstadoGastoDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.gastosService.actualizarEstadoGasto(
      id,
      req.user.sub,
      dto.estadoPago,
    );
  }
}
