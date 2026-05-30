import { IsEnum } from 'class-validator';
import { EstadoPago } from '@prisma/client';

export class ActualizarEstadoGastoDto {
  @IsEnum(EstadoPago, {
    message: 'estadoPago debe ser PAGADO o PENDIENTE',
  })
  estadoPago: EstadoPago;
}
