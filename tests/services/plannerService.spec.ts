import { describe, it, expect } from 'vitest';
import { PlannerService } from '../../src/services/plannerService';
import type { LLMClient, GenerateItineraryInput, GeneratedItinerary } from '../../src/services/llm/LLMClient';
import { metrics } from '../../src/observability/metrics';

class FlakyLLM implements LLMClient {
  private calls = 0;
  async generateItinerary(input: GenerateItineraryInput): Promise<GeneratedItinerary> {
    this.calls++;
    const { destination, start_date, end_date } = input;
    if (this.calls === 1) {
      // Return invalid itinerary (empty segments violates schema min(1))
      return {
        destination,
        start_date,
        end_date,
        days: [{ day_index: 1, segments: [] }]
      } as any;
    }
    // Return valid itinerary on second call
    const s = new Date(start_date + 'T00:00:00Z');
    const e = new Date(end_date + 'T00:00:00Z');
    const daysCount = Math.floor((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const days = Array.from({ length: daysCount }, (_, i) => ({
      day_index: i + 1,
      segments: [{ title: 'Valid segment' }]
    }));
    return { destination, start_date, end_date, days };
  }
}

class TimeoutLLM implements LLMClient {
  async generateItinerary(input: GenerateItineraryInput): Promise<GeneratedItinerary> {
    // Resolve after a long delay to trigger service timeout (configured to 1s)
    return new Promise<GeneratedItinerary>((resolve) => {
      setTimeout(() => {
        resolve({
          destination: input.destination,
          start_date: input.start_date,
          end_date: input.end_date,
          days: [{ day_index: 1, segments: [{ title: 'Late' }] }]
        });
      }, 5000);
    });
  }
}

describe('PlannerService timeout & retry', () => {
  it('retries when first generation invalid and succeeds on second', async () => {
    const svc = new PlannerService();
    // Monkey-patch private method for test injection
    (svc as any)['getLLMClient'] = () => new FlakyLLM();
    const before = { ...metrics.planner };
    const res = await svc.suggestItinerary({ destination: 'Hangzhou', start_date: '2025-03-01', end_date: '2025-03-02' });
    expect(res.days.length).toBe(2);
    expect(res.days[0].segments.length).toBeGreaterThan(0);
    const after = metrics.planner;
    expect(after.total_generations).toBe(before.total_generations + 1);
    expect(after.invalid).toBeGreaterThanOrEqual(before.invalid + 1);
    expect(after.retries).toBeGreaterThanOrEqual(before.retries + 1);
    expect(after.success).toBe(before.success + 1);
  });

  it('maps long-running generation to BAD_GATEWAY via timeout', async () => {
    const svc = new PlannerService();
    (svc as any)['getLLMClient'] = () => new TimeoutLLM();
    const before = { ...metrics.planner };
    try {
      await svc.suggestItinerary({ destination: 'Suzhou', start_date: '2025-04-01', end_date: '2025-04-01' });
      throw new Error('Expected timeout error');
    } catch (e: any) {
      expect(e.code).toBe('BAD_GATEWAY');
      expect(String(e.message)).toMatch(/timeout|failed/i);
    }
    const after = metrics.planner;
    expect(after.total_generations).toBe(before.total_generations + 1);
    expect(after.timeout).toBeGreaterThanOrEqual(before.timeout + 1);
    expect(after.failed).toBeGreaterThanOrEqual(before.failed + 1);
  });
});