import { SettingsService } from './settingsService';
import { LLMClient, GenerateItineraryInput, GeneratedItinerary } from './llm/LLMClient';
import { BailianLLMClient } from './llm/bailianClient';
import { validateItinerary } from '../schemas/itinerary';
import { metrics } from '../observability/metrics';

type ExtractCoverage = 'none' | 'partial' | 'full';
export interface ExtractedFields {
  destination?: string;
  start_date?: string;
  end_date?: string;
  party_size?: number;
  budget?: number;
  notes?: string;
  coverage: ExtractCoverage;
}

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
    // In test environment, avoid external network calls by using a deterministic mock
    if ((process.env.NODE_ENV || 'development') === 'test') {
      return {
        async generateItinerary(input: GenerateItineraryInput): Promise<GeneratedItinerary> {
          const daysCount = calculateDaysCount(input.start_date, input.end_date);
          const days = Array.from({ length: daysCount }, (_, i) => ({
            day_index: i + 1,
            segments: [{ title: 'Mock segment', location: input.destination }]
          }));
          return {
            destination: input.destination,
            start_date: input.start_date,
            end_date: input.end_date,
            days
          };
        }
      } as LLMClient;
    }
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
      }),
      party_size: typeof it.party_size === 'number' && it.party_size > 0
        ? it.party_size
        : (typeof input.party_size === 'number' && input.party_size > 0 ? input.party_size : undefined),
      budget: typeof it.budget === 'number' && it.budget > 0 ? it.budget : undefined
    };
    return out;
  }

  private stripCodeFences(text: string): string {
    return String(text || '')
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
  }

  async extractFieldsFromText(rawText: string): Promise<ExtractedFields> {
    const text = (rawText || '').trim();
    if (!text) {
      return { coverage: 'none' };
    }
    const cfg = this.settings.getSettings();
    const apiKey = (cfg as any).BAILIAN_API_KEY;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      const err: any = new Error('未配置大模型BAILIAN_API_KEY，请先至设置页面进行配置！');
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const fetchFn = (global as any).fetch as typeof globalThis.fetch;
    if (typeof fetchFn !== 'function') {
      throw Object.assign(new Error('fetch not available in Node runtime'), { code: 'BAD_GATEWAY' });
    }
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    const prompt = [
      '请阅读以下用户文本，严格输出一个 JSON 对象（不要任何解释）。',
      '字段：destination, start_date, end_date, party_size, budget, notes, coverage。',
      'notes 为除结构化字段外的补充信息（可为空字符串）。',
      '日期格式必须为 yyyy-mm-dd。party_size 为数字。budget 为数字（CNY）。',
      'coverage 为 none|partial|full：',
      '- full：文本包含目的地、开始日期、结束日期、同行人数四项；',
      '- partial：包含部分关键字段但不完整；',
      '- none：与行程无关或无法提取。',
      '禁止使用占位符(如???/N/A)。若未知请省略字段或设为空字符串。',
      '',
      '用户文本：',
      text
    ].join('\n');

    const chatUrl = 'https://dashscope.aliyuncs.com/compatible/v1/chat/completions';
    const chatBody = {
      model: 'qwen-turbo',
      messages: [
        { role: 'system', content: '你是信息抽取助手。只输出严格 JSON，字段如说明。' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    } as any;

    const extractRaw = (json: any): string => {
      const candidates: any[] = [
        json?.choices?.[0]?.message?.content,
        json?.output_text,
        json?.output?.text,
        json?.output?.choices?.[0]?.message?.content,
        typeof json?.output === 'object' ? JSON.stringify(json.output) : json?.output,
      ].filter((v) => v != null);
      for (const c of candidates) {
        if (typeof c === 'string' && c.trim()) return c;
      }
      throw Object.assign(new Error('bailian response missing output text'), { code: 'BAD_GATEWAY' });
    };

    const tryParse = (raw: string): any => {
      const cleaned = this.stripCodeFences(raw);
      try { return JSON.parse(cleaned); } catch {}
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw Object.assign(new Error('failed to parse JSON from bailian output'), { code: 'BAD_GATEWAY' });
    };

    try {
      const resp = await fetchFn(chatUrl, { method: 'POST', headers, body: JSON.stringify(chatBody) });
      if (!resp.ok) {
        const textBody = await resp.text().catch(() => '');
        throw Object.assign(new Error(`bailian chat http ${resp.status}: ${textBody?.slice(0, 200)}`), { code: resp.status >= 500 ? 'BAD_GATEWAY' : 'BAD_REQUEST' });
      }
      const json: any = await resp.json().catch(() => null);
      if (!json) throw Object.assign(new Error('bailian chat response not json'), { code: 'BAD_GATEWAY' });
      const raw = extractRaw(json);
      const parsed = tryParse(raw);
      const fields: ExtractedFields = {
        destination: typeof parsed?.destination === 'string' ? parsed.destination.trim() : undefined,
        start_date: typeof parsed?.start_date === 'string' ? parsed.start_date.trim() : undefined,
        end_date: typeof parsed?.end_date === 'string' ? parsed.end_date.trim() : undefined,
        party_size: typeof parsed?.party_size === 'number' ? parsed.party_size : undefined,
        budget: typeof parsed?.budget === 'number' ? parsed.budget : undefined,
        notes: typeof parsed?.notes === 'string' ? parsed.notes : '',
        coverage: (parsed?.coverage === 'full' || parsed?.coverage === 'partial') ? parsed.coverage : 'none'
      };
      return fields;
    } catch (e: any) {
      // Fallback: treat as none
      console.warn('[PlannerService] extractFieldsFromText failed:', e?.message || e);
      return { coverage: 'none' };
    }
  }
}