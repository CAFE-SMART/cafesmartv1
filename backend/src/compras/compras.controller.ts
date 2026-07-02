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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ComprasService } from './compras.service';
import { CreateCompraDto } from './dto/crear-compra.dto';

@ApiTags('Compras')
@Controller('compras')
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Listar todas las compras de la organización' })
  async listar(@Req() req: { user: { sub: string } }) {
    return this.comprasService.listarCompras(req.user.sub);
  }

  @Get('catalogos')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Obtener catálogos de tipos de café y calidades' })
  async catalogos(@Req() req: { user: { sub: string } }) {
    return this.comprasService.obtenerCatalogos(req.user.sub);
  }

  @Post('catalogos/tipo-cafe')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Crear un nuevo tipo de café personalizado' })
  async crearTipoCafe(
    @Body('nombre') nombre: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.comprasService.crearTipoCafe(nombre, req.user.sub);
  }

  @Put('catalogos/tipo-cafe/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Editar un tipo de café existente' })
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
  @ApiOperation({ summary: 'Eliminar un tipo de café de la organización' })
  async eliminarTipoCafe(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    await this.comprasService.eliminarTipoCafe(id, req.user.sub);
  }

  @Post('catalogos/calidad')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Crear una nueva calidad de café personalizada' })
  async crearCalidad(
    @Body('nombre') nombre: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.comprasService.crearCalidad(nombre, req.user.sub);
  }

  @Put('catalogos/calidad/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Editar una calidad de café existente' })
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
  @ApiOperation({ summary: 'Eliminar una calidad de café de la organización' })
  async eliminarCalidad(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    await this.comprasService.eliminarCalidad(id, req.user.sub);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar una nueva compra de café' })
  async crear(
    @Body() dto: CreateCompraDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.comprasService.crearCompra(dto, req.user.sub);
  }

  @Post('validar-capacidad')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validar si la compra supera el límite físico de almacenamiento' })
  async validarCapacidad(
    @Body() dto: CreateCompraDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.comprasService.validarCapacidadCompra(dto, req.user.sub);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Anular/Eliminar una compra' })
  async eliminar(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    await this.comprasService.eliminarCompra(id, req.user.sub);
  }
}
