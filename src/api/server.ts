import express from 'express';
import path from 'path';
import { correlationId } from './middlewares/correlationId';
import { createRequestLogger } from './middlewares/requestLogger';
import { loadConfig } from '../config';
import { metricsMiddleware, createMetricsRouter } from '../observability/metrics';
import { createSettingsRouter } from './settingsRoutes';
import { createLogger } from '../observability/logger';
import { createErrorHandler } from './middlewares/errorHandler';
import { openDatabase, initSchema } from '../data/db';
import { createAuthRouter } from './authRoutes';
import { createPlannerRouter } from './plannerRoutes';
import { createBudgetRouter } from './budgetRoutes';
import { createExpenseRouter } from './expenseRoutes';
import { createSpeechRouter } from './speechRoutes';
import { createPlanRouter } from './planRoutes';

export interface ServerOptions {
  jwtSecret: string;
}

export function createApp(opts: ServerOptions & { db?: import('../data/db').DB }) {
  const app = express();
  app.use(express.json());
  // support frontend calling /api/* by stripping the prefix to backend routes
  app.use((req, _res, next) => {
    if (req.url.startsWith('/api/')) {
      req.url = req.url.replace(/^\/api/, '');
    }
    next();
  });
  // request correlation id & logging (controlled via env)
  const env = process.env.NODE_ENV || 'development';
  const logLevel = (process.env.LOG_LEVEL || (env === 'development' ? 'debug' : 'info')) as any;
  const requestLogEnv = process.env.REQUEST_LOG;
  const requestLog = typeof requestLogEnv === 'string' ? requestLogEnv.toLowerCase() !== 'false' : env !== 'test';
  const logger = createLogger(logLevel);
  if (requestLog) {
    app.use(correlationId());
    app.use(createRequestLogger(logLevel));
  }
  // metrics middleware
  app.use(metricsMiddleware());

  const db = opts.db ?? openDatabase({ memory: process.env.NODE_ENV === 'test' });
  initSchema(db);

  app.get('/health', (_req, res) => {
    try { logger.info('healthcheck'); } catch {}
    res.status(200).json({ status: 'ok' });
  });

  // API index for root path
  app.get('/', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      message: 'AI Travel Planner API',
      endpoints: [
        { method: 'GET', path: '/health' },
        { method: 'POST', path: '/auth/register' },
        { method: 'POST', path: '/auth/login' },
        { method: 'POST', path: '/auth/logout' },
        { method: 'POST', path: '/planner/suggest' },
        { method: 'POST', path: '/planner/generate' },
        { method: 'POST', path: '/budget/estimate' },
        { method: 'POST', path: '/expenses' },
        { method: 'GET', path: '/expenses' },
        { method: 'GET', path: '/expenses/stats' },
        { method: 'POST', path: '/speech/recognize' }
      ]
    });
  });

  app.use('/auth', createAuthRouter(db, { jwtSecret: opts.jwtSecret }));
  app.use('/planner', createPlannerRouter(db));
  app.use('/budget', createBudgetRouter(db));
  app.use('/expenses', createExpenseRouter(db, { jwtSecret: opts.jwtSecret }));
  app.use('/plans', createPlanRouter(db, { jwtSecret: opts.jwtSecret }));
  app.use('/settings', createSettingsRouter());
  app.use('/metrics', createMetricsRouter());
  app.use('/speech', createSpeechRouter());

  // serve built frontend assets (Vite build output under /dist)
  const distDir = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distDir));
  // SPA fallback: return index.html for non-API GET requests
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    try {
      res.sendFile(path.join(distDir, 'index.html'));
    } catch {
      next();
    }
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ code: 'NOT_FOUND', message: 'route not found' });
  });

  // unified error handler
  app.use(createErrorHandler(logger));

  return app;
}

if (require.main === module) {
  const cfg = loadConfig();
  const app = createApp({ jwtSecret: cfg.jwtSecret });
  app.listen(cfg.port, () => {
    console.log(`API server listening on http://localhost:${cfg.port}`);
  });
}