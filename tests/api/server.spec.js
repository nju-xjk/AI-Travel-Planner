"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const server_1 = require("../../src/api/server");
(0, vitest_1.describe)('API Server', () => {
    const app = (0, server_1.createApp)({ jwtSecret: 'test-secret' });
    (0, vitest_1.it)('GET /health returns ok', async () => {
        const res = await (0, supertest_1.default)(app).get('/health');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.status).toBe('ok');
    });
    (0, vitest_1.it)('auth routes are mounted', async () => {
        const reg = await (0, supertest_1.default)(app).post('/auth/register').send({ email: 's@example.com', password: 'aaa' });
        (0, vitest_1.expect)(reg.status).toBe(201);
        const login = await (0, supertest_1.default)(app).post('/auth/login').send({ email: 's@example.com', password: 'aaa' });
        (0, vitest_1.expect)(login.status).toBe(200);
        (0, vitest_1.expect)(typeof login.body?.data?.token).toBe('string');
    });
});
