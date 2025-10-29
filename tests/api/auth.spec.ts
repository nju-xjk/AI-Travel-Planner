import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { openDatabase, initSchema } from '../../src/data/db';
import { createAuthRouter } from '../../src/api/authRoutes';

describe('Auth API', () => {
  let app: express.Express;

  beforeEach(() => {
    const db = openDatabase({ memory: true });
    initSchema(db);
    app = express();
    app.use(express.json());
    app.use('/auth', createAuthRouter(db, { jwtSecret: 'test-secret' }));
  });

  it('registers a new user', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'a@example.com', password: 'pass123' });
    expect(res.status).toBe(201);
    expect(res.body?.data?.email).toBe('a@example.com');
    expect(res.body?.data?.id).toBeGreaterThan(0);
  });

  it('rejects duplicate email registration', async () => {
    await request(app).post('/auth/register').send({ email: 'dup@example.com', password: 'x' });
    const res = await request(app).post('/auth/register').send({ email: 'dup@example.com', password: 'y' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EMAIL_EXISTS');
  });

  it('logs in with correct credentials and returns token', async () => {
    await request(app).post('/auth/register').send({ email: 'b@example.com', password: 'secret' });
    const res = await request(app).post('/auth/login').send({ email: 'b@example.com', password: 'secret' });
    expect(res.status).toBe(200);
    expect(typeof res.body?.data?.token).toBe('string');
    expect(res.body?.data?.token.length).toBeGreaterThan(10);
  });

  it('rejects login with wrong password', async () => {
    await request(app).post('/auth/register').send({ email: 'c@example.com', password: 'secret' });
    const res = await request(app).post('/auth/login').send({ email: 'c@example.com', password: 'bad' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('logout returns 204', async () => {
    const res = await request(app).post('/auth/logout').send({});
    expect(res.status).toBe(204);
  });
});