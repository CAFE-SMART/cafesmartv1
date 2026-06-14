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
import { SaveSecadoDraftDto } from './dto/save-secado-draft.dto';
import { EstadoSecado } from '@prisma/client';
import { validarResultadosSecadoCriticos } from './secado-validations';
import { invalidarDashboardCache } from '../dashboard/dashboard.service';

export const SECADO_SESSION_INCLUDE = {
  tipoCafe: true,
  calidad: true,
  lote: true,
  sublotes: {
    include: {
      sublote: {
        include: {
          tipoCafe: true,
          calidad: true,
        },
      },
    },
  },
} as const;

type SecadoSessionWithRelations = Prisma.SecadoSessionGetPayload<{
  include: typeof SECADO_SESSION_INCLUDE;
}>;

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
              pesoActual: {
                gte: new Prisma.Decimal(fuenteInput.pesoKg.toFixed(2)),
              },
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
    userId: string,
    tipoCafeId: string,
    calidadId: string,
    subloteIds: string[],
    pesos?: Record<string, number>,
  ) {
    const organizacionId = await this.getOrganizacionId(userId);
    const resultado = await this.prisma.$transaction(
      async (tx) => {
        const sublotes = await tx.sublote.findMany({
          where: {
            id: { in: subloteIds },
            deletedAt: null,
            compra: {
              organizacionId,
              deletedAt: null,
            },
          },
        });

        if (sublotes.length !== subloteIds.length) {
          throw new BadRequestException(
            apiError(
              'SECADO_SUBLOTE_ORIGEN_INVALIDO',
              'Uno o varios sublotes origen no estan disponibles para secado.',
            ),
          );
        }

        let totalInputKg = 0;
        for (const sublote of sublotes) {
          const disponible = this.redondear(Number(sublote.pesoActual));
          let pesoSecar = disponible;

          if (pesos) {
            const requested = pesos[sublote.id];
            if (
              requested === undefined ||
              requested === null ||
              !Number.isFinite(requested) ||
              requested <= 0
            ) {
              throw new BadRequestException(
                apiError(
                  'SECADO_ENTRADA_INVALIDA',
                  'La cantidad de entrada del secado debe ser mayor a 0.',
                ),
              );
            }
            if (requested > disponible) {
              throw new BadRequestException(
                apiError(
                  'SECADO_ENTRADA_SUPERA_DISPONIBLE',
                  'La cantidad a secar no puede superar el peso disponible.',
                  {
                    details: {
                      subloteId: sublote.id,
                      disponibleKg: disponible,
                      solicitadoKg: requested,
                    },
                  },
                ),
              );
            }
            pesoSecar = requested;
          } else {
            if (disponible <= 0) {
              throw new BadRequestException(
                apiError(
                  'SECADO_ENTRADA_INVALIDA',
                  'El sublote origen no tiene peso disponible para secado.',
                ),
              );
            }
          }

          totalInputKg += pesoSecar;
        }

        totalInputKg = this.redondear(totalInputKg);

        for (const sublote of sublotes) {
          const pesoSecar = pesos
            ? pesos[sublote.id]!
            : Number(sublote.pesoActual);
          const updated = await tx.sublote.updateMany({
            where: {
              id: sublote.id,
              deletedAt: null,
              pesoActual: { gte: new Prisma.Decimal(pesoSecar.toFixed(2)) },
            },
            data: {
              pesoActual: {
                decrement: new Prisma.Decimal(pesoSecar.toFixed(2)),
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
            -pesoSecar,
          );
        }

        const session = await tx.secadoSession.create({
          data: {
            estado: EstadoSecado.IN_PROCESS,
            loteId: sublotes[0].idLote,
            tipoCafeId,
            calidadId,
            inputKg: totalInputKg,
            organizacionId,
          },
        });

        await tx.secadoSessionSublote.createMany({
          data: sublotes.map((sublote) => {
            const pesoAsignado = pesos
              ? pesos[sublote.id]!
              : Number(sublote.pesoActual);
            return {
              sessionId: session.id,
              subloteId: sublote.id,
              pesoAsignado,
            };
          }),
        });

        await tx.inventarioMovimiento.createMany({
          data: sublotes.map((sublote) => {
            const pesoAsignado = pesos
              ? pesos[sublote.id]!
              : Number(sublote.pesoActual);
            return {
              organizacionId,
              usuarioId: userId,
              tipoCafeId: sublote.tipoCafeId,
              calidadId: sublote.calidadId,
              subloteId: sublote.id,
              cantidad: -pesoAsignado,
              tipoMovimiento: TipoMovimientoInventario.SECADO,
              referenciaTipo: TipoReferenciaInventario.SECADO,
              referenciaId: session.id,
            };
          }),
        });

        const sessionConRelaciones = await tx.secadoSession.findUnique({
          where: { id: session.id },
          include: SECADO_SESSION_INCLUDE,
        });

        return this.mapSession(sessionConRelaciones);
      },
      { maxWait: 10000, timeout: 25000 },
    );

    invalidarDashboardCache(organizacionId);
    return resultado;
  }

  async saveSecadoDraft(
    userId: string,
    sessionId: string,
    dto: SaveSecadoDraftDto,
  ) {
    const organizacionId = await this.getOrganizacionId(userId);

    const session = await this.prisma.secadoSession.findFirst({
      where: { id: sessionId, organizacionId },
    });

    if (!session) {
      throw new BadRequestException(
        apiError(
          'SECADO_SESSION_NO_ENCONTRADA',
          'La sesion de secado no fue encontrada.',
        ),
      );
    }

    const updated = await this.prisma.secadoSession.update({
      where: { id: sessionId },
      data: {
        draftStartDate: dto.startDate ? new Date(dto.startDate) : undefined,
        draftEndDate: dto.endDate ? new Date(dto.endDate) : undefined,
        draftBuenoKg:
          dto.buenoKg !== undefined
            ? new Prisma.Decimal(dto.buenoKg)
            : undefined,
        draftRegularKg:
          dto.regularKg !== undefined
            ? new Prisma.Decimal(dto.regularKg)
            : undefined,
        draftMaloKg:
          dto.maloKg !== undefined ? new Prisma.Decimal(dto.maloKg) : undefined,
      },
      include: SECADO_SESSION_INCLUDE,
    });

    invalidarDashboardCache(organizacionId);
    return this.mapSession(updated);
  }

  async saveSecadoResults(
    userId: string,
    sessionId: string,
    dto: SecadoResultsDto,
  ) {
    const organizacionId = await this.getOrganizacionId(userId);

    const session = await this.prisma.secadoSession.findFirst({
      where: { id: sessionId, organizacionId },
    });

    if (!session) {
      throw new BadRequestException(
        apiError(
          'SECADO_SESSION_NO_ENCONTRADA',
          'La sesion de secado no fue encontrada.',
        ),
      );
    }

    try {
      validarResultadosSecadoCriticos(Number(session.inputKg), dto);
    } catch (e: unknown) {
      const err = e as { code?: string; message: string };
      throw new BadRequestException(
        apiError(err.code || 'SECADO_CANTIDAD_INVALIDA', err.message),
      );
    }

    const totalSalida =
      dto.outputBuenoKg + dto.outputRegularKg + (dto.outputMaloKg ?? 0);
    const mermaKg = Math.max(0, Number(session.inputKg) - totalSalida);
    const rendimientoPct =
      Number(session.inputKg) > 0
        ? (totalSalida / Number(session.inputKg)) * 100
        : 0;

    const updated = await this.prisma.secadoSession.update({
      where: { id: sessionId },
      data: {
        estado: EstadoSecado.READY,
        outputBuenoKg: dto.outputBuenoKg,
        outputBuenoHumedad:
          dto.outputBuenoHumedad !== undefined ? dto.outputBuenoHumedad : null,
        outputRegularKg: dto.outputRegularKg,
        outputRegularHumedad:
          dto.outputRegularHumedad !== undefined
            ? dto.outputRegularHumedad
            : null,
        outputMaloKg: dto.outputMaloKg !== undefined ? dto.outputMaloKg : 0,
        outputMaloHumedad:
          dto.outputMaloHumedad !== undefined ? dto.outputMaloHumedad : null,
        mermaKg,
        rendimientoPct,
      },
      include: SECADO_SESSION_INCLUDE,
    });

    invalidarDashboardCache(organizacionId);
    return this.mapSession(updated);
  }

  async finalizeSecado(userId: string, sessionId: string) {
    const organizacionId = await this.getOrganizacionId(userId);

    const resultado = await this.prisma.$transaction(
      async (tx) => {
        const session = await tx.secadoSession.findUnique({
          where: { id: sessionId },
          include: SECADO_SESSION_INCLUDE,
        });

        if (!session || session.organizacionId !== organizacionId) {
          throw new BadRequestException(
            apiError(
              'SECADO_SESSION_NO_ENCONTRADA',
              'La sesion de secado no fue encontrada.',
            ),
          );
        }

        if (session.estado === EstadoSecado.COMPLETED) {
          return this.mapSession(session);
        }

        if (session.estado !== EstadoSecado.READY) {
          throw new BadRequestException(
            apiError(
              'SECADO_SESSION_NO_LISTA',
              'La sesion de secado no esta lista para ser finalizada.',
            ),
          );
        }

        const [tipoSeco, calidadBueno, calidadRegular, calidadMalo] =
          await Promise.all([
            tx.tipoCafe.findUnique({
              where: { nombre: 'SECO' },
              select: { id: true },
            }),
            tx.calidad.findUnique({
              where: { nombre: 'BUENO' },
              select: { id: true },
            }),
            tx.calidad.findUnique({
              where: { nombre: 'REGULAR' },
              select: { id: true },
            }),
            tx.calidad.findUnique({
              where: { nombre: 'MALO' },
              select: { id: true },
            }),
          ]);

        if (!tipoSeco || !calidadBueno || !calidadRegular || !calidadMalo) {
          throw new BadRequestException(
            apiError(
              'SECADO_CATALOGO_INVALIDO',
              'No encontramos los catalogos necesarios para crear el cafe seco.',
            ),
          );
        }

        const sessionSublotes = session.sublotes;
        if (sessionSublotes.length === 0) {
          throw new BadRequestException(
            apiError(
              'SECADO_SESSION_SIN_SUBLOTES',
              'La sesion no tiene sublotes asociados.',
            ),
          );
        }

        const compraId = sessionSublotes[0].sublote.compraId;
        const deviceId = sessionSublotes[0].sublote.deviceId;

        let costoTotalEntrada = 0;
        let pesoTotalEntrada = 0;
        for (const s of sessionSublotes) {
          const pesoInicial = Number(s.sublote.pesoInicial);
          const costoTotalFuente = Number(s.sublote.costoTotal);
          const precioKg =
            pesoInicial > 0 && costoTotalFuente > 0
              ? costoTotalFuente / pesoInicial
              : Number(s.sublote.precioKg);

          const pesoAsignado = Number(s.pesoAsignado);
          costoTotalEntrada += precioKg * pesoAsignado;
          pesoTotalEntrada += pesoAsignado;
        }

        const precioPromedioKg =
          pesoTotalEntrada > 0
            ? this.redondear(costoTotalEntrada / pesoTotalEntrada)
            : 0;

        const outputsToCreate = [
          {
            qualityName: 'BUENO',
            qualityId: calidadBueno.id,
            peso: Number(session.outputBuenoKg),
            humedad: session.outputBuenoHumedad,
          },
          {
            qualityName: 'REGULAR',
            qualityId: calidadRegular.id,
            peso: Number(session.outputRegularKg),
            humedad: session.outputRegularHumedad,
          },
          {
            qualityName: 'MALO',
            qualityId: calidadMalo.id,
            peso: Number(session.outputMaloKg),
            humedad: session.outputMaloHumedad,
          },
        ].filter((out) => out.peso > 0);

        for (const out of outputsToCreate) {
          const loteSalida = await this.asegurarLote(
            tx,
            organizacionId,
            tipoSeco.id,
            out.qualityId,
            `SECO ${out.qualityName}`,
          );

          const subloteSeco = await tx.sublote.create({
            data: {
              compraId,
              tipoCafeId: tipoSeco.id,
              calidadId: out.qualityId,
              idLote: loteSalida.id,
              pesoInicial: out.peso,
              pesoActual: out.peso,
              precioKg: precioPromedioKg,
              costoTotal: this.redondear(precioPromedioKg * out.peso),
              humedad: out.humedad
                ? new Prisma.Decimal(Number(out.humedad).toFixed(2))
                : null,
              deviceId,
              localId: `secado:${session.id}:${out.qualityName.toLowerCase()}`,
            },
          });

          await this.actualizarInventario(
            tx,
            organizacionId,
            tipoSeco.id,
            out.qualityId,
            out.peso,
          );

          await tx.inventarioMovimiento.create({
            data: {
              organizacionId,
              usuarioId: userId,
              tipoCafeId: tipoSeco.id,
              calidadId: out.qualityId,
              subloteId: subloteSeco.id,
              cantidad: out.peso,
              tipoMovimiento: TipoMovimientoInventario.SECADO,
              referenciaTipo: TipoReferenciaInventario.SECADO,
              referenciaId: session.id,
            },
          });
        }

        const sessionActualizada = await tx.secadoSession.update({
          where: { id: sessionId },
          data: {
            estado: EstadoSecado.COMPLETED,
            completedAt: new Date(),
          },
          include: SECADO_SESSION_INCLUDE,
        });

        return this.mapSession(sessionActualizada);
      },
      { maxWait: 10000, timeout: 25000 },
    );

    invalidarDashboardCache(organizacionId);
    return resultado;
  }

  async getActiveSecado(userId: string) {
    const organizacionId = await this.getOrganizacionId(userId);

    const activeSession = await this.prisma.secadoSession.findFirst({
      where: {
        organizacionId,
        estado: { in: [EstadoSecado.IN_PROCESS, EstadoSecado.READY] },
      },
      orderBy: { startedAt: 'desc' },
      include: SECADO_SESSION_INCLUDE,
    });

    if (!activeSession) return null;
    return this.mapSession(activeSession);
  }

  async getActiveSecadoForLote(userId: string, loteId: string) {
    const organizacionId = await this.getOrganizacionId(userId);

    const activeSession = await this.prisma.secadoSession.findFirst({
      where: {
        organizacionId,
        loteId,
        estado: { in: [EstadoSecado.IN_PROCESS, EstadoSecado.READY] },
      },
      orderBy: { startedAt: 'desc' },
      include: SECADO_SESSION_INCLUDE,
    });

    if (!activeSession) return null;
    return this.mapSession(activeSession);
  }

  async getSecadoSession(userId: string, sessionId: string) {
    const organizacionId = await this.getOrganizacionId(userId);

    const session = await this.prisma.secadoSession.findFirst({
      where: {
        id: sessionId,
        organizacionId,
      },
      include: SECADO_SESSION_INCLUDE,
    });

    if (!session) return null;
    return this.mapSession(session);
  }

  private mapSession(session: SecadoSessionWithRelations) {
    if (!session) return null;
    return {
      id: session.id,
      estado: session.estado,
      loteId: session.loteId,
      loteCodigo: session.lote?.codigo || '',
      tipoCafeId: session.tipoCafeId,
      tipoCafe: session.tipoCafe.nombre,
      calidadId: session.calidadId,
      calidad: session.calidad.nombre,
      subloteIds: session.sublotes.map((s) => s.subloteId),
      inputKg: Number(session.inputKg),
      outputBuenoKg: Number(session.outputBuenoKg),
      outputBuenoHumedad: session.outputBuenoHumedad
        ? Number(session.outputBuenoHumedad)
        : null,
      outputRegularKg: Number(session.outputRegularKg),
      outputRegularHumedad: session.outputRegularHumedad
        ? Number(session.outputRegularHumedad)
        : null,
      outputMaloKg: Number(session.outputMaloKg),
      outputMaloHumedad: session.outputMaloHumedad
        ? Number(session.outputMaloHumedad)
        : null,
      mermaKg: Number(session.mermaKg),
      rendimientoPct: session.rendimientoPct
        ? Number(session.rendimientoPct)
        : null,
      startedAt: session.startedAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      completedAt: session.completedAt
        ? session.completedAt.toISOString()
        : null,
      draftStartDate: session.draftStartDate
        ? session.draftStartDate.toISOString()
        : null,
      draftEndDate: session.draftEndDate
        ? session.draftEndDate.toISOString()
        : null,
      draftBuenoKg: session.draftBuenoKg ? Number(session.draftBuenoKg) : null,
      draftRegularKg: session.draftRegularKg
        ? Number(session.draftRegularKg)
        : null,
      draftMaloKg: session.draftMaloKg ? Number(session.draftMaloKg) : null,
      sublotes: session.sublotes.map((s, index) => {
        const now = new Date();
        const targetDate = new Date(s.sublote.creadoEn);
        const diffTime = Math.max(0, now.getTime() - targetDate.getTime());
        const diasEnBodega = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const etiqueta = `${s.sublote.tipoCafe.nombre.trim().charAt(0).toLowerCase()}${s.sublote.calidad.nombre.trim().charAt(0).toLowerCase()}-${index + 1}`;
        return {
          id: s.sublote.id,
          etiqueta,
          pesoActual: Number(s.pesoAsignado),
          pesoDisponible: Number(s.sublote.pesoActual) + Number(s.pesoAsignado),
          humedad: s.sublote.humedad ? Number(s.sublote.humedad) : null,
          fechaIngreso: s.sublote.creadoEn.toISOString(),
          diasEnBodega,
          calidad: session.calidad.nombre,
        };
      }),
    };
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
