import { describe, it, expect } from 'vitest';
import { BudgetService } from '../../src/services/budgetService';

describe('BudgetService', () => {
  const svc = new BudgetService();

  it('estimates total and breakdown with warnings when high total', () => {
    const estimate = svc.estimateBudget({ destination: 'Shanghai', start_date: '2025-01-01', end_date: '2025-01-07', party_size: 2 });
    expect(estimate.currency).toBe('CNY');
    expect(typeof estimate.total).toBe('number');
    expect(estimate.total).toBeGreaterThan(0);
    expect(estimate.breakdown.accommodation).toBeGreaterThan(0);
    expect(Array.isArray(estimate.warnings)).toBe(true);
  });

  it('rejects invalid party_size', () => {
    expect(() => svc.estimateBudget({ destination: 'X', start_date: '2025-01-01', end_date: '2025-01-02', party_size: 0 }))
      .toThrowError(/party_size/i);
  });

  it('rejects invalid date range', () => {
    expect(() => svc.estimateBudget({ destination: 'X', start_date: '2025-01-03', end_date: '2025-01-02', party_size: 1 }))
      .toThrowError(/date range invalid/i);
  });
});