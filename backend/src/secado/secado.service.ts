import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  Prisma,
  TipoMovimientoInventario,
  TipoReferenciaInventario,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { apiError } from '../common/errors/api-error';
import { SecadoResultsDto } from './dto/secado-results.dto';
import { TransformarSecadoDto } from './dto/transformar-secado.dto';
import { CrearSecadoDto } from './dto/crear-secado.dto';

type FuenteSecado = {
  id: string;
  precioKg: Prisma.Decimal;
  pesoInicial: Prisma.Decimal;
  costoTotal: Prisma.Decimal;
};

type TransformarSecadoInput = TransformarSecadoDto & {
  referenciaSubloteOrigenId?: string;
};

type SecadoDbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class SecadoService {
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
            fuentes: [{ id: dto.subloteId, pesoKg: pesoEntrada }],
            salidas: [
              {
                calidad: dto.calidadSalida,
                pesoKg: dto.pesoSalida,
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

    if (salidasExistentes.length === dto.salidas.length) {
      return {
        sessionId: dto.sessionId,
        totalEntradaKg: totalEntrada,
        totalSalidaKg: totalSalida,
        totalMermaKg,
        sublotes: salidasExistentes,
        alreadyProcessed: true,
      };
    }

    if (salidasExistentes.length > 0) {
      throw new ConflictException(
        apiError(
          'SECADO_SYNC_INCONSISTENTE',
          'El secado ya fue procesado parcialmente. Refresca el inventario e intenta de nuevo.',
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

    const fuentesPorId = new Map(
      fuentes.map((fuente) => [fuente.id, fuente]),
    );

    for (const fuenteInput of dto.fuentes) {
      const fuente = fuentesPorId.get(fuenteInput.id);
      const disponible = this.redondear(Number(fuente?.pesoActual ?? 0));

      if (!fuente || disponible < fuenteInput.pesoKg) {
        throw new BadRequestException(
          apiError(
            'SECADO_INVENTARIO_INSUFICIENTE',
            'No hay suficiente cafe verde para completar el secado.',
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
      const updated = await tx.sublote.updateMany({
        where: {
          id: fuente.id,
          deletedAt: null,
          pesoActual: { gte: fuenteInput.pesoKg },
          compra: {
            organizacionId,
            deletedAt: null,
          },
        },
        data: {
          pesoActual: {
            decrement: fuenteInput.pesoKg,
          },
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
        -fuenteInput.pesoKg,
      );

      await tx.inventarioMovimiento.create({
        data: {
          organizacionId,
          usuarioId: userId,
          tipoCafeId: fuente.tipoCafeId,
          calidadId: fuente.calidadId,
          subloteId: fuente.id,
          cantidad: -fuenteInput.pesoKg,
          tipoMovimiento: TipoMovimientoInventario.SECADO,
          referenciaTipo: TipoReferenciaInventario.SECADO,
          referenciaId: referenciaSecadoId,
        },
      });
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
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { organizacionId: true },
    });

    if (!user?.organizacionId) {
      throw new BadRequestException(
        apiError('ORGANIZACION_REQUERIDA', 'Usuario sin organizacion.'),
      );
    }

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
