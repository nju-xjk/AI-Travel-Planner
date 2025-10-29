import { describe, it, expect } from 'vitest';
import { openDatabase, initSchema } from '../../../src/data/db';
import { UserDAO } from '../../../src/data/dao/userDao';
import { PlanDAO } from '../../../src/data/dao/planDao';
import { ExpenseDAO } from '../../../src/data/dao/expenseDao';

describe('ExpenseDAO', () => {
  it('adds, lists, and computes stats', () => {
    const db = openDatabase({ memory: true });
    initSchema(db);
    const users = new UserDAO(db);
    const plans = new PlanDAO(db);
    const expenses = new ExpenseDAO(db);

    const user = users.create('frank@example.com', 'h');
    const plan = plans.create({
      user_id: user.id,
      destination: 'Hangzhou',
      start_date: '2025-03-01',
      end_date: '2025-03-02'
    });

    expenses.add({ plan_id: plan.id, date: '2025-03-01', amount: 120, category: 'food' });
    expenses.add({ plan_id: plan.id, date: '2025-03-01', amount: 80, category: 'transport' });

    const list = expenses.listByPlan(plan.id);
    expect(list.length).toBe(2);

    const stats = expenses.statsByPlan(plan.id);
    expect(stats.total).toBe(200);
    expect(stats.byCategory['food']).toBe(120);
    expect(stats.byCategory['transport']).toBe(80);
  });

  it('rejects expense for non-existing plan', () => {
    const db = openDatabase({ memory: true });
    initSchema(db);
    const expenses = new ExpenseDAO(db);
    expect(() => expenses.add({ plan_id: 12345, date: '2025-01-01', amount: 10, category: 'other' })).toThrow();
  });
});