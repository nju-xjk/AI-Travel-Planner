export interface BudgetEstimate {
  destination: string;
  start_date: string;
  end_date: string;
  party_size: number;
  currency: 'CNY';
  total: number;
  breakdown: Record<string, number>;
  warnings: string[];
}

export interface EstimateBudgetInput {
  destination: string;
  start_date: string;
  end_date: string;
  party_size: number;
  daysCount?: number;
}

function calculateDaysCount(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1; // inclusive
  return Number.isFinite(days) ? days : 0;
}

export class BudgetService {
  estimateBudget(input: EstimateBudgetInput): BudgetEstimate {
    const { destination, start_date, end_date } = input;
    const ps = Number(input.party_size);
    if (!Number.isFinite(ps) || ps <= 0) {
      const err: any = new Error('party_size must be a positive number');
      err.code = 'BAD_REQUEST';
      throw err;
    }
    if (typeof destination !== 'string' || typeof start_date !== 'string' || typeof end_date !== 'string') {
      const err: any = new Error('destination, start_date, end_date are required');
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const daysCount = input.daysCount ?? calculateDaysCount(start_date, end_date);
    if (daysCount <= 0) {
      const err: any = new Error('date range invalid');
      err.code = 'BAD_REQUEST';
      throw err;
    }

    // Base per-person per-day rules (CNY)
    const perDay = {
      accommodation: 300,
      food: 120,
      transport: 50,
      entertainment: 80
    };

    const breakdown = {
      accommodation: perDay.accommodation * daysCount * ps,
      food: perDay.food * daysCount * ps,
      transport: perDay.transport * daysCount * ps,
      entertainment: perDay.entertainment * daysCount * ps,
      shopping: 0,
      other: 0
    } as Record<string, number>;
    const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);

    const warnings: string[] = [];
    // Simple warning heuristics
    if (total > 5000) warnings.push('Estimated total exceeds 5,000 CNY. Consider adjusting plan.');
    if (ps >= 5) warnings.push('Large party size may require group booking arrangements.');

    return {
      destination,
      start_date,
      end_date,
      party_size: ps,
      currency: 'CNY',
      total,
      breakdown,
      warnings
    };
  }
}