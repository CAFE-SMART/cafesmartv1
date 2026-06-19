import {
  BadRequestException,
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
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { apiError } from '../common/errors/api-error';
import {
  getCachedOrganizationId,
  setCachedOrganizationId,
} from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { BodegaService } from './bodega.service';
import {
  ActualizarBodegaDto,
  ActualizarLimitesBodegaDto,
  CrearBodegaDto,
  EditarBodegaDto,
} from './dto/actualizar-bodega.dto';

@Controller('bodega')
export class BodegaController {
  constructor(
    private readonly bodegaService: BodegaService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async listarBodegas(@Req() req: { user: { sub: string } }) {
    const organizacionId = await this.obtenerOrganizacionId(req.user.sub);
    return this.bodegaService.listarBodegas(organizacionId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async crearBodega(
    @Body() dto: CrearBodegaDto,
    @Req() req: { user: { sub: string } },
  ) {
    const organizacionId = await this.obtenerOrganizacionId(req.user.sub);
    return this.bodegaService.crearBodega(organizacionId, dto);
  }

  @Get('detalle/:id')
  @UseGuards(JwtAuthGuard)
  async obtenerBodega(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    const organizacionId = await this.obtenerOrganizacionId(req.user.sub);
    return this.bodegaService.obtenerBodega(organizacionId, id);
  }

  @Get(':id/limites')
  @UseGuards(JwtAuthGuard)
  async obtenerLimitesBodega(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    const organizacionId = await this.obtenerOrganizacionId(req.user.sub);
    return this.bodegaService.obtenerLimitesBodega(organizacionId, id);
  }

  @Patch(':id/limites')
  @UseGuards(JwtAuthGuard)
  async actualizarLimitesBodega(
    @Param('id') id: string,
    @Body() dto: ActualizarLimitesBodegaDto,
    @Req() req: { user: { sub: string } },
  ) {
    const organizacionId = await this.obtenerOrganizacionId(req.user.sub);
    return this.bodegaService.actualizarLimitesBodega(organizacionId, id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async editarBodega(
    @Param('id') id: string,
    @Body() dto: EditarBodegaDto,
    @Req() req: { user: { sub: string } },
  ) {
    const organizacionId = await this.obtenerOrganizacionId(req.user.sub);
    return this.bodegaService.editarBodega(organizacionId, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async eliminarBodega(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    const organizacionId = await this.obtenerOrganizacionId(req.user.sub);
    return this.bodegaService.eliminarBodega(organizacionId, id);
  }

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

  @Post('limites/general')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async aplicarLimitesGeneral(
    @Body() dto: ActualizarLimitesBodegaDto & { scope?: string },
    @Req() req: { user: { sub: string } },
  ) {
    const organizacionId = await this.obtenerOrganizacionId(req.user.sub);
    return this.bodegaService.aplicarLimitesBodegaGeneral(organizacionId, dto);
  }

  @Post('limites')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async actualizarLimites(
    @Body()
    body: { maxPesoKg: number; maxPrecioKg: number; maxPrecioVentaKg: number },
    @Req() req: { user: { sub: string } },
  ) {
    const organizacionId = await this.obtenerOrganizacionId(req.user.sub);
    return this.bodegaService.actualizarLimites(
      organizacionId,
      body.maxPesoKg,
      body.maxPrecioKg,
      body.maxPrecioVentaKg,
    );
  }

  private async obtenerOrganizacionId(userId: string): Promise<string> {
    const cached = getCachedOrganizationId(userId);
    if (cached) return cached;

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

    setCachedOrganizationId(userId, usuario.organizacionId);
    return usuario.organizacionId;
  }
}
