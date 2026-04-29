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
import { GastosService } from './gastos.service';
import { CrearGastoDto } from './dto/crear-gasto.dto';

@Controller('gastos')
export class GastosController {
  constructor(private readonly gastosService: GastosService) {}

  /**
   * POST /gastos
   * Registra un nuevo gasto operativo.
   * Si el cuerpo incluye asociarASublotes=true y un arreglo subloteIds,
   * el gasto se vincula a esos sublotes en la tabla pivot gasto_sublote.
   * Si no, se trata como gasto general de la organización.
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async crear(
    @Body() dto: CrearGastoDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.gastosService.crearGasto(dto, req.user.sub);
  }

  /**
   * GET /gastos
   * Lista todos los gastos activos de la organización del usuario.
   * Query param opcional: ?subloteId=<uuid> → filtra solo los gastos
   * asociados a ese sublote específico.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async listar(
    @Req() req: { user: { sub: string } },
    @Query('subloteId') subloteId?: string,
  ) {
    return this.gastosService.listarGastos(req.user.sub, subloteId);
  }

  /**
   * GET /gastos/:id
   * Obtiene el detalle de un gasto por su id.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async obtener(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.gastosService.obtenerGasto(id, req.user.sub);
  }

  /**
   * GET /gastos/sublote/:subloteId
   * Lista todos los gastos operativos asociados a un sublote específico.
   */
  @Get('sublote/:subloteId')
  @UseGuards(JwtAuthGuard)
  async listarPorSublote(
    @Param('subloteId', new ParseUUIDPipe({ version: '4' })) subloteId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.gastosService.listarGastosPorSublote(subloteId, req.user.sub);
  }
}
