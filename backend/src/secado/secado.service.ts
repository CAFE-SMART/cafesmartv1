import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  Prisma,
  TipoMovimientoInventario,
  TipoReferenciaInventario,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { apiError } from '../common/errors/api-error';
import {
  getCachedOrganizationId,
  setCachedOrganizationId,
} from '../common/request-context';
import { SecadoResultsDto } from './dto/secado-results.dto';
import { TransformarSecadoDto } from './dto/transformar-secado.dto';
import { CrearSecadoDto } from './dto/crear-secado.dto';

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
    _userId: string,
    _tipoCafeId: string,
    _calidadId: string,
    _subloteIds: string[],
    _loteId?: string,
  ) {
    throw new BadRequestException(
      apiError(
        'SECADO_MODULO_NO_DISPONIBLE',
        'El modulo de secado no esta disponible en la base de datos actual.',
      ),
    );
  }

  async saveSecadoResults(
    _userId: string,
    _sessionId: string,
    _dto: SecadoResultsDto,
  ) {
    throw new BadRequestException(
      apiError(
        'SECADO_MODULO_NO_DISPONIBLE',
        'El modulo de secado no esta disponible en la base de datos actual.',
      ),
    );
  }

  async finalizeSecado(_userId: string, _sessionId: string) {
    throw new BadRequestException(
      apiError(
        'SECADO_MODULO_NO_DISPONIBLE',
        'El modulo de secado no esta disponible en la base de datos actual.',
      ),
    );
  }

  async getActiveSecado(_organizacionId: string) {
    return null;
  }

  async getActiveSecadoForLote(_userId: string, _loteId: string) {
    return null;
  }

  async getSecadoSession(_organizacionId: string, _sessionId: string) {
    return null;
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
