import { LLMClient, GenerateItineraryInput, GeneratedItinerary } from './LLMClient';

function calculateDaysCount(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1; // inclusive
  return Number.isFinite(days) ? days : 0;
}

export class OpenAILLMClient implements LLMClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateItinerary(input: GenerateItineraryInput): Promise<GeneratedItinerary> {
    const { destination, start_date, end_date, preferences } = input;
    const daysCount = calculateDaysCount(start_date, end_date);

    // Skeleton implementation: deterministic output with slight variation from mock
    const days = Array.from({ length: daysCount }, (_, i) => {
      const dayIndex = i + 1;
      const segments = [
        { title: 'Morning briefing', startTime: '08:30', endTime: '09:00', notes: 'Provider: openai' },
        { title: 'Explore city highlights', startTime: '09:30', endTime: '12:00', location: destination },
        { title: 'Local lunch', startTime: '12:30', endTime: '13:30' },
        { title: 'Afternoon museum', startTime: '14:00', endTime: '16:00', notes: preferences ? 'Tailored' : undefined },
        { title: 'Dinner & review', startTime: '18:30', endTime: '20:00' }
      ];
      return { day_index: dayIndex, segments };
    });

    return { destination, start_date, end_date, days };
  }
}