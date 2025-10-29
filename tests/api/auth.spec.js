"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
const db_1 = require("../../src/data/db");
const authRoutes_1 = require("../../src/api/authRoutes");
(0, vitest_1.describe)('Auth API', () => {
    let app;
    (0, vitest_1.beforeEach)(() => {
        const db = (0, db_1.openDatabase)({ memory: true });
        (0, db_1.initSchema)(db);
        app = (0, express_1.default)();
        app.use(express_1.default.json());
        app.use('/auth', (0, authRoutes_1.createAuthRouter)(db, { jwtSecret: 'test-secret' }));
    });
    (0, vitest_1.it)('registers a new user', async () => {
        const res = await (0, supertest_1.default)(app)
            .post('/auth/register')
            .send({ email: 'a@example.com', password: 'pass123' });
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body?.data?.email).toBe('a@example.com');
        (0, vitest_1.expect)(res.body?.data?.id).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('rejects duplicate email registration', async () => {
        await (0, supertest_1.default)(app).post('/auth/register').send({ email: 'dup@example.com', password: 'x' });
        const res = await (0, supertest_1.default)(app).post('/auth/register').send({ email: 'dup@example.com', password: 'y' });
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)(res.body.code).toBe('EMAIL_EXISTS');
    });
    (0, vitest_1.it)('logs in with correct credentials and returns token', async () => {
        await (0, supertest_1.default)(app).post('/auth/register').send({ email: 'b@example.com', password: 'secret' });
        const res = await (0, supertest_1.default)(app).post('/auth/login').send({ email: 'b@example.com', password: 'secret' });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(typeof res.body?.data?.token).toBe('string');
        (0, vitest_1.expect)(res.body?.data?.token.length).toBeGreaterThan(10);
    });
    (0, vitest_1.it)('rejects login with wrong password', async () => {
        await (0, supertest_1.default)(app).post('/auth/register').send({ email: 'c@example.com', password: 'secret' });
        const res = await (0, supertest_1.default)(app).post('/auth/login').send({ email: 'c@example.com', password: 'bad' });
        (0, vitest_1.expect)(res.status).toBe(401);
        (0, vitest_1.expect)(res.body.code).toBe('INVALID_CREDENTIALS');
    });
    (0, vitest_1.it)('logout returns 204', async () => {
        const res = await (0, supertest_1.default)(app).post('/auth/logout').send({});
        (0, vitest_1.expect)(res.status).toBe(204);
    });
});
