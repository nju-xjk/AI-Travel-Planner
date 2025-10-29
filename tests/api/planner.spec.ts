import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/server';

describe('Planner API (mock)', () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  it('POST /planner/suggest returns itinerary days', async () => {
    const res = await request(app)
      .post('/planner/suggest')
      .send({ destination: 'Shanghai', start_date: '2025-01-10', end_date: '2025-01-12', preferences: { pace: 'leisure' } });
    expect(res.status).toBe(200);
    expect(res.body?.data?.destination).toBe('Shanghai');
    expect(Array.isArray(res.body?.data?.days)).toBe(true);
    expect(res.body?.data?.days.length).toBe(3);
    const firstDay = res.body?.data?.days?.[0];
    expect(Array.isArray(firstDay.segments)).toBe(true);
    expect(firstDay.segments.length).toBeGreaterThan(0);
  });

  it('rejects invalid date range', async () => {
    const res = await request(app)
      .post('/planner/suggest')
      .send({ destination: 'Beijing', start_date: '2025-01-10', end_date: '2025-01-09' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});