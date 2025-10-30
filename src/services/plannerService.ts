import { SettingsService } from './settingsService';
import { LLMClient, GenerateItineraryInput, GeneratedItinerary } from './llm/LLMClient';
import { BailianLLMClient } from './llm/bailianClient';
import { validateItinerary } from '../schemas/itinerary';
import { metrics } from '../observability/metrics';

function calculateDaysCount(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1; // inclusive
  return Number.isFinite(days) ? days : 0;
}

export class PlannerService {
  private settings: SettingsService;

  constructor(settings?: SettingsService) {
    this.settings = settings ?? new SettingsService();
  }

  private getLLMClient(): LLMClient {
    const cfg = this.settings.getSettings();
    const apiKey = (cfg as any).BAILIAN_API_KEY;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      const err: any = new Error('BAILIAN_API_KEY is required');
      err.code = 'BAD_REQUEST';
      throw err;
    }
    return new BailianLLMClient(apiKey);
  }

  async suggestItinerary(input: GenerateItineraryInput): Promise<GeneratedItinerary> {
    const { destination, start_date, end_date } = input;
    if (typeof destination !== 'string' || typeof start_date !== 'string' || typeof end_date !== 'string') {
      const err: any = new Error('destination, start_date, end_date are required');
      err.code = 'BAD_REQUEST';
      throw err;
    }
    const daysCount = calculateDaysCount(start_date, end_date);
    if (daysCount <= 0) {
      const err: any = new Error('date range invalid');
      err.code = 'BAD_REQUEST';
      throw err;
    }
    const llm = this.getLLMClient();
    const cfg = this.settings.getSettings();
    const MAX_RETRIES = Number.isFinite(cfg.LLM_MAX_RETRIES as any) ? Number(cfg.LLM_MAX_RETRIES) : 2;
    const TIMEOUT_MS = Number.isFinite(cfg.LLM_TIMEOUT_MS as any) ? Number(cfg.LLM_TIMEOUT_MS) : 1000;
    metrics.planner.total_generations += 1;

    const callWithTimeout = <T>(p: Promise<T>, ms: number): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => {
          const err: any = new Error('planner generation timeout');
          err.code = 'BAD_GATEWAY';
          reject(err);
        }, ms);
        p.then((v) => {
          clearTimeout(t);
          resolve(v);
        }).catch((e) => {
          clearTimeout(t);
          reject(e);
        });
      });
    };

    let lastError: any = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await callWithTimeout(llm.generateItinerary(input), TIMEOUT_MS);
        const { valid } = validateItinerary(result);
        if (!valid) {
          const err: any = new Error('invalid itinerary generated');
          err.code = 'BAD_GATEWAY';
          lastError = err;
          metrics.planner.invalid += 1;
          if (attempt < MAX_RETRIES) metrics.planner.retries += 1;
          continue; // retry
        }
        const normalized = this.normalizeItinerary(input, result);
        metrics.planner.success += 1;
        return normalized;
      } catch (e: any) {
        lastError = e;
        if (e?.code === 'BAD_GATEWAY' && typeof e?.message === 'string' && e.message.includes('timeout')) {
          metrics.planner.timeout += 1;
        }
        if (attempt < MAX_RETRIES) metrics.planner.retries += 1;
        // retry on timeout or transient errors
        continue;
      }
    }
    const err: any = new Error('planner generation failed after retries');
    err.code = lastError?.code || 'BAD_GATEWAY';
    metrics.planner.failed += 1;
    throw err;
  }

  private normalizeItinerary(input: GenerateItineraryInput, it: GeneratedItinerary): GeneratedItinerary {
    const isPlaceholder = (v: any) => typeof v === 'string' && /^(\?+|N\/?A|unknown|未知|未定|tbd)$/i.test(v.trim());
    const clean = (v: any, fallback: string) => {
      if (typeof v !== 'string') return fallback;
      const t = v.trim();
      if (!t) return fallback;
      if (isPlaceholder(t)) return fallback;
      return t;
    };
    const out: GeneratedItinerary = {
      destination: input.destination,
      start_date: typeof it.start_date === 'string' ? it.start_date : input.start_date,
      end_date: typeof it.end_date === 'string' ? it.end_date : input.end_date,
      days: (Array.isArray(it.days) ? it.days : []).map((d, idx) => {
        const day_index = Number(d?.day_index) || (idx + 1);
        const segments = Array.isArray(d?.segments) ? d.segments : [];
        const normalizedSegments = segments.map((s: any) => {
          const title = clean(s?.title, '行程安排');
          const location = s?.location != null ? clean(s.location, '未知') : s?.location;
          const notes = s?.notes != null ? clean(s.notes, '') : s?.notes;
          return { ...s, title, location, notes };
        });
        const ensuredSegments = normalizedSegments.length > 0 ? normalizedSegments : [{ title: '自由活动', timeRange: '09:00-18:00', notes: '未提供具体安排' }];
        return { day_index, segments: ensuredSegments };
      })
    };
    return out;
  }
}