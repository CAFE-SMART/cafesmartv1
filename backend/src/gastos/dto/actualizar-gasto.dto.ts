import { PartialType } from '@nestjs/mapped-types';
import { CrearGastoDto } from './crear-gasto.dto';

export class ActualizarGastoDto extends PartialType(CrearGastoDto) {}
