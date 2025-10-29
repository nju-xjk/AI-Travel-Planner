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
    const result = await llm.generateItinerary(input);
    const { valid } = validateItinerary(result);
    if (!valid) {
      const err: any = new Error('invalid itinerary generated');
      err.code = 'BAD_GATEWAY';
      throw err;
    }
    return result;
  }
}