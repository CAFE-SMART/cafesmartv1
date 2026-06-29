import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ComprasService } from './compras.service';
import { CreateCompraDto } from './dto/crear-compra.dto';

@Controller('compras')
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async listar(@Req() req: { user: { sub: string } }) {
    return this.comprasService.listarCompras(req.user.sub);
  }

  @Get('catalogos')
  @UseGuards(JwtAuthGuard)
  async catalogos(@Req() req: { user: { sub: string } }) {
    return this.comprasService.obtenerCatalogos(req.user.sub);
  }

  @Post('catalogos/tipo-cafe')
  @UseGuards(JwtAuthGuard)
  async crearTipoCafe(
    @Body('nombre') nombre: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.comprasService.crearTipoCafe(nombre, req.user.sub);
  }

  @Put('catalogos/tipo-cafe/:id')
  @UseGuards(JwtAuthGuard)
  async editarTipoCafe(
    @Param('id') id: string,
    @Body('nombre') nombre: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.comprasService.editarTipoCafe(id, nombre, req.user.sub);
  }

  @Delete('catalogos/tipo-cafe/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarTipoCafe(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    await this.comprasService.eliminarTipoCafe(id, req.user.sub);
  }

  @Post('catalogos/calidad')
  @UseGuards(JwtAuthGuard)
  async crearCalidad(
    @Body('nombre') nombre: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.comprasService.crearCalidad(nombre, req.user.sub);
  }

  @Put('catalogos/calidad/:id')
  @UseGuards(JwtAuthGuard)
  async editarCalidad(
    @Param('id') id: string,
    @Body('nombre') nombre: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.comprasService.editarCalidad(id, nombre, req.user.sub);
  }

  @Delete('catalogos/calidad/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarCalidad(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    await this.comprasService.eliminarCalidad(id, req.user.sub);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async crear(
    @Body() dto: CreateCompraDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.comprasService.crearCompra(dto, req.user.sub);
  }

  @Post('validar-capacidad')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async validarCapacidad(
    @Body() dto: CreateCompraDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.comprasService.validarCapacidadCompra(dto, req.user.sub);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    await this.comprasService.eliminarCompra(id, req.user.sub);
  }
}
