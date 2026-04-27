import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecadoResultsDto } from './dto/secado-results.dto';

@Injectable()
export class SecadoService {
  constructor(private readonly prisma: PrismaService) {}

  async startSecado(
    _userId: string,
    _tipoCafeId: string,
    _calidadId: string,
    _subloteIds: string[],
    _loteId?: string,
  ) {
    throw new BadRequestException(
      'El modulo de secado no esta disponible en la base de datos actual.',
    );
  }

  async saveSecadoResults(
    _userId: string,
    _sessionId: string,
    _dto: SecadoResultsDto,
  ) {
    throw new BadRequestException(
      'El modulo de secado no esta disponible en la base de datos actual.',
    );
  }

  async finalizeSecado(_userId: string, _sessionId: string) {
    throw new BadRequestException(
      'El modulo de secado no esta disponible en la base de datos actual.',
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
      throw new BadRequestException('Usuario sin organización');
    }

    return user.organizacionId;
  }
}
