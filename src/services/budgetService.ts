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
  itinerary?: {
    days: { day_index: number; segments: { type?: string; costEstimate?: number }[] }[];
  };
}

function calculateDaysCount(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1; // inclusive
  return Number.isFinite(days) ? days : 0;
}

import { SettingsService } from './settingsService';

export class BudgetService {
  private settings: SettingsService;

  constructor(settings?: SettingsService) {
    this.settings = settings ?? new SettingsService();
  }

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

    const warnings: string[] = [];
    let breakdown: Record<string, number> = {
      accommodation: 0,
      food: 0,
      transport: 0,
      entertainment: 0,
      shopping: 0,
      other: 0
    };

    const itineraryDays = input.itinerary?.days ?? [];
    const cfg = this.settings.getSettings();
    if (Array.isArray(itineraryDays) && itineraryDays.length > 0) {
      // Per-segment coefficients (CNY) used when costEstimate missing
      const perSegment = {
        transport: cfg.BUDGET_COEFF_TRANSPORT ?? 50,
        food: cfg.BUDGET_COEFF_FOOD ?? 60,
        entertainment: cfg.BUDGET_COEFF_ENTERTAINMENT ?? 80,
        accommodation: cfg.BUDGET_COEFF_ACCOMMODATION ?? 300, // treat each accommodation segment as a night
        shopping: cfg.BUDGET_COEFF_SHOPPING ?? 0,
        other: cfg.BUDGET_COEFF_OTHER ?? 0,
      } as Record<string, number>;

      let missingType = false;
      for (const day of itineraryDays) {
        for (const seg of day.segments ?? []) {
          const rawType = seg.type ?? 'other';
          const type = rawType === 'attraction' ? 'entertainment' : rawType;
          if (!seg.type) missingType = true;
          if (Number.isFinite(seg.costEstimate) && (seg.costEstimate as number) > 0) {
            breakdown[type] = (breakdown[type] ?? 0) + (seg.costEstimate as number);
          } else {
            breakdown[type] = (breakdown[type] ?? 0) + (perSegment[type] ?? 0) * ps;
          }
        }
      }
      if (missingType) warnings.push('Some segments lack type; estimates may be rough.');
    } else {
      // Base per-person per-day rules (CNY) fallback
      const perDay = {
        accommodation: cfg.BUDGET_PERDAY_ACCOMMODATION ?? 300,
        food: cfg.BUDGET_PERDAY_FOOD ?? 120,
        transport: cfg.BUDGET_PERDAY_TRANSPORT ?? 50,
        entertainment: cfg.BUDGET_PERDAY_ENTERTAINMENT ?? 80,
      };
      breakdown = {
        accommodation: perDay.accommodation * daysCount * ps,
        food: perDay.food * daysCount * ps,
        transport: perDay.transport * daysCount * ps,
        entertainment: perDay.entertainment * daysCount * ps,
        shopping: 0,
        other: 0
      } as Record<string, number>;
    }
    const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
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