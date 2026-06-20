import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ParametrosService } from '../parametros/parametros.service';
import {
  ActualizarBodegaDto,
  ActualizarLimitesBodegaDto,
  CrearBodegaDto,
  EditarBodegaDto,
} from './dto/actualizar-bodega.dto';
import {
  PESO_MAXIMO_ENTRADA_KG,
  PESO_MAXIMO_OPERATIVO_DEFAULT_KG,
  PESO_MINIMO_KG,
} from '../common/business-rules';
import { apiError } from '../common/errors/api-error';

export type ConfiguracionBodega = {
  nombreBodega: string;
  capacidadKg: number | null;
  maxPesoKg: number;
  maxPrecioKg: number;
  maxPrecioVentaKg: number;
  updatedAt: string;
};

export type BodegaItem = {
  id: string;
  nombre: string;
  ubicacion: string | null;
  capacidadMaxKg: number;
  cafeAlmacenadoKg: number;
  disponibleKg: number;
  ocupacionPct: number;
  activa: boolean;
  esPrincipal: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LimitesBodega = {
  alertaPreventivaPct: number;
  alertaCriticaPct: number;
  bloquearAlSuperarCapacidad: boolean;
  alertasActivas: boolean;
};

@Injectable()
export class BodegaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametrosService: ParametrosService,
  ) {}

  /**
   * Obtiene la configuración de bodega de una organización.
   */
  async obtenerConfiguracion(
    organizacionId: string,
  ): Promise<ConfiguracionBodega> {
    const [
      nombreBodega,
      capacidadKgStr,
      maxPesoKgStr,
      maxPrecioKgStr,
      maxPrecioVentaKgStr,
    ] = await Promise.all([
      this.parametrosService.getParametroString(
        'nombre_bodega',
        organizacionId,
        'Bodega principal',
      ),
      this.parametrosService.getParametroString(
        'capacidad_bodega',
        organizacionId,
      ),
      this.parametrosService.getParametroString('max_peso_kg', organizacionId),
      this.parametrosService.getParametroString(
        'max_precio_kg',
        organizacionId,
      ),
      this.parametrosService.getParametroString(
        'max_precio_venta_kg',
        organizacionId,
      ),
    ]);

    const parsed = Number(capacidadKgStr);
    const capacidadKg =
      capacidadKgStr && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    const parsedMaxPeso = Number(maxPesoKgStr);
    const maxPesoKg =
      maxPesoKgStr &&
      Number.isFinite(parsedMaxPeso) &&
      parsedMaxPeso > 0 &&
      parsedMaxPeso <= PESO_MAXIMO_ENTRADA_KG
        ? parsedMaxPeso
        : PESO_MAXIMO_OPERATIVO_DEFAULT_KG;
    const parsedMaxPrecio = Number(maxPrecioKgStr);
    const maxPrecioKg =
      maxPrecioKgStr && Number.isFinite(parsedMaxPrecio) && parsedMaxPrecio > 0
        ? parsedMaxPrecio
        : 100000;
    const parsedMaxPrecioVenta = Number(maxPrecioVentaKgStr);
    const maxPrecioVentaKg =
      maxPrecioVentaKgStr &&
      Number.isFinite(parsedMaxPrecioVenta) &&
      parsedMaxPrecioVenta > 0
        ? parsedMaxPrecioVenta
        : 100000;

    return {
      nombreBodega: nombreBodega || 'Bodega principal',
      capacidadKg,
      maxPesoKg,
      maxPrecioKg,
      maxPrecioVentaKg,
      updatedAt: new Date().toISOString(),
    };
  }

  async listarBodegas(organizacionId: string): Promise<BodegaItem[]> {
    try {
      await this.ensureBodegaPrincipal(organizacionId);
      const bodegas = await this.prisma.bodega.findMany({
        where: { organizacionId, deletedAt: null },
        orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'asc' }],
      });
      const inventarioPrincipal = await this.obtenerInventarioActualKg(
        organizacionId,
      );

      return bodegas.map((bodega) =>
        this.mapBodega(
          bodega,
          bodega.esPrincipal ? inventarioPrincipal : 0,
        ),
      );
    } catch (error) {
      if (!this.isMissingBodegaStorage(error)) throw error;
      return [await this.buildLegacyPrincipalBodega(organizacionId)];
    }
  }

  async obtenerBodega(
    organizacionId: string,
    bodegaId: string,
  ): Promise<BodegaItem> {
    try {
      await this.ensureBodegaPrincipal(organizacionId);
      const bodega = await this.prisma.bodega.findFirst({
        where: { id: bodegaId, organizacionId, deletedAt: null },
      });
      if (!bodega) {
        throw new NotFoundException(
          apiError('BODEGA_NO_ENCONTRADA', 'No encontramos esta bodega.'),
        );
      }
      const inventarioPrincipal = bodega.esPrincipal
        ? await this.obtenerInventarioActualKg(organizacionId)
        : 0;
      return this.mapBodega(bodega, inventarioPrincipal);
    } catch (error) {
      if (!this.isMissingBodegaStorage(error)) throw error;
      const legacy = await this.buildLegacyPrincipalBodega(organizacionId);
      if (bodegaId === legacy.id || bodegaId === 'principal') return legacy;
      throw new NotFoundException(
        apiError('BODEGA_NO_ENCONTRADA', 'No encontramos esta bodega.'),
      );
    }
  }

  async crearBodega(
    organizacionId: string,
    dto: CrearBodegaDto,
  ): Promise<BodegaItem> {
    const nombre = this.normalizeNombre(dto.nombre);
    const ubicacion = this.normalizeUbicacion(dto.ubicacion);
    const capacidadMaxKg = this.normalizeCapacidad(dto.capacidadMaxKg);
    let existingCount = 0;
    try {
      const duplicated = await this.prisma.bodega.findFirst({
        where: {
          organizacionId,
          deletedAt: null,
          nombre: { equals: nombre, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (duplicated) {
        throw new ConflictException(
          apiError(
            'BODEGA_NOMBRE_DUPLICADO',
            'Ya existe una bodega con este nombre.',
            { field: 'nombre' },
          ),
        );
      }
      existingCount = await this.prisma.bodega.count({
        where: { organizacionId, deletedAt: null },
      });
    } catch (error) {
      if (!this.isMissingBodegaStorage(error)) throw error;
      throw new BadRequestException(
        apiError(
          'BODEGA_MIGRACION_REQUERIDA',
          'No pudimos crear otra bodega. Falta aplicar la migración de bodegas en la base de datos.',
        ),
      );
    }
    const esPrincipal = dto.esPrincipal === true || existingCount === 0;

    const bodega = await this.prisma.$transaction(async (tx) => {
      if (esPrincipal) {
        await tx.bodega.updateMany({
          where: { organizacionId, deletedAt: null },
          data: { esPrincipal: false },
        });
      }

      return tx.bodega.create({
        data: {
          organizacionId,
          nombre,
          ubicacion,
          capacidadMaxKg,
          activa: esPrincipal ? true : dto.activa ?? true,
          esPrincipal,
        },
      });
    });

    return this.mapBodega(bodega, esPrincipal ? await this.obtenerInventarioActualKg(organizacionId) : 0);
  }

  async editarBodega(
    organizacionId: string,
    bodegaId: string,
    dto: EditarBodegaDto,
  ): Promise<BodegaItem> {
    let actual;
    try {
      actual = await this.prisma.bodega.findFirst({
        where: { id: bodegaId, organizacionId, deletedAt: null },
      });
    } catch (error) {
      if (!this.isMissingBodegaStorage(error)) throw error;
      if (bodegaId !== 'legacy-principal' && bodegaId !== 'principal') {
        throw new NotFoundException(
          apiError('BODEGA_NO_ENCONTRADA', 'No encontramos esta bodega.'),
        );
      }
      const config = await this.obtenerConfiguracion(organizacionId);
      const capacidadMaxKg =
        typeof dto.capacidadMaxKg === 'number'
          ? Number(this.normalizeCapacidad(dto.capacidadMaxKg))
          : config.capacidadKg ?? 3000;
      await this.actualizarConfiguracion(organizacionId, {
        nombreBodega: typeof dto.nombre === 'string' ? dto.nombre : config.nombreBodega,
        capacidadKg: capacidadMaxKg,
      });
      return this.buildLegacyPrincipalBodega(organizacionId);
    }
    if (!actual) {
      throw new NotFoundException(
        apiError('BODEGA_NO_ENCONTRADA', 'No encontramos esta bodega.'),
      );
    }

    if (typeof dto.nombre === 'string') {
      const nextNombre = this.normalizeNombre(dto.nombre);
      const duplicated = await this.prisma.bodega.findFirst({
        where: {
          organizacionId,
          deletedAt: null,
          id: { not: bodegaId },
          nombre: { equals: nextNombre, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (duplicated) {
        throw new ConflictException(
          apiError(
            'BODEGA_NOMBRE_DUPLICADO',
            'Ya existe una bodega con este nombre.',
            { field: 'nombre' },
          ),
        );
      }
    }

    const inventarioActual = actual.esPrincipal
      ? await this.obtenerInventarioActualKg(organizacionId)
      : 0;
    const capacidadMaxKg =
      typeof dto.capacidadMaxKg === 'number'
        ? this.normalizeCapacidad(dto.capacidadMaxKg)
        : undefined;

    if (
      capacidadMaxKg !== undefined &&
      Number(capacidadMaxKg) < inventarioActual
    ) {
      throw new BadRequestException(
        apiError(
          'BODEGA_CAPACIDAD_MENOR_A_INVENTARIO',
          'La capacidad no puede ser menor al café almacenado actualmente.',
          { field: 'capacidadMaxKg' },
        ),
      );
    }

    const nextPrincipal = dto.esPrincipal === true;
    if (dto.activa === false) {
      if (actual.esPrincipal) {
        throw new ConflictException(
          apiError(
            'BODEGA_PRINCIPAL_ACTIVA_REQUERIDA',
            'La bodega principal debe estar activa. Marca otra bodega como principal antes de desactivarla.',
          ),
        );
      }

      const activeCount = await this.prisma.bodega.count({
        where: { organizacionId, deletedAt: null, activa: true },
      });
      if (actual.activa && activeCount <= 1) {
        throw new ConflictException(
          apiError(
            'BODEGA_UNICA_ACTIVA_REQUERIDA',
            'Debe existir al menos una bodega activa.',
          ),
        );
      }

      if (inventarioActual > 0) {
        throw new ConflictException(
          apiError(
            'BODEGA_CON_INVENTARIO_ACTIVO',
            'No puedes desactivar esta bodega porque tiene inventario activo.',
          ),
        );
      }
    }

    const bodega = await this.prisma.$transaction(async (tx) => {
      if (nextPrincipal) {
        await tx.bodega.updateMany({
          where: { organizacionId, deletedAt: null, id: { not: bodegaId } },
          data: { esPrincipal: false },
        });
      }

      return tx.bodega.update({
        where: { id: bodegaId },
        data: {
          ...(typeof dto.nombre === 'string'
            ? { nombre: this.normalizeNombre(dto.nombre) }
            : {}),
          ...(typeof dto.ubicacion !== 'undefined'
            ? { ubicacion: this.normalizeUbicacion(dto.ubicacion) }
            : {}),
          ...(capacidadMaxKg !== undefined ? { capacidadMaxKg } : {}),
          ...(!nextPrincipal && typeof dto.activa === 'boolean'
            ? { activa: dto.activa }
            : {}),
          ...(nextPrincipal ? { esPrincipal: true, activa: true } : {}),
        },
      });
    });

    if (bodega.esPrincipal) {
      await this.sincronizarParametrosBodegaPrincipal(organizacionId, bodega);
    }

    return this.mapBodega(
      bodega,
      bodega.esPrincipal ? await this.obtenerInventarioActualKg(organizacionId) : 0,
    );
  }

  async eliminarBodega(organizacionId: string, bodegaId: string) {
    let bodegas;
    try {
      bodegas = await this.prisma.bodega.findMany({
        where: { organizacionId, deletedAt: null },
        orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'asc' }],
      });
    } catch (error) {
      if (!this.isMissingBodegaStorage(error)) throw error;
      throw new ConflictException(
        apiError(
          'BODEGA_UNICA_NO_ELIMINABLE',
          'No puedes eliminar la única bodega registrada.',
        ),
      );
    }
    if (bodegas.length <= 1) {
      throw new ConflictException(
        apiError(
          'BODEGA_UNICA_NO_ELIMINABLE',
          'No puedes eliminar la única bodega registrada.',
        ),
      );
    }

    const bodega = bodegas.find((item) => item.id === bodegaId);
    if (!bodega) {
      throw new NotFoundException(
        apiError('BODEGA_NO_ENCONTRADA', 'No encontramos esta bodega.'),
      );
    }

    const inventarioActual = bodega.esPrincipal
      ? await this.obtenerInventarioActualKg(organizacionId)
      : 0;
    if (inventarioActual > 0) {
      throw new ConflictException(
        apiError(
          'BODEGA_CON_INVENTARIO_ACTIVO',
          'No puedes eliminar esta bodega porque tiene inventario activo.',
        ),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.bodega.update({
        where: { id: bodegaId },
        data: { deletedAt: new Date(), activa: false, esPrincipal: false },
      });

      if (bodega.esPrincipal) {
        const replacement = bodegas.find((item) => item.id !== bodegaId);
        if (replacement) {
          await tx.bodega.update({
            where: { id: replacement.id },
            data: { esPrincipal: true, activa: true },
          });
        }
      }
    });

    return { ok: true };
  }

  async obtenerLimitesBodega(
    organizacionId: string,
    bodegaId: string,
  ): Promise<LimitesBodega> {
    await this.ensureBodegaExists(organizacionId, bodegaId);
    return this.getLimitesBodega(organizacionId, bodegaId);
  }

  async actualizarLimitesBodega(
    organizacionId: string,
    bodegaId: string,
    dto: ActualizarLimitesBodegaDto,
  ): Promise<LimitesBodega> {
    await this.ensureBodegaExists(organizacionId, bodegaId);
    const limites = this.normalizeLimitesBodega(dto);
    await this.parametrosService.setParametro(
      this.limitesBodegaKey(bodegaId),
      JSON.stringify(limites),
      organizacionId,
    );
    return limites;
  }

  async aplicarLimitesBodegaGeneral(
    organizacionId: string,
    dto: ActualizarLimitesBodegaDto & { scope?: string; bodegaIds?: string[] },
  ) {
    const limites = this.normalizeLimitesBodega(dto);
    const selectedIds = Array.isArray(dto.bodegaIds)
      ? Array.from(
          new Set(
            dto.bodegaIds
              .map((id) => String(id ?? '').trim())
              .filter(Boolean),
          ),
        )
      : [];

    if (dto.scope === 'seleccionadas' && selectedIds.length === 0) {
      throw new BadRequestException(
        apiError(
          'BODEGA_SELECCION_REQUERIDA',
          'Selecciona al menos una bodega.',
        ),
      );
    }

    const where =
      dto.scope === 'seleccionadas'
        ? { organizacionId, deletedAt: null, id: { in: selectedIds } }
        : dto.scope === 'activas'
          ? { organizacionId, deletedAt: null, activa: true }
          : { organizacionId, deletedAt: null };
    const bodegas = await this.prisma.bodega.findMany({
      where,
      select: { id: true },
    });

    if (dto.scope === 'seleccionadas' && bodegas.length !== selectedIds.length) {
      throw new BadRequestException(
        apiError(
          'BODEGA_SELECCION_INVALIDA',
          'No pudimos encontrar todas las bodegas seleccionadas.',
        ),
      );
    }

    const valor = JSON.stringify(limites);
    await this.prisma.$transaction(
      bodegas.map((bodega) =>
        this.prisma.parametroOrganizacion.upsert({
          where: {
            organizacionId_nombre: {
              organizacionId,
              nombre: this.limitesBodegaKey(bodega.id),
            },
          },
          update: { valor },
          create: {
            organizacionId,
            nombre: this.limitesBodegaKey(bodega.id),
            valor,
          },
        }),
      ),
    );

    return { ...limites, bodegasAfectadas: bodegas.length };
  }

  /**
   * Actualiza la configuración de bodega de una organización.
   */
  async actualizarConfiguracion(
    organizacionId: string,
    dto: ActualizarBodegaDto,
  ): Promise<ConfiguracionBodega> {
    // Validaciones
    if (!dto.nombreBodega || dto.nombreBodega.trim().length === 0) {
      throw new BadRequestException('El nombre de la bodega es requerido');
    }

    if (!Number.isFinite(dto.capacidadKg) || dto.capacidadKg <= 0) {
      throw new BadRequestException('La capacidad debe ser un número positivo');
    }

    // Guardar en base de datos
    await Promise.all([
      this.parametrosService.setParametro(
        'nombre_bodega',
        dto.nombreBodega.trim(),
        organizacionId,
      ),
      this.parametrosService.setParametro(
        'capacidad_bodega',
        dto.capacidadKg.toString(),
        organizacionId,
      ),
    ]);

    try {
      await this.sincronizarBodegaPrincipalDesdeConfiguracion(
        organizacionId,
        dto.nombreBodega.trim(),
        dto.capacidadKg,
      );
    } catch (error) {
      if (!this.isMissingBodegaStorage(error)) throw error;
    }

    return {
      nombreBodega: dto.nombreBodega.trim(),
      capacidadKg: dto.capacidadKg,
      maxPesoKg: PESO_MAXIMO_OPERATIVO_DEFAULT_KG,
      maxPrecioKg: 100000,
      maxPrecioVentaKg: 100000,
      updatedAt: new Date().toISOString(),
    };
  }

  async actualizarLimites(
    organizacionId: string,
    maxPesoKg: number,
    maxPrecioKg: number,
    maxPrecioVentaKg: number,
  ): Promise<{
    maxPesoKg: number;
    maxPrecioKg: number;
    maxPrecioVentaKg: number;
  }> {
    if (
      !Number.isFinite(maxPesoKg) ||
      maxPesoKg < PESO_MINIMO_KG ||
      maxPesoKg > PESO_MAXIMO_ENTRADA_KG
    ) {
      throw new BadRequestException(
        `El peso máximo debe estar entre ${PESO_MINIMO_KG} y ${PESO_MAXIMO_ENTRADA_KG} kg`,
      );
    }

    if (!Number.isFinite(maxPrecioKg) || maxPrecioKg <= 0) {
      throw new BadRequestException(
        'El precio máximo de compra debe ser mayor que 0',
      );
    }

    if (!Number.isFinite(maxPrecioVentaKg) || maxPrecioVentaKg <= 0) {
      throw new BadRequestException(
        'El precio máximo de venta debe ser mayor que 0',
      );
    }

    await Promise.all([
      this.parametrosService.setParametro(
        'max_peso_kg',
        maxPesoKg.toString(),
        organizacionId,
      ),
      this.parametrosService.setParametro(
        'max_precio_kg',
        maxPrecioKg.toString(),
        organizacionId,
      ),
      this.parametrosService.setParametro(
        'max_precio_venta_kg',
        maxPrecioVentaKg.toString(),
        organizacionId,
      ),
    ]);

    return { maxPesoKg, maxPrecioKg, maxPrecioVentaKg };
  }

  private async ensureBodegaPrincipal(organizacionId: string) {
    const existing = await this.prisma.bodega.findFirst({
      where: { organizacionId, deletedAt: null },
      select: { id: true },
    });
    if (existing) return;

    const config = await this.obtenerConfiguracion(organizacionId);
    await this.prisma.bodega.create({
      data: {
        organizacionId,
        nombre: config.nombreBodega || 'Bodega principal',
        capacidadMaxKg: config.capacidadKg ?? 3000,
        ubicacion: null,
        activa: true,
        esPrincipal: true,
      },
    });
  }

  private async sincronizarBodegaPrincipalDesdeConfiguracion(
    organizacionId: string,
    nombre: string,
    capacidadMaxKg: number,
  ) {
    const principal = await this.prisma.bodega.findFirst({
      where: { organizacionId, deletedAt: null, esPrincipal: true },
    });
    if (principal) {
      await this.prisma.bodega.update({
        where: { id: principal.id },
        data: {
          nombre,
          capacidadMaxKg,
          activa: true,
        },
      });
      return;
    }

    const existing = await this.prisma.bodega.findFirst({
      where: { organizacionId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      await this.prisma.bodega.update({
        where: { id: existing.id },
        data: {
          nombre,
          capacidadMaxKg,
          activa: true,
          esPrincipal: true,
        },
      });
      return;
    }

    await this.prisma.bodega.create({
      data: {
        organizacionId,
        nombre,
        capacidadMaxKg,
        ubicacion: null,
        activa: true,
        esPrincipal: true,
      },
    });
  }

  private async buildLegacyPrincipalBodega(
    organizacionId: string,
  ): Promise<BodegaItem> {
    const [config, cafeAlmacenadoKg] = await Promise.all([
      this.obtenerConfiguracion(organizacionId),
      this.obtenerInventarioActualKg(organizacionId),
    ]);
    const capacidadMaxKg = config.capacidadKg ?? 3000;
    const disponibleKg = Math.max(0, capacidadMaxKg - cafeAlmacenadoKg);
    const ocupacionPct =
      capacidadMaxKg > 0
        ? Math.min(100, Math.round((cafeAlmacenadoKg / capacidadMaxKg) * 100))
        : 0;

    return {
      id: 'legacy-principal',
      nombre: config.nombreBodega || 'Bodega principal',
      ubicacion: null,
      capacidadMaxKg,
      cafeAlmacenadoKg,
      disponibleKg,
      ocupacionPct,
      activa: true,
      esPrincipal: true,
      createdAt: config.updatedAt,
      updatedAt: config.updatedAt,
    };
  }

  private limitesBodegaKey(bodegaId: string) {
    return `bodega_limites:${bodegaId}`;
  }

  private defaultLimitesBodega(): LimitesBodega {
    return {
      alertaPreventivaPct: 80,
      alertaCriticaPct: 95,
      bloquearAlSuperarCapacidad: true,
      alertasActivas: true,
    };
  }

  private normalizeLimitesBodega(
    input: Partial<LimitesBodega>,
  ): LimitesBodega {
    const preventiva = Number(input.alertaPreventivaPct);
    const critica = Number(input.alertaCriticaPct);
    if (
      !Number.isInteger(preventiva) ||
      preventiva <= 0 ||
      preventiva > 100
    ) {
      throw new BadRequestException(
        apiError(
          'BODEGA_ALERTA_PREVENTIVA_INVALIDA',
          'Ingresa una alerta preventiva válida.',
        ),
      );
    }
    if (!Number.isInteger(critica) || critica <= 0 || critica > 100) {
      throw new BadRequestException(
        apiError(
          'BODEGA_ALERTA_CRITICA_INVALIDA',
          'Ingresa un estado crítico válido.',
        ),
      );
    }
    if (critica <= preventiva) {
      throw new BadRequestException(
        apiError(
          'BODEGA_ALERTA_CRITICA_MENOR',
          'El nivel preventivo debe ser menor que el nivel crítico.',
        ),
      );
    }
    return {
      alertaPreventivaPct: preventiva,
      alertaCriticaPct: critica,
      bloquearAlSuperarCapacidad:
        input.bloquearAlSuperarCapacidad !== false,
      alertasActivas: input.alertasActivas !== false,
    };
  }

  private async getLimitesBodega(
    organizacionId: string,
    bodegaId: string,
  ): Promise<LimitesBodega> {
    const raw = await this.parametrosService.getParametroString(
      this.limitesBodegaKey(bodegaId),
      organizacionId,
    );
    if (!raw) return this.defaultLimitesBodega();
    try {
      return this.normalizeLimitesBodega(JSON.parse(raw));
    } catch {
      return this.defaultLimitesBodega();
    }
  }

  private async ensureBodegaExists(organizacionId: string, bodegaId: string) {
    const bodega = await this.prisma.bodega.findFirst({
      where: { id: bodegaId, organizacionId, deletedAt: null },
      select: { id: true },
    });
    if (!bodega) {
      throw new NotFoundException(
        apiError('BODEGA_NO_ENCONTRADA', 'No encontramos esta bodega.'),
      );
    }
  }

  private isMissingBodegaStorage(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2021' ||
        (error.code === 'P2022' &&
          String(error.meta?.column ?? '').includes('bodega')))
    );
  }

  private normalizeNombre(value: string) {
    const nombre = String(value ?? '').trim().replace(/\s+/g, ' ');
    if (!nombre || nombre.length < 2) {
      throw new BadRequestException(
        apiError('BODEGA_NOMBRE_REQUERIDO', 'Ingresa el nombre de la bodega.', {
          field: 'nombre',
        }),
      );
    }
    return nombre.slice(0, 80);
  }

  private normalizeUbicacion(value?: string | null) {
    const ubicacion = String(value ?? '').trim().replace(/\s+/g, ' ');
    return ubicacion ? ubicacion.slice(0, 120) : null;
  }

  private normalizeCapacidad(value: number) {
    const capacidad = Number(value);
    if (!Number.isFinite(capacidad)) {
      throw new BadRequestException(
        apiError(
          'BODEGA_CAPACIDAD_REQUERIDA',
          'Ingresa la capacidad máxima de la bodega.',
          { field: 'capacidadMaxKg' },
        ),
      );
    }
    if (capacidad <= 0) {
      throw new BadRequestException(
        apiError(
          'BODEGA_CAPACIDAD_INVALIDA',
          'Ingresa una capacidad válida mayor que cero',
          { field: 'capacidadMaxKg' },
        ),
      );
    }
    return new Prisma.Decimal(capacidad);
  }

  private async obtenerInventarioActualKg(organizacionId: string) {
    const result = await this.prisma.inventario.aggregate({
      where: { organizacionId },
      _sum: { pesoTotal: true },
    });
    return Number(result._sum.pesoTotal ?? 0);
  }

  private async sincronizarParametrosBodegaPrincipal(
    organizacionId: string,
    bodega: { nombre: string; capacidadMaxKg: Prisma.Decimal | number },
  ) {
    await Promise.all([
      this.parametrosService.setParametro(
        'nombre_bodega',
        bodega.nombre,
        organizacionId,
      ),
      this.parametrosService.setParametro(
        'capacidad_bodega',
        String(Number(bodega.capacidadMaxKg)),
        organizacionId,
      ),
    ]);
  }

  private mapBodega(
    bodega: {
      id: string;
      nombre: string;
      ubicacion: string | null;
      capacidadMaxKg: Prisma.Decimal | number;
      activa: boolean;
      esPrincipal: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    cafeAlmacenadoKg: number,
  ): BodegaItem {
    const capacidadMaxKg = Number(bodega.capacidadMaxKg);
    const disponibleKg = Math.max(0, capacidadMaxKg - cafeAlmacenadoKg);
    const ocupacionPct =
      capacidadMaxKg > 0
        ? Math.min(100, Math.round((cafeAlmacenadoKg / capacidadMaxKg) * 100))
        : 0;
    return {
      id: bodega.id,
      nombre: bodega.nombre,
      ubicacion: bodega.ubicacion,
      capacidadMaxKg,
      cafeAlmacenadoKg,
      disponibleKg,
      ocupacionPct,
      activa: bodega.activa,
      esPrincipal: bodega.esPrincipal,
      createdAt: bodega.createdAt.toISOString(),
      updatedAt: bodega.updatedAt.toISOString(),
    };
  }
}
