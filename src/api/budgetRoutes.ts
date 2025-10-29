import express from 'express';
import type { DB } from '../data/db';

export function createBudgetRouter(_db: DB): express.Router {
  const router = express.Router();

  router.post('/estimate', (req, res) => {
    const { destination, start_date, end_date, party_size = 1 } = req.body || {};
    if (typeof destination !== 'string' || typeof start_date !== 'string' || typeof end_date !== 'string') {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'destination, start_date, end_date are required' });
    }
    const ps = Number(party_size);
    if (!Number.isFinite(ps) || ps <= 0) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'party_size must be a positive number' });
    }

    const daysCount = calculateDaysCount(start_date, end_date);
    if (daysCount <= 0) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'date range invalid' });
    }

    // Very simple mock rules per person per day (CNY)
    const perDay = {
      accommodation: 300,
      food: 120,
      transport: 50,
      entertainment: 80
    };
    const breakdown = {
      accommodation: perDay.accommodation * daysCount * ps,
      food: perDay.food * daysCount * ps,
      transport: perDay.transport * daysCount * ps,
      entertainment: perDay.entertainment * daysCount * ps,
      shopping: 0,
      other: 0
    };
    const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);

    return res.status(200).json({
      data: {
        destination,
        start_date,
        end_date,
        party_size: ps,
        currency: 'CNY',
        total,
        breakdown
      }
    });
  });

  return router;
}

function calculateDaysCount(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1; // inclusive
  return Number.isFinite(days) ? days : 0;
}