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
import { GuardarProductorDto } from './dto/guardar-productor.dto';
import { ProductoresService } from './productores.service';

@ApiTags('Productores')
@Controller('productores')
@UseGuards(JwtAuthGuard)
export class ProductoresController {
  constructor(private readonly productoresService: ProductoresService) {}

  @Get()
  @ApiOperation({ summary: 'Listar o buscar productores de la organización' })
  listar(
    @Req() req: { user: { sub: string } },
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('orden') orden?: 'recientes' | 'antiguos' | 'az',
  ) {
    return this.productoresService.listar(req.user.sub, {
      q,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      orden,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un nuevo productor' })
  crear(
    @Body() dto: GuardarProductorDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.productoresService.crear(req.user.sub, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar los datos de un productor existente' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: GuardarProductorDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.productoresService.actualizar(req.user.sub, id, dto);
  }
}
