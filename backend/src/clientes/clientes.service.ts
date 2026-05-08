import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GuardarClienteDto } from './dto/guardar-cliente.dto';
import {
  normalizarDocumentoPersona,
  normalizarNombrePersona,
  normalizarTelefonoPersona,
} from '../common/validations/person-fields';

type ClienteListadoItem = {
  id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  createdAt: string;
};

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(userId: string): Promise<ClienteListadoItem[]> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const clientes = await this.prisma.cliente.findMany({
      where: {
        organizacionId,
        deletedAt: null,
      },
      orderBy: [{ createdAt: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        documento: true,
        telefono: true,
        createdAt: true,
      },
    });

    return clientes.map((cliente) => ({
      id: cliente.id,
      nombre: cliente.nombre,
      documento: cliente.documento,
      telefono: cliente.telefono,
      createdAt: cliente.createdAt.toISOString(),
    }));
  }

  async crear(
    userId: string,
    dto: GuardarClienteDto,
  ): Promise<ClienteListadoItem> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const cliente = await this.prisma.cliente.create({
      data: {
        organizacionId,
        nombre: this.normalizarNombre(dto.nombre),
        documento: normalizarDocumentoPersona(dto.documento, 'cliente'),
        telefono: normalizarTelefonoPersona(dto.telefono, 'cliente'),
      },
      select: {
        id: true,
        nombre: true,
        documento: true,
        telefono: true,
        createdAt: true,
      },
    });

    return {
      id: cliente.id,
      nombre: cliente.nombre,
      documento: cliente.documento,
      telefono: cliente.telefono,
      createdAt: cliente.createdAt.toISOString(),
    };
  }

  async actualizar(
    userId: string,
    clienteId: string,
    dto: GuardarClienteDto,
  ): Promise<ClienteListadoItem> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const existente = await this.prisma.cliente.findFirst({
      where: {
        id: clienteId,
        organizacionId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!existente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const cliente = await this.prisma.cliente.update({
      where: { id: clienteId },
      data: {
        nombre: this.normalizarNombre(dto.nombre),
        documento: normalizarDocumentoPersona(dto.documento, 'cliente'),
        telefono: normalizarTelefonoPersona(dto.telefono, 'cliente'),
      },
      select: {
        id: true,
        nombre: true,
        documento: true,
        telefono: true,
        createdAt: true,
      },
    });

    return {
      id: cliente.id,
      nombre: cliente.nombre,
      documento: cliente.documento,
      telefono: cliente.telefono,
      createdAt: cliente.createdAt.toISOString(),
    };
  }

  private async obtenerOrganizacionId(userId: string): Promise<string> {
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizacionId: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!usuario.organizacionId) {
      throw new BadRequestException(
        'El usuario no tiene organizacion asignada',
      );
    }

    return usuario.organizacionId;
  }

  private normalizarNombre(valor: string): string {
    return normalizarNombrePersona(valor, 'cliente');
  }
}
