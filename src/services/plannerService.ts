import { SettingsService } from './settingsService';
import { LLMClient, GenerateItineraryInput, GeneratedItinerary } from './llm/LLMClient';
import { MockLLMClient } from './llm/mockLLMClient';
import { OpenAILLMClient } from './llm/openaiClient';
import { BailianLLMClient } from './llm/bailianClient';
import { XunfeiLLMClient } from './llm/xunfeiClient';
import { validateItinerary } from '../schemas/itinerary';

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
    const enabled = cfg.llmEnabled === true;
    const provider = (cfg.llmProvider || 'mock').toLowerCase();
    if (!enabled || provider === 'mock') {
      return new MockLLMClient();
    }
    const apiKey = cfg.LLM_API_KEY;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      const err: any = new Error('LLM provider requires API key');
      err.code = 'BAD_REQUEST';
      throw err;
    }
    switch (provider) {
      case 'openai':
        return new OpenAILLMClient(apiKey);
      case 'bailian':
        return new BailianLLMClient(apiKey);
      case 'xunfei':
        return new XunfeiLLMClient(apiKey, cfg.XF_APP_ID);
      default:
        return new MockLLMClient();
    }
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
          continue; // retry
        }
        return result;
      } catch (e: any) {
        lastError = e;
        // retry on timeout or transient errors
        continue;
      }
    }
    const err: any = new Error('planner generation failed after retries');
    err.code = lastError?.code || 'BAD_GATEWAY';
    throw err;
  }
}