import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ContactosService } from './contactos.service';
import {
  AgregarRolContactoDto,
  GuardarContactoDto,
  type ContactoRol,
} from './dto/guardar-contacto.dto';

@UseGuards(JwtAuthGuard)
@Controller('contactos')
export class ContactosController {
  constructor(private readonly contactosService: ContactosService) {}

  @Get()
  listar(
    @Req() req: { user: { sub: string } },
    @Query('rol') rol?: 'CLIENTE' | 'PRODUCTOR' | 'MULTIROL',
  ) {
    return this.contactosService.listar(req.user.sub, rol);
  }

  @Post()
  crear(@Body() dto: GuardarContactoDto, @Req() req: { user: { sub: string } }) {
    return this.contactosService.crear(req.user.sub, dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id') id: string,
    @Body() dto: GuardarContactoDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.contactosService.actualizar(req.user.sub, id, dto);
  }

  @Post(':id/roles')
  agregarRol(
    @Param('id') id: string,
    @Body() dto: AgregarRolContactoDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.contactosService.agregarRol(req.user.sub, id, dto.rol);
  }

  @Delete(':id/roles/:rol')
  retirarRol(
    @Param('id') id: string,
    @Param('rol') rol: ContactoRol,
    @Req() req: { user: { sub: string } },
  ) {
    return this.contactosService.retirarRol(req.user.sub, id, rol);
  }
}
