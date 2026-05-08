import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { apiError } from '../common/errors/api-error';
import { CreateVentaDto } from './dto/crear-venta.dto';
import {
  buscarVentaActivaPorSync,
  buscarVentaPorSync,
  ClienteNoEncontradoError,
  construirRespuestaDesdeVentaExistente,
  CrearVentaResultado,
  InventarioInconsistenteError,
  InventarioNoEncontradoError,
  procesarVenta,
  StockInsuficienteError,
  SubloteNoEncontradoError,
  VentaConSublotesDuplicadosError,
  VentaEliminadaError,
  VentaValidacionCriticaError,
} from './procesar-venta';

@Injectable()
export class VentasService {
  constructor(private readonly prisma: PrismaService) {}

  async crearVenta(
    input: CreateVentaDto,
    userId: string,
  ): Promise<CrearVentaResultado>;
  async crearVenta(
    input: CreateVentaDto,
    userId: string,
    organizacionId: string,
  ): Promise<CrearVentaResultado>;
  async crearVenta(
    input: CreateVentaDto,
    userId: string,
    organizacionId?: string,
  ): Promise<CrearVentaResultado> {
    const organizacionIdFinal = await this.obtenerOrganizacionId(
      userId,
      organizacionId,
    );

    try {
      return await procesarVenta(
        {
          ...input,
          organizacionId: organizacionIdFinal,
          userId,
        },
        this.prisma,
      );
    } catch (error) {
      if (error instanceof VentaValidacionCriticaError) {
        throw new BadRequestException(
          apiError(error.code, error.message, { details: error.details }),
        );
      }

      if (error instanceof VentaConSublotesDuplicadosError) {
        throw new BadRequestException({
          code: 'VENTA_SUBLOTES_DUPLICADOS',
          message:
            'No es posible registrar la venta porque un mismo sublote aparece repetido.',
          details: {
            subloteIds: error.subloteIds,
          },
        });
      }

      if (error instanceof SubloteNoEncontradoError) {
        throw new BadRequestException({
          code: 'VENTA_SUBLOTE_INVALIDO',
          message:
            'Uno o varios sublotes ya no estan disponibles para la venta. Revise el inventario y vuelva a intentarlo.',
          details: {
            subloteIds: error.subloteIds,
          },
        });
      }

      if (error instanceof ClienteNoEncontradoError) {
        throw new BadRequestException({
          code: 'VENTA_CLIENTE_INVALIDO',
          message:
            'El cliente seleccionado no esta disponible para esta organizacion. Revise el dato e intente de nuevo.',
          details: {
            clienteId: error.clienteId,
          },
        });
      }

      if (error instanceof StockInsuficienteError) {
        throw new ConflictException({
          code: 'INSUFFICIENT_STOCK',
          message: 'No hay suficiente inventario para realizar la venta',
          details: error.detalles.map((detalle) => ({
            subloteId: detalle.subloteId,
            disponibleKg: detalle.disponibleKg,
            solicitadoKg: detalle.solicitadoKg,
          })),
        });
      }

      if (error instanceof InventarioNoEncontradoError) {
        throw new ConflictException({
          code: 'INSUFFICIENT_STOCK',
          message: 'No hay suficiente inventario para realizar la venta',
          details: error.movimientos,
        });
      }

      if (error instanceof InventarioInconsistenteError) {
        throw new ConflictException({
          code: 'INSUFFICIENT_STOCK',
          message: 'No hay suficiente inventario para realizar la venta',
          details: error.movimientos,
        });
      }

      if (error instanceof VentaEliminadaError) {
        throw new ConflictException({
          code: 'VENTA_SYNC_ELIMINADA',
          message:
            'Esta venta ya habia sido registrada y luego anulada. Para evitar duplicados, enviela con un nuevo identificador.',
        });
      }

      if (this.esErrorUnico(error)) {
        const ventaExistente = await buscarVentaActivaPorSync(
          this.prisma,
          input.deviceId,
          input.localId,
        );

        if (ventaExistente) {
          return construirRespuestaDesdeVentaExistente(ventaExistente);
        }

        const ventaPorSync = await buscarVentaPorSync(
          this.prisma,
          input.deviceId,
          input.localId,
        );

        if (ventaPorSync?.deletedAt !== null) {
          throw new ConflictException({
            code: 'VENTA_SYNC_ELIMINADA',
            message:
              'Esta venta ya habia sido registrada y luego anulada. Para evitar duplicados, enviela con un nuevo identificador.',
          });
        }

        throw new ConflictException({
          code: 'VENTA_SYNC_CONFLICT',
          message:
            'Ya recibimos una venta con ese identificador de sincronizacion. Revise si el equipo ya la envio antes.',
        });
      }

      throw error;
    }
  }

  /**
   * Resuelve la organizacion del usuario autenticado y evita ventas cruzadas entre organizaciones.
   */
  private async obtenerOrganizacionId(
    userId: string,
    organizacionId?: string,
  ): Promise<string> {
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizacionId: true },
    });

    if (!usuario) {
      throw new UnauthorizedException({
        code: 'AUTH_USER_NOT_FOUND',
        message: 'No encontramos el usuario que intenta registrar la venta.',
      });
    }

    if (!usuario.organizacionId) {
      throw new BadRequestException({
        code: 'ORGANIZACION_REQUERIDA',
        message:
          'El usuario no tiene una organizacion asociada para registrar ventas.',
      });
    }

    if (organizacionId && usuario.organizacionId !== organizacionId) {
      throw new UnauthorizedException({
        code: 'AUTH_ORGANIZACION_INVALIDA',
        message:
          'El usuario no pertenece a la organizacion indicada para esta venta.',
      });
    }

    return usuario.organizacionId;
  }

  /**
   * Identifica errores de unicidad emitidos por Prisma para resolver reintentos idempotentes.
   */
  private esErrorUnico(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
