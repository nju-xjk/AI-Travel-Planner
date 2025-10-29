"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const db_1 = require("../../../src/data/db");
const userDao_1 = require("../../../src/data/dao/userDao");
const planDao_1 = require("../../../src/data/dao/planDao");
const expenseDao_1 = require("../../../src/data/dao/expenseDao");
(0, vitest_1.describe)('ExpenseDAO', () => {
    (0, vitest_1.it)('adds, lists, and computes stats', () => {
        const db = (0, db_1.openDatabase)({ memory: true });
        (0, db_1.initSchema)(db);
        const users = new userDao_1.UserDAO(db);
        const plans = new planDao_1.PlanDAO(db);
        const expenses = new expenseDao_1.ExpenseDAO(db);
        const user = users.create('frank@example.com', 'h');
        const plan = plans.create({
            user_id: user.id,
            destination: 'Hangzhou',
            start_date: '2025-03-01',
            end_date: '2025-03-02'
        });
        expenses.add({ plan_id: plan.id, date: '2025-03-01', amount: 120, category: 'food' });
        expenses.add({ plan_id: plan.id, date: '2025-03-01', amount: 80, category: 'transport' });
        const list = expenses.listByPlan(plan.id);
        (0, vitest_1.expect)(list.length).toBe(2);
        const stats = expenses.statsByPlan(plan.id);
        (0, vitest_1.expect)(stats.total).toBe(200);
        (0, vitest_1.expect)(stats.byCategory['food']).toBe(120);
        (0, vitest_1.expect)(stats.byCategory['transport']).toBe(80);
    });
    (0, vitest_1.it)('rejects expense for non-existing plan', () => {
        const db = (0, db_1.openDatabase)({ memory: true });
        (0, db_1.initSchema)(db);
        const expenses = new expenseDao_1.ExpenseDAO(db);
        (0, vitest_1.expect)(() => expenses.add({ plan_id: 12345, date: '2025-01-01', amount: 10, category: 'other' })).toThrow();
    });
});
