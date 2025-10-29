import React, { useEffect, useMemo, useRef, useState } from 'react';
import Card from './Card';

type Segment = { location?: string };
type Day = { segments: Segment[] };
type Itinerary = { destination: string; days: Day[] };

function useLocations(itinerary?: Itinerary) {
  return useMemo(() => {
    const set = new Set<string>();
    if (!itinerary) return [] as string[];
    for (const d of itinerary.days || []) {
      for (const s of d.segments || []) {
        if (s.location && s.location.trim()) set.add(s.location.trim());
      }
    }
    // fallback include destination
    if (itinerary.destination) set.add(itinerary.destination);
    return Array.from(set);
  }, [itinerary]);
}

async function loadAmapScript(key: string): Promise<boolean> {
  if ((window as any).AMap) return true;
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.PlaceSearch`;
    script.async = true;
    script.onload = () => resolve(!!(window as any).AMap);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export default function MapView({ itinerary, apiKey }: { itinerary?: Itinerary; apiKey?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const locations = useLocations(itinerary);

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!apiKey) return;
      const ok = await loadAmapScript(apiKey);
      if (!ok || disposed) return;
      setReady(true);
      try {
        const AMap = (window as any).AMap;
        const map = new AMap.Map(containerRef.current!, { zoom: 11 });
        // simple place search for first location only to demonstrate
        if (locations[0]) {
          AMap.plugin('AMap.PlaceSearch', () => {
            const placeSearch = new AMap.PlaceSearch();
            placeSearch.search(locations[0], (status: string, result: any) => {
              if (status === 'complete' && result?.poiList?.pois?.length) {
                const poi = result.poiList.pois[0];
                const marker = new AMap.Marker({ position: poi.location, title: poi.name });
                map.add(marker);
                map.setCenter(poi.location);
              }
            });
          });
        }
      } catch (_err) {
        // noop; fallback UI will render
      }
    })();
    return () => { disposed = true; };
  }, [apiKey, locations]);

  if (!itinerary) return null;

  return (
    <Card title="地图预览">
      {apiKey && ready ? (
        <div ref={containerRef} style={{ height: 360, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }} />
      ) : (
        <div className="stack">
          <div className="note">未检测到地图脚本或未配置 AMAP_API_KEY，展示地点列表：</div>
          {locations.length === 0 ? (
            <div className="note">行程中未包含地点信息</div>
          ) : (
            <ul style={{ paddingLeft: 16 }}>
              {locations.map((loc) => (
                <li key={loc}>
                  <a href={`https://www.amap.com/search?keywords=${encodeURIComponent(loc)}`} target="_blank" rel="noreferrer">{loc}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}