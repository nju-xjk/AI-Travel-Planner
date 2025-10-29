import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { openDatabase, initSchema } from '../../src/data/db';
import { UserDAO } from '../../src/data/dao/userDao';
import { PlanDAO } from '../../src/data/dao/planDao';
import { createApp } from '../../src/api/server';

describe('Expenses API', () => {
  const db = openDatabase({ memory: true });
  initSchema(db);
  const app = createApp({ jwtSecret: 'test-secret', db });

  it('adds expenses, lists them, and returns stats (authenticated)', async () => {
    // register & login to get token
    await request(app).post('/auth/register').send({ email: 'ex@example.com', password: 'pass' });
    const login = await request(app).post('/auth/login').send({ email: 'ex@example.com', password: 'pass' });
    expect(login.status).toBe(200);
    const token = login.body?.data?.token as string;
    expect(typeof token).toBe('string');

    // prepare a plan via DAO using same DB
    const users = new UserDAO(db);
    const plans = new PlanDAO(db);
    const user = users.findByEmail('ex@example.com')!;
    const plan = plans.create({
      user_id: user.id,
      destination: 'Hangzhou',
      start_date: '2025-03-01',
      end_date: '2025-03-02'
    });

    // add expenses
    const add1 = await request(app)
      .post('/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: plan.id, date: '2025-03-01', amount: 120, category: 'food', note: 'lunch', inputMethod: 'text' });
    expect(add1.status).toBe(201);
    const add2 = await request(app)
      .post('/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: plan.id, date: '2025-03-01', amount: 80, category: 'transport' });
    expect(add2.status).toBe(201);

    // list
    const list = await request(app)
      .get('/expenses')
      .set('Authorization', `Bearer ${token}`)
      .query({ planId: plan.id });
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body?.data)).toBe(true);
    expect(list.body?.data?.length).toBe(2);

    // stats
    const stats = await request(app)
      .get('/expenses/stats')
      .set('Authorization', `Bearer ${token}`)
      .query({ planId: plan.id });
    expect(stats.status).toBe(200);
    expect(stats.body?.data?.total).toBe(200);
    expect(stats.body?.data?.byCategory?.food).toBe(120);
    expect(stats.body?.data?.byCategory?.transport).toBe(80);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/expenses').query({ planId: 1 });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});