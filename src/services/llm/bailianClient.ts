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
  }

  async generateItinerary(input: GenerateItineraryInput): Promise<GeneratedItinerary> {
    const { destination, start_date, end_date, preferences } = input;
    const daysCount = calculateDaysCount(start_date, end_date);

    // 通过明确的提示词要求严格JSON输出，字段与项目Schema一致
    const prompt = [
      '你是一名行程规划助手，请严格输出一个 JSON（不要任何解释或附加文本）。',
      '字段必须为：destination, start_date, end_date, days。',
      'days 为数组，长度等于行程天数；每个元素包含 day_index（从1开始递增）、segments（数组，至少1个）。',
      'segments 每项包含至少 title；可选：startTime, endTime（格式HH:MM）、location, notes, type（transport|accommodation|food|entertainment|attraction|shopping|other）, costEstimate。',
      '要求所有时间字段使用 24小时制 HH:MM。',
      '请仅输出 JSON 内容，不要使用代码块或前后说明。',
      '',
      `destination: ${destination}`,
      `start_date: ${start_date}`,
      `end_date: ${end_date}`,
      `days_count: ${daysCount}`,
      preferences ? `preferences_hint: ${JSON.stringify(preferences)}` : ''
    ].filter(Boolean).join('\n');

    const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    // 在 Node 18+ 使用全局 fetch；为兼容TS类型，进行断言
    const fetchFn = (global as any).fetch as typeof globalThis.fetch;
    if (typeof fetchFn !== 'function') {
      const err: any = new Error('fetch not available in Node runtime');
      err.code = 'BAD_GATEWAY';
      throw err;
    }

    const body = {
      model: 'qwen-turbo',
      input: prompt,
      parameters: {
        result_format: 'json'
      }
    };

    let resp: Response;
    try {
      resp = await fetchFn(url, { method: 'POST', headers, body: JSON.stringify(body) });
    } catch (e: any) {
      const err: any = new Error(`bailian request failed: ${String(e?.message || e)}`);
      err.code = 'BAD_GATEWAY';
      throw err;
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      const err: any = new Error(`bailian http ${resp.status}: ${text?.slice(0, 200)}`);
      err.code = resp.status >= 500 ? 'BAD_GATEWAY' : 'BAD_REQUEST';
      throw err;
    }

    const json: any = await resp.json().catch(() => null);
    if (!json) {
      const err: any = new Error('bailian response not json');
      err.code = 'BAD_GATEWAY';
      throw err;
    }

    // 兼容不同返回字段，尝试从多个可能位置取文本/JSON
    const candidates: any[] = [
      json?.output_text,
      json?.output?.text,
      json?.output?.choices?.[0]?.message?.content,
      json?.output,
    ].filter((v) => v != null);

    let raw = '';
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) { raw = c; break; }
      if (typeof c === 'object') { raw = JSON.stringify(c); break; }
    }

    if (!raw || typeof raw !== 'string') {
      const err: any = new Error('bailian response missing output text');
      err.code = 'BAD_GATEWAY';
      throw err;
    }

    // 去除可能的代码围栏并解析为对象
    const cleaned = stripCodeFences(raw);
    let parsed: any = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch (_e) {
      // 有些返回可能是纯文本带JSON片段；尝试从文本中提取第一对大括号
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) {
        parsed = JSON.parse(m[0]);
      } else {
        const err: any = new Error('failed to parse JSON from bailian output');
        err.code = 'BAD_GATEWAY';
        throw err;
      }
    }

    try {
      const it = coerceItinerary(parsed);
      return it;
    } catch (e: any) {
      const err: any = new Error(`bailian output invalid: ${String(e?.message || e)}`);
      err.code = 'BAD_GATEWAY';
      throw err;
    }
  }
}