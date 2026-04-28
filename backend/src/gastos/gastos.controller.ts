import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
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
  ) {
    return this.gastosService.listarGastos(req.user.sub, subloteId);
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
}
