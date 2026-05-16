import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ClientesService } from './clientes.service';
import { GuardarClienteDto } from './dto/guardar-cliente.dto';

@Controller('clientes')
@UseGuards(JwtAuthGuard)
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  listar(@Req() req: { user: { sub: string } }) {
    return this.clientesService.listar(req.user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  crear(@Body() dto: GuardarClienteDto, @Req() req: { user: { sub: string } }) {
    return this.clientesService.crear(req.user.sub, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  actualizar(
    @Param('id') id: string,
    @Body() dto: GuardarClienteDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.clientesService.actualizar(req.user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.clientesService.eliminar(req.user.sub, id);
  }
}
