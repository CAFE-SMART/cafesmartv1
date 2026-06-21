import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, RolUsuario, TipoOrganizacion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { apiError } from '../common/errors/api-error';
import { normalizarTelefonoInternacional } from '../common/validations/person-fields';

type CrearUsuarioData = {
  nombre: string;
  correo: string;
  password: string | null;
  googleId?: string | null;
  telefono: string;
  rol: RolUsuario;
  organizacionId: string;
};

type CreateAdminWithOrganizationInput = {
  nombreOrganizacion: string;
  tipoOrganizacion: TipoOrganizacion;
  otroTipoDetalle?: string | null;
  descripcionOrganizacion?: string | null;
  nombre: string;
  correo: string;
  telefono: string;
  password: string;
  googleId?: string | null;
};

type UpdateOrganizationSettingsInput = {
  nombreOrganizacion: string;
  tipoOrganizacion: string;
  descripcionOrganizacion?: string | null;
  descripcion?: string | null;
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          nombre: true,
          correo: true,
          telefono: true,
          avatarUrl: true,
          organizacionId: true,
          organizacion: {
            select: {
              nombre: true,
              tipo: true,
              otroTipoDetalle: true,
              descripcion: true,
            },
          },
        },
      });

      if (!user) {
        throw new BadRequestException(
          apiError('USUARIO_NO_ENCONTRADO', 'No encontramos tu usuario.'),
        );
      }

      return this.mapProfileResponse(user);
    } catch (error) {
      if (!this.isMissingAvatarColumn(error)) throw error;
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          nombre: true,
          correo: true,
          telefono: true,
          organizacionId: true,
          organizacion: {
            select: {
              nombre: true,
              tipo: true,
              otroTipoDetalle: true,
              descripcion: true,
            },
          },
        },
      });

      if (!user) {
        throw new BadRequestException(
          apiError('USUARIO_NO_ENCONTRADO', 'No encontramos tu usuario.'),
        );
      }

      return this.mapProfileResponse({ ...user, avatarUrl: null });
    }
  }

  /**
   * Busca un usuario por correo normalizando mayusculas y espacios.
   */
  async findByEmail(correo: string) {
    const normalizedEmail = correo.trim().toLowerCase();

    try {
      return await this.prisma.user.findFirst({
        where: {
          correo: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
          correo: true,
          nombre: true,
          telefono: true,
          avatarUrl: true,
          password: true,
          googleId: true,
          organizacionId: true,
          organizacion: {
            select: {
              nombre: true,
              tipo: true,
              otroTipoDetalle: true,
              descripcion: true,
            },
          },
        },
      });
    } catch (error) {
      if (!this.isMissingAvatarColumn(error)) throw error;
      const user = await this.prisma.user.findFirst({
        where: {
          correo: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
          correo: true,
          nombre: true,
          telefono: true,
          password: true,
          googleId: true,
          organizacionId: true,
        },
      });
      return user ? { ...user, avatarUrl: null } : null;
    }
  }

  async findSessionById(userId: string) {
    try {
      return await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          nombre: true,
          correo: true,
          telefono: true,
          avatarUrl: true,
          organizacionId: true,
          organizacion: {
            select: {
              id: true,
              nombre: true,
              tipo: true,
              otroTipoDetalle: true,
              descripcion: true,
            },
          },
        },
      });
    } catch (error) {
      if (!this.isMissingAvatarColumn(error)) throw error;
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          nombre: true,
          correo: true,
          telefono: true,
          organizacionId: true,
          organizacion: {
            select: {
              id: true,
              nombre: true,
              tipo: true,
              otroTipoDetalle: true,
              descripcion: true,
            },
          },
        },
      });
      return user ? { ...user, avatarUrl: null } : null;
    }
  }

  async findPasswordById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
      },
    });
  }

  async updatePassword(userId: string, hashedPassword: string) {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
        select: { id: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return null;
      }

      throw error;
    }
  }

  /**
   * Crea un usuario en la transaccion actual o en el cliente principal si no se provee una.
   */
  async create(data: CrearUsuarioData, tx?: Prisma.TransactionClient) {
    const prismaClient = tx ? tx : this.prisma;
    const user = await prismaClient.user.create({
      data: {
        nombre: data.nombre,
        correo: data.correo.trim().toLowerCase(),
        password: data.password,
        googleId: data.googleId,
        telefono: data.telefono,
        rol: data.rol,
        organizacionId: data.organizacionId,
      },
      select: {
        id: true,
        nombre: true,
        correo: true,
        telefono: true,
        avatarUrl: true,
        rol: true,
        organizacionId: true,
        googleId: true,
      },
    });
    return { ...user, avatarUrl: null };
  }

  /**
   * Registra la organizacion inicial y su administrador dentro de una misma transaccion.
   */
  async createAdminWithOrganization(input: CreateAdminWithOrganizationInput) {
    return this.prisma.$transaction(async (tx) => {
      const supportsOrganizationDescription =
        await this.supportsOrganizationDescriptionColumn(tx);
      const organization = await tx.organization.create({
        data: {
          nombre: input.nombreOrganizacion,
          tipo: input.tipoOrganizacion,
          otroTipoDetalle: input.otroTipoDetalle ?? null,
          ...(supportsOrganizationDescription
            ? {
                descripcion: this.normalizeOptionalDescription(
                  input.descripcionOrganizacion,
                ),
              }
            : {}),
        },
        select: {
          id: true,
          nombre: true,
          tipo: true,
          otroTipoDetalle: true,
          ...(supportsOrganizationDescription ? { descripcion: true } : {}),
        },
      });

      const user = await tx.user.create({
        data: {
          nombre: input.nombre,
          correo: input.correo.trim().toLowerCase(),
          telefono: input.telefono,
          password: input.password,
          googleId: input.googleId ?? null,
          rol: RolUsuario.ADMIN,
          organizacionId: organization.id,
        },
        select: {
          id: true,
          nombre: true,
          correo: true,
          telefono: true,
          avatarUrl: true,
          rol: true,
          organizacionId: true,
          googleId: true,
        },
      });
      return {
        ...user,
        avatarUrl: null,
        organizacion: {
          id: organization.id,
          nombre: organization.nombre,
          tipo: organization.tipo,
          otroTipoDetalle: organization.otroTipoDetalle,
          descripcion:
            'descripcion' in organization ? organization.descripcion ?? null : null,
        },
      };
    });
  }

  private async supportsOrganizationDescriptionColumn(
    tx: Prisma.TransactionClient,
  ) {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    try {
      const rows = await tx.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'organizacion'
          AND column_name = 'descripcion'
      `);
      return rows.length > 0;
    } catch (error) {
      console.error(
        '[CafeSmart][register] no se pudo verificar columna organizacion.descripcion:',
        error,
      );
      return true;
    }
  }

  async getOrganizationSettings(userId: string) {
    const supportsOrganizationDescription =
      await this.supportsOrganizationDescriptionColumn(this.prisma);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        organizacion: {
          select: {
            id: true,
            nombre: true,
            tipo: true,
            otroTipoDetalle: true,
            ...(supportsOrganizationDescription ? { descripcion: true } : {}),
          },
        },
      },
    });

    if (!user?.organizacion) {
      throw new BadRequestException(
        apiError('ORGANIZACION_REQUERIDA', 'Usuario sin organizacion.'),
      );
    }

    return {
      id: user.organizacion.id,
      nombre: user.organizacion.nombre,
      tipo: user.organizacion.tipo,
      otroTipoDetalle: user.organizacion.otroTipoDetalle,
      descripcion:
        'descripcion' in user.organizacion
          ? user.organizacion.descripcion ?? null
          : null,
    };
  }

  async linkGoogleAccount(userId: string, googleId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { googleId },
      select: {
        id: true,
        nombre: true,
        correo: true,
        telefono: true,
        avatarUrl: true,
        rol: true,
        organizacionId: true,
        googleId: true,
        organizacion: {
          select: {
            nombre: true,
            tipo: true,
            otroTipoDetalle: true,
            descripcion: true,
          },
        },
      },
    });
  }

  async updateProfile(
    userId: string,
    input: {
      nombre: string;
      correo: string;
      telefono?: string | null;
    },
  ) {
    const nombre = input.nombre.trim();
    const correo = input.correo.trim().toLowerCase();
    const telefonoRaw = input.telefono?.trim() ?? '';
    const telefono = telefonoRaw ? normalizarTelefonoInternacional(telefonoRaw) : '';
    if (telefonoRaw && !telefono) {
      throw new BadRequestException(
        apiError(
          'USUARIO_TELEFONO_INVALIDO',
          'Ingresa un número de teléfono válido.',
          { field: 'telefono' },
        ),
      );
    }

    if (!nombre) {
      throw new BadRequestException(
        apiError('USUARIO_NOMBRE_REQUERIDO', 'Escribe tu nombre.'),
      );
    }

    if (!correo) {
      throw new BadRequestException(
        apiError('USUARIO_CORREO_REQUERIDO', 'Escribe un correo electrónico.'),
      );
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          nombre,
          correo,
          telefono,
        },
        select: {
          id: true,
          nombre: true,
          correo: true,
          telefono: true,
          avatarUrl: true,
          organizacionId: true,
          organizacion: {
            select: {
              nombre: true,
              tipo: true,
              otroTipoDetalle: true,
              descripcion: true,
            },
          },
        },
      });
      return this.mapProfileResponse(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          apiError('USUARIO_CORREO_DUPLICADO', 'El correo ya está en uso.'),
        );
      }

      if (this.isMissingAvatarColumn(error)) {
        const updated = await this.prisma.user.update({
          where: { id: userId },
          data: {
            nombre,
            correo,
            telefono,
          },
          select: {
            id: true,
            nombre: true,
            correo: true,
            telefono: true,
            organizacionId: true,
            organizacion: {
              select: {
                nombre: true,
                tipo: true,
                otroTipoDetalle: true,
                descripcion: true,
              },
            },
          },
        });
        return this.mapProfileResponse({ ...updated, avatarUrl: null });
      }

      throw error;
    }
  }

  async updateOrganizationSettings(
    userId: string,
    input: UpdateOrganizationSettingsInput,
  ) {
    const nombre = input.nombreOrganizacion.trim();
    const tipo = this.normalizeTipoOrganizacion(input.tipoOrganizacion);
    const descripcion = this.normalizeOptionalDescription(
      input.descripcionOrganizacion ?? input.descripcion,
    );

    if (!nombre) {
      throw new BadRequestException(
        apiError('ORGANIZACION_NOMBRE_REQUERIDO', 'Escribe el nombre de la empresa.'),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const supportsOrganizationDescription =
        await this.supportsOrganizationDescriptionColumn(tx);
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { organizacionId: true },
      });

      if (!user?.organizacionId) {
        throw new BadRequestException(
          apiError('ORGANIZACION_REQUERIDA', 'Usuario sin organizacion.'),
        );
      }

      return tx.organization.update({
        where: { id: user.organizacionId },
        data: {
          nombre,
          tipo,
          ...(supportsOrganizationDescription ? { descripcion } : {}),
        },
        select: {
          id: true,
          nombre: true,
          tipo: true,
          otroTipoDetalle: true,
          ...(supportsOrganizationDescription ? { descripcion: true } : {}),
        },
      });
    });
  }

  async uploadAvatar(
    userId: string,
    file: {
      buffer: Buffer;
      mimetype: string;
      size: number;
      originalname?: string;
    },
  ) {
    if (!file?.buffer || !file.size) {
      throw new BadRequestException(
        apiError(
          'AVATAR_REQUERIDO',
          'No pudimos leer la imagen. Selecciona otro archivo e intenta nuevamente.',
        ),
      );
    }

    const allowedTypes = new Map([
      ['image/jpeg', 'jpg'],
      ['image/jpg', 'jpg'],
      ['image/png', 'png'],
      ['image/webp', 'webp'],
    ]);
    const extension = allowedTypes.get(file.mimetype);
    if (!extension) {
      throw new BadRequestException(
        apiError(
          'AVATAR_FORMATO_INVALIDO',
          'Formato no compatible. Selecciona una imagen JPG, PNG o WebP.',
        ),
      );
    }

    if (file.size > 8 * 1024 * 1024) {
      throw new BadRequestException(
        apiError(
          'AVATAR_TAMANO_INVALIDO',
          'La imagen es demasiado grande. Selecciona una imagen de máximo 8 MB.',
        ),
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException(
        apiError('USUARIO_NO_ENCONTRADO', 'No encontramos tu usuario.'),
      );
    }

    const objectPath = `${userId}/profile-${Date.now()}.${extension}`;
    if (process.env.NODE_ENV !== 'production') {
      console.info('[CafeSmart][profile-avatar] archivo recibido', {
        userId,
        originalname: file.originalname ?? null,
        mimetype: file.mimetype,
        size: file.size,
        bucket: 'avatars',
        objectPath,
      });
    }
    const avatarUrl = await this.uploadAvatarToSupabase(
      objectPath,
      file.buffer,
      file.mimetype,
    );

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl },
        select: {
          id: true,
          nombre: true,
          correo: true,
          telefono: true,
          avatarUrl: true,
          organizacionId: true,
          organizacion: {
            select: {
              nombre: true,
              tipo: true,
              otroTipoDetalle: true,
              descripcion: true,
            },
          },
        },
      });
      const profile = this.mapProfileResponse(updated);
      if (process.env.NODE_ENV !== 'production') {
        console.info('[CafeSmart][profile-avatar] perfil actualizado', {
          userId,
          avatarUrl: profile.avatarUrl,
        });
      }
      return profile;
    } catch (error) {
      if (!this.isMissingAvatarColumn(error)) throw error;
      throw new BadRequestException(
        apiError(
          'AVATAR_URL_COLUMN_MISSING',
          'No pudimos guardar la foto. Falta aplicar la migración de perfil en la base de datos.',
        ),
      );
    }
  }

  async removeAvatar(userId: string) {
    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: null },
        select: {
          id: true,
          nombre: true,
          correo: true,
          telefono: true,
          avatarUrl: true,
          organizacionId: true,
          organizacion: {
            select: {
              nombre: true,
              tipo: true,
              otroTipoDetalle: true,
              descripcion: true,
            },
          },
        },
      });
      return this.mapProfileResponse(updated);
    } catch (error) {
      if (!this.isMissingAvatarColumn(error)) throw error;
      throw new BadRequestException(
        apiError(
          'AVATAR_URL_COLUMN_MISSING',
          'No pudimos actualizar la foto. Falta aplicar la migración de perfil en la base de datos.',
        ),
      );
    }
  }

  private normalizeOptionalDescription(value?: string | null) {
    const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
    return normalized ? normalized.slice(0, 200) : null;
  }

  private mapProfileResponse(user: {
    id: string;
    nombre: string;
    correo: string;
    telefono: string | null;
    avatarUrl?: string | null;
    organizacionId: string | null;
    organizacion?: {
      id?: string | null;
      nombre: string;
      tipo: TipoOrganizacion;
      otroTipoDetalle: string | null;
      descripcion?: string | null;
    } | null;
  }) {
    return {
      id: user.id,
      nombre: user.nombre,
      correo: user.correo,
      telefono: user.telefono,
      avatarUrl: user.avatarUrl ?? null,
      organizacionId: user.organizacionId,
      organizacion: user.organizacion
        ? {
            id: user.organizacion.id ?? user.organizacionId,
            nombre: user.organizacion.nombre,
            tipo: user.organizacion.tipo,
            otroTipoDetalle: user.organizacion.otroTipoDetalle,
            descripcion: user.organizacion.descripcion ?? null,
          }
        : null,
      nombreOrganizacion: user.organizacion?.nombre ?? null,
      tipoOrganizacion: user.organizacion?.tipo ?? null,
      otroTipoDetalle: user.organizacion?.otroTipoDetalle ?? null,
      descripcionOrganizacion: user.organizacion?.descripcion ?? null,
    };
  }

  private normalizeTipoOrganizacion(value: string): TipoOrganizacion {
    const normalized = value.trim().toUpperCase();

    if (normalized.includes('COOPERATIVA')) return TipoOrganizacion.COOPERATIVA;
    if (normalized.includes('COMPRAVENTA')) return TipoOrganizacion.COMPRAVENTA;
    if (normalized === 'OTRO') return TipoOrganizacion.OTRO;

    return TipoOrganizacion.OTRO;
  }

  private isMissingAvatarColumn(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2022' &&
      String(error.meta?.column ?? '').includes('avatar_url')
    );
  }

  private getSupabaseStorageConfig() {
    const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      process.env.SUPABASE_SERVICE_KEY?.trim();

    if (!url || !serviceKey) {
      throw new BadRequestException(
        apiError(
          'SUPABASE_STORAGE_CONFIG_FALTANTE',
          'No pudimos subir la foto. Falta configurar Supabase Storage.',
        ),
      );
    }

    return { url, serviceKey };
  }

  private async ensureAvatarsBucket() {
    const { url, serviceKey } = this.getSupabaseStorageConfig();
    const response = await fetch(`${url}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: 'avatars', name: 'avatars', public: true }),
    });

    if (response.ok || response.status === 400 || response.status === 409) {
      return;
    }

    throw new BadRequestException(
      apiError(
        'AVATAR_BUCKET_ERROR',
        'No pudimos preparar el almacenamiento de fotos.',
      ),
    );
  }

  private async uploadAvatarToSupabase(
    objectPath: string,
    buffer: Buffer,
    contentType: string,
  ) {
    await this.ensureAvatarsBucket();
    const { url, serviceKey } = this.getSupabaseStorageConfig();
    const encodedPath = objectPath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const response = await fetch(
      `${url}/storage/v1/object/avatars/${encodedPath}`,
      {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: buffer as unknown as BodyInit,
      },
    );

    if (!response.ok) {
      throw new BadRequestException(
        apiError(
          'AVATAR_UPLOAD_ERROR',
          'No pudimos subir la foto. Revisa tu conexión e intenta nuevamente.',
        ),
      );
    }

    return `${url}/storage/v1/object/public/avatars/${encodedPath}`;
  }
}
