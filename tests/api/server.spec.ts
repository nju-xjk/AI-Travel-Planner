import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/server';

describe('API Server', () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET / returns API index', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(Array.isArray(res.body.endpoints)).toBe(true);
    const paths = res.body.endpoints.map((e: any) => e.path);
    expect(paths).toContain('/health');
    expect(paths).toContain('/auth/register');
  });

  it('auth routes are mounted', async () => {
    const reg = await request(app).post('/auth/register').send({ email: 's@example.com', password: 'aaa' });
    expect(reg.status).toBe(201);
    const login = await request(app).post('/auth/login').send({ email: 's@example.com', password: 'aaa' });
    expect(login.status).toBe(200);
    expect(typeof login.body?.data?.token).toBe('string');
  });

  it('returns 404 for unknown route', async () => {
    const res = await request(app).get('/no-such-route');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});