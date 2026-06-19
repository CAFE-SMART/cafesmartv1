import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GuardarClienteDto } from './dto/guardar-cliente.dto';
import { apiError } from '../common/errors/api-error';
import {
  type TipoDocumento,
  normalizarDocumentoPersona,
  normalizarNombreEmpresaPersona,
  normalizarNombrePersona,
  normalizarTelefonoPersona,
} from '../common/validations/person-fields';

type ClienteListadoItem = {
  id: string;
  nombre: string;
  documento: string | null;
  tipoDocumento: TipoDocumento | null;
  telefono: string | null;
  createdAt: string;
};

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(userId: string): Promise<ClienteListadoItem[]> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const clientes = await this.findManyCompat(organizacionId);

    return clientes.map((cliente) => ({
      id: cliente.id,
      nombre: cliente.nombre,
      documento: cliente.documento,
      tipoDocumento: (cliente.tipoDocumento as TipoDocumento | null) ?? this.inferirTipoDocumento(cliente.documento),
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

    const data = {
        organizacionId,
        nombre: this.normalizarNombre(dto.nombre, tipoDocumento),
        documento,
        tipoDocumento,
        telefono: normalizarTelefonoPersona(dto.telefono, 'cliente'),
    };
    const cliente = await this.createCompat(data);

    return {
      id: cliente.id,
      nombre: cliente.nombre,
      documento: cliente.documento,
      tipoDocumento: (cliente.tipoDocumento as TipoDocumento | null) ?? this.inferirTipoDocumento(cliente.documento),
      telefono: cliente.telefono,
      createdAt: cliente.createdAt.toISOString(),
    };
  }

  private async createCompat(data: {
    organizacionId: string;
    nombre: string;
    documento: string | null;
    tipoDocumento: TipoDocumento | null;
    telefono: string | null;
  }) {
    try {
      return await this.prisma.cliente.create({
        data,
      select: {
        id: true,
        nombre: true,
        documento: true,
        tipoDocumento: true,
        telefono: true,
        createdAt: true,
      },
      });
    } catch (error) {
      if (!this.isMissingTipoDocumentoColumn(error)) throw error;
      return this.prisma.cliente.create({
        data: {
          organizacionId: data.organizacionId,
          nombre: data.nombre,
          documento: data.documento,
          telefono: data.telefono,
        },
        select: this.baseSelect(),
      }).then((cliente) => ({
        ...cliente,
        tipoDocumento: this.inferirTipoDocumento(cliente.documento),
      }));
    }
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

    const data = {
        nombre: this.normalizarNombre(dto.nombre, tipoDocumento),
        documento,
        tipoDocumento,
        telefono: normalizarTelefonoPersona(dto.telefono, 'cliente'),
    };
    const cliente = await this.updateCompat(clienteId, data);

    return {
      id: cliente.id,
      nombre: cliente.nombre,
      documento: cliente.documento,
      tipoDocumento: (cliente.tipoDocumento as TipoDocumento | null) ?? this.inferirTipoDocumento(cliente.documento),
      telefono: cliente.telefono,
      createdAt: cliente.createdAt.toISOString(),
    };
  }

  private async updateCompat(
    clienteId: string,
    data: {
      nombre: string;
      documento: string | null;
      tipoDocumento: TipoDocumento | null;
      telefono: string | null;
    },
  ) {
    try {
      return await this.prisma.cliente.update({
        where: { id: clienteId },
        data,
      select: {
        id: true,
        nombre: true,
        documento: true,
        tipoDocumento: true,
        telefono: true,
        createdAt: true,
      },
      });
    } catch (error) {
      if (!this.isMissingTipoDocumentoColumn(error)) throw error;
      return this.prisma.cliente.update({
        where: { id: clienteId },
        data: {
          nombre: data.nombre,
          documento: data.documento,
          telefono: data.telefono,
        },
        select: this.baseSelect(),
      }).then((cliente) => ({
        ...cliente,
        tipoDocumento: this.inferirTipoDocumento(cliente.documento),
      }));
    }
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
  ): TipoDocumento | null {
    if (!valor) return tipoDocumento ?? null;
    return tipoDocumento ?? (valor.includes('-') ? 'NIT' : 'CEDULA');
  }

  private inferirTipoDocumento(
    documento: string | null,
  ): TipoDocumento | null {
    if (!documento) return null;
    return documento.includes('-') ? 'NIT' : 'CEDULA';
  }

  private baseSelect() {
    return {
      id: true,
      nombre: true,
      documento: true,
      telefono: true,
      createdAt: true,
    } as const;
  }

  private async findManyCompat(organizacionId: string) {
    try {
      return await this.prisma.cliente.findMany({
        where: {
          organizacionId,
          deletedAt: null,
        },
        orderBy: [{ createdAt: 'desc' }, { nombre: 'asc' }],
        select: {
          id: true,
          nombre: true,
          documento: true,
          tipoDocumento: true,
          telefono: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (!this.isMissingTipoDocumentoColumn(error)) throw error;
      const clientes = await this.prisma.cliente.findMany({
        where: {
          organizacionId,
          deletedAt: null,
        },
        orderBy: [{ createdAt: 'desc' }, { nombre: 'asc' }],
        select: this.baseSelect(),
      });
      return clientes.map((cliente) => ({
        ...cliente,
        tipoDocumento: this.inferirTipoDocumento(cliente.documento),
      }));
    }
  }

  private isMissingTipoDocumentoColumn(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2022' &&
      String(error.meta?.column ?? '').includes('tipo_documento')
    );
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
          'DOCUMENT_ALREADY_EXISTS',
          'Este cliente ya está registrado con este documento.',
          { field: 'documento' },
        ),
      );
    }
  }
}
