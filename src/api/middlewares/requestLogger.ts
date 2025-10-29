import express from 'express';
import { createLogger } from '../../observability/logger';
import type { LogLevel } from '../../config';
import type { AuthedRequest } from './authGuard';

export function createRequestLogger(level: LogLevel = 'info'): express.RequestHandler {
  const logger = createLogger(level);
  return (req: AuthedRequest, res: express.Response, next: express.NextFunction) => {
    const start = process.hrtime.bigint();
    const id = (req as any).id as string | undefined;
    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const durationMs = Number((end - start) / BigInt(1_000_000));
      logger.info('request', {
        id,
        method: req.method,
        url: req.originalUrl || req.url,
        status: res.statusCode,
        duration_ms: durationMs,
        user_id: req.user?.id ?? null,
      });
    });
    next();
  };
}