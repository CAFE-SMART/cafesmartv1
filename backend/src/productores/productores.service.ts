import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GuardarProductorDto } from './dto/guardar-productor.dto';
import { apiError } from '../common/errors/api-error';
import {
  type TipoDocumento,
  normalizarDocumentoPersona,
  normalizarNombreEmpresaPersona,
  normalizarNombrePersona,
  normalizarTelefonoPersona,
} from '../common/validations/person-fields';

type ProductorListadoItem = {
  id: string;
  nombre: string;
  documento: string | null;
  tipoDocumento: TipoDocumento | null;
  telefono: string | null;
  createdAt: string;
};

@Injectable()
export class ProductoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(userId: string): Promise<ProductorListadoItem[]> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const productores = await this.findManyCompat(organizacionId);

    return productores.map((productor) => ({
      id: productor.id,
      nombre: productor.nombre,
      documento: productor.documento,
      tipoDocumento:
        (productor.tipoDocumento as TipoDocumento | null) ??
        this.inferirTipoDocumento(productor.documento),
      telefono: productor.telefono,
      createdAt: productor.createdAt.toISOString(),
    }));
  }

  async crear(
    userId: string,
    dto: GuardarProductorDto,
  ): Promise<ProductorListadoItem> {
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
        telefono: normalizarTelefonoPersona(dto.telefono, 'productor'),
    };
    const productor = await this.createCompat(data);

    return {
      id: productor.id,
      nombre: productor.nombre,
      documento: productor.documento,
      tipoDocumento:
        (productor.tipoDocumento as TipoDocumento | null) ??
        this.inferirTipoDocumento(productor.documento),
      telefono: productor.telefono,
      createdAt: productor.createdAt.toISOString(),
    };
  }

  private async createCompat(data: {
    organizacionId: string;
    nombre: string;
    documento: string;
    tipoDocumento: TipoDocumento;
    telefono: string | null;
  }) {
    try {
      return await this.prisma.productor.create({
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
      return this.prisma.productor.create({
        data: {
          organizacionId: data.organizacionId,
          nombre: data.nombre,
          documento: data.documento,
          telefono: data.telefono,
        },
        select: this.baseSelect(),
      }).then((productor) => ({
        ...productor,
        tipoDocumento: this.inferirTipoDocumento(productor.documento),
      }));
    }
  }

  async actualizar(
    userId: string,
    productorId: string,
    dto: GuardarProductorDto,
  ): Promise<ProductorListadoItem> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const existente = await this.prisma.productor.findFirst({
      where: {
        id: productorId,
        organizacionId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!existente) {
      throw new NotFoundException('Productor no encontrado');
    }

    const tipoDocumento = this.obtenerTipoDocumento(
      dto.documento,
      dto.tipoDocumento,
    );
    const documento = this.normalizarDocumento(dto.documento, tipoDocumento);
    await this.validarDocumentoDisponible(
      organizacionId,
      documento,
      productorId,
    );

    const data = {
        nombre: this.normalizarNombre(dto.nombre, tipoDocumento),
        documento,
        tipoDocumento,
        telefono: normalizarTelefonoPersona(dto.telefono, 'productor'),
    };
    const productor = await this.updateCompat(productorId, data);

    return {
      id: productor.id,
      nombre: productor.nombre,
      documento: productor.documento,
      tipoDocumento:
        (productor.tipoDocumento as TipoDocumento | null) ??
        this.inferirTipoDocumento(productor.documento),
      telefono: productor.telefono,
      createdAt: productor.createdAt.toISOString(),
    };
  }

  private async updateCompat(
    productorId: string,
    data: {
      nombre: string;
      documento: string;
      tipoDocumento: TipoDocumento;
      telefono: string | null;
    },
  ) {
    try {
      return await this.prisma.productor.update({
        where: { id: productorId },
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
      return this.prisma.productor.update({
        where: { id: productorId },
        data: {
          nombre: data.nombre,
          documento: data.documento,
          telefono: data.telefono,
        },
        select: this.baseSelect(),
      }).then((productor) => ({
        ...productor,
        tipoDocumento: this.inferirTipoDocumento(productor.documento),
      }));
    }
  }

  async eliminar(userId: string, productorId: string): Promise<void> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const existente = await this.prisma.productor.findFirst({
      where: {
        id: productorId,
        organizacionId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!existente) {
      throw new NotFoundException('Productor no encontrado');
    }

    await this.prisma.productor.update({
      where: { id: productorId },
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
    tipoDocumento: GuardarProductorDto['tipoDocumento'],
  ): string {
    return tipoDocumento === 'NIT'
      ? normalizarNombreEmpresaPersona(valor, 'productor')
      : normalizarNombrePersona(valor, 'productor');
  }

  private normalizarDocumento(
    valor: string,
    tipoDocumento: GuardarProductorDto['tipoDocumento'],
  ): string {
    return normalizarDocumentoPersona(valor, 'productor', {
      required: true,
      tipoDocumento: tipoDocumento ?? (valor.includes('-') ? 'NIT' : 'CEDULA'),
    }) as string;
  }

  private obtenerTipoDocumento(
    valor: string,
    tipoDocumento: GuardarProductorDto['tipoDocumento'],
  ): TipoDocumento {
    return tipoDocumento ?? (valor.includes('-') ? 'NIT' : 'CEDULA');
  }

  private inferirTipoDocumento(documento: string | null): TipoDocumento | null {
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
      return await this.prisma.productor.findMany({
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
      const productores = await this.prisma.productor.findMany({
        where: {
          organizacionId,
          deletedAt: null,
        },
        orderBy: [{ createdAt: 'desc' }, { nombre: 'asc' }],
        select: this.baseSelect(),
      });
      return productores.map((productor) => ({
        ...productor,
        tipoDocumento: this.inferirTipoDocumento(productor.documento),
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
    documento: string,
    productorId?: string,
  ) {
    const existente = await this.prisma.productor.findFirst({
      where: {
        organizacionId,
        documento,
        deletedAt: null,
        ...(productorId ? { id: { not: productorId } } : {}),
      },
      select: { id: true },
    });

    if (existente) {
      throw new ConflictException(
        apiError(
          'DOCUMENT_ALREADY_EXISTS',
          'Este productor ya está registrado con este documento.',
          { field: 'documento' },
        ),
      );
    }
  }
}
