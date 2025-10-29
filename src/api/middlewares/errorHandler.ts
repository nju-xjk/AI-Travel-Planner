import type express from 'express';

interface ErrorShape {
  code?: string;
  message?: string;
  status?: number;
}

function mapStatus(code?: string): number {
  switch (code) {
    case 'BAD_REQUEST':
    case 'INVALID_PLAN':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'BAD_GATEWAY':
      return 502;
    default:
      return 500;
  }
}

export function createErrorHandler(logger: { error: (msg: string, meta?: any) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: ErrorShape, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const code = err?.code || 'SERVER_ERROR';
    const message = err?.message || 'unexpected error';
    const status = typeof err?.status === 'number' ? err.status : mapStatus(code);
    try {
      logger.error('error', { code, message, id: (req as any).id });
    } catch {}
    res.status(status).json({ code, message });
  };
}