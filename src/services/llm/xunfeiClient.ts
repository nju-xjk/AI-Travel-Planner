import { LLMClient, GenerateItineraryInput, GeneratedItinerary } from './LLMClient';

function calculateDaysCount(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1; // inclusive
  return Number.isFinite(days) ? days : 0;
}

export class XunfeiLLMClient implements LLMClient {
  private apiKey: string;
  private appId?: string;

  constructor(apiKey: string, appId?: string) {
    this.apiKey = apiKey;
    this.appId = appId;
  }

  async generateItinerary(input: GenerateItineraryInput): Promise<GeneratedItinerary> {
    const { destination, start_date, end_date, preferences } = input;
    const daysCount = calculateDaysCount(start_date, end_date);

    const days = Array.from({ length: daysCount }, (_, i) => {
      const dayIndex = i + 1;
      const segments = [
        { title: '晨间规划', startTime: '08:00', endTime: '08:30', notes: 'Provider: xunfei' },
        { title: '市区游览', startTime: '09:30', endTime: '11:30', location: destination },
        { title: '午餐时间', startTime: '12:00', endTime: '13:00' },
        { title: '下午休闲', startTime: '14:00', endTime: '16:00', notes: preferences ? '个性化' : undefined },
        { title: '晚间总结', startTime: '18:30', endTime: '19:30' }
      ];
      return { day_index: dayIndex, segments };
    });

    return { destination, start_date, end_date, days };
  }
}