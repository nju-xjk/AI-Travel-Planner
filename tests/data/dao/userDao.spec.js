"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const db_1 = require("../../../src/data/db");
const userDao_1 = require("../../../src/data/dao/userDao");
(0, vitest_1.describe)('UserDAO', () => {
    (0, vitest_1.it)('creates and fetches user by email', () => {
        const db = (0, db_1.openDatabase)({ memory: true });
        (0, db_1.initSchema)(db);
        const dao = new userDao_1.UserDAO(db);
        const u = dao.create('alice@example.com', 'hash123');
        (0, vitest_1.expect)(u.id).toBeGreaterThan(0);
        const fetched = dao.findByEmail('alice@example.com');
        (0, vitest_1.expect)(fetched?.id).toBe(u.id);
        (0, vitest_1.expect)(fetched?.email).toBe('alice@example.com');
    });
    (0, vitest_1.it)('enforces unique email constraint', () => {
        const db = (0, db_1.openDatabase)({ memory: true });
        (0, db_1.initSchema)(db);
        const dao = new userDao_1.UserDAO(db);
        dao.create('bob@example.com', 'h1');
        (0, vitest_1.expect)(() => dao.create('bob@example.com', 'h2')).toThrow();
    });
    (0, vitest_1.it)('deletes user', () => {
        const db = (0, db_1.openDatabase)({ memory: true });
        (0, db_1.initSchema)(db);
        const dao = new userDao_1.UserDAO(db);
        const u = dao.create('carol@example.com', 'h');
        const changes = dao.delete(u.id);
        (0, vitest_1.expect)(changes).toBe(1);
        (0, vitest_1.expect)(dao.findById(u.id)).toBeNull();
    });
});
