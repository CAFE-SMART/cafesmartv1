import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request & { user?: { sub?: string } }, res: Response, next: NextFunction) {
    const route =
      req.route?.path || `${req.baseUrl}${req.path}` || req.originalUrl || 'unknown-route';
    const context = {
      method: req.method,
      url: req.originalUrl || req.url,
      route,
      getUserId: () => req.user?.sub,
      organizationIdByUserId: new Map<string, string>(),
    };

    runWithRequestContext(context, () => next());
  }
}
