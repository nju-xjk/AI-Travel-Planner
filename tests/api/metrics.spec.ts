import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/server';

describe('Metrics API', () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  it('collects requests and exposes /metrics', async () => {
    await request(app).get('/health');
    await request(app).get('/');
    await request(app).post('/planner/generate').send({ destination: 'Hangzhou', start_date: '2025-05-01', end_date: '2025-05-02' });
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    const data = res.body?.data;
    expect(typeof data?.total_requests).toBe('number');
    expect(data.total_requests).toBeGreaterThanOrEqual(3);
    expect(typeof data?.avg_total_duration_ms).toBe('number');
    expect(data?.planner).toBeDefined();
    expect(typeof data?.planner?.success).toBe('number');
    expect(data?.planner?.success).toBeGreaterThanOrEqual(1);
  });
});