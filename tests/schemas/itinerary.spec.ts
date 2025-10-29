import { describe, it, expect } from 'vitest';
import { validateItinerary } from '../../src/schemas/itinerary';

describe('Itinerary schema (zod)', () => {
  it('accepts valid itinerary', () => {
    const validObj = {
      destination: 'Shanghai',
      start_date: '2025-01-10',
      end_date: '2025-01-12',
      days: [
        { day_index: 1, segments: [{ title: 'Breakfast', startTime: '08:00', endTime: '09:00' }] },
        { day_index: 2, segments: [{ title: 'Museum' }] },
        { day_index: 3, segments: [{ title: 'Dinner', startTime: '18:30' }] }
      ]
    };
    const { valid, errors } = validateItinerary(validObj);
    expect(valid).toBe(true);
    expect(errors).toBeUndefined();
  });

  it('rejects invalid itinerary with bad dates and empty segments', () => {
    const invalidObj = {
      destination: 'Beijing',
      start_date: '2025-01-10',
      end_date: '2025-01-09',
      days: [
        { day_index: 1, segments: [] }
      ]
    };
    const { valid, errors } = validateItinerary(invalidObj);
    expect(valid).toBe(false);
    expect(Array.isArray(errors)).toBe(true);
    expect(errors!.some(e => e.includes('end_date'))).toBe(true);
  });
});