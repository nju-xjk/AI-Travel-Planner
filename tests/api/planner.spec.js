"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const server_1 = require("../../src/api/server");
(0, vitest_1.describe)('Planner API (mock)', () => {
    const app = (0, server_1.createApp)({ jwtSecret: 'test-secret' });
    (0, vitest_1.it)('POST /planner/suggest returns itinerary days', async () => {
        const res = await (0, supertest_1.default)(app)
            .post('/planner/suggest')
            .send({ destination: 'Shanghai', start_date: '2025-01-10', end_date: '2025-01-12', preferences: { pace: 'leisure' } });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body?.data?.destination).toBe('Shanghai');
        (0, vitest_1.expect)(Array.isArray(res.body?.data?.days)).toBe(true);
        (0, vitest_1.expect)(res.body?.data?.days.length).toBe(3);
        const firstDay = res.body?.data?.days?.[0];
        (0, vitest_1.expect)(Array.isArray(firstDay.segments)).toBe(true);
        (0, vitest_1.expect)(firstDay.segments.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('rejects invalid date range', async () => {
        const res = await (0, supertest_1.default)(app)
            .post('/planner/suggest')
            .send({ destination: 'Beijing', start_date: '2025-01-10', end_date: '2025-01-09' });
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)(res.body.code).toBe('BAD_REQUEST');
    });
});
