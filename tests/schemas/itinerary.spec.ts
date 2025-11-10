import { describe, it, expect } from 'vitest';
import { validateItinerary, evaluateItineraryQuality } from '../../src/schemas/itinerary';

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

  it('quality evaluator flags minimal itinerary as low quality', () => {
    const minimal = {
      destination: 'Nanjing',
      start_date: '2025-05-01',
      end_date: '2025-05-03',
      days: [
        { day_index: 1, segments: [{ title: '抵达' }] },
        { day_index: 2, segments: [{ title: '游玩' }] },
        { day_index: 3, segments: [{ title: '返程' }] }
      ]
    };
    const { valid } = validateItinerary(minimal);
    expect(valid).toBe(true);
    const quality = evaluateItineraryQuality(minimal);
    expect(quality.ok).toBe(false);
    expect(Array.isArray(quality.reasons)).toBe(true);
  });

  it('quality evaluator accepts detailed itinerary', () => {
    const rich = {
      destination: 'Nanjing',
      start_date: '2025-05-01',
      end_date: '2025-05-02',
      days: [
        {
          day_index: 1,
          segments: [
            { title: '入住酒店', type: 'accommodation', timeRange: '14:00-15:00', location: '南京金陵饭店', costEstimate: 300, notes: '含早餐，靠近地铁站' },
            { title: '夫子庙游览', type: 'attraction', timeRange: '15:30-17:30', location: '夫子庙秦淮风光带', costEstimate: 100, notes: '建议避开高峰时段' },
            { title: '晚餐', type: 'food', timeRange: '18:00-19:00', location: '回味鸭血粉丝汤（夫子庙店）', costEstimate: 60 },
            { title: '交通返回酒店', type: 'transport', timeRange: '19:10-19:40', location: '从夫子庙到金陵饭店', costEstimate: 20, notes: '地铁1号线' }
          ]
        },
        {
          day_index: 2,
          segments: [
            { title: '早餐', type: 'food', timeRange: '08:00-08:30', location: '南京大排档（新街口店）', costEstimate: 50 },
            { title: '中山陵', type: 'attraction', timeRange: '09:30-11:30', location: '中山陵景区', costEstimate: 50 },
            { title: '交通至南京博物院', type: 'transport', timeRange: '11:30-12:00', location: '从中山陵到南京博物院', costEstimate: 20, notes: '公交游2路' },
            { title: '午餐', type: 'food', timeRange: '12:10-13:10', location: '小厨娘（博物馆店）', costEstimate: 70 }
          ]
        }
      ],
      budget: 770,
      party_size: 2
    };
    const { valid } = validateItinerary(rich);
    expect(valid).toBe(true);
    const quality = evaluateItineraryQuality(rich);
    expect(quality.ok).toBe(true);
    expect(quality.score).toBeGreaterThanOrEqual(60);
  });
});