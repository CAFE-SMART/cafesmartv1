import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { apiError } from '../common/errors/api-error';
import {
  type TipoDocumento,
  normalizarDocumentoPersona,
  normalizarNombreEmpresaPersona,
  normalizarNombrePersona,
  normalizarTelefonoPersona,
} from '../common/validations/person-fields';
import {
  type ContactoRol,
  GuardarContactoDto,
} from './dto/guardar-contacto.dto';

type LegacyPerson = {
  id: string;
  nombre: string;
  documento: string | null;
  tipoDocumento: string | null;
  telefono: string | null;
  createdAt: Date;
  updatedAt?: Date | null;
  role: ContactoRol;
};

type ContactoListadoItem = {
  id: string;
  nombre: string;
  documento: string;
  tipoDocumento: TipoDocumento;
  telefono: string | null;
  roles: ContactoRol[];
  esMultirol: boolean;
  etiquetaRol: 'Cliente' | 'Productor' | 'Multirol';
  descripcionRol: string;
  clienteId: string | null;
  productorId: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class ContactosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    userId: string,
    filtroRol?: 'CLIENTE' | 'PRODUCTOR' | 'MULTIROL',
  ): Promise<ContactoListadoItem[]> {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const contactos = await this.obtenerContactosUnificados(organizacionId);

    return contactos
      .filter((contacto) => {
        if (!filtroRol) return true;
        if (filtroRol === 'MULTIROL') {
          return contacto.roles.includes('CLIENTE') && contacto.roles.includes('PRODUCTOR');
        }
        return contacto.roles.includes(filtroRol);
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  async crear(userId: string, dto: GuardarContactoDto) {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const payload = this.normalizarPayload(dto);
    const existente = await this.buscarPorDocumento(
      organizacionId,
      payload.tipoDocumento,
      payload.documento,
    );

    if (existente) {
      const missingRoles = payload.roles.filter((rol) => !existente.roles.includes(rol));
      if (missingRoles.length === 0) {
        throw new ConflictException(
          apiError(
            'CONTACT_ALREADY_HAS_ROLES',
            existente.roles.length > 1
              ? 'Este contacto ya es Multirol.'
              : `Este contacto ya está registrado como ${existente.roles[0] === 'CLIENTE' ? 'cliente' : 'productor'}.`,
            { details: { contactId: existente.id, roles: existente.roles } },
          ),
        );
      }

      throw new ConflictException(
        apiError(
          'CONTACT_ROLE_CAN_BE_ADDED',
          'Este contacto ya está registrado. Puedes agregarle otro rol sin duplicar su información.',
          { details: {
            contactId: existente.id,
            roles: existente.roles,
            missingRoles,
          } },
        ),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const rol of payload.roles) {
        await this.crearRegistroRol(tx, organizacionId, payload, rol);
      }
    });

    const contacto = await this.buscarPorDocumento(
      organizacionId,
      payload.tipoDocumento,
      payload.documento,
    );
    if (!contacto) {
      throw new NotFoundException('No pudimos cargar el contacto creado.');
    }
    return contacto;
  }

  async actualizar(userId: string, contactoId: string, dto: GuardarContactoDto) {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const actual = await this.obtenerPorId(organizacionId, contactoId);
    const payload = this.normalizarPayload(dto);

    const duplicado = await this.buscarPorDocumento(
      organizacionId,
      payload.tipoDocumento,
      payload.documento,
    );
    if (duplicado && duplicado.id !== actual.id) {
      throw new ConflictException(
        apiError(
          'DOCUMENT_ALREADY_EXISTS',
          'Ya existe un contacto con este tipo y número de documento.',
          { field: 'documento', details: { contactId: duplicado.id } },
        ),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (actual.clienteId) {
        await tx.cliente.update({
          where: { id: actual.clienteId },
          data: this.dataPersona(payload),
        });
      }
      if (actual.productorId) {
        await tx.productor.update({
          where: { id: actual.productorId },
          data: this.dataPersona(payload),
        });
      }

      for (const rol of payload.roles.filter((rol) => !actual.roles.includes(rol))) {
        await this.crearRegistroRol(tx, organizacionId, payload, rol);
      }
    });

    return this.buscarPorDocumentoOrFail(
      organizacionId,
      payload.tipoDocumento,
      payload.documento,
    );
  }

  async agregarRol(userId: string, contactoId: string, rol: ContactoRol) {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const contacto = await this.obtenerPorId(organizacionId, contactoId);
    if (contacto.roles.includes(rol)) {
      throw new ConflictException(
        apiError(
          'CONTACT_ALREADY_HAS_ROLE',
          rol === 'CLIENTE'
            ? 'Este contacto ya está registrado como cliente.'
            : 'Este contacto ya está registrado como productor.',
          { details: { contactId: contacto.id, roles: contacto.roles } },
        ),
      );
    }

    const payload = {
      nombre: contacto.nombre,
      tipoDocumento: contacto.tipoDocumento,
      documento: contacto.documento,
      telefono: contacto.telefono,
    };
    await this.crearRegistroRol(this.prisma, organizacionId, payload, rol);
    return this.buscarPorDocumentoOrFail(
      organizacionId,
      payload.tipoDocumento,
      payload.documento,
    );
  }

  async retirarRol(userId: string, contactoId: string, rol: ContactoRol) {
    const organizacionId = await this.obtenerOrganizacionId(userId);
    const contacto = await this.obtenerPorId(organizacionId, contactoId);
    if (!contacto.roles.includes(rol)) return contacto;
    if (contacto.roles.length <= 1) {
      throw new BadRequestException(
        apiError(
          'CONTACT_REQUIRES_ROLE',
          'El contacto debe conservar al menos un rol.',
          { details: { contactId: contacto.id } },
        ),
      );
    }

    if (rol === 'CLIENTE' && contacto.clienteId) {
      await this.prisma.cliente.update({
        where: { id: contacto.clienteId },
        data: { deletedAt: new Date() },
      });
    }
    if (rol === 'PRODUCTOR' && contacto.productorId) {
      await this.prisma.productor.update({
        where: { id: contacto.productorId },
        data: { deletedAt: new Date() },
      });
    }

    return this.obtenerPorId(organizacionId, contactoId);
  }

  private normalizarPayload(dto: GuardarContactoDto) {
    const tipoDocumento = dto.tipoDocumento as TipoDocumento;
    const documento = normalizarDocumentoPersona(dto.documento, 'cliente', {
      required: true,
      tipoDocumento,
    }) as string;
    const nombre =
      tipoDocumento === 'NIT'
        ? normalizarNombreEmpresaPersona(dto.nombre, 'cliente')
        : normalizarNombrePersona(dto.nombre, 'cliente');
    const roles = Array.from(new Set(dto.roles));

    if (roles.length === 0) {
      throw new BadRequestException('Selecciona al menos un rol para el contacto.');
    }

    return {
      nombre,
      tipoDocumento,
      documento,
      telefono: normalizarTelefonoPersona(dto.telefono, 'cliente'),
      roles,
    };
  }

  private dataPersona(payload: {
    nombre: string;
    tipoDocumento: TipoDocumento;
    documento: string;
    telefono: string | null;
  }) {
    return {
      nombre: payload.nombre,
      tipoDocumento: payload.tipoDocumento,
      documento: payload.documento,
      telefono: payload.telefono,
      deletedAt: null,
    };
  }

  private async crearRegistroRol(
    tx: Prisma.TransactionClient | PrismaService,
    organizacionId: string,
    payload: {
      nombre: string;
      tipoDocumento: TipoDocumento;
      documento: string;
      telefono: string | null;
    },
    rol: ContactoRol,
  ) {
    const data = {
      organizacionId,
      ...this.dataPersona(payload),
    };
    if (rol === 'CLIENTE') {
      const existente = await tx.cliente.findFirst({
        where: { organizacionId, documento: payload.documento },
        select: { id: true },
      });
      return existente
        ? tx.cliente.update({ where: { id: existente.id }, data })
        : tx.cliente.create({ data });
    }

    const existente = await tx.productor.findFirst({
      where: { organizacionId, documento: payload.documento },
      select: { id: true },
    });
    return existente
      ? tx.productor.update({ where: { id: existente.id }, data })
      : tx.productor.create({ data });
  }

  private async buscarPorDocumento(
    organizacionId: string,
    tipoDocumento: TipoDocumento,
    documento: string,
  ) {
    const contactos = await this.obtenerContactosUnificados(organizacionId);
    return contactos.find(
      (contacto) =>
        contacto.tipoDocumento === tipoDocumento && contacto.documento === documento,
    );
  }

  private async buscarPorDocumentoOrFail(
    organizacionId: string,
    tipoDocumento: TipoDocumento,
    documento: string,
  ) {
    const contacto = await this.buscarPorDocumento(
      organizacionId,
      tipoDocumento,
      documento,
    );
    if (!contacto) throw new NotFoundException('Contacto no encontrado');
    return contacto;
  }

  private async obtenerPorId(organizacionId: string, contactoId: string) {
    const contactos = await this.obtenerContactosUnificados(organizacionId);
    const contacto = contactos.find((item) => item.id === contactoId);
    if (!contacto) throw new NotFoundException('Contacto no encontrado');
    return contacto;
  }

  private async obtenerContactosUnificados(
    organizacionId: string,
  ): Promise<ContactoListadoItem[]> {
    const [clientes, productores] = await Promise.all([
      this.prisma.cliente.findMany({
        where: { organizacionId, deletedAt: null, documento: { not: null } },
        select: {
          id: true,
          nombre: true,
          documento: true,
          tipoDocumento: true,
          telefono: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.productor.findMany({
        where: { organizacionId, deletedAt: null, documento: { not: null } },
        select: {
          id: true,
          nombre: true,
          documento: true,
          tipoDocumento: true,
          telefono: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const map = new Map<string, LegacyPerson[]>();
    const push = (person: LegacyPerson) => {
      if (!person.documento) return;
      const tipoDocumento =
        (person.tipoDocumento as TipoDocumento | null) ??
        (person.documento.includes('-') ? 'NIT' : 'CEDULA');
      const key = `${tipoDocumento}:${person.documento}`;
      map.set(key, [...(map.get(key) ?? []), { ...person, tipoDocumento }]);
    };

    clientes.forEach((cliente) => push({ ...cliente, role: 'CLIENTE' }));
    productores.forEach((productor) => push({ ...productor, role: 'PRODUCTOR' }));

    return [...map.values()].map((items) => this.mapContacto(items));
  }

  private mapContacto(items: LegacyPerson[]): ContactoListadoItem {
    const roles = Array.from(new Set(items.map((item) => item.role))).sort() as ContactoRol[];
    const preferred =
      items.find((item) => item.role === 'CLIENTE') ?? items[0];
    const cliente = items.find((item) => item.role === 'CLIENTE');
    const productor = items.find((item) => item.role === 'PRODUCTOR');
    const tipoDocumento =
      (preferred.tipoDocumento as TipoDocumento | null) ??
      (preferred.documento?.includes('-') ? 'NIT' : 'CEDULA');
    const createdAt = new Date(
      Math.min(...items.map((item) => item.createdAt.getTime())),
    );
    const updatedAt = new Date(
      Math.max(...items.map((item) => (item.updatedAt ?? item.createdAt).getTime())),
    );

    return {
      id: this.encodeId(tipoDocumento, preferred.documento ?? ''),
      nombre: preferred.nombre,
      documento: preferred.documento ?? '',
      tipoDocumento,
      telefono: preferred.telefono ?? productor?.telefono ?? null,
      roles,
      esMultirol: roles.includes('CLIENTE') && roles.includes('PRODUCTOR'),
      etiquetaRol: roles.length > 1 ? 'Multirol' : roles[0] === 'CLIENTE' ? 'Cliente' : 'Productor',
      descripcionRol:
        roles.length > 1
          ? 'Cliente y productor'
          : roles[0] === 'CLIENTE'
            ? 'Cliente'
            : 'Productor',
      clienteId: cliente?.id ?? null,
      productorId: productor?.id ?? null,
      activo: true,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    };
  }

  private encodeId(tipoDocumento: TipoDocumento, documento: string) {
    return Buffer.from(JSON.stringify({ tipoDocumento, documento })).toString(
      'base64url',
    );
  }

  private async obtenerOrganizacionId(userId: string): Promise<string> {
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizacionId: true },
    });

    if (!usuario) throw new UnauthorizedException('Usuario no encontrado');
    if (!usuario.organizacionId) {
      throw new BadRequestException('El usuario no tiene organizacion asignada');
    }
    return usuario.organizacionId;
  }
}
