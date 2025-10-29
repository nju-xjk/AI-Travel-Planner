import type { DB } from '../db';
import { TravelPlan, TravelPlanBasic, PlanDay } from '../../domain/models';

export interface CreatePlanInput {
  user_id: number;
  destination: string;
  start_date: string;
  end_date: string;
  budget?: number | null;
  party_size?: number | null;
  preferences?: Record<string, unknown> | null;
  days?: { day_index: number; segments: unknown[] }[];
}

export class PlanDAO {
  constructor(private db: DB) {}

  create(input: CreatePlanInput): TravelPlan {
    const created_at = new Date().toISOString();
    const preferences_json = input.preferences ? JSON.stringify(input.preferences) : null;

    const stmt = this.db.prepare(
      `INSERT INTO plans (user_id, destination, start_date, end_date, budget, party_size, preferences_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const info = stmt.run(
      input.user_id,
      input.destination,
      input.start_date,
      input.end_date,
      input.budget ?? null,
      input.party_size ?? null,
      preferences_json,
      created_at
    );
    const plan_id = Number(info.lastInsertRowid);

    if (input.days && input.days.length > 0) {
      const dayStmt = this.db.prepare(
        'INSERT INTO plan_days (plan_id, day_index, segments_json) VALUES (?, ?, ?)'
      );
      const insertMany = this.db.transaction((days: { day_index: number; segments: unknown[] }[]) => {
        for (const d of days) {
          dayStmt.run(plan_id, d.day_index, JSON.stringify(d.segments ?? []));
        }
      });
      insertMany(input.days);
    }

    return this.getById(plan_id)!;
  }

  getById(id: number): TravelPlan | null {
    const plan = this.db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as TravelPlanBasic | undefined;
    if (!plan) return null;
    const days = this.db
      .prepare('SELECT * FROM plan_days WHERE plan_id = ? ORDER BY day_index ASC, id ASC')
      .all(id) as PlanDay[];
    return { ...plan, days };
  }

  listByUser(user_id: number): TravelPlanBasic[] {
    return this.db
      .prepare('SELECT * FROM plans WHERE user_id = ? ORDER BY created_at DESC, id DESC')
      .all(user_id) as TravelPlanBasic[];
  }

  updateBasic(id: number, fields: Partial<Omit<TravelPlanBasic, 'id' | 'user_id' | 'created_at'>> & { preferences?: Record<string, unknown> | null }): number {
    const current = this.db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as TravelPlanBasic | undefined;
    if (!current) return 0;
    const destination = fields['destination'] ?? current.destination;
    const start_date = fields['start_date'] ?? current.start_date;
    const end_date = fields['end_date'] ?? current.end_date;
    const budget = fields['budget'] ?? current.budget ?? null;
    const party_size = fields['party_size'] ?? current.party_size ?? null;
    const preferences_json = fields['preferences'] ? JSON.stringify(fields['preferences']) : current.preferences_json ?? null;
    const info = this.db
      .prepare(
        `UPDATE plans SET destination = ?, start_date = ?, end_date = ?, budget = ?, party_size = ?, preferences_json = ? WHERE id = ?`
      )
      .run(destination, start_date, end_date, budget, party_size, preferences_json, id);
    return info.changes;
  }

  replaceDays(plan_id: number, days: { day_index: number; segments: unknown[] }[]): number {
    const delInfo = this.db.prepare('DELETE FROM plan_days WHERE plan_id = ?').run(plan_id);
    const dayStmt = this.db.prepare('INSERT INTO plan_days (plan_id, day_index, segments_json) VALUES (?, ?, ?)');
    const insertMany = this.db.transaction((ds: { day_index: number; segments: unknown[] }[]) => {
      for (const d of ds) {
        dayStmt.run(plan_id, d.day_index, JSON.stringify(d.segments ?? []));
      }
    });
    insertMany(days);
    return delInfo.changes + days.length;
  }

  delete(id: number): number {
    const info = this.db.prepare('DELETE FROM plans WHERE id = ?').run(id);
    return info.changes;
  }
}