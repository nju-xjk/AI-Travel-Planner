import { LLMClient, GenerateItineraryInput, GeneratedItinerary } from './LLMClient';

function calculateDaysCount(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1; // inclusive
  return Number.isFinite(days) ? days : 0;
}

export class BailianLLMClient implements LLMClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateItinerary(input: GenerateItineraryInput): Promise<GeneratedItinerary> {
    const { destination, start_date, end_date, preferences } = input;
    const daysCount = calculateDaysCount(start_date, end_date);

    const days = Array.from({ length: daysCount }, (_, i) => {
      const dayIndex = i + 1;
      const segments = [
        { title: '早间简报', startTime: '08:15', endTime: '08:45', notes: 'Provider: bailian' },
        { title: '城市地标打卡', startTime: '09:30', endTime: '11:30', location: destination },
        { title: '午餐', startTime: '12:00', endTime: '13:00' },
        { title: '下午活动', startTime: '14:00', endTime: '16:30', notes: preferences ? '个性化' : undefined },
        { title: '晚餐', startTime: '18:30', endTime: '20:00' }
      ];
      return { day_index: dayIndex, segments };
    });

    return { destination, start_date, end_date, days };
  }
}