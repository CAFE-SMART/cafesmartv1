import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

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
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const debugError = getDebugError(exception);
    const shouldExposeDebug = process.env.NODE_ENV !== 'production';

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} fallo con ${status}: ${
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
          message: 'Error interno del servidor. Revisa la terminal del backend.',
          error: 'Internal Server Error',
        };

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...baseBody,
      ...(shouldExposeDebug && status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? { debug: debugError }
        : {}),
    });
  }
}
