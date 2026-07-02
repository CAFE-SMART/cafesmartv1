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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CrearGastoDto } from './dto/crear-gasto.dto';
import { ActualizarEstadoGastoDto } from './dto/actualizar-estado-gasto.dto';
import { GastosService } from './gastos.service';

@ApiTags('Gastos')
@Controller('gastos')
export class GastosController {
  constructor(private readonly gastosService: GastosService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un nuevo gasto (operativo o de sublote)' })
  async crear(
    @Body() dto: CrearGastoDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.gastosService.crearGasto(dto, req.user.sub);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Listar gastos de la organización' })
  async listar(
    @Req() req: { user: { sub: string } },
    @Query('subloteId') subloteId?: string,
  ) {
    return this.gastosService.listarGastos(req.user.sub, subloteId);
  }

  @Get('sublote/:subloteId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Listar gastos asociados a un sublote específico' })
  async listarPorSublote(
    @Param('subloteId', new ParseUUIDPipe({ version: '4' })) subloteId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.gastosService.listarGastosPorSublote(subloteId, req.user.sub);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Obtener detalles de un gasto por ID' })
  async obtener(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.gastosService.obtenerGasto(id, req.user.sub);
  }

  @Patch(':id/estado')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Actualizar el estado de pago de un gasto' })
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
