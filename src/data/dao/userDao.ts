import type { DB } from '../db';
import { User } from '../../domain/models';

export class UserDAO {
  constructor(private db: DB) {}

  create(email: string, password_hash: string): User {
    const created_at = new Date().toISOString();
    const stmt = this.db.prepare(
      'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)'
    );
    const info = stmt.run(email, password_hash, created_at);
    return { id: Number(info.lastInsertRowid), email, password_hash, created_at };
  }

  findById(id: number): User | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
    return row ?? null;
  }

  findByEmail(email: string): User | null {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
    return row ?? null;
  }

  list(): User[] {
    return this.db.prepare('SELECT * FROM users ORDER BY id ASC').all() as User[];
  }

  delete(id: number): number {
    const info = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return info.changes;
  }
}