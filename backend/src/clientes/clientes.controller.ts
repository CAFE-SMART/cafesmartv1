import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ClientesService } from './clientes.service';
import { GuardarClienteDto } from './dto/guardar-cliente.dto';

@ApiTags('Clientes')
@Controller('clientes')
@UseGuards(JwtAuthGuard)
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar o buscar compradores/clientes de la organización' })
  listar(
    @Req() req: { user: { sub: string } },
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('orden') orden?: 'recientes' | 'antiguos' | 'az',
  ) {
    return this.clientesService.listar(req.user.sub, {
      q,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      orden,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un nuevo cliente' })
  crear(@Body() dto: GuardarClienteDto, @Req() req: { user: { sub: string } }) {
    return this.clientesService.crear(req.user.sub, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar los datos de un cliente existente' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: GuardarClienteDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.clientesService.actualizar(req.user.sub, id, dto);
  }
}
