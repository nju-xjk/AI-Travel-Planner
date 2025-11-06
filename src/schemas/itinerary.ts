import { z } from 'zod';

export const DaySegmentSchema = z.object({
  title: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  location: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
  // Extended optional fields for richer itinerary semantics and budget integration
  type: z
    .enum(['transport', 'accommodation', 'food', 'entertainment', 'attraction', 'shopping', 'other'])
    .optional(),
  placeId: z.string().optional(),
  costEstimate: z.number().positive().optional(),
  timeRange: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/).optional()
});

export const ItineraryDaySchema = z.object({
  day_index: z.number().int().positive(),
  segments: z.array(DaySegmentSchema).min(1),
  // 后端计算的当天预算（CNY），可选
  dayBudget: z.number().nonnegative().optional()
});

export const ItinerarySchema = z.object({
  destination: z.string().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.array(ItineraryDaySchema).min(1),
  budget: z.number().positive().optional(),
  party_size: z.number().int().positive().optional()
}).superRefine((val, ctx) => {
  const s = new Date(val.start_date + 'T00:00:00Z').getTime();
  const e = new Date(val.end_date + 'T00:00:00Z').getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'dates must be valid ISO yyyy-mm-dd' });
  } else if (e < s) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'end_date must be >= start_date' });
  }
  for (let i = 0; i < val.days.length; i++) {
    if (val.days[i].day_index !== i + 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `day_index must increment from 1; got ${val.days[i].day_index} at ${i}` });
      break;
    }
  }
});

export type ItineraryDay = z.infer<typeof ItineraryDaySchema>;
export type Itinerary = z.infer<typeof ItinerarySchema>;

export function validateItinerary(it: any): { valid: boolean; errors?: string[] } {
  const parsed = ItinerarySchema.safeParse(it);
  if (parsed.success) return { valid: true };
  const errors = parsed.error.issues.map(i => i.message);
  return { valid: false, errors };
}