import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Obtener resumen general financiero y utilidades' })
  obtenerResumen(@Req() req: { user: { sub: string } }) {
    return this.dashboardService.obtenerResumen(req.user.sub);
  }

  @Get('inicio')
  @ApiOperation({ summary: 'Obtener métricas y listados de inicio del panel principal' })
  obtenerInicio(@Req() req: { user: { sub: string } }) {
    return this.dashboardService.obtenerInicio(req.user.sub);
  }
}
