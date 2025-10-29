"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const server_1 = require("../../src/api/server");
(0, vitest_1.describe)('Budget API (mock)', () => {
    const app = (0, server_1.createApp)({ jwtSecret: 'test-secret' });
    (0, vitest_1.it)('POST /budget/estimate returns total and breakdown', async () => {
        const res = await (0, supertest_1.default)(app)
            .post('/budget/estimate')
            .send({ destination: 'Hangzhou', start_date: '2025-03-01', end_date: '2025-03-02', party_size: 2 });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body?.data?.currency).toBe('CNY');
        (0, vitest_1.expect)(typeof res.body?.data?.total).toBe('number');
        (0, vitest_1.expect)(res.body?.data?.total).toBeGreaterThan(0);
        const breakdown = res.body?.data?.breakdown;
        (0, vitest_1.expect)(breakdown.accommodation).toBeGreaterThan(0);
        (0, vitest_1.expect)(breakdown.food).toBeGreaterThan(0);
        (0, vitest_1.expect)(breakdown.transport).toBeGreaterThan(0);
        (0, vitest_1.expect)(breakdown.entertainment).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('rejects invalid party_size', async () => {
        const res = await (0, supertest_1.default)(app)
            .post('/budget/estimate')
            .send({ destination: 'X', start_date: '2025-01-01', end_date: '2025-01-02', party_size: 0 });
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)(res.body.code).toBe('BAD_REQUEST');
    });
});
