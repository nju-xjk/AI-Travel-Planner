import Database from 'better-sqlite3';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export type DB = BetterSqlite3Database;

export interface OpenOptions {
  memory?: boolean;
  filePath?: string;
}

export function openDatabase(options: OpenOptions = {}): DB {
  const { memory = false, filePath = path.join('data', 'app.db') } = options;
  if (!memory) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new Database(memory ? ':memory:' : filePath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  return db;
}

export function initSchema(db: DB): void {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      preferences_text TEXT
    );

    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      origin TEXT,
      destination TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      budget REAL,
      party_size INTEGER,
      preferences_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plan_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      day_index INTEGER NOT NULL,
      segments_json TEXT NOT NULL,
      FOREIGN KEY(plan_id) REFERENCES plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      note TEXT,
      input_method TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(plan_id) REFERENCES plans(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
    CREATE INDEX IF NOT EXISTS idx_plan_days_plan_id ON plan_days(plan_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_plan_id ON expenses(plan_id);
  `;
  db.exec(sql);

  // 迁移：确保旧数据库上存在 origin 列
  try {
    const cols = db.prepare('PRAGMA table_info(plans)').all() as Array<{ name: string }>;
    const hasOrigin = cols.some(c => c.name === 'origin');
    if (!hasOrigin) {
      db.exec('ALTER TABLE plans ADD COLUMN origin TEXT');
    }
  } catch {
    // ignore migration errors
  }

  // 迁移：为 users 表添加 preferences_text 列（用于存储用户偏好）
  try {
    const userCols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    const hasPrefText = userCols.some(c => c.name === 'preferences_text');
    if (!hasPrefText) {
      db.exec('ALTER TABLE users ADD COLUMN preferences_text TEXT');
    }
  } catch {
    // ignore migration errors
  }
}