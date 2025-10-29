import express from 'express';
import type { DB } from '../data/db';
import { BudgetService } from '../services/budgetService';
import { validateItinerary } from '../schemas/itinerary';

export function createBudgetRouter(_db: DB): express.Router {
  const router = express.Router();
  const svc = new BudgetService();

  router.post('/estimate', (req, res) => {
    const { destination, start_date, end_date, party_size = 1, itinerary } = req.body || {};
    try {
      if (itinerary) {
        const { valid, errors } = validateItinerary(itinerary);
        if (!valid) {
          return res.status(400).json({ code: 'BAD_REQUEST', message: (errors && errors.join('; ')) || 'invalid itinerary payload' });
        }
      }
      const estimate = svc.estimateBudget({ destination, start_date, end_date, party_size, itinerary });
      return res.status(200).json({ data: estimate });
    } catch (err: any) {
      if (err?.code === 'BAD_REQUEST') {
        return res.status(400).json({ code: 'BAD_REQUEST', message: err.message || 'invalid request' });
      }
      return res.status(500).json({ code: 'SERVER_ERROR', message: 'unexpected error' });
    }
  });

  return router;
}

// days count calculation is handled inside BudgetService