import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreditoService } from './credito.service';

@Controller('credito')
export class CreditoController {
  constructor(private readonly creditoService: CreditoService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async obtenerCredito(@Req() req: { user: { sub: string } }) {
    return this.creditoService.obtenerCredito(req.user.sub);
  }

  @Post('limite')
  @UseGuards(JwtAuthGuard)
  async setLimiteCredito(
    @Body() body: { limite: number },
    @Req() req: { user: { sub: string } },
  ) {
    return this.creditoService.setLimiteCredito(req.user.sub, body.limite);
  }
}
