import { LLMClient, GenerateItineraryInput, GeneratedItinerary } from './LLMClient';

function calculateDaysCount(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1; // inclusive
  return Number.isFinite(days) ? days : 0;
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function coerceItinerary(obj: any): GeneratedItinerary {
  // Minimal runtime shape check; full validation由 PlannerService 调用的 validateItinerary 负责
  if (!obj || typeof obj !== 'object') throw new Error('invalid itinerary object');
  const { destination, start_date, end_date, days } = obj;
  if (typeof destination !== 'string' || typeof start_date !== 'string' || typeof end_date !== 'string') {
    throw new Error('missing required fields');
  }
  if (!Array.isArray(days) || days.length === 0) throw new Error('days missing');
  return obj as GeneratedItinerary;
}

export class BailianLLMClient implements LLMClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    console.log('[BailianLLMClient] Initialized with API key:', this.apiKey ? `${this.apiKey.slice(0, 8)}...` : 'MISSING');
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
    // 强制目的地与日期与输入一致，避免模型返回占位或翻译差异
    it.destination = input.destination;
    it.start_date = typeof it.start_date === 'string' ? it.start_date : input.start_date;
    it.end_date = typeof it.end_date === 'string' ? it.end_date : input.end_date;
    // 规范每一天与分段
    it.days = (Array.isArray(it.days) ? it.days : []).map((d, idx) => {
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
    });
    return it;
  }

  async generateItinerary(input: GenerateItineraryInput): Promise<GeneratedItinerary> {
    console.log('[BailianLLMClient] generateItinerary called with input:', JSON.stringify(input, null, 2));
    
    const { destination, start_date, end_date, preferences, party_size, budget } = input;
    const daysCount = calculateDaysCount(start_date, end_date);

    // 通过明确的提示词要求严格JSON输出，字段与项目Schema一致
    const prompt = [
      '你是一名行程规划助手，请严格输出一个 JSON（不要任何解释或附加文本）。',
      '字段必须为：destination, start_date, end_date, days, budget, party_size。',
      'days 为数组，长度等于行程天数；每个元素包含 day_index（从1开始递增）、segments（数组，至少1个）。',
      'segments 每项至少包含 title，且必须包含 costEstimate（人均CNY，数字）；建议提供 type（transport|accommodation|food|entertainment|attraction|shopping|other）。可选：startTime, endTime（格式HH:MM）、location, notes。',
      '要求所有时间字段使用 24小时制 HH:MM。',
      '禁止输出任何占位符，如 ??? 或 N/A；若信息不确定，请填写 "未知"。',
      '请仅输出 JSON 内容，不要使用代码块或前后说明。',
      '',
      `destination: ${destination}`,
      `start_date: ${start_date}`,
      `end_date: ${end_date}`,
      `days_count: ${daysCount}`,
      preferences ? `preferences_hint: ${JSON.stringify(preferences)}` : '',
      typeof party_size === 'number' ? `party_size: ${party_size}` : 'party_size: 1',
      typeof budget === 'number' ? `budget_hint: ${budget}` : 'budget_hint: 未提供。请结合行程为该人数预测总预算（CNY），输出为 budget 字段的数字。'
    ].filter(Boolean).join('\n');

    console.log('[BailianLLMClient] Generated prompt:', prompt);

    // 在 Node 18+ 使用全局 fetch；为兼容TS类型，进行断言
    const fetchFn = (global as any).fetch as typeof globalThis.fetch;
    if (typeof fetchFn !== 'function') {
      console.error('[BailianLLMClient] fetch not available in Node runtime');
      const err: any = new Error('fetch not available in Node runtime');
      err.code = 'BAD_GATEWAY';
      throw err;
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    // 优先使用 Chat Completions（OpenAI 兼容），强制 JSON 输出
    const chatUrl = 'https://dashscope.aliyuncs.com/compatible/v1/chat/completions';
    const chatBody = {
      model: 'qwen-turbo',
      messages: [
        { role: 'system', content: '你是行程规划助手。只输出严格 JSON，符合项目的 Itinerary 结构。禁止使用占位符(如???/N/A)。' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2
    } as any;

    const tryParse = (raw: string): any => {
      const cleaned = stripCodeFences(raw);
      try { return JSON.parse(cleaned); } catch { /* fallthrough */ }
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw Object.assign(new Error('failed to parse JSON from bailian output'), { code: 'BAD_GATEWAY' });
    };

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

    const addRequestIdNote = (parsed: any, reqId?: string) => {
      try {
        if (!reqId) return parsed;
        if (Array.isArray(parsed?.days) && parsed.days[0]?.segments?.[0]) {
          const seg = parsed.days[0].segments[0];
          const prev = seg.notes ? String(seg.notes) + ' ' : '';
          seg.notes = `${prev}reqId:${reqId}`.trim();
        }
      } catch {}
      return parsed;
    };

    // 先尝试 Chat Completions
    try {
      console.log('[BailianLLMClient] Calling Chat Completions:', chatUrl);
      const resp = await fetchFn(chatUrl, { method: 'POST', headers, body: JSON.stringify(chatBody) });
      console.log('[BailianLLMClient] Chat resp status:', resp.status, resp.statusText);
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.error('[BailianLLMClient] Chat error:', text);
        throw Object.assign(new Error(`bailian chat http ${resp.status}: ${text?.slice(0, 200)}`), { code: resp.status >= 500 ? 'BAD_GATEWAY' : 'BAD_REQUEST' });
      }
      const json: any = await resp.json().catch(() => null);
      console.log('[BailianLLMClient] Chat JSON:', JSON.stringify(json, null, 2));
      if (!json) throw Object.assign(new Error('bailian chat response not json'), { code: 'BAD_GATEWAY' });
      const raw = extractRaw(json);
      const parsed = tryParse(raw);
      const withId = addRequestIdNote(parsed, json?.id || json?.request_id);
      let it = coerceItinerary(withId);
      it = this.normalizeItinerary(input, it);
      console.log('[BailianLLMClient] Chat parsed itinerary ok (normalized)');
      return it;
    } catch (chatErr) {
      console.warn('[BailianLLMClient] Chat call failed, fallback to Text Generation:', (chatErr as any)?.message || chatErr);
    }

    // 回退到 Text Generation
    const genUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
    const genBody = {
      model: 'qwen-turbo',
      input: { prompt },
      parameters: { result_format: 'json', temperature: 0.2 }
    };
    console.log('[BailianLLMClient] Calling Text Generation:', genUrl);
    let genResp: Response;
    try {
      genResp = await fetchFn(genUrl, { method: 'POST', headers, body: JSON.stringify(genBody) });
      console.log('[BailianLLMClient] Gen resp status:', genResp.status, genResp.statusText);
    } catch (e: any) {
      console.error('[BailianLLMClient] Gen request failed:', e);
      const err: any = new Error(`bailian request failed: ${String(e?.message || e)}`);
      err.code = 'BAD_GATEWAY';
      throw err;
    }
    if (!genResp.ok) {
      const text = await genResp.text().catch(() => '');
      console.error('[BailianLLMClient] Gen error resp:', text);
      const err: any = new Error(`bailian http ${genResp.status}: ${text?.slice(0, 200)}`);
      err.code = genResp.status >= 500 ? 'BAD_GATEWAY' : 'BAD_REQUEST';
      throw err;
    }
    const genJson: any = await genResp.json().catch(() => null);
    console.log('[BailianLLMClient] Gen JSON:', JSON.stringify(genJson, null, 2));
    if (!genJson) {
      const err: any = new Error('bailian response not json');
      err.code = 'BAD_GATEWAY';
      throw err;
    }
    const genRaw = extractRaw(genJson);
    const parsed = tryParse(genRaw);
    const withId = addRequestIdNote(parsed, genJson?.request_id);
    try {
      let it = coerceItinerary(withId);
      it = this.normalizeItinerary(input, it);
      console.log('[BailianLLMClient] Gen parsed itinerary ok (normalized)');
      return it;
    } catch (e: any) {
      console.error('[BailianLLMClient] Failed to coerce itinerary:', e);
      const err: any = new Error(`bailian output invalid: ${String(e?.message || e)}`);
      err.code = 'BAD_GATEWAY';
      throw err;
    }
  }
}