import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GuardarClienteDto } from './dto/guardar-cliente.dto';
import { apiError } from '../common/errors/api-error';
import {
  normalizarDocumentoPersona,
  normalizarNombreEmpresaPersona,
  normalizarNombrePersona,
  normalizarTelefonoPersona,
} from '../common/validations/person-fields';

type ClienteListadoItem = {
  id: string;
  nombre: string;
  documento: string | null;
  tipoDocumento: 'CEDULA' | 'NIT' | null;
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
      tipoDocumento: this.inferirTipoDocumento(cliente.documento),
      telefono: cliente.telefono,
      createdAt: cliente.createdAt.toISOString(),
    }));
  }

  async crear(
    userId: string,
    dto: GuardarClienteDto,
  ): Promise<ClienteListadoItem> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const tipoDocumento = this.obtenerTipoDocumento(
      dto.documento,
      dto.tipoDocumento,
    );
    const documento = this.normalizarDocumento(dto.documento, tipoDocumento);

    await this.validarDocumentoDisponible(organizacionId, documento);

    const cliente = await this.prisma.cliente.create({
      data: {
        organizacionId,
        nombre: this.normalizarNombre(dto.nombre, tipoDocumento),
        documento,
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
      tipoDocumento: this.inferirTipoDocumento(cliente.documento),
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

    const tipoDocumento = this.obtenerTipoDocumento(
      dto.documento,
      dto.tipoDocumento,
    );
    const documento = this.normalizarDocumento(dto.documento, tipoDocumento);
    await this.validarDocumentoDisponible(organizacionId, documento, clienteId);

    const cliente = await this.prisma.cliente.update({
      where: { id: clienteId },
      data: {
        nombre: this.normalizarNombre(dto.nombre, tipoDocumento),
        documento,
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
      tipoDocumento: this.inferirTipoDocumento(cliente.documento),
      telefono: cliente.telefono,
      createdAt: cliente.createdAt.toISOString(),
    };
  }

  async eliminar(userId: string, clienteId: string): Promise<void> {
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

    await this.prisma.cliente.update({
      where: { id: clienteId },
      data: { deletedAt: new Date() },
    });
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

  private normalizarNombre(
    valor: string,
    tipoDocumento: GuardarClienteDto['tipoDocumento'] | null,
  ): string {
    return tipoDocumento === 'NIT'
      ? normalizarNombreEmpresaPersona(valor, 'cliente')
      : normalizarNombrePersona(valor, 'cliente');
  }

  private normalizarDocumento(
    valor: string | undefined,
    tipoDocumento: GuardarClienteDto['tipoDocumento'],
  ): string | null {
    return normalizarDocumentoPersona(valor, 'cliente', {
      required: Boolean(valor),
      tipoDocumento: tipoDocumento ?? (valor?.includes('-') ? 'NIT' : 'CEDULA'),
    });
  }

  private obtenerTipoDocumento(
    valor: string | undefined,
    tipoDocumento: GuardarClienteDto['tipoDocumento'],
  ): 'CEDULA' | 'NIT' | null {
    if (!valor) return tipoDocumento ?? null;
    return tipoDocumento ?? (valor.includes('-') ? 'NIT' : 'CEDULA');
  }

  private inferirTipoDocumento(
    documento: string | null,
  ): 'CEDULA' | 'NIT' | null {
    if (!documento) return null;
    return documento.includes('-') ? 'NIT' : 'CEDULA';
  }

  private async validarDocumentoDisponible(
    organizacionId: string,
    documento: string | null,
    clienteId?: string,
  ) {
    if (!documento) return;

    const existente = await this.prisma.cliente.findFirst({
      where: {
        organizacionId,
        documento,
        deletedAt: null,
        ...(clienteId ? { id: { not: clienteId } } : {}),
      },
      select: { id: true },
    });

    if (existente) {
      throw new ConflictException(
        apiError(
          'CLIENTE_DOCUMENTO_DUPLICADO',
          'Ya hay un cliente registrado con este documento.',
          { field: 'documento' },
        ),
      );
    }
  }
}
