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
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SecadoService } from './secado.service';
import { StartSecadoDto } from './dto/start-secado.dto';
import { SecadoResultsDto } from './dto/secado-results.dto';
import { TransformarSecadoDto } from './dto/transformar-secado.dto';

@Controller('secado')
@UseGuards(JwtAuthGuard)
export class SecadoController {
  constructor(private readonly secadoService: SecadoService) {}

  @Post('transformar')
  transformar(
    @Body() dto: TransformarSecadoDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.secadoService.transformarSecado(req.user.sub, dto);
  }

  @Post('start/:tipoCafeId/:calidadId')
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
    );
  }

  @Patch(':sessionId/results')
  saveResults(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: SecadoResultsDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.secadoService.saveSecadoResults(req.user.sub, sessionId, dto);
  }

  @Patch(':sessionId/finalize')
  finalize(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.secadoService.finalizeSecado(req.user.sub, sessionId);
  }

  @Get('active')
  active(@Req() req: { user: { sub: string } }) {
    return this.secadoService.getActiveSecado(req.user.sub);
  }

  @Get('active/:loteId')
  activeForLote(
    @Param('loteId') loteId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.secadoService.getActiveSecadoForLote(req.user.sub, loteId);
  }

  @Get(':sessionId')
  getSession(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.secadoService.getSecadoSession(req.user.sub, sessionId);
  }
}
