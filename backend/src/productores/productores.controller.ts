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
import { JwtAuthGuard } from '../auth/jwt.guard';
import { GuardarProductorDto } from './dto/guardar-productor.dto';
import { ProductoresService } from './productores.service';

@Controller('productores')
@UseGuards(JwtAuthGuard)
export class ProductoresController {
  constructor(private readonly productoresService: ProductoresService) {}

  @Get()
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
  crear(
    @Body() dto: GuardarProductorDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.productoresService.crear(req.user.sub, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  actualizar(
    @Param('id') id: string,
    @Body() dto: GuardarProductorDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.productoresService.actualizar(req.user.sub, id, dto);
  }
}
