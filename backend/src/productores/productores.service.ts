import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GuardarProductorDto } from './dto/guardar-productor.dto';

type ProductorListadoItem = {
  id: string;
  nombre: string;
  documento: string | null;
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
        telefono: true,
        createdAt: true,
      },
    });

    return productores.map((productor) => ({
      id: productor.id,
      nombre: productor.nombre,
      documento: productor.documento,
      telefono: productor.telefono,
      createdAt: productor.createdAt.toISOString(),
    }));
  }

  async crear(userId: string, dto: GuardarProductorDto): Promise<ProductorListadoItem> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const productor = await this.prisma.productor.create({
      data: {
        organizacionId,
        nombre: this.normalizarNombre(dto.nombre),
        documento: this.normalizarTextoOpcional(dto.documento),
        telefono: this.normalizarTextoOpcional(dto.telefono),
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
      id: productor.id,
      nombre: productor.nombre,
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

    const productor = await this.prisma.productor.update({
      where: { id: productorId },
      data: {
        nombre: this.normalizarNombre(dto.nombre),
        documento: this.normalizarTextoOpcional(dto.documento),
        telefono: this.normalizarTextoOpcional(dto.telefono),
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
      id: productor.id,
      nombre: productor.nombre,
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
      throw new BadRequestException('El usuario no tiene organizacion asignada');
    }

    return usuario.organizacionId;
  }

  private normalizarTextoOpcional(valor?: string): string | null {
    const texto = valor?.trim();
    return texto ? texto : null;
  }

  private normalizarNombre(valor: string): string {
    const nombre = valor.trim();

    if (!nombre) {
      throw new BadRequestException('El nombre del productor es obligatorio');
    }

    return nombre;
  }
}
