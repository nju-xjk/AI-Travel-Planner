import express from 'express';
import type { DB } from '../data/db';
import { PlannerService } from '../services/plannerService';

export function createPlannerRouter(_db: DB): express.Router {
  const router = express.Router();
  const planner = new PlannerService();

  // Mock itinerary suggestion endpoint
  router.post('/suggest', async (req, res, next) => {
    try {
      const data = await planner.suggestItinerary(req.body || {});
      return res.status(200).json({ data });
    } catch (err: any) {
      next(err);
    }
  });

  // Alias route to align with TECH_PLAN: POST /planner/generate
  router.post('/generate', async (req, res, next) => {
    try {
      const data = await planner.suggestItinerary(req.body || {});
      return res.status(200).json({ data });
    } catch (err: any) {
      next(err);
    }
  });

  return router;
}

// calculateDaysCount is now handled in service