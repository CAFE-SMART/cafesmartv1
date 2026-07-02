import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ActualizarFactoresDto } from './dto/actualizar-factores.dto';
import { ActualizarHumedadesDto } from './dto/actualizar-humedades.dto';
import { ActualizarPesosDto } from './dto/actualizar-pesos.dto';
import { LotesService } from './lotes.service';

@ApiTags('Lotes')
@Controller('lotes')
@UseGuards(JwtAuthGuard)
export class LotesController {
  constructor(private readonly lotesService: LotesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener un listado resumido de lotes de la organización' })
  findAll(@Req() req: { user: { sub: string } }) {
    return this.lotesService.findAll(req.user.sub);
  }

  @Get(':tipoCafeId/:calidadId/sublotes')
  @ApiOperation({ summary: 'Obtener sublotes pertenecientes a una combinación de tipo y calidad' })
  findSublotes(
    @Param('tipoCafeId') tipoCafeId: string,
    @Param('calidadId') calidadId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.lotesService.findSublotesByLote(
      req.user.sub,
      tipoCafeId,
      calidadId,
    );
  }

  @Get('sublotes/:subloteId/resultados-financieros')
  @ApiOperation({ summary: 'Obtener resultados financieros y rentabilidad de un sublote' })
  getResultadosFinancierosSublote(
    @Param('subloteId') subloteId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.lotesService.obtenerResultadosFinancierosSublote(
      req.user.sub,
      subloteId,
    );
  }

  @Patch('sublotes/humedad')
  @ApiOperation({ summary: 'Actualizar porcentajes de humedad para múltiples sublotes' })
  updateHumedades(
    @Body() dto: ActualizarHumedadesDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.lotesService.actualizarHumedades(req.user.sub, dto.sublotes);
  }

  @Patch('sublotes/factor')
  @ApiOperation({ summary: 'Actualizar factores de rendimiento para múltiples sublotes' })
  updateFactores(
    @Body() dto: ActualizarFactoresDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.lotesService.actualizarFactores(req.user.sub, dto.sublotes);
  }

  @Patch('sublotes/peso')
  @ApiOperation({ summary: 'Actualizar peso actual para múltiples sublotes' })
  updatePesos(
    @Body() dto: ActualizarPesosDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.lotesService.actualizarPesos(req.user.sub, dto.sublotes);
  }
}
