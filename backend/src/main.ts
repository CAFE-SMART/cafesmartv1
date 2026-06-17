import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { validationCodeForField } from './common/errors/api-error';

/**
 * Aplana errores anidados de validacion para devolver un contrato simple por campo.
 */
function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): Array<{ field: string; message: string; code: string }> {
  return errors.flatMap((error) => {
    const currentPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const ownMessages = Object.values(error.constraints ?? {}).map(
      (message) => ({
        field: currentPath,
        message,
        code: validationCodeForField(currentPath),
      }),
    );
    const nestedMessages = flattenValidationErrors(
      error.children ?? [],
      currentPath,
    );
    return [...ownMessages, ...nestedMessages];
  });
}

function getDatabaseUrlKind(databaseUrl?: string) {
  if (!databaseUrl) return 'missing';

  try {
    const url = new URL(databaseUrl);
    const host = url.hostname.toLowerCase();
    if (host.includes('pooler') || host.includes('pool')) return 'pooler';
    return 'direct';
  } catch {
    return 'invalid';
  }
}

/**
 * Configura el backend con CORS, validacion global y formato uniforme de errores.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = Number(configService.get('PORT') ?? 3000);
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  const databaseUrl = configService.get<string>('DATABASE_URL');

  console.log('[CafeSmart][boot] commit:', process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || 'unknown');
  console.log('[CafeSmart][boot] build time:', process.env.BUILD_TIME || process.env.RENDER_BUILD_TIME || 'unknown');
  console.log('[CafeSmart][boot] node env:', nodeEnv);
  console.log('[CafeSmart][boot] prisma client:', Prisma.prismaVersion.client);
  console.log('[CafeSmart][boot] database url kind:', getDatabaseUrlKind(databaseUrl));
  console.log('[CafeSmart][boot] backend version:', process.env.npm_package_version || 'unknown');
  const appCorsOrigins = [
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'https://localhost',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://cafesmart-v1.onrender.com',
  ];
  const localDevOrigins = [
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://192.168.100.7:5173',
    'http://192.168.100.7:4173',
  ];
  const corsOrigins = (configService.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedCorsOrigins =
    nodeEnv === 'production'
      ? Array.from(new Set([...corsOrigins, ...appCorsOrigins]))
      : Array.from(new Set([...corsOrigins, ...appCorsOrigins, ...localDevOrigins]));

  app.enableCors({
    origin:
      allowedCorsOrigins.length > 0 ? allowedCorsOrigins : nodeEnv !== 'production',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: false,
    optionsSuccessStatus: 204,
  });
  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const issues = flattenValidationErrors(errors);
        const firstIssue = issues[0];
        const details = issues.reduce<Record<string, string[]>>(
          (acc, issue) => {
            if (!acc[issue.field]) {
              acc[issue.field] = [];
            }

            acc[issue.field].push(issue.message);
            return acc;
          },
          {},
        );

        return new BadRequestException({
          code: firstIssue?.code ?? 'VALIDATION_ERROR',
          message: firstIssue?.message ?? 'Datos invalidos.',
          field: firstIssue?.field ?? null,
          issues,
          details,
          error: 'Bad Request',
        });
      },
    }),
  );

  await app.listen(port, '0.0.0.0');
  console.log(`Backend Cafe Smart corriendo en el puerto ${port}`);
}

void bootstrap();
