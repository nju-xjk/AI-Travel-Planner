import type { DB } from '../db';
import { ExpenseRecord } from '../../domain/models';

export interface CreateExpenseInput {
  plan_id: number;
  date: string; // ISO yyyy-mm-dd
  amount: number;
  category: string;
  note?: string | null;
  input_method?: string | null;
}

export class ExpenseDAO {
  constructor(private db: DB) {}

  add(input: CreateExpenseInput): ExpenseRecord {
    const created_at = new Date().toISOString();
    const stmt = this.db.prepare(
      `INSERT INTO expenses (plan_id, date, amount, category, note, input_method, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const info = stmt.run(
      input.plan_id,
      input.date,
      input.amount,
      input.category,
      input.note ?? null,
      input.input_method ?? null,
      created_at
    );
    const id = Number(info.lastInsertRowid);
    return this.getById(id)!;
  }

  getById(id: number): ExpenseRecord | null {
    const row = this.db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as ExpenseRecord | undefined;
    return row ?? null;
  }

  listByPlan(plan_id: number): ExpenseRecord[] {
    return this.db
      .prepare('SELECT * FROM expenses WHERE plan_id = ? ORDER BY date ASC, id ASC')
      .all(plan_id) as ExpenseRecord[];
  }

  delete(id: number): number {
    return this.db.prepare('DELETE FROM expenses WHERE id = ?').run(id).changes;
  }

  statsByPlan(plan_id: number): { total: number; byCategory: Record<string, number> } {
    const totalRow = this.db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE plan_id = ?').get(plan_id) as { total: number };
    const rows = this.db
      .prepare('SELECT category, COALESCE(SUM(amount), 0) AS sum FROM expenses WHERE plan_id = ? GROUP BY category')
      .all(plan_id) as { category: string; sum: number }[];
    const byCategory: Record<string, number> = {};
    for (const r of rows) byCategory[r.category] = r.sum;
    return { total: totalRow.total, byCategory };
  }
}