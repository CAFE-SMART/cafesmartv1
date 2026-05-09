import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/**
 * Normaliza la URL de base de datos para asegurar SSL en entornos como Supabase.
 */
function normalizeDatabaseUrl(value: string) {
  const trimmed = value.trim();
  const url = new URL(trimmed);

  if (!url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', 'require');
  }

  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', '5');
  }

  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', '20');
  }

  return url.toString();
}

const globalForPrisma = globalThis as typeof globalThis & {
  cafeSmartPrismaService?: PrismaService;
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly maxConnectAttempts: number;
  private readonly retryDelayMs: number;
  private connected = false;

  constructor(configService: ConfigService) {
    if (globalForPrisma.cafeSmartPrismaService) {
      return globalForPrisma.cafeSmartPrismaService;
    }

    const databaseUrl = normalizeDatabaseUrl(
      configService.getOrThrow<string>('DATABASE_URL'),
    );

    const attempts = Number(
      configService.get('PRISMA_CONNECT_MAX_ATTEMPTS') ?? '5',
    );
    const delayMs = Number(
      configService.get('PRISMA_CONNECT_RETRY_DELAY_MS') ?? '3000',
    );

    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log:
        process.env.PRISMA_QUERY_LOGS === 'true'
          ? [{ emit: 'event', level: 'query' }]
          : undefined,
    });

    this.maxConnectAttempts =
      Number.isFinite(attempts) && attempts > 0 ? attempts : 5;
    this.retryDelayMs =
      Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 3000;

    this.$use(async (params, next) => {
      const startedAt = Date.now();
      try {
        return await next(params);
      } finally {
        const durationMs = Date.now() - startedAt;
        if (durationMs >= 750) {
          this.logger.warn(
            JSON.stringify({
              event: 'prisma_slow_query',
              model: params.model,
              action: params.action,
              durationMs,
            }),
          );
        }
      }
    });

    globalForPrisma.cafeSmartPrismaService = this;
  }

  /**
   * Intenta conectar Prisma al iniciar el modulo y reintenta si el error es transitorio.
   */
  async onModuleInit() {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxConnectAttempts; attempt += 1) {
      try {
        if (this.connected) {
          return;
        }

        await this.$connect();
        this.connected = true;
        if (attempt > 1) {
          this.logger.log(
            `Conexion Prisma recuperada en el intento ${attempt}.`,
          );
        }
        return;
      } catch (error) {
        lastError = error;

        if (attempt === this.maxConnectAttempts) {
          break;
        }

        this.logger.warn(
          `No se pudo conectar a la base de datos en el intento ${attempt}/${this.maxConnectAttempts}: ${this.formatConnectionError(error)}. Reintentando en ${this.retryDelayMs} ms.`,
        );
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      }
    }

    throw lastError;
  }

  private formatConnectionError(error: unknown): string {
    if (error instanceof Error) {
      const code =
        'code' in error && typeof error.code === 'string'
          ? ` ${error.code}`
          : '';

      return `${error.name}${code}: ${error.message}`;
    }

    return String(error);
  }

  async onModuleDestroy() {
    this.connected = false;
    await this.$disconnect();
  }
}
