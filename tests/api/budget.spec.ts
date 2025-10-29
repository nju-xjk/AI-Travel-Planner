import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/server';

describe('Budget API (mock)', () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  it('POST /budget/estimate returns total and breakdown', async () => {
    const res = await request(app)
      .post('/budget/estimate')
      .send({ destination: 'Hangzhou', start_date: '2025-03-01', end_date: '2025-03-02', party_size: 2 });
    expect(res.status).toBe(200);
    expect(res.body?.data?.currency).toBe('CNY');
    expect(typeof res.body?.data?.total).toBe('number');
    expect(res.body?.data?.total).toBeGreaterThan(0);
    const breakdown = res.body?.data?.breakdown;
    expect(breakdown.accommodation).toBeGreaterThan(0);
    expect(breakdown.food).toBeGreaterThan(0);
    expect(breakdown.transport).toBeGreaterThan(0);
    expect(breakdown.entertainment).toBeGreaterThan(0);
  });

  it('rejects invalid party_size', async () => {
    const res = await request(app)
      .post('/budget/estimate')
      .send({ destination: 'X', start_date: '2025-01-01', end_date: '2025-01-02', party_size: 0 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});