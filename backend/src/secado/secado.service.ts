import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  EstadoSecadoProceso,
  Prisma,
  TipoMovimientoInventario,
  TipoReferenciaInventario,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { apiError } from '../common/errors/api-error';
import {
  getCachedOrganizationId,
  setCachedOrganizationId,
} from '../common/request-context';
import { SecadoResultsDto } from './dto/secado-results.dto';
import { TransformarSecadoDto } from './dto/transformar-secado.dto';
import { CrearSecadoDto } from './dto/crear-secado.dto';
import { StartSecadoDto } from './dto/start-secado.dto';

type FuenteSecado = {
  id: string;
  precioKg: Prisma.Decimal;
  pesoInicial: Prisma.Decimal;
  pesoActual: Prisma.Decimal;
  costoTotal: Prisma.Decimal;
  tipoCafeId: string;
  calidadId: string;
  compraId: string;
  tipoCafe: {
    nombre: string;
  };
  calidad: {
    nombre: string;
  };
};

type TransformarSecadoInput = TransformarSecadoDto & {
  referenciaSubloteOrigenId?: string;
};

type SecadoDbClient = Prisma.TransactionClient | PrismaService;

const ACTIVE_SECADO_STATES = [
  EstadoSecadoProceso.PENDIENTE,
  EstadoSecadoProceso.EN_ESPERA,
  EstadoSecadoProceso.EN_PROCESO,
  EstadoSecadoProceso.RESULTADO_REGISTRADO,
];

@Injectable()
export class SecadoService {
  private readonly logger = new Logger(SecadoService.name);

  constructor(private readonly prisma: PrismaService) {}

  async crearSecado(userId: string, dto: CrearSecadoDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const organizacionId = await this.getOrganizacionId(userId, tx);
        const sublote = await tx.sublote.findFirst({
          where: {
            id: dto.subloteId,
            deletedAt: null,
            compra: {
              organizacionId,
              deletedAt: null,
            },
          },
          select: {
            id: true,
            pesoActual: true,
            tipoCafe: {
              select: {
                nombre: true,
              },
            },
          },
        });

        if (!sublote) {
          throw new BadRequestException(
            apiError(
              'SECADO_SUBLOTE_ORIGEN_INVALIDO',
              'El sublote origen no esta disponible para secado.',
            ),
          );
        }

        if (sublote.tipoCafe.nombre.trim().toUpperCase() !== 'VERDE') {
          throw new BadRequestException(
            apiError(
              'SECADO_SUBLOTE_ORIGEN_INVALIDO',
              'Solo puedes finalizar secado desde cafe verde disponible.',
            ),
          );
        }

        const pesoEntrada = this.redondear(Number(sublote.pesoActual));
        if (pesoEntrada <= 0) {
          throw new BadRequestException(
            apiError(
              'SECADO_INVENTARIO_INSUFICIENTE',
              'No hay cafe disponible para secar en este sublote.',
            ),
          );
        }

        if (dto.pesoSalida > pesoEntrada) {
          throw new BadRequestException(
            apiError(
              'SECADO_SALIDA_MAYOR_ENTRADA',
              'La salida no puede superar el peso disponible del sublote.',
              { details: { inputKg: pesoEntrada, outputKg: dto.pesoSalida } },
            ),
          );
        }

        return this.transformarSecadoEnTransaccion(
          tx,
          userId,
          organizacionId,
          {
            sessionId: `secado-${dto.subloteId}-${dto.calidadSalida}-${dto.pesoSalida}`,
            deviceId: 'backend-secado',
            referenciaSubloteOrigenId: dto.subloteId,
            fuentes: [{ id: dto.subloteId, pesoKg: dto.pesoSalida }],
            salidas: [
              {
                calidad: dto.calidadSalida,
                pesoKg: dto.pesoSalida,
                humedad: dto.humedad ?? null,
                factor: dto.factor ?? null,
              },
            ],
          } as TransformarSecadoInput,
        );
      },
      { maxWait: 10000, timeout: 25000 },
    );
  }

  async transformarSecado(userId: string, dto: TransformarSecadoInput) {
    return this.prisma.$transaction(
      async (tx) => {
        const organizacionId = await this.getOrganizacionId(userId, tx);
        return this.transformarSecadoEnTransaccion(
          tx,
          userId,
          organizacionId,
          dto,
        );
      },
      { maxWait: 10000, timeout: 25000 },
    );
  }

  private async transformarSecadoEnTransaccion(
    tx: Prisma.TransactionClient,
    userId: string,
    organizacionId: string,
    dto: TransformarSecadoInput,
  ) {
    const totalEntrada = this.redondear(
      dto.fuentes.reduce((sum, fuente) => sum + fuente.pesoKg, 0),
    );
    const totalSalida = this.redondear(
      dto.salidas.reduce((sum, salida) => sum + salida.pesoKg, 0),
    );

    if (totalEntrada <= 0 || totalSalida <= 0) {
      throw new BadRequestException(
        apiError(
          'SECADO_CANTIDAD_INVALIDA',
          'La entrada y la salida del secado deben ser mayores a 0.',
        ),
      );
    }

    if (totalSalida > totalEntrada) {
      throw new BadRequestException(
        apiError(
          'SECADO_SALIDA_MAYOR_ENTRADA',
          'La salida no puede superar el peso de entrada.',
          { details: { inputKg: totalEntrada, outputKg: totalSalida } },
        ),
      );
    }

    const fuenteIds = dto.fuentes.map((fuente) => fuente.id);
    if (new Set(fuenteIds).size !== fuenteIds.length) {
      throw new BadRequestException(
        apiError(
          'SECADO_FUENTES_DUPLICADAS',
          'No se puede enviar el mismo sublote dos veces en un secado.',
        ),
      );
    }

    const calidadesSalida = dto.salidas.map((salida) => salida.calidad);
    if (new Set(calidadesSalida).size !== calidadesSalida.length) {
      throw new BadRequestException(
        apiError(
          'SECADO_SALIDAS_DUPLICADAS',
          'No se puede repetir la misma calidad de salida en un secado.',
        ),
      );
    }

    const totalMermaKg = this.redondear(totalEntrada - totalSalida);
    const referenciaSecadoId = dto.referenciaSubloteOrigenId ?? dto.sessionId;

    const localIdsSalida = dto.salidas.map((salida) =>
      this.getSalidaLocalId(dto.sessionId, salida.calidad),
    );
    const salidasExistentes = await tx.sublote.findMany({
      where: {
        deviceId: dto.deviceId,
        localId: { in: localIdsSalida },
        deletedAt: null,
        compra: {
          organizacionId,
          deletedAt: null,
        },
      },
      orderBy: { creadoEn: 'asc' },
    });

    if (salidasExistentes.length > 0) {
      throw new ConflictException(
        apiError(
          'SECADO_SESION_DUPLICADA',
          'Este proceso de secado ya fue registrado. Actualiza el inventario para ver los cambios.',
        ),
      );
    }

    const fuentes = await tx.sublote.findMany({
      where: {
        id: { in: dto.fuentes.map((fuente) => fuente.id) },
        deletedAt: null,
        compra: {
          organizacionId,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        pesoActual: true,
        pesoInicial: true,
        precioKg: true,
        costoTotal: true,
        compraId: true,
        tipoCafeId: true,
        calidadId: true,
        tipoCafe: {
          select: { nombre: true },
        },
        calidad: {
          select: { nombre: true },
        },
      },
    });

    if (fuentes.length !== dto.fuentes.length) {
      throw new BadRequestException(
        apiError(
          'SECADO_SUBLOTE_ORIGEN_INVALIDO',
          'Uno o varios sublotes origen no estan disponibles para secado.',
        ),
      );
    }

    const tiposFuente = new Set(
      fuentes.map((fuente) => fuente.tipoCafe.nombre.trim().toUpperCase()),
    );
    if (tiposFuente.size !== 1 || !tiposFuente.has('VERDE')) {
      throw new BadRequestException(
        apiError(
          'SECADO_SUBLOTE_ORIGEN_INVALIDO',
          'Solo puedes secar sublotes de cafe verde disponible.',
        ),
      );
    }

    const calidadesFuente = new Set(
      fuentes.map((fuente) => fuente.calidad.nombre.trim().toUpperCase()),
    );
    if (calidadesFuente.size !== 1) {
      throw new BadRequestException(
        apiError(
          'SECADO_MEZCLA_CALIDADES',
          'No se pueden mezclar diferentes calidades de cafe en un mismo proceso de secado. Procesa cada calidad por separado.',
        ),
      );
    }

    const fuentesPorId = new Map(
      fuentes.map((fuente) => [fuente.id, fuente]),
    );

    for (const fuenteInput of dto.fuentes) {
      const fuente = fuentesPorId.get(fuenteInput.id);
      const disponible = this.redondear(Number(fuente?.pesoActual ?? 0));

      if (!fuente || disponible <= 0 || disponible < fuenteInput.pesoKg) {
        throw new BadRequestException(
          apiError(
            'SECADO_INVENTARIO_INSUFICIENTE',
            'El peso a secar supera el disponible en uno de los sublotes.',
            {
              details: {
                subloteId: fuenteInput.id,
                disponibleKg: disponible,
                solicitadoKg: fuenteInput.pesoKg,
              },
            },
          ),
        );
      }
    }

    const [tipoSeco, calidades] = await Promise.all([
      tx.tipoCafe.findUnique({
        where: { nombre: 'SECO' },
        select: { id: true },
      }),
      tx.calidad.findMany({
        where: {
          nombre: { in: dto.salidas.map((salida) => salida.calidad) },
        },
        select: { id: true, nombre: true },
      }),
    ]);

    if (
      !tipoSeco ||
      calidades.length !== new Set(dto.salidas.map((s) => s.calidad)).size
    ) {
      throw new BadRequestException(
        apiError(
          'SECADO_CATALOGO_INVALIDO',
          'No encontramos los catalogos necesarios para crear el cafe seco.',
        ),
      );
    }

    const calidadPorNombre = new Map(
      calidades.map((calidad) => [calidad.nombre, calidad.id]),
    );
    const compraId = fuentes[0].compraId;
    const precioPromedioKg = this.calcularPrecioPromedioEntrada(
      dto,
      fuentesPorId,
    );
    const sublotesSalida = [];

    for (const fuenteInput of dto.fuentes) {
      const fuente = fuentesPorId.get(fuenteInput.id)!;
      const pesoOriginal = this.redondear(Number(fuente.pesoActual));
      const pesoSecar = this.redondear(fuenteInput.pesoKg);
      const pesoRestante = this.redondear(Math.max(0, pesoOriginal - pesoSecar));
      const updated = await tx.sublote.updateMany({
        where: {
          id: fuente.id,
          deletedAt: null,
          pesoActual: { gte: pesoSecar },
          compra: {
            organizacionId,
            deletedAt: null,
          },
        },
        data: {
          pesoActual: pesoRestante,
        },
      });

      if (updated.count === 0) {
        throw new ConflictException(
          apiError(
            'SECADO_INVENTARIO_INSUFICIENTE',
            'No hay suficiente cafe verde para completar el secado.',
          ),
        );
      }

      await this.actualizarInventario(
        tx,
        organizacionId,
        fuente.tipoCafeId,
        fuente.calidadId,
        -pesoSecar,
      );

      await tx.inventarioMovimiento.create({
        data: {
          organizacionId,
          usuarioId: userId,
          tipoCafeId: fuente.tipoCafeId,
          calidadId: fuente.calidadId,
          subloteId: fuente.id,
          cantidad: -pesoSecar,
          tipoMovimiento: TipoMovimientoInventario.SECADO,
          referenciaTipo: TipoReferenciaInventario.SECADO,
          referenciaId: referenciaSecadoId,
        },
      });

      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(
          JSON.stringify({
            event: 'secado_parcial_debug',
            subloteId: fuente.id,
            pesoOriginal,
            pesoEnviado: pesoSecar,
            pesoRestante,
            movimientoRegistrado: -pesoSecar,
          }),
        );
      }
    }

    for (const salida of dto.salidas) {
      const calidadId = calidadPorNombre.get(salida.calidad);

      if (!calidadId) {
        throw new BadRequestException(
          apiError(
            'SECADO_CALIDAD_INVALIDA',
            'La calidad de salida del secado no es valida.',
          ),
        );
      }

      const loteSalida = await this.asegurarLote(
        tx,
        organizacionId,
        tipoSeco.id,
        calidadId,
        `SECO ${salida.calidad}`,
      );
      const costoTotal = this.redondear(precioPromedioKg * salida.pesoKg);
      const subloteSalida = await tx.sublote.create({
        data: {
          compraId,
          tipoCafeId: tipoSeco.id,
          calidadId,
          idLote: loteSalida.id,
          pesoInicial: salida.pesoKg,
          pesoActual: salida.pesoKg,
          precioKg: precioPromedioKg,
          costoTotal,
          humedad: salida.humedad ?? null,
          factor: salida.factor ?? null,
          deviceId: dto.deviceId,
          localId: this.getSalidaLocalId(dto.sessionId, salida.calidad),
        },
      });

      sublotesSalida.push(subloteSalida);

      await this.actualizarInventario(
        tx,
        organizacionId,
        tipoSeco.id,
        calidadId,
        salida.pesoKg,
      );

      await tx.inventarioMovimiento.create({
        data: {
          organizacionId,
          usuarioId: userId,
          tipoCafeId: tipoSeco.id,
          calidadId,
          subloteId: subloteSalida.id,
          cantidad: salida.pesoKg,
          tipoMovimiento: TipoMovimientoInventario.SECADO,
          referenciaTipo: TipoReferenciaInventario.SECADO,
          referenciaId: referenciaSecadoId,
        },
      });
    }

    if (totalMermaKg > 0) {
      const fuenteReferencia = fuentes[0];

      await tx.inventarioMovimiento.create({
        data: {
          organizacionId,
          usuarioId: userId,
          tipoCafeId: fuenteReferencia.tipoCafeId,
          calidadId: fuenteReferencia.calidadId,
          subloteId: fuenteReferencia.id,
          cantidad: totalMermaKg,
          tipoMovimiento: TipoMovimientoInventario.MERMA_SECADO,
          referenciaTipo: TipoReferenciaInventario.SECADO,
          referenciaId: referenciaSecadoId,
        },
      });
    }

    await tx.secadoSesion.updateMany({
      where: {
        id: dto.sessionId,
        organizacionId,
        estado: { in: ACTIVE_SECADO_STATES },
      },
      data: {
        estado: EstadoSecadoProceso.FINALIZADO,
        completedAt: new Date(),
      },
    });

    return {
      sessionId: dto.sessionId,
      totalEntradaKg: totalEntrada,
      totalSalidaKg: totalSalida,
      totalMermaKg,
      sublotes: sublotesSalida,
      alreadyProcessed: false,
    };
  }

  async startSecado(
    userId: string,
    tipoCafeId: string,
    calidadId: string,
    dto: StartSecadoDto,
  ) {
    const organizacionId = await this.getOrganizacionId(userId);
    const subloteIds = dto.subloteIds;

    const fuentes = await this.prisma.sublote.findMany({
      where: {
        id: { in: subloteIds },
        deletedAt: null,
        tipoCafeId,
        calidadId,
        compra: {
          organizacionId,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        pesoActual: true,
        tipoCafe: { select: { nombre: true } },
        calidad: { select: { nombre: true } },
        lote: { select: { id: true, codigo: true } },
      },
    });

    if (fuentes.length !== subloteIds.length) {
      throw new BadRequestException(
        apiError(
          'SECADO_SUBLOTE_ORIGEN_INVALIDO',
          'Uno o varios sublotes origen no estan disponibles para secado.',
        ),
      );
    }

    if (
      fuentes.some(
        (fuente) => fuente.tipoCafe.nombre.trim().toUpperCase() !== 'VERDE',
      )
    ) {
      throw new BadRequestException(
        apiError(
          'SECADO_SUBLOTE_ORIGEN_INVALIDO',
          'Solo puedes secar sublotes de cafe verde disponible.',
        ),
      );
    }

    const now = new Date();
    const startedAt = this.parseOptionalDate(dto.startedAt) ?? now;
    const sessionId = dto.sessionId ?? randomUUID();
    const sublotesPayload =
      dto.sublotes?.length === subloteIds.length
        ? dto.sublotes
        : fuentes.map((fuente) => ({
            id: fuente.id,
            etiqueta: fuente.id,
            sourceLoteId: fuente.lote?.id ?? dto.loteId,
            pesoActual: this.redondear(Number(fuente.pesoActual)),
            pesoSeleccionadoKg: this.redondear(Number(fuente.pesoActual)),
            pesoDisponible: this.redondear(Number(fuente.pesoActual)),
            modoSecado: dto.modoSecado ?? 'TOTAL',
            humedad: null,
            fechaIngreso: startedAt.toISOString(),
            diasEnBodega: 0,
          }));

    const payload = {
      id: sessionId,
      estado: 'IN_PROCESS',
      loteId: dto.loteId ?? fuentes[0]?.lote?.id ?? '',
      loteCodigo: dto.loteCodigo ?? fuentes[0]?.lote?.codigo ?? 'Secado',
      tipoCafeId,
      tipoCafe: dto.tipoCafe ?? fuentes[0]?.tipoCafe.nombre ?? 'VERDE',
      calidadId,
      calidad: dto.calidad ?? fuentes[0]?.calidad.nombre ?? '',
      modoSecado: dto.modoSecado ?? 'TOTAL',
      fechaLote: dto.fechaLote ?? startedAt.toISOString(),
      sublotes: sublotesPayload,
      startedAt: startedAt.toISOString(),
      updatedAt: now.toISOString(),
      completedAt: null,
      outputBuenoKg: 0,
      outputBuenoHumedad: null,
      outputRegularKg: 0,
      outputRegularHumedad: null,
      outputMaloKg: 0,
      outputMaloHumedad: null,
      mermaKg: 0,
      rendimientoPct: 0,
    };

    const persisted = await this.prisma.secadoSesion.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        organizacionId,
        usuarioId: userId,
        estado: EstadoSecadoProceso.EN_PROCESO,
        loteId: payload.loteId || null,
        tipoCafeId,
        calidadId,
        payload: payload as Prisma.InputJsonObject,
        startedAt,
      },
      update: {
        estado: EstadoSecadoProceso.EN_PROCESO,
        loteId: payload.loteId || null,
        tipoCafeId,
        calidadId,
        payload: payload as Prisma.InputJsonObject,
        startedAt,
        completedAt: null,
      },
      select: { payload: true },
    });

    return persisted.payload;
  }

  async saveSecadoResults(
    userId: string,
    sessionId: string,
    dto: SecadoResultsDto,
  ) {
    const organizacionId = await this.getOrganizacionId(userId);
    const current = await this.findSessionForOrganization(
      organizacionId,
      sessionId,
    );
    const payload = this.mergeSessionPayload(current.payload, {
      estado: 'READY',
      outputBuenoKg: dto.outputBuenoKg,
      outputBuenoHumedad: dto.outputBuenoHumedad ?? null,
      outputRegularKg: dto.outputRegularKg,
      outputRegularHumedad: dto.outputRegularHumedad ?? null,
      outputMaloKg: dto.outputMaloKg ?? 0,
      outputMaloHumedad: dto.outputMaloHumedad ?? null,
      completedAt: dto.completedAt ?? null,
      updatedAt: new Date().toISOString(),
    });

    const updated = await this.prisma.secadoSesion.update({
      where: { id: sessionId },
      data: {
        estado: EstadoSecadoProceso.RESULTADO_REGISTRADO,
        completedAt: this.parseOptionalDate(dto.completedAt),
        payload,
      },
      select: { payload: true },
    });

    return updated.payload;
  }

  async finalizeSecado(userId: string, sessionId: string) {
    const organizacionId = await this.getOrganizacionId(userId);
    const current = await this.findSessionForOrganization(
      organizacionId,
      sessionId,
    );
    const completedAt = new Date();
    const payload = this.mergeSessionPayload(current.payload, {
      estado: 'COMPLETED',
      completedAt: completedAt.toISOString(),
      updatedAt: completedAt.toISOString(),
    });

    const updated = await this.prisma.secadoSesion.update({
      where: { id: sessionId },
      data: {
        estado: EstadoSecadoProceso.FINALIZADO,
        completedAt,
        payload,
      },
      select: { payload: true },
    });

    return updated.payload;
  }

  async cancelSecado(userId: string, sessionId: string) {
    const organizacionId = await this.getOrganizacionId(userId);
    const current = await this.findSessionForOrganization(
      organizacionId,
      sessionId,
    );
    const now = new Date();
    const payload = this.mergeSessionPayload(current.payload, {
      estado: 'CANCELLED',
      updatedAt: now.toISOString(),
    });

    const updated = await this.prisma.secadoSesion.update({
      where: { id: sessionId },
      data: {
        estado: EstadoSecadoProceso.CANCELADO,
        payload,
      },
      select: { payload: true },
    });

    return updated.payload;
  }

  async getActiveSecado(userId: string) {
    const organizacionId = await this.getOrganizacionId(userId);
    const sessions = await this.prisma.secadoSesion.findMany({
      where: {
        organizacionId,
        estado: { in: ACTIVE_SECADO_STATES },
      },
      orderBy: { startedAt: 'asc' },
      select: { payload: true },
    });

    return sessions.map((session) => session.payload);
  }

  async getActiveSecadoForLote(userId: string, loteId: string) {
    const organizacionId = await this.getOrganizacionId(userId);
    const sessions = await this.prisma.secadoSesion.findMany({
      where: {
        organizacionId,
        loteId,
        estado: { in: ACTIVE_SECADO_STATES },
      },
      orderBy: { startedAt: 'asc' },
      select: { payload: true },
    });

    return sessions.map((session) => session.payload);
  }

  async getSecadoSession(userId: string, sessionId: string) {
    const organizacionId = await this.getOrganizacionId(userId);
    const session = await this.findSessionForOrganization(
      organizacionId,
      sessionId,
    );
    return session.payload;
  }

  private async getOrganizacionId(
    userId: string,
    client: SecadoDbClient = this.prisma,
  ): Promise<string> {
    const cached = getCachedOrganizationId(userId);
    if (cached) return cached;

    const user = await client.user.findUnique({
      where: { id: userId },
      select: { organizacionId: true },
    });

    if (!user?.organizacionId) {
      throw new BadRequestException(
        apiError('ORGANIZACION_REQUERIDA', 'Usuario sin organizacion.'),
      );
    }

    setCachedOrganizationId(userId, user.organizacionId);
    return user.organizacionId;
  }

  private async findSessionForOrganization(
    organizacionId: string,
    sessionId: string,
  ) {
    const session = await this.prisma.secadoSesion.findFirst({
      where: {
        id: sessionId,
        organizacionId,
      },
      select: {
        id: true,
        payload: true,
      },
    });

    if (!session) {
      throw new BadRequestException(
        apiError(
          'SECADO_SESION_NO_ENCONTRADA',
          'No encontramos este secado en proceso.',
        ),
      );
    }

    return session;
  }

  private mergeSessionPayload(
    current: Prisma.JsonValue,
    updates: Record<string, unknown>,
  ) {
    const base =
      current && typeof current === 'object' && !Array.isArray(current)
        ? (current as Record<string, unknown>)
        : {};

    return {
      ...base,
      ...updates,
    } as Prisma.InputJsonObject;
  }

  private parseOptionalDate(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private getSalidaLocalId(sessionId: string, calidad: string): string {
    return `secado:${sessionId}:${calidad.toLowerCase()}`;
  }

  private redondear(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private calcularPrecioPromedioEntrada(
    dto: TransformarSecadoDto,
    fuentesPorId: Map<string, FuenteSecado>,
  ): number {
    let costoTotal = 0;
    let pesoTotal = 0;

    for (const fuenteInput of dto.fuentes) {
      const fuente = fuentesPorId.get(fuenteInput.id);
      if (!fuente) continue;

      const pesoInicial = Number(fuente.pesoInicial);
      const costoTotalFuente = Number(fuente.costoTotal);
      const precioKg =
        pesoInicial > 0 && costoTotalFuente > 0
          ? costoTotalFuente / pesoInicial
          : Number(fuente.precioKg);

      costoTotal += precioKg * fuenteInput.pesoKg;
      pesoTotal += fuenteInput.pesoKg;
    }

    return pesoTotal > 0 ? this.redondear(costoTotal / pesoTotal) : 0;
  }

  private async asegurarLote(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    tipoCafeId: string,
    calidadId: string,
    codigo: string,
  ) {
    return tx.lote.upsert({
      where: {
        organizacionId_tipoCafeId_calidadId: {
          organizacionId,
          tipoCafeId,
          calidadId,
        },
      },
      create: {
        organizacionId,
        tipoCafeId,
        calidadId,
        codigo,
      },
      update: {},
      select: { id: true },
    });
  }

  private async actualizarInventario(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    tipoCafeId: string,
    calidadId: string,
    cantidad: number,
  ) {
    if (cantidad < 0) {
      const update = await tx.inventario.updateMany({
        where: {
          organizacionId,
          tipoCafeId,
          calidadId,
          pesoTotal: {
            gte: Math.abs(cantidad),
          },
        },
        data: {
          pesoTotal: {
            decrement: Math.abs(cantidad),
          },
        },
      });

      if (update.count === 0) {
        throw new ConflictException(
          apiError(
            'SECADO_INVENTARIO_INSUFICIENTE',
            'No hay suficiente cafe verde para completar el secado.',
          ),
        );
      }

      return;
    }

    await tx.inventario.upsert({
      where: {
        organizacionId_tipoCafeId_calidadId: {
          organizacionId,
          tipoCafeId,
          calidadId,
        },
      },
      create: {
        organizacionId,
        tipoCafeId,
        calidadId,
        pesoTotal: cantidad,
      },
      update: {
        pesoTotal: {
          increment: cantidad,
        },
      },
    });
  }
}
