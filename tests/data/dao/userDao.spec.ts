import { describe, it, expect } from 'vitest';
import { openDatabase, initSchema } from '../../../src/data/db';
import { UserDAO } from '../../../src/data/dao/userDao';

describe('UserDAO', () => {
  it('creates and fetches user by email', () => {
    const db = openDatabase({ memory: true });
    initSchema(db);
    const dao = new UserDAO(db);

    const u = dao.create('alice@example.com', 'hash123');
    expect(u.id).toBeGreaterThan(0);

    const fetched = dao.findByEmail('alice@example.com');
    expect(fetched?.id).toBe(u.id);
    expect(fetched?.email).toBe('alice@example.com');
  });

  it('enforces unique email constraint', () => {
    const db = openDatabase({ memory: true });
    initSchema(db);
    const dao = new UserDAO(db);

    dao.create('bob@example.com', 'h1');
    expect(() => dao.create('bob@example.com', 'h2')).toThrow();
  });

  it('deletes user', () => {
    const db = openDatabase({ memory: true });
    initSchema(db);
    const dao = new UserDAO(db);

    const u = dao.create('carol@example.com', 'h');
    const changes = dao.delete(u.id);
    expect(changes).toBe(1);
    expect(dao.findById(u.id)).toBeNull();
  });
});