"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const db_1 = require("../../../src/data/db");
const userDao_1 = require("../../../src/data/dao/userDao");
const planDao_1 = require("../../../src/data/dao/planDao");
(0, vitest_1.describe)('PlanDAO', () => {
    (0, vitest_1.it)('creates plan with days and retrieves it', () => {
        const db = (0, db_1.openDatabase)({ memory: true });
        (0, db_1.initSchema)(db);
        const users = new userDao_1.UserDAO(db);
        const plans = new planDao_1.PlanDAO(db);
        const user = users.create('dave@example.com', 'h');
        const plan = plans.create({
            user_id: user.id,
            destination: 'Shanghai',
            start_date: '2025-01-10',
            end_date: '2025-01-12',
            budget: 3000,
            party_size: 2,
            preferences: { hotel: '3-star' },
            days: [
                { day_index: 1, segments: [{ title: 'Bund walk' }] },
                { day_index: 2, segments: [{ title: 'Museum' }] }
            ]
        });
        (0, vitest_1.expect)(plan.id).toBeGreaterThan(0);
        (0, vitest_1.expect)(plan.days.length).toBe(2);
        (0, vitest_1.expect)(plan.destination).toBe('Shanghai');
        const list = plans.listByUser(user.id);
        (0, vitest_1.expect)(list.length).toBe(1);
    });
    (0, vitest_1.it)('deletes plan and cascades days', () => {
        const db = (0, db_1.openDatabase)({ memory: true });
        (0, db_1.initSchema)(db);
        const users = new userDao_1.UserDAO(db);
        const plans = new planDao_1.PlanDAO(db);
        const user = users.create('erin@example.com', 'h');
        const plan = plans.create({
            user_id: user.id,
            destination: 'Beijing',
            start_date: '2025-02-01',
            end_date: '2025-02-03',
            days: [{ day_index: 1, segments: [] }]
        });
        const changes = plans.delete(plan.id);
        (0, vitest_1.expect)(changes).toBe(1);
        const fetched = plans.getById(plan.id);
        (0, vitest_1.expect)(fetched).toBeNull();
    });
    (0, vitest_1.it)('rejects plan creation for non-existing user', () => {
        const db = (0, db_1.openDatabase)({ memory: true });
        (0, db_1.initSchema)(db);
        const plans = new planDao_1.PlanDAO(db);
        (0, vitest_1.expect)(() => plans.create({
            user_id: 999,
            destination: 'X',
            start_date: '2025-01-01',
            end_date: '2025-01-02'
        })).toThrow();
    });
});
