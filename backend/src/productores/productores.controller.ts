import {
  Body,
  Controller,
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
import { GuardarProductorDto } from './dto/guardar-productor.dto';
import { ProductoresService } from './productores.service';

@Controller('productores')
@UseGuards(JwtAuthGuard)
export class ProductoresController {
  constructor(private readonly productoresService: ProductoresService) {}

  @Get()
  listar(@Req() req: { user: { sub: string } }) {
    return this.productoresService.listar(req.user.sub);
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
