import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SecadoService } from './secado.service';
import { CrearSecadoDto } from './dto/crear-secado.dto';
import { StartSecadoDto } from './dto/start-secado.dto';
import { SecadoResultsDto } from './dto/secado-results.dto';
import { TransformarSecadoDto } from './dto/transformar-secado.dto';
import { SaveSecadoDraftDto } from './dto/save-secado-draft.dto';

@ApiTags('Secado')
@Controller('secado')
@UseGuards(JwtAuthGuard)
export class SecadoController {
  constructor(private readonly secadoService: SecadoService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un nuevo proceso de secado (directo)' })
  crear(@Body() dto: CrearSecadoDto, @Req() req: { user: { sub: string } }) {
    return this.secadoService.crearSecado(req.user.sub, dto);
  }

  @Post('transformar')
  @ApiOperation({ summary: 'Transformar café mojado a seco (salida manual)' })
  transformar(
    @Body() dto: TransformarSecadoDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.secadoService.transformarSecado(req.user.sub, dto);
  }

  @Post('start/:tipoCafeId/:calidadId')
  @ApiOperation({ summary: 'Iniciar sesión de secado para múltiples sublotes' })
  start(
    @Param('tipoCafeId') tipoCafeId: string,
    @Param('calidadId') calidadId: string,
    @Body() dto: StartSecadoDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.secadoService.startSecado(
      req.user.sub,
      tipoCafeId,
      calidadId,
      dto.subloteIds,
      dto.pesos,
    );
  }

  @Patch(':sessionId/draft')
  @ApiOperation({ summary: 'Guardar borrador intermedio de sesión de secado' })
  saveDraft(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: SaveSecadoDraftDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.secadoService.saveSecadoDraft(req.user.sub, sessionId, dto);
  }

  @Patch(':sessionId/results')
  @ApiOperation({ summary: 'Registrar resultados de control de humedad en secado' })
  saveResults(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: SecadoResultsDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.secadoService.saveSecadoResults(req.user.sub, sessionId, dto);
  }

  @Patch(':sessionId/finalize')
  @ApiOperation({ summary: 'Finalizar proceso de secado y actualizar inventario' })
  finalize(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.secadoService.finalizeSecado(req.user.sub, sessionId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Obtener todas las sesiones de secado activas' })
  active(@Req() req: { user: { sub: string } }) {
    return this.secadoService.getActiveSecado(req.user.sub);
  }

  @Get('active/:loteId')
  @ApiOperation({ summary: 'Obtener sesión de secado activa para un lote específico' })
  activeForLote(
    @Param('loteId') loteId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.secadoService.getActiveSecadoForLote(req.user.sub, loteId);
  }

  @Get(':sessionId')
  @ApiOperation({ summary: 'Obtener detalles de una sesión de secado por ID' })
  getSession(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.secadoService.getSecadoSession(req.user.sub, sessionId);
  }
}
