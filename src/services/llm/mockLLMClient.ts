import { LLMClient, GenerateItineraryInput, GeneratedItinerary } from './LLMClient';

function calculateDaysCount(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1; // inclusive
  return Number.isFinite(days) ? days : 0;
}

export class MockLLMClient implements LLMClient {
  async generateItinerary(input: GenerateItineraryInput): Promise<GeneratedItinerary> {
    const { destination, start_date, end_date, preferences } = input;
    const daysCount = calculateDaysCount(start_date, end_date);

    // deterministic mock segments, aligned with existing tests
    const days = Array.from({ length: daysCount }, (_, i) => {
      const dayIndex = i + 1;
      const segments = [
        { title: 'Breakfast & brief', startTime: '08:00', endTime: '09:00', notes: 'Local cuisine' },
        { title: 'Sightseeing', startTime: '10:00', endTime: '12:00', location: destination },
        { title: 'Lunch', startTime: '12:30', endTime: '13:30' },
        { title: 'Afternoon activity', startTime: '14:00', endTime: '16:30', notes: preferences ? 'Tailored to preferences' : undefined },
        { title: 'Dinner', startTime: '18:30', endTime: '20:00' }
      ];
      return { day_index: dayIndex, segments };
    });

    return {
      destination,
      start_date,
      end_date,
      days
    };
  }
}