import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly entries = new Map<string, RateLimitEntry>();
  private lastCleanupAt = 0;

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
      socket?: { remoteAddress?: string };
      method?: string;
      route?: { path?: string };
      originalUrl?: string;
    }>();

    const windowMs = Number(
      this.configService.get('AUTH_RATE_LIMIT_WINDOW_MS') ?? 60_000,
    );
    const maxRequests = Number(
      this.configService.get('AUTH_RATE_LIMIT_MAX_REQUESTS') ?? 15,
    );
    const now = Date.now();

    this.cleanupExpiredEntries(now);

    const routeKey = request.route?.path ?? request.originalUrl ?? 'unknown-route';
    const clientKey = `${this.getClientIp(request)}:${request.method ?? 'POST'}:${routeKey}`;
    const current = this.entries.get(clientKey);

    if (!current || current.resetAt <= now) {
      this.entries.set(clientKey, {
        count: 1,
        resetAt: now + windowMs,
      });
      return true;
    }

    if (current.count >= maxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000),
      );

      throw new HttpException(
        {
          message: `Demasiados intentos. Intenta nuevamente en ${retryAfterSeconds} segundos.`,
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
    this.entries.set(clientKey, current);
    return true;
  }

  private cleanupExpiredEntries(now: number) {
    if (now - this.lastCleanupAt < 30_000) {
      return;
    }

    for (const [key, entry] of this.entries.entries()) {
      if (entry.resetAt <= now) {
        this.entries.delete(key);
      }
    }

    this.lastCleanupAt = now;
  }

  private getClientIp(request: {
    headers?: Record<string, string | string[] | undefined>;
    ip?: string;
    socket?: { remoteAddress?: string };
  }) {
    const forwardedFor = request.headers?.['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0].trim();
    }

    if (Array.isArray(forwardedFor) && forwardedFor[0]?.trim()) {
      return forwardedFor[0].split(',')[0].trim();
    }

    return request.ip ?? request.socket?.remoteAddress ?? 'unknown-ip';
  }
}
