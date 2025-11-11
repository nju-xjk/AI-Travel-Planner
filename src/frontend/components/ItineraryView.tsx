import React from 'react';
import Card from './Card';

type DaySegment = {
  title: string;
  startTime?: string;
  endTime?: string;
  timeRange?: string;
  location?: string;
  notes?: string;
  type?: 'transport' | 'accommodation' | 'food' | 'entertainment' | 'attraction' | 'shopping' | 'other';
  costEstimate?: number;
};

type ItineraryDay = { day_index: number; segments: DaySegment[]; dayBudget?: number };

type Itinerary = {
  origin?: string;
  destination: string;
  start_date: string;
  end_date: string;
  days: ItineraryDay[];
  budget?: number;
};

function typeIcon(type?: DaySegment['type']): string {
  switch (type) {
    case 'transport': return '🛫';
    case 'accommodation': return '🏨';
    case 'food': return '🍽️';
    case 'entertainment': return '🎭';
    case 'attraction': return '📍';
    case 'shopping': return '🛍️';
    default: return '📝';
  }
}

function formatTime(seg: DaySegment): string | null {
  if (seg.timeRange) return seg.timeRange;
  if (seg.startTime && seg.endTime) return `${seg.startTime}-${seg.endTime}`;
  if (seg.startTime) return seg.startTime;
  if (seg.endTime) return seg.endTime;
  return null;
}

export default function ItineraryView({ itinerary, singleDayIndex }: { itinerary: Itinerary; singleDayIndex?: number }) {
  const [openDays, setOpenDays] = React.useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    for (const d of itinerary.days || []) init[d.day_index] = true;
    return init;
  });

  const toggleDay = (idx: number) => setOpenDays(prev => ({ ...prev, [idx]: !prev[idx] }));

  return (
    <Card>
      <div className="itinerary-header">
        <div className="itinerary-title">📍 {itinerary.origin ? `${itinerary.origin} → ${itinerary.destination}` : itinerary.destination}</div>
        <div className="itinerary-dates">🗓️ {itinerary.start_date} → {itinerary.end_date}</div>
        {/* 全局总预算不再显示，改为“当天预算”在各天标题处展示 */}
      </div>
      <div className="itinerary-days">
        {(typeof singleDayIndex === 'number' ? [itinerary.days[singleDayIndex]].filter(Boolean) : itinerary.days).map((day) => (
          <div key={day.day_index} className="itinerary-day">
            <div className="day-header" onClick={() => toggleDay(day.day_index)}>
              <div className="day-title">第 {day.day_index} 天</div>
              {(() => {
                const computed = typeof day.dayBudget === 'number' ? day.dayBudget : (day.segments || []).reduce((sum, s) => sum + (Number(s.costEstimate) > 0 ? Number(s.costEstimate) : 0), 0);
                return computed > 0 ? (
                  <div className="day-title" style={{ marginLeft: 'auto', fontWeight: 500 }}>💰 当天预算：¥{Math.round(computed)}</div>
                ) : null;
              })()}
              {typeof singleDayIndex !== 'number' && (
                <button className="day-toggle" type="button">{openDays[day.day_index] ? '收起' : '展开'}</button>
              )}
            </div>
            {(typeof singleDayIndex === 'number' ? true : openDays[day.day_index]) && (
              <div className="segments">
                {day.segments.map((seg, i) => {
                  const time = formatTime(seg);
                  const displayNotes = (() => {
                    const raw = (seg.notes || '').trim();
                    if (!raw) return '';
                    // 过滤后端注入的请求ID调试信息，避免污染用户界面
                    const cleaned = raw.replace(/\breqId:[a-z0-9-]{8,}\b/i, '').trim();
                    return cleaned;
                  })();
                  return (
                    <div key={i} className="segment-card">
                      <div className="segment-icon" title={seg.type || 'other'}>{typeIcon(seg.type)}</div>
                      <div className="segment-main">
                        <div className="segment-title">{seg.title}</div>
                        <div className="segment-meta">
                          {time && <span className="chip">{time}</span>}
                          {seg.location && (
                            <a className="chip link" href={`https://map.baidu.com/search/${encodeURIComponent(seg.location)}`} target="_blank" rel="noreferrer">
                              {seg.location}
                            </a>
                          )}
                          {typeof seg.costEstimate === 'number' && <span className="chip">¥{seg.costEstimate}</span>}
                        </div>
                        {displayNotes && <div className="segment-notes">{displayNotes}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}