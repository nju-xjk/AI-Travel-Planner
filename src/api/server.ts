import express from 'express';
import { openDatabase, initSchema } from '../data/db';
import { createAuthRouter } from './authRoutes';
import { createPlannerRouter } from './plannerRoutes';
import { createBudgetRouter } from './budgetRoutes';
import { createExpenseRouter } from './expenseRoutes';

export interface ServerOptions {
  jwtSecret: string;
}

export function createApp(opts: ServerOptions & { db?: import('../data/db').DB }) {
  const app = express();
  app.use(express.json());

  const db = opts.db ?? openDatabase({ memory: process.env.NODE_ENV === 'test' });
  initSchema(db);

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/auth', createAuthRouter(db, { jwtSecret: opts.jwtSecret }));
  app.use('/planner', createPlannerRouter(db));
  app.use('/budget', createBudgetRouter(db));
  app.use('/expenses', createExpenseRouter(db, { jwtSecret: opts.jwtSecret }));

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ code: 'NOT_FOUND', message: 'route not found' });
  });

  // error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // fall back to generic error structure
    const code = err?.code || 'SERVER_ERROR';
    const message = err?.message || 'unexpected error';
    res.status(500).json({ code, message });
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
  const app = createApp({ jwtSecret });
  app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
  });
}