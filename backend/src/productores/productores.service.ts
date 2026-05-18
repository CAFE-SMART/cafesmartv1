import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GuardarProductorDto } from './dto/guardar-productor.dto';
import { apiError } from '../common/errors/api-error';
import {
  normalizarDocumentoPersona,
  normalizarNombrePersona,
  normalizarTelefonoPersona,
} from '../common/validations/person-fields';

type ProductorListadoItem = {
  id: string;
  nombre: string;
  tipoDocumento: string | null;
  documento: string | null;
  telefono: string | null;
  createdAt: string;
};

type ListarProductoresOptions = {
  q?: string;
  limit?: number;
  offset?: number;
  orden?: 'recientes' | 'antiguos' | 'az';
};

@Injectable()
export class ProductoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    userId: string,
    options: ListarProductoresOptions = {},
  ): Promise<ProductorListadoItem[]> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const q = options.q?.trim();
    const limit = Number.isFinite(options.limit)
      ? Math.min(Math.max(Number(options.limit), 1), 50)
      : undefined;
    const offset = Number.isFinite(options.offset)
      ? Math.max(Number(options.offset), 0)
      : undefined;
    const orderBy =
      options.orden === 'az'
        ? [{ nombre: 'asc' as const }, { createdAt: 'desc' as const }]
        : options.orden === 'antiguos'
          ? [{ createdAt: 'asc' as const }, { nombre: 'asc' as const }]
          : [{ createdAt: 'desc' as const }, { nombre: 'asc' as const }];
    const productores = await this.prisma.productor.findMany({
      where: {
        organizacionId,
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { nombre: { contains: q, mode: 'insensitive' as const } },
                { documento: { contains: q, mode: 'insensitive' as const } },
                { telefono: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy,
      ...(typeof limit === 'number' ? { take: limit } : {}),
      ...(typeof offset === 'number' ? { skip: offset } : {}),
      select: {
        id: true,
        nombre: true,
        tipoDocumento: true,
        documento: true,
        telefono: true,
        createdAt: true,
      },
    });

    return productores.map((productor) => ({
      id: productor.id,
      nombre: productor.nombre,
      tipoDocumento: productor.tipoDocumento,
      documento: productor.documento,
      telefono: productor.telefono,
      createdAt: productor.createdAt.toISOString(),
    }));
  }

  async crear(
    userId: string,
    dto: GuardarProductorDto,
  ): Promise<ProductorListadoItem> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const tipoDocumento = this.normalizarTipoDocumento(dto.tipoDocumento);
    const nombre = this.normalizarNombre(dto.nombre, tipoDocumento);
    const documento = this.normalizarDocumento(dto.documento, tipoDocumento);

    await this.validarDocumentoUnico(organizacionId, tipoDocumento, documento);

    const productor = await this.prisma.productor.create({
      data: {
        organizacionId,
        nombre,
        tipoDocumento,
        documento,
        telefono: normalizarTelefonoPersona(dto.telefono, 'productor'),
      },
      select: {
        id: true,
        nombre: true,
        tipoDocumento: true,
        documento: true,
        telefono: true,
        createdAt: true,
      },
    });

    return {
      id: productor.id,
      nombre: productor.nombre,
      tipoDocumento: productor.tipoDocumento,
      documento: productor.documento,
      telefono: productor.telefono,
      createdAt: productor.createdAt.toISOString(),
    };
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

    const tipoDocumento = this.normalizarTipoDocumento(dto.tipoDocumento);
    const nombre = this.normalizarNombre(dto.nombre, tipoDocumento);
    const documento = this.normalizarDocumento(dto.documento, tipoDocumento);

    await this.validarDocumentoUnico(
      organizacionId,
      tipoDocumento,
      documento,
      productorId,
    );

    const productor = await this.prisma.productor.update({
      where: { id: productorId },
      data: {
        nombre,
        tipoDocumento,
        documento,
        telefono: normalizarTelefonoPersona(dto.telefono, 'productor'),
      },
      select: {
        id: true,
        nombre: true,
        tipoDocumento: true,
        documento: true,
        telefono: true,
        createdAt: true,
      },
    });

    return {
      id: productor.id,
      nombre: productor.nombre,
      tipoDocumento: productor.tipoDocumento,
      documento: productor.documento,
      telefono: productor.telefono,
      createdAt: productor.createdAt.toISOString(),
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

  private normalizarNombre(
    valor: string,
    tipoDocumento?: GuardarProductorDto['tipoDocumento'],
  ): string {
    return normalizarNombrePersona(valor, 'productor', { tipoDocumento });
  }

  private normalizarDocumento(
    valor: string,
    tipoDocumento?: GuardarProductorDto['tipoDocumento'],
  ): string {
    return normalizarDocumentoPersona(valor, 'productor', {
      required: true,
      tipoDocumento,
    }) as string;
  }

  private normalizarTipoDocumento(
    tipoDocumento?: GuardarProductorDto['tipoDocumento'],
  ): NonNullable<GuardarProductorDto['tipoDocumento']> {
    return tipoDocumento ?? 'CC';
  }

  private normalizarDocumentoClave(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private async validarDocumentoUnico(
    organizacionId: string,
    tipoDocumento: NonNullable<GuardarProductorDto['tipoDocumento']>,
    documento: string,
    productorIdActual?: string,
  ) {
    const documentoClave = this.normalizarDocumentoClave(documento);
    const productores = await this.prisma.productor.findMany({
      where: {
        organizacionId,
        deletedAt: null,
        documento: { not: null },
        OR: [{ tipoDocumento }, { tipoDocumento: null }],
      },
      select: {
        id: true,
        tipoDocumento: true,
        documento: true,
      },
    });

    const duplicado = productores.find(
      (productor) =>
        productor.id !== productorIdActual &&
        productor.documento &&
        this.normalizarDocumentoClave(productor.documento) === documentoClave,
    );

    if (duplicado) {
      const isEmpresa = tipoDocumento === 'NIT';
      throw new ConflictException(
        apiError(
          'PRODUCTOR_DOCUMENTO_DUPLICADO',
          isEmpresa
            ? 'Esta empresa ya está registrada.'
            : 'Este productor ya está registrado.',
          {
            field: 'documento',
            action: isEmpresa
              ? 'Puedes seleccionarla desde la lista de productores.'
              : 'Puedes seleccionarlo desde la lista de productores.',
          },
        ),
      );
    }
  }
}
