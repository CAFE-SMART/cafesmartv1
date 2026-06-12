import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  Prisma,
  TipoMovimientoInventario,
  TipoReferenciaInventario,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { apiError } from '../common/errors/api-error';
import { CrearSecadoDto } from './dto/crear-secado.dto';
import { SecadoResultsDto } from './dto/secado-results.dto';
import { TransformarSecadoDto } from './dto/transformar-secado.dto';

type FuenteSecado = {
  id: string;
  precioKg: Prisma.Decimal;
  pesoInicial: Prisma.Decimal;
  costoTotal: Prisma.Decimal;
};

@Injectable()
export class SecadoService {
  constructor(private readonly prisma: PrismaService) {}

  async crearSecado(userId: string, dto: CrearSecadoDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { organizacionId: true },
        });

        if (!user?.organizacionId) {
          throw new BadRequestException(
            apiError('ORGANIZACION_REQUERIDA', 'Usuario sin organizacion.'),
          );
        }

        const organizacionId = user.organizacionId;
        const pesoSalida = this.redondear(dto.pesoSalida);
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
            pesoInicial: true,
            precioKg: true,
            costoTotal: true,
            compraId: true,
            tipoCafeId: true,
            calidadId: true,
            deviceId: true,
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

        const pesoEntrada = this.redondear(Number(sublote.pesoActual));

        if (pesoEntrada <= 0) {
          throw new BadRequestException(
            apiError(
              'SECADO_ENTRADA_INVALIDA',
              'El sublote origen no tiene peso disponible para secado.',
              { details: { subloteId: sublote.id, disponibleKg: pesoEntrada } },
            ),
          );
        }

        if (pesoSalida > pesoEntrada) {
          throw new BadRequestException(
            apiError(
              'SECADO_SALIDA_MAYOR_ENTRADA',
              'La salida no puede superar el peso disponible del sublote.',
              {
                details: {
                  subloteId: sublote.id,
                  disponibleKg: pesoEntrada,
                  outputKg: pesoSalida,
                },
              },
            ),
          );
        }

        const [tipoSeco, calidadSalida] = await Promise.all([
          tx.tipoCafe.findUnique({
            where: { nombre: 'SECO' },
            select: { id: true },
          }),
          tx.calidad.findUnique({
            where: { nombre: dto.calidadSalida },
            select: { id: true, nombre: true },
          }),
        ]);

        if (!tipoSeco || !calidadSalida) {
          throw new BadRequestException(
            apiError(
              'SECADO_CATALOGO_INVALIDO',
              'No encontramos los catalogos necesarios para crear el cafe seco.',
            ),
          );
        }

        const updated = await tx.sublote.updateMany({
          where: {
            id: sublote.id,
            deletedAt: null,
            pesoActual: { gte: new Prisma.Decimal(pesoEntrada.toFixed(2)) },
          },
          data: {
            pesoActual: {
              decrement: new Prisma.Decimal(pesoEntrada.toFixed(2)),
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
          sublote.tipoCafeId,
          sublote.calidadId,
          -pesoEntrada,
        );

        const loteSalida = await this.asegurarLote(
          tx,
          organizacionId,
          tipoSeco.id,
          calidadSalida.id,
          `SECO ${calidadSalida.nombre}`,
        );
        const costoDisponible = this.calcularCostoDisponible(sublote);
        const precioKgSalida = this.redondear(costoDisponible / pesoSalida);
        const subloteSeco = await tx.sublote.create({
          data: {
            compraId: sublote.compraId,
            tipoCafeId: tipoSeco.id,
            calidadId: calidadSalida.id,
            idLote: loteSalida.id,
            pesoInicial: pesoSalida,
            pesoActual: pesoSalida,
            precioKg: precioKgSalida,
            costoTotal: this.redondear(precioKgSalida * pesoSalida),
            humedad: null,
            deviceId: sublote.deviceId,
            localId: `secado:${sublote.id}:${randomUUID()}`,
          },
        });

        await this.actualizarInventario(
          tx,
          organizacionId,
          tipoSeco.id,
          calidadSalida.id,
          pesoSalida,
        );

        await tx.inventarioMovimiento.createMany({
          data: [
            {
              organizacionId,
              usuarioId: userId,
              tipoCafeId: sublote.tipoCafeId,
              calidadId: sublote.calidadId,
              subloteId: sublote.id,
              cantidad: -pesoEntrada,
              tipoMovimiento: TipoMovimientoInventario.SECADO,
              referenciaTipo: TipoReferenciaInventario.SECADO,
              referenciaId: sublote.id,
            },
            {
              organizacionId,
              usuarioId: userId,
              tipoCafeId: tipoSeco.id,
              calidadId: calidadSalida.id,
              subloteId: subloteSeco.id,
              cantidad: pesoSalida,
              tipoMovimiento: TipoMovimientoInventario.SECADO,
              referenciaTipo: TipoReferenciaInventario.SECADO,
              referenciaId: sublote.id,
            },
          ],
        });

        return {
          subloteOrigenId: sublote.id,
          subloteSeco,
          pesoEntradaKg: pesoEntrada,
          pesoSalidaKg: pesoSalida,
          mermaKg: this.redondear(pesoEntrada - pesoSalida),
        };
      },
      { maxWait: 10000, timeout: 25000 },
    );
  }

  async transformarSecado(userId: string, dto: TransformarSecadoDto) {
    const organizacionId = await this.getOrganizacionId(userId);
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

    return this.prisma.$transaction(
      async (tx) => {
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
              pesoActual: { gte: new Prisma.Decimal(fuenteInput.pesoKg.toFixed(2)) },
            },
            data: {
              pesoActual: {
                decrement: new Prisma.Decimal(fuenteInput.pesoKg.toFixed(2)),
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
              referenciaId: dto.sessionId,
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
              referenciaId: dto.sessionId,
            },
          });
        }

        return {
          sessionId: dto.sessionId,
          totalEntradaKg: totalEntrada,
          totalSalidaKg: totalSalida,
          sublotes: sublotesSalida,
          alreadyProcessed: false,
        };
      },
      { maxWait: 10000, timeout: 25000 },
    );
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

  private async getOrganizacionId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
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

  private calcularCostoDisponible(sublote: {
    pesoInicial: Prisma.Decimal;
    pesoActual: Prisma.Decimal;
    precioKg: Prisma.Decimal;
    costoTotal: Prisma.Decimal;
  }): number {
    const pesoInicial = Number(sublote.pesoInicial);
    const costoTotal = Number(sublote.costoTotal);
    const precioKg =
      pesoInicial > 0 && costoTotal > 0
        ? costoTotal / pesoInicial
        : Number(sublote.precioKg);

    return this.redondear(precioKg * Number(sublote.pesoActual));
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
            gte: new Prisma.Decimal(Math.abs(cantidad).toFixed(2)),
          },
        },
        data: {
          pesoTotal: {
            decrement: new Prisma.Decimal(Math.abs(cantidad).toFixed(2)),
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
