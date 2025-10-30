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

type ItineraryDay = { day_index: number; segments: DaySegment[] };

type Itinerary = {
  destination: string;
  start_date: string;
  end_date: string;
  days: ItineraryDay[];
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

export default function ItineraryView({ itinerary }: { itinerary: Itinerary }) {
  const [openDays, setOpenDays] = React.useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    for (const d of itinerary.days || []) init[d.day_index] = true;
    return init;
  });

  const toggleDay = (idx: number) => setOpenDays(prev => ({ ...prev, [idx]: !prev[idx] }));

  return (
    <Card title="行程">
      <div className="itinerary-header">
        <div className="itinerary-title">📍 {itinerary.destination}</div>
        <div className="itinerary-dates">🗓️ {itinerary.start_date} → {itinerary.end_date}</div>
      </div>
      <div className="itinerary-days">
        {itinerary.days.map((day) => (
          <div key={day.day_index} className="itinerary-day">
            <div className="day-header" onClick={() => toggleDay(day.day_index)}>
              <div className="day-title">第 {day.day_index} 天</div>
              <button className="day-toggle" type="button">{openDays[day.day_index] ? '收起' : '展开'}</button>
            </div>
            {openDays[day.day_index] && (
              <div className="segments">
                {day.segments.map((seg, i) => {
                  const time = formatTime(seg);
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
                        {seg.notes && <div className="segment-notes">{seg.notes}</div>}
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