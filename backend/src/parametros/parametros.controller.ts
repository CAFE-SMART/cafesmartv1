import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ParametrosService } from './parametros.service';

@Controller('parametros')
export class ParametrosController {
  constructor(private readonly parametrosService: ParametrosService) {}

  @Get(':nombre')
  @UseGuards(JwtAuthGuard)
  async obtener(@Param('nombre') nombre: string, @Req() req: any) {
    const valor = await this.parametrosService.getParametro(nombre, req.user.sub);
    return { nombre, valor };
  }

  @Post(':nombre')
  @UseGuards(JwtAuthGuard)
  async actualizar(@Param('nombre') nombre: string, @Body() body: { valor: string }, @Req() req: any) {
    await this.parametrosService.setParametro(nombre, body.valor, req.user.sub);
    return { success: true };
  }
}
