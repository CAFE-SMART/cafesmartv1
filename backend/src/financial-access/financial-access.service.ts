import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';

@Injectable()
export class FinancialAccessService {
  constructor(private readonly configService: ConfigService) {}

  verify(password: string) {
    const expectedPassword = this.configService.get<string>(
      'FINANCIAL_ACCESS_PASSWORD',
    );

    if (!expectedPassword) {
      throw new ServiceUnavailableException({
        ok: false,
        message: 'Acceso financiero no configurado',
      });
    }

    if (!password) {
      return false;
    }

    const inputHash = createHash('sha256').update(password).digest();
    const expectedHash = createHash('sha256').update(expectedPassword).digest();

    return timingSafeEqual(inputHash, expectedHash);
  }
}
