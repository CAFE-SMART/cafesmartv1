import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { defaultCodeForHttpStatus } from '../errors/api-error';

type HttpRequestLike = {
  method?: string;
  url?: string;
};

type HttpResponseLike = {
  status(status: number): {
    json(body: unknown): unknown;
  };
};

type DebugError = {
  name?: string;
  message?: string;
  code?: string;
  meta?: unknown;
  stack?: string;
};

function getDebugError(exception: unknown): DebugError {
  if (!exception || typeof exception !== 'object') {
    return { message: String(exception) };
  }

  const error = exception as {
    name?: string;
    message?: string;
    code?: string;
    meta?: unknown;
    stack?: string;
  };

  return {
    name: error.name,
    message: error.message,
    code: error.code,
    meta: error.meta,
    stack: error.stack,
  };
}

function getResponseBody(exception: HttpException) {
  const response = exception.getResponse();

  if (typeof response === 'string') {
    return { message: response };
  }

  if (response && typeof response === 'object') {
    return response as Record<string, unknown>;
  }

  return { message: exception.message };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponseLike>();
    const request = ctx.getRequest<HttpRequestLike>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const debugError = getDebugError(exception);
    const shouldExposeDebug = process.env.NODE_ENV !== 'production';

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method ?? 'HTTP'} ${request.url ?? ''} fallo con ${status}: ${
          debugError.message ?? 'Error sin mensaje'
        }`,
        debugError.stack,
      );

      if (debugError.code || debugError.meta) {
        this.logger.error(
          `Detalle del error: ${JSON.stringify({
            name: debugError.name,
            code: debugError.code,
            meta: debugError.meta,
          })}`,
        );
      }
    }

    const baseBody = isHttpException
      ? getResponseBody(exception)
      : {
          message: 'No pudimos completar la acción. Vuelve a intentarlo.',
          error: 'Internal Server Error',
        };

    const code =
      typeof baseBody.code === 'string'
        ? baseBody.code
        : defaultCodeForHttpStatus(status);

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url ?? '',
      code,
      ...baseBody,
      ...(shouldExposeDebug && status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? { debug: debugError }
        : {}),
    });
  }
}
