import express from 'express';
import type { DB } from '../data/db';

export function createPlannerRouter(_db: DB): express.Router {
  const router = express.Router();

  // Mock itinerary suggestion endpoint
  router.post('/suggest', (req, res) => {
    const { destination, start_date, end_date, preferences } = req.body || {};
    if (typeof destination !== 'string' || typeof start_date !== 'string' || typeof end_date !== 'string') {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'destination, start_date, end_date are required' });
    }

    const daysCount = calculateDaysCount(start_date, end_date);
    if (daysCount <= 0) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'date range invalid' });
    }

    const days = Array.from({ length: daysCount }, (_, i) => {
      const dayIndex = i + 1;
      const segments = [
        { title: 'Breakfast & brief', startTime: '08:00', endTime: '09:00', notes: 'Local cuisine' },
        { title: 'Sightseeing', startTime: '10:00', endTime: '12:00', location: destination },
        { title: 'Lunch', startTime: '12:30', endTime: '13:30' },
        { title: 'Afternoon activity', startTime: '14:00', endTime: '16:30', notes: preferences ? 'Tailored to preferences' : undefined },
        { title: 'Dinner', startTime: '18:30', endTime: '20:00' }
      ];
      return { day_index: dayIndex, segments };
    });

    return res.status(200).json({
      data: {
        destination,
        start_date,
        end_date,
        days
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