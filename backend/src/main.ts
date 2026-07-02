import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
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

  const config = new DocumentBuilder()
    .setTitle('Café Smart API')
    .setDescription('Documentación interactiva de la API de Café Smart')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.use(helmet());

  const isProd = process.env.NODE_ENV === 'production';
  const frontendUrl = process.env.FRONTEND_URL;

  if (isProd && (!frontendUrl || frontendUrl === '*')) {
    throw new Error(
      'La variable de entorno FRONTEND_URL debe estar configurada en producción y no puede ser "*".',
    );
  }

  app.enableCors({
    origin: frontendUrl || '*',
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

process.on('unhandledRejection', (reason, promise) => {
  console.error(
    'Rechazo de promesa no manejado:',
    reason,
    'en la promesa:',
    promise,
  );
});

process.on('uncaughtException', (error) => {
  console.error('Excepción no capturada crítica:', error);
  process.exit(1);
});

void bootstrap();
