import express from 'express';
import type { DB } from '../data/db';
import { PlannerService } from '../services/plannerService';

export function createPlannerRouter(_db: DB): express.Router {
  const router = express.Router();
  const planner = new PlannerService();

  // Mock itinerary suggestion endpoint
  router.post('/suggest', async (req, res) => {
    try {
      const data = await planner.suggestItinerary(req.body || {});
      return res.status(200).json({ data });
    } catch (err: any) {
      if (err?.code === 'BAD_REQUEST') {
        return res.status(400).json({ code: 'BAD_REQUEST', message: err.message || 'invalid request' });
      }
      if (err?.code === 'BAD_GATEWAY') {
        return res.status(502).json({ code: 'BAD_GATEWAY', message: err.message || 'upstream invalid response' });
      }
      return res.status(500).json({ code: 'SERVER_ERROR', message: 'unexpected error' });
    }
  });

  // Alias route to align with TECH_PLAN: POST /planner/generate
  router.post('/generate', async (req, res) => {
    try {
      const data = await planner.suggestItinerary(req.body || {});
      return res.status(200).json({ data });
    } catch (err: any) {
      if (err?.code === 'BAD_REQUEST') {
        return res.status(400).json({ code: 'BAD_REQUEST', message: err.message || 'invalid request' });
      }
      if (err?.code === 'BAD_GATEWAY') {
        return res.status(502).json({ code: 'BAD_GATEWAY', message: err.message || 'upstream invalid response' });
      }
      return res.status(500).json({ code: 'SERVER_ERROR', message: 'unexpected error' });
    }
  });

  return router;
}

// calculateDaysCount is now handled in service