import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Compra,
  Prisma,
  Sublote,
  TipoReferenciaInventario,
  TipoMovimientoInventario,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { aCentiUnidades, desdeCentiUnidades } from '../common/utils/math';
import { apiError } from '../common/errors/api-error';
import { invalidarDashboardCache } from '../dashboard/dashboard.service';
import { CreateCompraDto } from './dto/crear-compra.dto';
import {
  CompraProcesada,
  CompraValidacionCriticaError,
  ContextoCapacidadCompra,
  EstadoCapacidadCompra,
  crearCapacidadRequerida,
  crearCapacidadSinValidacion,
  normalizarADosDecimales,
  procesarCompra,
} from './procesar-compra';

type CompraActivaConSublotes = Compra & { sublotes: Sublote[] };

type CrearCompraResultado = {
  compra: Compra;
  sublotes: Sublote[];
  warning?: string;
  exceso?: number;
  capacidad: EstadoCapacidadCompra;
};

type CatalogoItem = {
  id: string;
  nombre: string;
};

type CompraListadoItem = {
  id: string;
  fecha: string;
  totalCompra: number;
  totalSublotes: number;
  creadoEn: string;
  sublotes: {
    id: string;
    tipoCafeId: string;
    tipoCafe: string;
    calidadId: string;
    calidad: string;
    pesoInicial: number;
    pesoActual: number;
    precioKg: number;
  }[];
};

type MovimientoInventario = {
  tipoCafeId: string;
  calidadId: string;
  cantidad: number;
  tipoMovimiento: TipoMovimientoInventario;
  referenciaTipo: TipoReferenciaInventario;
};

const TIPOS_CAFE_BASE = ['VERDE', 'SECO', 'TRILLADO', 'PASILLA'];
const CALIDADES_BASE = ['BUENO', 'REGULAR', 'MALO'];

function claveCatalogo(nombre: string) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function dedupeCatalogoItems(items: CatalogoItem[], ordenBase: string[]) {
  const prioridad = new Map(ordenBase.map((nombre, index) => [nombre, index]));
  const ordenados = [...items].sort((a, b) => {
    const claveA = claveCatalogo(a.nombre);
    const claveB = claveCatalogo(b.nombre);
    const indexA = prioridad.get(claveA) ?? Number.MAX_SAFE_INTEGER;
    const indexB = prioridad.get(claveB) ?? Number.MAX_SAFE_INTEGER;

    if (indexA !== indexB) return indexA - indexB;
    if (a.nombre === claveA && b.nombre !== claveB) return -1;
    if (b.nombre === claveB && a.nombre !== claveA) return 1;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
  const vistos = new Set<string>();

  return ordenados.filter((item) => {
    const clave = claveCatalogo(item.nombre);
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

@Injectable()
export class ComprasService {
  private readonly logger = new Logger(ComprasService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async asegurarCatalogosBase(
    prisma: PrismaService | Prisma.TransactionClient,
  ) {
    await Promise.all([
      prisma.tipoCafe.createMany({
        data: TIPOS_CAFE_BASE.map((nombre) => ({ nombre })),
        skipDuplicates: true,
      }),
      prisma.calidad.createMany({
        data: CALIDADES_BASE.map((nombre) => ({ nombre })),
        skipDuplicates: true,
      }),
    ]);
  }

  async listarCompras(userId: string): Promise<CompraListadoItem[]> {
    const organizacionId = await this.obtenerOrganizacionId(
      this.prisma,
      userId,
    );
    const compras = await this.prisma.compra.findMany({
      where: {
        deletedAt: null,
        organizacionId,
      },
      include: {
        sublotes: {
          where: this.obtenerWhereSubloteActivo(),
          include: {
            tipoCafe: { select: { id: true, nombre: true } },
            calidad: { select: { id: true, nombre: true } },
          },
          orderBy: { creadoEn: 'asc' },
        },
      },
      orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
    });

    return compras.map((compra) => ({
      id: compra.id,
      fecha: compra.fecha.toISOString(),
      totalCompra: Number(compra.totalCompra),
      totalSublotes: compra.sublotes.length,
      creadoEn: compra.creadoEn.toISOString(),
      sublotes: compra.sublotes.map((sublote) => ({
        id: sublote.id,
        tipoCafeId: sublote.tipoCafeId,
        tipoCafe: sublote.tipoCafe.nombre,
        calidadId: sublote.calidadId,
        calidad: sublote.calidad.nombre,
        pesoInicial: Number(sublote.pesoInicial),
        pesoActual: Number(sublote.pesoActual),
        precioKg: Number(sublote.precioKg),
      })),
    }));
  }

  async obtenerCatalogos(_userId: string): Promise<{
    tiposCafe: CatalogoItem[];
    calidades: CatalogoItem[];
  }> {
    await this.asegurarCatalogosBase(this.prisma);
    const organizacionId = await this.obtenerOrganizacionId(this.prisma, _userId);

    const [tiposCafe, calidades] = await Promise.all([
      this.prisma.tipoCafe.findMany({
        where: {
          OR: [
            { organizacionId: null },
            { organizacionId },
          ],
        },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.calidad.findMany({
        where: {
          OR: [
            { organizacionId: null },
            { organizacionId },
          ],
        },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
    ]);

    return {
      tiposCafe: dedupeCatalogoItems(tiposCafe, TIPOS_CAFE_BASE),
      calidades: dedupeCatalogoItems(calidades, CALIDADES_BASE),
    };
  }

  async crearTipoCafe(nombre: string, userId: string): Promise<CatalogoItem> {
    if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
      throw new BadRequestException('El nombre del tipo de café es obligatorio.');
    }
    const cleanNombre = nombre.trim();
    if (cleanNombre.length > 50) {
      throw new BadRequestException('El nombre del tipo de café no puede superar los 50 caracteres.');
    }

    const organizacionId = await this.obtenerOrganizacionId(this.prisma, userId);

    const existing = await this.prisma.tipoCafe.findFirst({
      where: {
        nombre: {
          equals: cleanNombre,
          mode: 'insensitive',
        },
        OR: [
          { organizacionId: null },
          { organizacionId },
        ],
      },
    });
    if (existing) {
      throw new BadRequestException('Este tipo de café ya está registrado.');
    }

    return this.prisma.tipoCafe.create({
      data: {
        nombre: cleanNombre,
        organizacionId,
      },
      select: { id: true, nombre: true },
    });
  }

  async editarTipoCafe(id: string, nombre: string, userId: string): Promise<CatalogoItem> {
    if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
      throw new BadRequestException('El nombre del tipo de café es obligatorio.');
    }
    const cleanNombre = nombre.trim();
    if (cleanNombre.length > 50) {
      throw new BadRequestException('El nombre del tipo de café no puede superar los 50 caracteres.');
    }

    const existing = await this.prisma.tipoCafe.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new BadRequestException('El tipo de café no existe.');
    }

    if (TIPOS_CAFE_BASE.includes(existing.nombre.toUpperCase())) {
      throw new BadRequestException('No se pueden modificar los tipos de café base del sistema.');
    }

    const organizacionId = await this.obtenerOrganizacionId(this.prisma, userId);
    if (existing.organizacionId !== organizacionId) {
      throw new ForbiddenException('No tienes permiso para modificar este tipo de café.');
    }

    const duplicate = await this.prisma.tipoCafe.findFirst({
      where: {
        id: { not: id },
        nombre: {
          equals: cleanNombre,
          mode: 'insensitive',
        },
        OR: [
          { organizacionId: null },
          { organizacionId },
        ],
      },
    });
    if (duplicate) {
      throw new BadRequestException('Ya existe otro tipo de café con este nombre.');
    }

    return this.prisma.tipoCafe.update({
      where: { id },
      data: { nombre: cleanNombre },
      select: { id: true, nombre: true },
    });
  }

  async eliminarTipoCafe(id: string, userId: string): Promise<void> {
    const existing = await this.prisma.tipoCafe.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new BadRequestException('El tipo de café no existe.');
    }

    if (TIPOS_CAFE_BASE.includes(existing.nombre.toUpperCase())) {
      throw new BadRequestException('No se pueden eliminar los tipos de café base del sistema.');
    }

    const organizacionId = await this.obtenerOrganizacionId(this.prisma, userId);
    if (existing.organizacionId !== organizacionId) {
      throw new ForbiddenException('No tienes permiso para eliminar este tipo de café.');
    }

    const lotesCount = await this.prisma.lote.count({ where: { tipoCafeId: id } });
    const sublotesCount = await this.prisma.sublote.count({ where: { tipoCafeId: id, deletedAt: null } });
    if (lotesCount > 0 || sublotesCount > 0) {
      throw new BadRequestException('No se puede eliminar el tipo de café porque tiene lotes o sublotes activos asociados.');
    }

    try {
      await this.prisma.tipoCafe.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('No se puede eliminar el tipo de café porque está en uso en transacciones del sistema.');
      }
      throw error;
    }
  }

  async crearCalidad(nombre: string, userId: string): Promise<CatalogoItem> {
    if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
      throw new BadRequestException('El nombre de la calidad es obligatorio.');
    }
    const cleanNombre = nombre.trim();
    if (cleanNombre.length > 50) {
      throw new BadRequestException('El nombre de la calidad no puede superar los 50 caracteres.');
    }

    const organizacionId = await this.obtenerOrganizacionId(this.prisma, userId);

    const existing = await this.prisma.calidad.findFirst({
      where: {
        nombre: {
          equals: cleanNombre,
          mode: 'insensitive',
        },
        OR: [
          { organizacionId: null },
          { organizacionId },
        ],
      },
    });
    if (existing) {
      throw new BadRequestException('Esta calidad ya está registrada.');
    }

    return this.prisma.calidad.create({
      data: {
        nombre: cleanNombre,
        organizacionId,
      },
      select: { id: true, nombre: true },
    });
  }

  async editarCalidad(id: string, nombre: string, userId: string): Promise<CatalogoItem> {
    if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
      throw new BadRequestException('El nombre de la calidad es obligatorio.');
    }
    const cleanNombre = nombre.trim();
    if (cleanNombre.length > 50) {
      throw new BadRequestException('El nombre de la calidad no puede superar los 50 caracteres.');
    }

    const existing = await this.prisma.calidad.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new BadRequestException('La calidad no existe.');
    }

    if (CALIDADES_BASE.includes(existing.nombre.toUpperCase())) {
      throw new BadRequestException('No se pueden modificar las calidades base del sistema.');
    }

    const organizacionId = await this.obtenerOrganizacionId(this.prisma, userId);
    if (existing.organizacionId !== organizacionId) {
      throw new ForbiddenException('No tienes permiso para modificar esta calidad.');
    }

    const duplicate = await this.prisma.calidad.findFirst({
      where: {
        id: { not: id },
        nombre: {
          equals: cleanNombre,
          mode: 'insensitive',
        },
        OR: [
          { organizacionId: null },
          { organizacionId },
        ],
      },
    });
    if (duplicate) {
      throw new BadRequestException('Ya existe otra calidad con este nombre.');
    }

    return this.prisma.calidad.update({
      where: { id },
      data: { nombre: cleanNombre },
      select: { id: true, nombre: true },
    });
  }

  async eliminarCalidad(id: string, userId: string): Promise<void> {
    const existing = await this.prisma.calidad.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new BadRequestException('La calidad no existe.');
    }

    if (CALIDADES_BASE.includes(existing.nombre.toUpperCase())) {
      throw new BadRequestException('No se pueden eliminar las calidades base del sistema.');
    }

    const organizacionId = await this.obtenerOrganizacionId(this.prisma, userId);
    if (existing.organizacionId !== organizacionId) {
      throw new ForbiddenException('No tienes permiso para eliminar esta calidad.');
    }

    const lotesCount = await this.prisma.lote.count({ where: { calidadId: id } });
    const sublotesCount = await this.prisma.sublote.count({ where: { calidadId: id, deletedAt: null } });
    if (lotesCount > 0 || sublotesCount > 0) {
      throw new BadRequestException('No se puede eliminar la calidad porque tiene lotes o sublotes activos asociados.');
    }

    try {
      await this.prisma.calidad.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('No se puede eliminar la calidad porque está en uso en transacciones del sistema.');
      }
      throw error;
    }
  }

  async crearCompra(
    input: CreateCompraDto,
    userId: string,
  ): Promise<CrearCompraResultado>;
  async crearCompra(
    input: CreateCompraDto,
    userId: string,
    organizacionId: string,
  ): Promise<CrearCompraResultado>;
  async crearCompra(
    input: CreateCompraDto,
    userId: string,
    organizacionId?: string,
  ): Promise<CrearCompraResultado> {
    try {
      const organizacionIdCapacidad = await this.obtenerOrganizacionId(
        this.prisma,
        userId,
        organizacionId,
      );
      const contextoCapacidad = await this.obtenerContextoCapacidadSeguro(
        this.prisma,
        organizacionIdCapacidad,
      );

      /**
       * Ejecuta la compra como una sola unidad de trabajo:
       * crea la compra, crea sublotes, actualiza el agregado y registra trazabilidad.
       */
      const resultado = await this.prisma.$transaction(
        async (tx) => {
          const organizacionIdFinal = await this.obtenerOrganizacionId(
            tx,
            userId,
            organizacionId,
          );

          const compraExistente = await this.buscarCompraActivaPorSync(
            tx,
            input.deviceId,
            input.localId,
          );

          if (compraExistente) {
            return this.construirRespuestaDesdeCompraExistente(compraExistente);
          }

          this.validarSublotesDuplicadosEnRequest(input);
          await this.asegurarCatalogosBase(tx);
          await this.validarCatalogos(tx, input);
          await this.validarProductor(
            tx,
            organizacionIdFinal,
            input.productorId,
          );

          const [minPesoStr, maxPesoStr, minPrecioStr, maxPrecioStr] =
            tx.parametroOrganizacion
              ? await Promise.all([
                  tx.parametroOrganizacion.findUnique({
                    where: {
                      organizacionId_nombre: {
                        organizacionId: organizacionIdFinal,
                        nombre: 'min_peso_kg',
                      },
                    },
                    select: { valor: true },
                  }),
                  tx.parametroOrganizacion.findUnique({
                    where: {
                      organizacionId_nombre: {
                        organizacionId: organizacionIdFinal,
                        nombre: 'max_peso_kg',
                      },
                    },
                    select: { valor: true },
                  }),
                  tx.parametroOrganizacion.findUnique({
                    where: {
                      organizacionId_nombre: {
                        organizacionId: organizacionIdFinal,
                        nombre: 'min_precio_kg',
                      },
                    },
                    select: { valor: true },
                  }),
                  tx.parametroOrganizacion.findUnique({
                    where: {
                      organizacionId_nombre: {
                        organizacionId: organizacionIdFinal,
                        nombre: 'max_precio_kg',
                      },
                    },
                    select: { valor: true },
                  }),
                ])
              : [null, null, null, null];

          const minPeso = minPesoStr?.valor ? Number(minPesoStr.valor) : 5;
          const maxPeso = maxPesoStr?.valor ? Number(maxPesoStr.valor) : 99999;
          const minPrecio = minPrecioStr?.valor
            ? Number(minPrecioStr.valor)
            : 1000;
          const maxPrecio = maxPrecioStr?.valor
            ? Number(maxPrecioStr.valor)
            : 100000;

          for (const [index, sublote] of input.sublotes.entries()) {
            if (sublote.pesoInicial < minPeso) {
              throw new CompraValidacionCriticaError(
                'COMPRA_CANTIDAD_INVALIDA',
                `La cantidad de la compra debe ser minimo ${minPeso} kg.`,
                { index },
              );
            }
            if (sublote.pesoInicial > maxPeso) {
              throw new CompraValidacionCriticaError(
                'COMPRA_CANTIDAD_INVALIDA',
                `La cantidad de la compra no puede superar ${maxPeso} kg.`,
                { index },
              );
            }
            if (sublote.precioKg < minPrecio || sublote.precioKg > maxPrecio) {
              throw new CompraValidacionCriticaError(
                'COMPRA_PRECIO_INVALIDO',
                `El precio por kg debe estar entre $${minPrecio.toLocaleString('es-CO')} y $${maxPrecio.toLocaleString('es-CO')}.`,
                { index },
              );
            }
          }

          const compraProcesada = procesarCompra(input, contextoCapacidad);

          const lotesCompra = await this.asegurarLotesCompra(
            tx,
            organizacionIdFinal,
            compraProcesada.sublotes,
          );
          const movimientosCompra = this.construirMovimientosCompra(
            compraProcesada.sublotes,
          );

          const compra = await tx.compra.create({
            data: {
              fecha: new Date(compraProcesada.compra.fecha),
              totalCompra: compraProcesada.compra.totalCompra,
              deviceId: compraProcesada.compra.deviceId,
              localId: compraProcesada.compra.localId,
              usuarioId: userId,
              organizacionId: organizacionIdFinal,
              productorId: input.productorId?.trim() || null,
            },
          });

          await tx.sublote.createMany({
            data: this.construirSublotesData(
              compra.id,
              input,
              compraProcesada.sublotes,
              lotesCompra,
            ),
          });

          await this.actualizarInventarioSnapshot(
            tx,
            organizacionIdFinal,
            movimientosCompra,
          );

          await this.registrarMovimientosInventario(
            tx,
            organizacionIdFinal,
            userId,
            compra.id,
            movimientosCompra,
          );

          if (!compraProcesada.capacidad.validada) {
            this.logger.warn(
              JSON.stringify({
                event: 'compra_sin_validacion_capacidad',
                compraId: compra.id,
                organizacionId: organizacionIdFinal,
                usuarioId: userId,
                motivo: compraProcesada.capacidad.nivel,
              }),
            );
          }

          const sublotes = await tx.sublote.findMany({
            where: this.obtenerWhereSubloteActivo({
              compraId: compra.id,
            }),
            orderBy: { creadoEn: 'asc' },
          });

          return {
            compra,
            sublotes,
            warning: compraProcesada.warning,
            exceso: compraProcesada.exceso,
            capacidad: compraProcesada.capacidad,
          };
        },
        { maxWait: 10000, timeout: 25000 },
      );

      invalidarDashboardCache(organizacionIdCapacidad);
      return resultado;
    } catch (error) {
      if (error instanceof CompraValidacionCriticaError) {
        throw new BadRequestException(
          apiError(error.code, error.message, { details: error.details }),
        );
      }

      if (this.esErrorUnico(error)) {
        const compraExistente = await this.buscarCompraActivaPorSync(
          this.prisma,
          input.deviceId,
          input.localId,
        );

        if (compraExistente) {
          return this.construirRespuestaDesdeCompraExistente(compraExistente);
        }

        await this.lanzarConflictoDeSincronizacion(input);
      }

      throw error;
    }
  }

  async validarCapacidadCompra(
    input: CreateCompraDto,
    userId: string,
  ): Promise<EstadoCapacidadCompra> {
    try {
      const organizacionId = await this.obtenerOrganizacionId(
        this.prisma,
        userId,
      );
      const contextoCapacidad = await this.obtenerContextoCapacidad(
        this.prisma,
        organizacionId,
      );

      if (!contextoCapacidad) {
        return crearCapacidadRequerida();
      }

      return procesarCompra(input, contextoCapacidad).capacidad;
    } catch {
      return crearCapacidadSinValidacion();
    }
  }

  async eliminarCompra(compraId: string, userId: string): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const organizacionId = await this.obtenerOrganizacionId(tx, userId);
        const compra = await tx.compra.findFirst({
          where: {
            id: compraId,
            organizacionId,
            deletedAt: null,
          },
          include: {
            sublotes: {
              where: this.obtenerWhereSubloteActivo(),
              include: {
                detallesVenta: {
                  where: { deletedAt: null },
                  select: { id: true },
                },
              },
            },
          },
        });

        if (!compra) {
          throw new BadRequestException(
            'La compra no existe o ya fue eliminada',
          );
        }

        const tieneVentas = compra.sublotes.some(
          (sublote) => sublote.detallesVenta.length > 0,
        );

        if (tieneVentas) {
          throw new BadRequestException(
            'No se puede eliminar una compra que ya tiene ventas registradas',
          );
        }

        const ahora = new Date();
        const movimientosReversa: MovimientoInventario[] = compra.sublotes.map(
          (sublote) => ({
            tipoCafeId: sublote.tipoCafeId,
            calidadId: sublote.calidadId,
            cantidad: -Number(sublote.pesoActual),
            tipoMovimiento: TipoMovimientoInventario.COMPRA,
            referenciaTipo: TipoReferenciaInventario.COMPRA,
          }),
        );

        await this.actualizarInventarioSnapshot(
          tx,
          organizacionId,
          movimientosReversa,
        );

        await this.registrarMovimientosInventario(
          tx,
          organizacionId,
          userId,
          compra.id,
          movimientosReversa,
        );

        await tx.sublote.updateMany({
          where: {
            compraId: compra.id,
            deletedAt: null,
          },
          data: { deletedAt: ahora },
        });

        await tx.compra.update({
          where: { id: compra.id },
          data: { deletedAt: ahora },
        });
      },
      { maxWait: 10000, timeout: 25000 },
    );
  }

  /**
   * Resuelve la organizacion efectiva del usuario y valida acceso cruzado.
   */
  private async obtenerOrganizacionId(
    tx: Prisma.TransactionClient | PrismaService,
    userId: string,
    organizacionId?: string,
  ): Promise<string> {
    const usuario = await tx.user.findUnique({
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

    if (organizacionId && usuario.organizacionId !== organizacionId) {
      throw new UnauthorizedException(
        'El usuario no pertenece a la organizacion indicada',
      );
    }

    return usuario.organizacionId;
  }

  /**
   * Evita que un mismo request intente registrar el mismo sublote dos veces.
   */
  private validarSublotesDuplicadosEnRequest(input: CreateCompraDto): void {
    const clavesVistas = new Set<string>();
    const clavesDuplicadas = new Set<string>();

    for (const sublote of input.sublotes) {
      const clave = `${sublote.deviceId}::${sublote.localId}`;

      if (clavesVistas.has(clave)) {
        clavesDuplicadas.add(clave);
        continue;
      }

      clavesVistas.add(clave);
    }

    if (clavesDuplicadas.size > 0) {
      throw new BadRequestException(
        apiError(
          'COMPRA_SUBLOTES_DUPLICADOS',
          'Hay sublotes duplicados en la compra.',
          { details: { sublotes: [...clavesDuplicadas] } },
        ),
      );
    }
  }

  /**
   * Verifica que los catalogos referenciados por la compra existan antes de persistir.
   */
  private async validarCatalogos(
    tx: Prisma.TransactionClient,
    input: CreateCompraDto,
  ): Promise<void> {
    const tipoCafeIds = [...new Set(input.sublotes.map((s) => s.tipoCafeId))];
    const calidadIds = [...new Set(input.sublotes.map((s) => s.calidadId))];

    const [tiposCafe, calidades] = await Promise.all([
      tx.tipoCafe.findMany({
        where: { id: { in: tipoCafeIds } },
        select: { id: true },
      }),
      tx.calidad.findMany({
        where: { id: { in: calidadIds } },
        select: { id: true },
      }),
    ]);

    if (tiposCafe.length !== tipoCafeIds.length) {
      const encontrados = new Set(tiposCafe.map((tipoCafe) => tipoCafe.id));
      const faltantes = tipoCafeIds.filter((id) => !encontrados.has(id));
      throw new BadRequestException(
        apiError(
          'COMPRA_TIPO_CAFE_INVALIDO',
          'El tipo de cafe seleccionado no es valido.',
          { details: { tipoCafeIds: faltantes } },
        ),
      );
    }

    if (calidades.length !== calidadIds.length) {
      const encontrados = new Set(calidades.map((calidad) => calidad.id));
      const faltantes = calidadIds.filter((id) => !encontrados.has(id));
      throw new BadRequestException(
        apiError(
          'COMPRA_CALIDAD_INVALIDA',
          'La calidad seleccionada no es valida.',
          { details: { calidadIds: faltantes } },
        ),
      );
    }
  }

  private async validarProductor(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    productorId?: string,
  ): Promise<void> {
    const productorIdNormalizado = productorId?.trim();

    if (!productorIdNormalizado) {
      return;
    }

    const productor = await tx.productor.findFirst({
      where: {
        id: productorIdNormalizado,
        organizacionId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!productor) {
      throw new BadRequestException(
        apiError(
          'COMPRA_PRODUCTOR_INVALIDO',
          'El productor seleccionado no esta disponible para esta organizacion.',
        ),
      );
    }
  }

  /**
   * Obtiene la capacidad configurada de la bodega y el inventario agregado actual.
   */
  private async obtenerContextoCapacidad(
    tx: Prisma.TransactionClient | PrismaService,
    organizacionId: string,
  ): Promise<ContextoCapacidadCompra | null> {
    const parametro = await tx.parametroOrganizacion.findUnique({
      where: {
        organizacionId_nombre: {
          organizacionId,
          nombre: 'capacidad_bodega',
        },
      },
      select: { valor: true },
    });

    if (!parametro?.valor?.trim()) {
      return null;
    }

    const capacidadBodegaKg = Number(parametro.valor);

    if (!Number.isFinite(capacidadBodegaKg) || capacidadBodegaKg <= 0) {
      return null;
    }

    const inventarioActualKg = await this.obtenerPesoInventarioActual(
      tx,
      organizacionId,
    );

    return {
      capacidadBodegaKg: normalizarADosDecimales(capacidadBodegaKg),
      inventarioActualKg: normalizarADosDecimales(inventarioActualKg),
    };
  }

  private async obtenerContextoCapacidadSeguro(
    tx: Prisma.TransactionClient | PrismaService,
    organizacionId: string,
  ): Promise<ContextoCapacidadCompra | null> {
    try {
      return await this.obtenerContextoCapacidad(tx, organizacionId);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'compra_sin_validacion_capacidad',
          organizacionId,
          motivo: 'fallo_calculo_inventario',
          error: error instanceof Error ? error.message : 'Error desconocido',
        }),
      );
      return null;
    }
  }

  private async obtenerPesoInventarioActual(
    tx: Prisma.TransactionClient | PrismaService,
    organizacionId: string,
  ): Promise<number> {
    const sublotesActuales = await tx.sublote.aggregate({
      _sum: { pesoActual: true },
      where: {
        deletedAt: null,
        compra: {
          organizacionId,
          deletedAt: null,
        },
      },
    });
    const pesoActual = Number(sublotesActuales._sum.pesoActual ?? 0);

    if (!Number.isFinite(pesoActual)) {
      throw new Error('El fallback de sublotes devolvio un valor invalido');
    }

    return pesoActual;
  }

  private construirClaveLote(tipoCafeId: string, calidadId: string): string {
    return `${tipoCafeId}::${calidadId}`;
  }

  private async asegurarLotesCompra(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    sublotesProcesados: CompraProcesada['sublotes'],
  ): Promise<Map<string, string>> {
    const tipoCafeIds = [
      ...new Set(sublotesProcesados.map((s) => s.tipoCafeId)),
    ];
    const calidadIds = [...new Set(sublotesProcesados.map((s) => s.calidadId))];

    const [tiposCafe, calidades, lotesExistentes] = await Promise.all([
      tx.tipoCafe.findMany({
        where: { id: { in: tipoCafeIds } },
        select: { id: true, nombre: true },
      }),
      tx.calidad.findMany({
        where: { id: { in: calidadIds } },
        select: { id: true, nombre: true },
      }),
      tx.lote.findMany({
        where: {
          organizacionId,
          tipoCafeId: { in: tipoCafeIds },
          calidadId: { in: calidadIds },
        },
        select: { id: true, tipoCafeId: true, calidadId: true },
      }),
    ]);

    const nombreTipoPorId = new Map(
      tiposCafe.map((tipoCafe) => [tipoCafe.id, tipoCafe.nombre]),
    );
    const nombreCalidadPorId = new Map(
      calidades.map((calidad) => [calidad.id, calidad.nombre]),
    );

    const lotesPorClave = new Map<string, string>();
    for (const lote of lotesExistentes) {
      lotesPorClave.set(
        this.construirClaveLote(lote.tipoCafeId, lote.calidadId),
        lote.id,
      );
    }

    for (const sublote of sublotesProcesados) {
      const clave = this.construirClaveLote(
        sublote.tipoCafeId,
        sublote.calidadId,
      );
      if (lotesPorClave.has(clave)) {
        continue;
      }

      const tipoNombre = nombreTipoPorId.get(sublote.tipoCafeId) ?? 'TIPO';
      const calidadNombre =
        nombreCalidadPorId.get(sublote.calidadId) ?? 'CALIDAD';
      const codigo = `${tipoNombre} ${calidadNombre}`.trim();

      try {
        const loteCreado = await tx.lote.create({
          data: {
            organizacionId,
            tipoCafeId: sublote.tipoCafeId,
            calidadId: sublote.calidadId,
            codigo,
          },
          select: { id: true },
        });

        lotesPorClave.set(clave, loteCreado.id);
      } catch (error) {
        if (!this.esErrorUnico(error)) {
          throw error;
        }

        const loteExistente = await tx.lote.findUnique({
          where: {
            organizacionId_tipoCafeId_calidadId: {
              organizacionId,
              tipoCafeId: sublote.tipoCafeId,
              calidadId: sublote.calidadId,
            },
          },
          select: { id: true },
        });

        if (!loteExistente) {
          throw new ConflictException(
            'No se pudo asegurar el lote para la combinación tipo/calidad',
          );
        }

        lotesPorClave.set(clave, loteExistente.id);
      }
    }

    return lotesPorClave;
  }

  /**
   * Transforma los sublotes procesados al formato que espera `createMany`.
   */
  private construirSublotesData(
    compraId: string,
    input: CreateCompraDto,
    sublotesProcesados: CompraProcesada['sublotes'],
    lotesCompra: Map<string, string>,
  ): Prisma.SubloteCreateManyInput[] {
    return sublotesProcesados.map((sublote, index) => {
      const clave = this.construirClaveLote(
        sublote.tipoCafeId,
        sublote.calidadId,
      );
      const idLote = lotesCompra.get(clave);

      if (!idLote) {
        throw new BadRequestException(
          apiError(
            'COMPRA_LOTE_INVALIDO',
            'No se encontro el lote para uno de los sublotes de la compra.',
          ),
        );
      }

      return {
        compraId,
        tipoCafeId: sublote.tipoCafeId,
        calidadId: sublote.calidadId,
        pesoInicial: sublote.pesoInicial,
        pesoActual: sublote.pesoActual,
        precioKg: sublote.precioKg,
        costoTotal: sublote.costoTotal,
        idLote,
        deviceId: input.sublotes[index].deviceId,
        localId: input.sublotes[index].localId,
      };
    });
  }

  /**
   * Actualiza el inventario agregado por tipo de cafe y calidad.
   */
  private async actualizarInventarioSnapshot(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    movimientos: MovimientoInventario[],
  ): Promise<void> {
    const movimientosAgrupados = this.agruparMovimientosInventario(movimientos);

    for (const movimiento of movimientosAgrupados) {
      await tx.inventario.upsert({
        where: {
          organizacionId_tipoCafeId_calidadId: {
            organizacionId,
            tipoCafeId: movimiento.tipoCafeId,
            calidadId: movimiento.calidadId,
          },
        },
        create: {
          organizacionId,
          tipoCafeId: movimiento.tipoCafeId,
          calidadId: movimiento.calidadId,
          pesoTotal: movimiento.cantidad,
        },
        update: {
          pesoTotal: {
            increment: movimiento.cantidad,
          },
        },
      });
    }
  }

  /**
   * Registra movimientos de inventario para dejar trazabilidad de la compra.
   */
  private async registrarMovimientosInventario(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    usuarioId: string,
    referenciaId: string,
    movimientos: MovimientoInventario[],
  ): Promise<void> {
    await tx.inventarioMovimiento.createMany({
      data: movimientos.map((movimiento) => ({
        organizacionId,
        usuarioId,
        tipoCafeId: movimiento.tipoCafeId,
        calidadId: movimiento.calidadId,
        cantidad: movimiento.cantidad,
        tipoMovimiento: movimiento.tipoMovimiento,
        referenciaTipo: movimiento.referenciaTipo,
        referenciaId,
      })),
    });
  }

  /**
   * Traduce sublotes procesados a movimientos de inventario de tipo compra.
   */
  private construirMovimientosCompra(
    sublotesProcesados: CompraProcesada['sublotes'],
  ): MovimientoInventario[] {
    return sublotesProcesados.map((sublote) => ({
      tipoCafeId: sublote.tipoCafeId,
      calidadId: sublote.calidadId,
      cantidad: sublote.pesoActual,
      tipoMovimiento: TipoMovimientoInventario.COMPRA,
      referenciaTipo: TipoReferenciaInventario.COMPRA,
    }));
  }

  /**
   * Consolida movimientos iguales para evitar operaciones repetidas sobre el agregado.
   */
  private agruparMovimientosInventario(
    movimientos: MovimientoInventario[],
  ): MovimientoInventario[] {
    const acumulados = new Map<
      string,
      Omit<MovimientoInventario, 'cantidad'> & { cantidadCenti: number }
    >();

    for (const movimiento of movimientos) {
      const clave = `${movimiento.tipoCafeId}::${movimiento.calidadId}::${movimiento.tipoMovimiento}::${movimiento.referenciaTipo}`;
      const movimientoActual = acumulados.get(clave);

      if (!movimientoActual) {
        acumulados.set(clave, {
          tipoCafeId: movimiento.tipoCafeId,
          calidadId: movimiento.calidadId,
          tipoMovimiento: movimiento.tipoMovimiento,
          referenciaTipo: movimiento.referenciaTipo,
          cantidadCenti: aCentiUnidades(movimiento.cantidad),
        });
        continue;
      }

      movimientoActual.cantidadCenti += aCentiUnidades(movimiento.cantidad);
    }

    return [...acumulados.values()].map((movimiento) => ({
      tipoCafeId: movimiento.tipoCafeId,
      calidadId: movimiento.calidadId,
      tipoMovimiento: movimiento.tipoMovimiento,
      referenciaTipo: movimiento.referenciaTipo,
      cantidad: desdeCentiUnidades(movimiento.cantidadCenti),
    }));
  }

  /**
   * Busca una compra activa por su llave de sincronizacion movil.
   */
  private async buscarCompraActivaPorSync(
    client: Prisma.TransactionClient | PrismaService,
    deviceId: string,
    localId: string,
  ): Promise<CompraActivaConSublotes | null> {
    const compra = await client.compra.findUnique({
      where: {
        deviceId_localId: {
          deviceId,
          localId,
        },
      },
      include: {
        sublotes: {
          where: this.obtenerWhereSubloteActivo(),
        },
      },
    });

    if (!compra || compra.deletedAt !== null) {
      return null;
    }

    return compra;
  }

  /**
   * Busca una compra por sincronizacion sin filtrar si fue eliminada.
   */
  private async buscarCompraPorSync(
    client: Prisma.TransactionClient | PrismaService,
    deviceId: string,
    localId: string,
  ): Promise<Compra | null> {
    return client.compra.findUnique({
      where: {
        deviceId_localId: {
          deviceId,
          localId,
        },
      },
    });
  }

  /**
   * Busca si alguno de los sublotes del request ya existe en la base.
   */
  private async buscarSublotePorSync(
    client: Prisma.TransactionClient | PrismaService,
    input: CreateCompraDto,
  ): Promise<Sublote | null> {
    return client.sublote.findFirst({
      where: {
        OR: input.sublotes.map((sublote) => ({
          deviceId: sublote.deviceId,
          localId: sublote.localId,
        })),
      },
    });
  }

  /**
   * Recompone la respuesta de una compra ya existente en el formato del servicio.
   */
  private construirRespuestaDesdeCompraExistente(
    compraExistente: CompraActivaConSublotes,
  ): CrearCompraResultado {
    const { sublotes, ...compra } = compraExistente;

    return {
      compra,
      sublotes,
      capacidad: crearCapacidadSinValidacion(),
    };
  }

  /**
   * Aplica el filtro de sublotes no eliminados a consultas internas del servicio.
   */
  private obtenerWhereSubloteActivo(
    where: Prisma.SubloteWhereInput = {},
  ): Prisma.SubloteWhereInput {
    return {
      ...where,
      deletedAt: null,
    };
  }

  /**
   * Determina la causa funcional de un conflicto de sincronizacion en compras.
   */
  private async lanzarConflictoDeSincronizacion(
    input: CreateCompraDto,
  ): Promise<never> {
    const compraEliminada = await this.buscarCompraPorSync(
      this.prisma,
      input.deviceId,
      input.localId,
    );

    if (compraEliminada && compraEliminada.deletedAt !== null) {
      throw new ConflictException(
        apiError(
          'COMPRA_SYNC_ELIMINADA',
          'Ya existe una compra eliminada con ese identificador de sincronizacion.',
        ),
      );
    }

    const subloteExistente = await this.buscarSublotePorSync(
      this.prisma,
      input,
    );

    if (subloteExistente && subloteExistente.deletedAt !== null) {
      throw new ConflictException(
        apiError(
          'COMPRA_SUBLOTE_SYNC_ELIMINADO',
          'Ya existe un sublote eliminado con ese identificador de sincronizacion.',
        ),
      );
    }

    if (subloteExistente) {
      throw new ConflictException(
        apiError(
          'COMPRA_SUBLOTE_SYNC_DUPLICADO',
          'Uno o mas sublotes ya existen y no pueden asociarse a una nueva compra.',
        ),
      );
    }

    throw new ConflictException(
      apiError(
        'COMPRA_SYNC_CONFLICT',
        'Conflicto de sincronizacion al crear la compra.',
      ),
    );
  }

  /**
   * Identifica errores de unicidad emitidos por Prisma.
   */
  private esErrorUnico(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
