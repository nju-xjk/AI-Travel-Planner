"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const db_1 = require("../../src/data/db");
const userDao_1 = require("../../src/data/dao/userDao");
const planDao_1 = require("../../src/data/dao/planDao");
const server_1 = require("../../src/api/server");
(0, vitest_1.describe)('Expenses API', () => {
    const db = (0, db_1.openDatabase)({ memory: true });
    (0, db_1.initSchema)(db);
    const app = (0, server_1.createApp)({ jwtSecret: 'test-secret', db });
    (0, vitest_1.it)('adds expenses, lists them, and returns stats (authenticated)', async () => {
        // register & login to get token
        await (0, supertest_1.default)(app).post('/auth/register').send({ email: 'ex@example.com', password: 'pass' });
        const login = await (0, supertest_1.default)(app).post('/auth/login').send({ email: 'ex@example.com', password: 'pass' });
        (0, vitest_1.expect)(login.status).toBe(200);
        const token = login.body?.data?.token;
        (0, vitest_1.expect)(typeof token).toBe('string');
        // prepare a plan via DAO using same DB
        const users = new userDao_1.UserDAO(db);
        const plans = new planDao_1.PlanDAO(db);
        const user = users.findByEmail('ex@example.com');
        const plan = plans.create({
            user_id: user.id,
            destination: 'Hangzhou',
            start_date: '2025-03-01',
            end_date: '2025-03-02'
        });
        // add expenses
        const add1 = await (0, supertest_1.default)(app)
            .post('/expenses')
            .set('Authorization', `Bearer ${token}`)
            .send({ planId: plan.id, date: '2025-03-01', amount: 120, category: 'food', note: 'lunch', inputMethod: 'text' });
        (0, vitest_1.expect)(add1.status).toBe(201);
        const add2 = await (0, supertest_1.default)(app)
            .post('/expenses')
            .set('Authorization', `Bearer ${token}`)
            .send({ planId: plan.id, date: '2025-03-01', amount: 80, category: 'transport' });
        (0, vitest_1.expect)(add2.status).toBe(201);
        // list
        const list = await (0, supertest_1.default)(app)
            .get('/expenses')
            .set('Authorization', `Bearer ${token}`)
            .query({ planId: plan.id });
        (0, vitest_1.expect)(list.status).toBe(200);
        (0, vitest_1.expect)(Array.isArray(list.body?.data)).toBe(true);
        (0, vitest_1.expect)(list.body?.data?.length).toBe(2);
        // stats
        const stats = await (0, supertest_1.default)(app)
            .get('/expenses/stats')
            .set('Authorization', `Bearer ${token}`)
            .query({ planId: plan.id });
        (0, vitest_1.expect)(stats.status).toBe(200);
        (0, vitest_1.expect)(stats.body?.data?.total).toBe(200);
        (0, vitest_1.expect)(stats.body?.data?.byCategory?.food).toBe(120);
        (0, vitest_1.expect)(stats.body?.data?.byCategory?.transport).toBe(80);
    });
    (0, vitest_1.it)('rejects unauthenticated requests', async () => {
        const res = await (0, supertest_1.default)(app).get('/expenses').query({ planId: 1 });
        (0, vitest_1.expect)(res.status).toBe(401);
        (0, vitest_1.expect)(res.body.code).toBe('UNAUTHORIZED');
    });
});
