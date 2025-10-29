import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/server';

describe('Settings API', () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  it('GET /settings returns default object', async () => {
    const res = await request(app).get('/settings');
    expect(res.status).toBe(200);
    expect(typeof res.body?.data).toBe('object');
  });

  it('POST /settings writes and reads back', async () => {
    const payload = { llmProvider: 'mock', LLM_API_KEY: 'abc', AMAP_API_KEY: 'def' };
    const res = await request(app).post('/settings').send(payload);
    expect(res.status).toBe(200);
    expect(res.body?.data?.llmProvider).toBe('mock');
    const getRes = await request(app).get('/settings');
    expect(getRes.status).toBe(200);
    expect(getRes.body?.data?.LLM_API_KEY).toBe('abc');
    expect(getRes.body?.data?.AMAP_API_KEY).toBe('def');
  });

  it('rejects invalid key type', async () => {
    const res = await request(app).post('/settings').send({ LLM_API_KEY: 123 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});