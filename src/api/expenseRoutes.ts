import express from 'express';
import type { DB } from '../data/db';
import { ExpenseDAO } from '../data/dao/expenseDao';
import { PlanDAO } from '../data/dao/planDao';
import { createAuthGuard } from './middlewares/authGuard';

export interface CreateExpenseRouterOptions {
  jwtSecret: string;
}

export function createExpenseRouter(db: DB, options: CreateExpenseRouterOptions): express.Router {
  const router = express.Router();
  const guard = createAuthGuard(options.jwtSecret);
  const expenses = new ExpenseDAO(db);
  const plans = new PlanDAO(db);

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

  // Delete an expense by id (must belong to the current user's plan)
  router.delete('/:id', guard, (req, res) => {
    const user = (req as any).user as { id: number } | undefined;
    if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'missing user' });
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'invalid id' });
    }
    const rec = expenses.getById(id);
    if (!rec) return res.status(404).json({ code: 'NOT_FOUND', message: 'expense not found' });
    const plan = plans.getById(rec.plan_id);
    if (!plan) return res.status(404).json({ code: 'NOT_FOUND', message: 'plan not found' });
    if (plan.user_id !== user.id) return res.status(403).json({ code: 'FORBIDDEN', message: 'not your plan' });
    try {
      const deleted = expenses.delete(id);
      if (deleted <= 0) {
        return res.status(500).json({ code: 'INTERNAL', message: 'failed to delete expense' });
      }
      return res.status(200).json({ data: { id } });
    } catch (err: any) {
      return res.status(500).json({ code: 'INTERNAL', message: err?.message || 'failed to delete expense' });
    }
  });

  return router;
}