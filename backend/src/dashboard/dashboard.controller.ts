import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  obtenerResumen(@Req() req: { user: { sub: string } }) {
    return this.dashboardService.obtenerResumen(req.user.sub);
  }

  @Get('inicio')
  obtenerInicio(@Req() req: { user: { sub: string } }) {
    return this.dashboardService.obtenerInicio(req.user.sub);
  }
}
