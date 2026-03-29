import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

function normalizeDatabaseUrl(value: string) {
  const trimmed = value.trim();
  const url = new URL(trimmed);

  if (!url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', 'require');
  }

  return url.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly maxConnectAttempts: number;
  private readonly retryDelayMs: number;

  constructor(configService: ConfigService) {
    const databaseUrl = normalizeDatabaseUrl(
      configService.getOrThrow<string>('DATABASE_URL'),
    );

    const attempts = Number(configService.get('PRISMA_CONNECT_MAX_ATTEMPTS') ?? '5');
    const delayMs = Number(configService.get('PRISMA_CONNECT_RETRY_DELAY_MS') ?? '3000');

    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });

    this.maxConnectAttempts = Number.isFinite(attempts) && attempts > 0 ? attempts : 5;
    this.retryDelayMs = Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 3000;
  }

  async onModuleInit() {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxConnectAttempts; attempt += 1) {
      try {
        await this.$connect();
        if (attempt > 1) {
          this.logger.log(`Conexion Prisma recuperada en el intento ${attempt}.`);
        }
        return;
      } catch (error) {
        lastError = error;

        if (attempt === this.maxConnectAttempts) {
          break;
        }

        this.logger.warn(
          `No se pudo conectar a la base de datos en el intento ${attempt}/${this.maxConnectAttempts}. Reintentando en ${this.retryDelayMs} ms.`,
        );
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      }
    }

    throw lastError;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
