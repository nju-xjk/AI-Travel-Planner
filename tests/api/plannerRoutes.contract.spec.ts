import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/server';

describe('Planner API contract: /planner/generate', () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  it('POST /planner/generate returns itinerary aligned with /planner/suggest', async () => {
    const payload = { destination: 'Hangzhou', start_date: '2025-03-01', end_date: '2025-03-03', preferences: { pace: 'leisure' } };
    const resGen = await request(app).post('/planner/generate').send(payload);
    expect(resGen.status).toBe(200);
    expect(resGen.body?.data?.destination).toBe('Hangzhou');
    expect(Array.isArray(resGen.body?.data?.days)).toBe(true);
    expect(resGen.body?.data?.days.length).toBe(3);

    // Compare with suggest for parity
    const resSuggest = await request(app).post('/planner/suggest').send(payload);
    expect(resSuggest.status).toBe(200);
    expect(resSuggest.body?.data?.days.length).toBe(resGen.body?.data?.days.length);
  });

  it('rejects invalid date range with 400', async () => {
    const res = await request(app)
      .post('/planner/generate')
      .send({ destination: 'Hangzhou', start_date: '2025-03-03', end_date: '2025-03-01' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});