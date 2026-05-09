import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { apiError } from '../common/errors/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { BodegaService } from './bodega.service';
import { ActualizarBodegaDto } from './dto/actualizar-bodega.dto';

@Controller('bodega')
export class BodegaController {
  constructor(
    private readonly bodegaService: BodegaService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('configuracion')
  @UseGuards(JwtAuthGuard)
  async obtenerConfiguracion(@Req() req: { user: { sub: string } }) {
    const organizacionId = await this.obtenerOrganizacionId(req.user.sub);
    return this.bodegaService.obtenerConfiguracion(organizacionId);
  }

  @Post('configuracion')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async actualizarConfiguracion(
    @Body() dto: ActualizarBodegaDto,
    @Req() req: { user: { sub: string } },
  ) {
    const organizacionId = await this.obtenerOrganizacionId(req.user.sub);
    return this.bodegaService.actualizarConfiguracion(organizacionId, dto);
  }

  private async obtenerOrganizacionId(userId: string): Promise<string> {
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizacionId: true },
    });

    if (!usuario) {
      throw new UnauthorizedException(
        apiError(
          'AUTH_USER_NOT_FOUND',
          'No encontramos el usuario para consultar la configuración.',
        ),
      );
    }

    if (!usuario.organizacionId) {
      throw new BadRequestException(
        apiError(
          'ORGANIZACION_REQUERIDA',
          'Tu usuario no tiene una organización asignada.',
        ),
      );
    }

    return usuario.organizacionId;
  }
}
