import express from 'express';

export interface Metrics {
  total_requests: number;
  total_errors: number;
  routes: Record<string, { count: number; total_duration_ms: number }>;
  planner: {
    total_generations: number;
    success: number;
    timeout: number;
    invalid: number;
    failed: number;
    retries: number;
  };
}

export const metrics: Metrics = {
  total_requests: 0,
  total_errors: 0,
  routes: {},
  planner: {
    total_generations: 0,
    success: 0,
    timeout: 0,
    invalid: 0,
    failed: 0,
    retries: 0,
  },
};

export function metricsMiddleware(): express.RequestHandler {
  return (req, res, next) => {
    metrics.total_requests += 1;
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const durMs = Number((end - start) / BigInt(1_000_000));
      const key = req.route?.path ? `${req.method} ${req.baseUrl}${req.route.path}` : `${req.method} ${req.originalUrl || req.url}`;
      const entry = metrics.routes[key] || { count: 0, total_duration_ms: 0 };
      entry.count += 1;
      entry.total_duration_ms += durMs;
      metrics.routes[key] = entry;
      if (res.statusCode >= 500) metrics.total_errors += 1;
    });
    next();
  };
}

export function createMetricsRouter(): express.Router {
  const router = express.Router();
  router.get('/', (_req, res) => {
    const avg_total_duration_ms = (() => {
      let total = 0;
      let count = 0;
      for (const k of Object.keys(metrics.routes)) {
        const r = metrics.routes[k];
        total += r.total_duration_ms;
        count += r.count;
      }
      return count > 0 ? Math.round(total / count) : 0;
    })();
    res.status(200).json({ data: { ...metrics, avg_total_duration_ms } });
  });
  return router;
}