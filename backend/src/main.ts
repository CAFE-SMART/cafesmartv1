import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
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

/**
 * Configura el backend con CORS, validacion global y formato uniforme de errores.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3000;

  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
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

  await app.listen(port);
  console.log(`Backend Cafe Smart corriendo en el puerto ${port}`);
}

void bootstrap();
