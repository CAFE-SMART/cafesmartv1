import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ActualizarFactoresDto } from './dto/actualizar-factores.dto';
import { ActualizarHumedadesDto } from './dto/actualizar-humedades.dto';
import { LotesService } from './lotes.service';

@Controller('lotes')
@UseGuards(JwtAuthGuard)
export class LotesController {
  constructor(private readonly lotesService: LotesService) {}

  @Get()
  findAll(@Req() req: { user: { sub: string } }) {
    return this.lotesService.findAll(req.user.sub);
  }

  @Get(':tipoCafeId/:calidadId/sublotes')
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
  updateHumedades(
    @Body() dto: ActualizarHumedadesDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.lotesService.actualizarHumedades(req.user.sub, dto.sublotes);
  }

  @Patch('sublotes/factor')
  updateFactores(
    @Body() dto: ActualizarFactoresDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.lotesService.actualizarFactores(req.user.sub, dto.sublotes);
  }
}
