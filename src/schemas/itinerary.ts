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
  // 允许为 0（例如步行交通或免费景点）；非负更合理
  costEstimate: z.number().nonnegative().optional(),
  timeRange: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/).optional()
});

export const ItineraryDaySchema = z.object({
  day_index: z.number().int().positive(),
  segments: z.array(DaySegmentSchema).min(1),
  // 后端计算的当天预算（CNY），可选
  dayBudget: z.number().nonnegative().optional()
});

export const ItinerarySchema = z.object({
  origin: z.string().min(1),
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

// 质量评估：在通过基本 Schema 后，进一步判断是否“足够细致”
export function evaluateItineraryQuality(it: any): { ok: boolean; score: number; reasons: string[] } {
  const reasons: string[] = [];
  const base = ItinerarySchema.safeParse(it);
  if (!base.success) {
    return { ok: false, score: 0, reasons: ['schema invalid'] };
  }
  const val = base.data;
  const days = val.days || [];
  const dayCount = days.length;
  if (dayCount <= 0) {
    return { ok: false, score: 0, reasons: ['no days'] };
  }
  let score = 0;

  // 规则1：每天≥4段
  const minSegPerDay = 4;
  const segEnoughDays = days.filter(d => (d.segments || []).length >= minSegPerDay).length;
  if (segEnoughDays < dayCount) {
    reasons.push(`not enough segments per day: ${segEnoughDays}/${dayCount} meet >=${minSegPerDay}`);
  } else {
    score += 20;
  }

  // 规则2：type 填写率≥80%
  const allSegs = days.flatMap(d => d.segments || []);
  const typeFilled = allSegs.filter(s => typeof (s as any).type === 'string' && ((s as any).type as string).length > 0).length;
  const typeRate = allSegs.length ? typeFilled / allSegs.length : 0;
  if (typeRate < 0.8) {
    reasons.push(`type filled rate too low: ${(typeRate * 100).toFixed(0)}%`);
  } else {
    score += 20;
  }

  // 规则3：有时间信息（timeRange 或 startTime/endTime）比例≥70%
  const timeFilled = allSegs.filter(s => {
    const a = s as any;
    return (typeof a.timeRange === 'string' && /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(a.timeRange))
      || (typeof a.startTime === 'string' && /^\d{2}:\d{2}$/.test(a.startTime))
      || (typeof a.endTime === 'string' && /^\d{2}:\d{2}$/.test(a.endTime));
  }).length;
  const timeRate = allSegs.length ? timeFilled / allSegs.length : 0;
  if (timeRate < 0.7) {
    reasons.push(`time info rate too low: ${(timeRate * 100).toFixed(0)}%`);
  } else {
    score += 20;
  }

  // 规则4：costEstimate 填写比例≥70%
  const costFilled = allSegs.filter(s => typeof (s as any).costEstimate === 'number' && Number((s as any).costEstimate) >= 0).length;
  const costRate = allSegs.length ? costFilled / allSegs.length : 0;
  if (costRate < 0.7) {
    reasons.push(`costEstimate rate too low: ${(costRate * 100).toFixed(0)}%`);
  } else {
    score += 20;
  }

  // 规则5：关键类型必须有具体地点（accommodation/food/attraction）
  const mustHaveLocTypes = new Set(['accommodation', 'food', 'attraction']);
  const missingLoc = allSegs.filter(s => mustHaveLocTypes.has(((s as any).type || '').toString()) && (!((s as any).location) || !String((s as any).location).trim())).length;
  if (missingLoc > 0) {
    reasons.push(`some key segments missing location: ${missingLoc}`);
  } else {
    score += 10;
  }

  // 规则6：至少有一个交通段（transport）
  const hasTransport = allSegs.some(s => ((s as any).type || '') === 'transport');
  if (!hasTransport) {
    reasons.push('no transport segment present');
  } else {
    score += 10;
  }

  // 规则7（关键约束）：每天至少包含午餐与晚餐两个餐饮段（type=food）
  const daysMealsOk = days.every(d => {
    const foodCount = (d.segments || []).filter(s => ((s as any).type || '') === 'food').length;
    return foodCount >= 2; // 至少午餐与晚餐
  });
  if (!daysMealsOk) {
    reasons.push('meals missing: 每天至少午餐与晚餐 (type=food)');
  } else {
    score += 10;
  }

  // 综合阈值：必须满足餐饮关键约束，同时分数与问题数量达到要求
  const ok = daysMealsOk && score >= 60 && reasons.length <= 2;
  return { ok, score, reasons };
}