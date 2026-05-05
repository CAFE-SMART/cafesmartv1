import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Aplana errores anidados de validacion para devolver un contrato simple por campo.
 */
function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): Array<{ field: string; message: string }> {
  return errors.flatMap((error) => {
    const currentPath = parentPath ? `${parentPath}.${error.property}` : error.property;
    const ownMessages = Object.values(error.constraints ?? {}).map((message) => ({
      field: currentPath,
      message,
    }));
    const nestedMessages = flattenValidationErrors(error.children ?? [], currentPath);
    return [...ownMessages, ...nestedMessages];
  });
}

/**
 * Configura el backend con CORS, validacion global y formato uniforme de errores.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = Number(configService.get('PORT') ?? 3000);
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  const corsOrigins = (configService.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : nodeEnv !== 'production',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const issues = flattenValidationErrors(errors);
        const firstIssue = issues[0];
        const details = issues.reduce<Record<string, string[]>>((acc, issue) => {
          if (!acc[issue.field]) {
            acc[issue.field] = [];
          }

          acc[issue.field].push(issue.message);
          return acc;
        }, {});

        return new BadRequestException({
          message: firstIssue?.message ?? 'Datos invalidos.',
          field: firstIssue?.field ?? null,
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
