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
  const { origin, destination, start_date, end_date, days } = obj;
  if (typeof origin !== 'string' || typeof destination !== 'string' || typeof start_date !== 'string' || typeof end_date !== 'string') {
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
    // 强制出发地、目的地与日期与输入一致，避免模型返回占位或翻译差异
    it.origin = input.origin;
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
    
    const { origin, destination, start_date, end_date, preferences, party_size, budget } = input;
    const daysCount = calculateDaysCount(start_date, end_date);

    // 通过明确的提示词要求严格JSON输出，并提升行程细致度
    const prompt = [
      '你是一名专业行程规划助手。请严格只输出一个 JSON 对象（不要任何解释或附加文本、不要代码块）。',
      '必须字段：origin, destination, start_date, end_date, days, budget, party_size。',
      'days 是数组，长度=行程天数；每个元素包含 day_index（从1开始递增）、segments（数组）。',
      '段落 segments：\n- 每段必须包含：title, type, costEstimate（人均CNY，数字）；\n- 强烈建议包含：timeRange（HH:MM-HH:MM）或 startTime/endTime（HH:MM），location（具体到商家/景点/酒店全称），notes（包含必要细节）；\n- type 取值：transport|accommodation|food|entertainment|attraction|shopping|other；',
      '细化要求：\n- 住宿（accommodation）：写明具体酒店名称与地址；入住/退房时间；如需押金或早餐说明写在 notes。\n- 餐饮（food）：具体餐厅名称与地址；推荐菜；人均预算；如需排队预留时间。\n- 交通（transport）：具体方式（步行/地铁/公交/打车/高铁/飞机等）、起点与终点；预计时长；费用；在 notes 中写清线路或车次。\n- 景点（attraction/entertainment）：具体景点名称；预计游玩时长；门票价格/预约说明；最佳时间段；避免高峰建议。\n- 购物（shopping）：具体商场/商业街名称；预算与停留时长。',
      '餐饮要求（关键约束）：\n- 每一天必须包含午餐与晚餐两个独立的餐饮段（type=food），可选早餐；\n- 每个餐饮段需包含：具体餐厅名称与地址（location）、时间段（timeRange，建议午餐 11:30-13:30、晚餐 18:00-20:30，可适当调整）、推荐菜（notes 中说明）、人均消费 costEstimate（CNY，数字）；\n- 如当日存在长途交通或跨城移动，仍需安排餐饮（可沿途或到达后），并在时间上合理留出；',
      '时间与节奏：\n- 每天建议≥6段，包含餐饮、交通、景点/娱乐、住宿等组合；\n- 使用 24小时制；安排合理间隔；避免不现实的行程（跨城移动需考虑时长）。',
      '出发地与交通安排：\n- 第一天需安排从 origin 到 destination 的交通（type=transport），具体方式与时间；\n- 若 origin 与 destination 同城，则安排本地交通（如地铁/公交/打车）；\n- 建议在最后一天安排返程交通（可选），或在 notes 中说明返程建议；',
      '位置字段约束（重要）：\n- 跨城交通段（如从 origin 到 destination）中，location 只填写目的地城市的具体地点（destination 城市的车站/机场/地标），不要写“出发地-目的地”或者“目的地-出发地”的组合字符串；\n- 示例：origin=南昌，destination=南京，第一段和最后一段交通的 location 仅为“南京南站”。',
      '预算：\n- 对每段给出 costEstimate（CNY）；如不确定填近似值但不要占位符；\n- 计算并给出总 budget（该人数）。',
      '禁止：任何占位符（???/N/A）；不要输出除 JSON 外的任何文本。',
      '',
      `origin: ${origin}`,
      `destination: ${destination}`,
      `start_date: ${start_date}`,
      `end_date: ${end_date}`,
      `days_count: ${daysCount}`,
      preferences ? `preferences_hint: ${JSON.stringify(preferences)}` : '',
      typeof party_size === 'number' ? `party_size: ${party_size}` : 'party_size: 1',
      typeof budget === 'number' ? `budget_hint: ${budget}` : 'budget_hint: 未提供；请结合行程为该人数预测总预算（CNY），输出为 budget 字段数字。'
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

    // 过去尝试 Chat Completions 会返回 404，这里直接跳过，改为仅使用 Text Generation
    // 如需恢复 Chat 模式，可改为条件开关或配置项。
    const chatUrl = 'https://dashscope.aliyuncs.com/compatible/v1/chat/completions';
    const chatBody = {} as any;

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

    // 跳过 Chat Completions，直接使用 Text Generation
    console.log('[BailianLLMClient] Skipping Chat Completions; using Text Generation directly');

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