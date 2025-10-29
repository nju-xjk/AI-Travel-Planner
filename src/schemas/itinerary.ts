export interface ItineraryDay {
  day_index: number;
  segments: Array<{
    title: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    notes?: string;
  }>;
}

export interface Itinerary {
  destination: string;
  start_date: string;
  end_date: string;
  days: ItineraryDay[];
}

export function validateItinerary(it: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  if (!it || typeof it !== 'object') {
    return { valid: false, errors: ['itinerary must be object'] };
  }
  if (typeof it.destination !== 'string' || !it.destination) {
    errors.push('destination must be string');
  }
  if (typeof it.start_date !== 'string' || typeof it.end_date !== 'string') {
    errors.push('start_date and end_date must be string');
  }
  if (!Array.isArray(it.days) || it.days.length <= 0) {
    errors.push('days must be non-empty array');
  } else {
    for (let i = 0; i < it.days.length; i++) {
      const d = it.days[i];
      if (!d || typeof d !== 'object') {
        errors.push(`day[${i}] must be object`);
        continue;
      }
      if (typeof d.day_index !== 'number' || d.day_index <= 0) {
        errors.push(`day[${i}].day_index must be positive number`);
      }
      if (!Array.isArray(d.segments)) {
        errors.push(`day[${i}].segments must be array`);
      } else {
        for (let j = 0; j < d.segments.length; j++) {
          const s = d.segments[j];
          if (!s || typeof s !== 'object') {
            errors.push(`day[${i}].segments[${j}] must be object`);
            continue;
          }
          if (typeof s.title !== 'string' || !s.title) {
            errors.push(`day[${i}].segments[${j}].title must be string`);
          }
        }
      }
    }
  }
  return { valid: errors.length === 0, errors: errors.length ? errors : undefined };
}