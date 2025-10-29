import express from 'express';
import type { DB } from '../data/db';
import { ExpenseDAO } from '../data/dao/expenseDao';
import { createAuthGuard } from './middlewares/authGuard';

export interface CreateExpenseRouterOptions {
  jwtSecret: string;
}

export function createExpenseRouter(db: DB, options: CreateExpenseRouterOptions): express.Router {
  const router = express.Router();
  const guard = createAuthGuard(options.jwtSecret);
  const expenses = new ExpenseDAO(db);

  router.post('/', guard, (req, res) => {
    const { planId, date, amount, category, note, inputMethod } = req.body || {};
    const plan_id = Number(planId);
    const amt = Number(amount);
    if (!Number.isFinite(plan_id) || plan_id <= 0 || typeof date !== 'string' || !date || !category || !['transport','accommodation','food','entertainment','shopping','other'].includes(String(category))) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'invalid expense payload' });
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'amount must be positive number' });
    }
    try {
      const rec = expenses.add({ plan_id, date, amount: amt, category: String(category), note: note ?? null, input_method: inputMethod ?? null });
      return res.status(201).json({ data: rec });
    } catch (_err) {
      return res.status(400).json({ code: 'INVALID_PLAN', message: 'plan does not exist' });
    }
  });

  router.get('/', guard, (req, res) => {
    const plan_id = Number(req.query.planId);
    if (!Number.isFinite(plan_id) || plan_id <= 0) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'planId is required' });
    }
    const list = expenses.listByPlan(plan_id);
    return res.status(200).json({ data: list });
  });

  router.get('/stats', guard, (req, res) => {
    const plan_id = Number(req.query.planId);
    if (!Number.isFinite(plan_id) || plan_id <= 0) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'planId is required' });
    }
    const stats = expenses.statsByPlan(plan_id);
    return res.status(200).json({ data: stats });
  });

  return router;
}