import express from 'express';
import type { DB } from '../data/db';
import { PlanDAO } from '../data/dao/planDao';
import { UserDAO } from '../data/dao/userDao';
import { createAuthGuard } from './middlewares/authGuard';
import { validateItinerary } from '../schemas/itinerary';

export function createPlanRouter(db: DB, opts: { jwtSecret: string }): express.Router {
  const router = express.Router();
  const guard = createAuthGuard(opts.jwtSecret);
  const plans = new PlanDAO(db);
  const users = new UserDAO(db);

  // Create a plan from generated itinerary
  router.post('/', guard, (req, res) => {
    const user = (req as any).user as { id: number } | undefined;
    if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'missing user' });
    const it = req.body?.itinerary || req.body;
    const { valid, errors } = validateItinerary(it);
    if (!valid) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: errors?.join('; ') || 'invalid itinerary' });
    }
    // Ensure user exists
    const existing = users.findById(user.id);
    if (!existing) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'user not found' });

    try {
      const created = plans.create({
        user_id: user.id,
        origin: it.origin,
        destination: it.destination,
        start_date: it.start_date,
        end_date: it.end_date,
        budget: it.budget ?? null,
        party_size: it.party_size ?? null,
        preferences: null,
        days: (it.days || []).map((d: any) => ({ day_index: d.day_index, segments: d.segments || [] }))
      });
      const data = {
        id: created.id,
        origin: created.origin ?? undefined,
        destination: created.destination,
        start_date: created.start_date,
        end_date: created.end_date,
        budget: created.budget ?? undefined,
        party_size: created.party_size ?? undefined,
        created_at: created.created_at,
      };
      return res.status(201).json({ data });
    } catch (err: any) {
      return res.status(500).json({ code: 'INTERNAL', message: err?.message || 'failed to create plan' });
    }
  });

  // List my plans (basic info only)
  router.get('/my', guard, (req, res) => {
    const user = (req as any).user as { id: number } | undefined;
    if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'missing user' });
    const list = plans.listByUser(user.id).map(p => ({
      id: p.id,
      origin: p.origin ?? undefined,
      destination: p.destination,
      start_date: p.start_date,
      end_date: p.end_date,
      budget: p.budget ?? undefined,
      party_size: p.party_size ?? undefined,
      created_at: p.created_at,
    }));
    return res.status(200).json({ data: list });
  });

  // Get plan details by id (must be owned by user)
  router.get('/:id', guard, (req, res) => {
    const user = (req as any).user as { id: number } | undefined;
    if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'missing user' });
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: 'invalid id' });
    const plan = plans.getById(id);
    if (!plan) return res.status(404).json({ code: 'NOT_FOUND', message: 'plan not found' });
    if (plan.user_id !== user.id) return res.status(403).json({ code: 'FORBIDDEN', message: 'not your plan' });
    const days = (plan.days || []).map(d => ({
      day_index: d.day_index,
      segments: (() => { try { return JSON.parse(d.segments_json || '[]'); } catch { return []; } })()
    }));
    const data = {
      id: plan.id,
      origin: plan.origin ?? undefined,
      destination: plan.destination,
      start_date: plan.start_date,
      end_date: plan.end_date,
      budget: plan.budget ?? undefined,
      party_size: plan.party_size ?? undefined,
      days,
      created_at: plan.created_at,
    };
    return res.status(200).json({ data });
  });

  // Delete a plan by id (must be owned by user)
  router.delete('/:id', guard, (req, res) => {
    const user = (req as any).user as { id: number } | undefined;
    if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'missing user' });
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: 'invalid id' });
    const plan = plans.getById(id);
    if (!plan) return res.status(404).json({ code: 'NOT_FOUND', message: 'plan not found' });
    if (plan.user_id !== user.id) return res.status(403).json({ code: 'FORBIDDEN', message: 'not your plan' });
    try {
      const deleted = plans.delete(id);
      if (deleted <= 0) {
        return res.status(500).json({ code: 'INTERNAL', message: 'failed to delete plan' });
      }
      return res.status(200).json({ data: { id } });
    } catch (err: any) {
      return res.status(500).json({ code: 'INTERNAL', message: err?.message || 'failed to delete plan' });
    }
  });

  // Get a single day of a plan (must be owned by user)
  router.get('/:id/day/:dayIndex', guard, (req, res) => {
    const user = (req as any).user as { id: number } | undefined;
    if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'missing user' });
    const id = Number(req.params.id);
    const dayIndex = Number(req.params.dayIndex);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: 'invalid id' });
    if (!Number.isFinite(dayIndex) || dayIndex <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: 'invalid dayIndex' });
    const plan = plans.getById(id);
    if (!plan) return res.status(404).json({ code: 'NOT_FOUND', message: 'plan not found' });
    if (plan.user_id !== user.id) return res.status(403).json({ code: 'FORBIDDEN', message: 'not your plan' });
    const day = (plan.days || []).find(d => d.day_index === dayIndex);
    if (!day) return res.status(404).json({ code: 'NOT_FOUND', message: 'day not found' });
    const segments = (() => { try { return JSON.parse(day.segments_json || '[]'); } catch { return []; } })();
    const data = {
      plan_id: plan.id,
      origin: plan.origin ?? undefined,
      destination: plan.destination,
      start_date: plan.start_date,
      end_date: plan.end_date,
      day_index: dayIndex,
      segments,
    };
    return res.status(200).json({ data });
  });

  return router;
}