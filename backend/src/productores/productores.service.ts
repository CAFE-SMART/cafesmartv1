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
  documento: string | null;
  tipoDocumento: 'CEDULA' | 'NIT' | null;
  telefono: string | null;
  createdAt: string;
};

@Injectable()
export class ProductoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(userId: string): Promise<ProductorListadoItem[]> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const productores = await this.prisma.productor.findMany({
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

    return productores.map((productor) => ({
      id: productor.id,
      nombre: productor.nombre,
      documento: productor.documento,
      tipoDocumento: productor.tipoDocumento as 'CEDULA' | 'NIT' | null,
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

    const productor = await this.prisma.productor.create({
      data: {
        organizacionId,
        nombre: this.normalizarNombre(dto.nombre),
        documento,
        tipoDocumento,
        telefono: normalizarTelefonoPersona(dto.telefono, 'productor'),
      },
      select: {
        id: true,
        nombre: true,
        documento: true,
        tipoDocumento: true,
        telefono: true,
        createdAt: true,
      },
    });

    return {
      id: productor.id,
      nombre: productor.nombre,
      documento: productor.documento,
      tipoDocumento: productor.tipoDocumento as 'CEDULA' | 'NIT' | null,
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

    const productor = await this.prisma.productor.update({
      where: { id: productorId },
      data: {
        nombre: this.normalizarNombre(dto.nombre),
        documento,
        tipoDocumento,
        telefono: normalizarTelefonoPersona(dto.telefono, 'productor'),
      },
      select: {
        id: true,
        nombre: true,
        documento: true,
        tipoDocumento: true,
        telefono: true,
        createdAt: true,
      },
    });

    return {
      id: productor.id,
      nombre: productor.nombre,
      documento: productor.documento,
      tipoDocumento: productor.tipoDocumento as 'CEDULA' | 'NIT' | null,
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

  private normalizarNombre(valor: string): string {
    return normalizarNombrePersona(valor, 'productor');
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
  ): 'CEDULA' | 'NIT' {
    return tipoDocumento ?? (valor.includes('-') ? 'NIT' : 'CEDULA');
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
          'PRODUCTOR_DOCUMENTO_DUPLICADO',
          'Ya hay un productor registrado con este documento.',
          { field: 'documento' },
        ),
      );
    }
  }
}
