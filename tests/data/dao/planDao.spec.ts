import { describe, it, expect } from 'vitest';
import { openDatabase, initSchema } from '../../../src/data/db';
import { UserDAO } from '../../../src/data/dao/userDao';
import { PlanDAO } from '../../../src/data/dao/planDao';

describe('PlanDAO', () => {
  it('creates plan with days and retrieves it', () => {
    const db = openDatabase({ memory: true });
    initSchema(db);
    const users = new UserDAO(db);
    const plans = new PlanDAO(db);

    const user = users.create('dave@example.com', 'h');
    const plan = plans.create({
      user_id: user.id,
      destination: 'Shanghai',
      start_date: '2025-01-10',
      end_date: '2025-01-12',
      budget: 3000,
      party_size: 2,
      preferences: { hotel: '3-star' },
      days: [
        { day_index: 1, segments: [{ title: 'Bund walk' }] },
        { day_index: 2, segments: [{ title: 'Museum' }] }
      ]
    });

    expect(plan.id).toBeGreaterThan(0);
    expect(plan.days.length).toBe(2);
    expect(plan.destination).toBe('Shanghai');

    const list = plans.listByUser(user.id);
    expect(list.length).toBe(1);
  });

  it('deletes plan and cascades days', () => {
    const db = openDatabase({ memory: true });
    initSchema(db);
    const users = new UserDAO(db);
    const plans = new PlanDAO(db);
    const user = users.create('erin@example.com', 'h');
    const plan = plans.create({
      user_id: user.id,
      destination: 'Beijing',
      start_date: '2025-02-01',
      end_date: '2025-02-03',
      days: [{ day_index: 1, segments: [] }]
    });
    const changes = plans.delete(plan.id);
    expect(changes).toBe(1);
    const fetched = plans.getById(plan.id);
    expect(fetched).toBeNull();
  });

  it('rejects plan creation for non-existing user', () => {
    const db = openDatabase({ memory: true });
    initSchema(db);
    const plans = new PlanDAO(db);
    expect(() =>
      plans.create({
        user_id: 999,
        destination: 'X',
        start_date: '2025-01-01',
        end_date: '2025-01-02'
      })
    ).toThrow();
  });
});