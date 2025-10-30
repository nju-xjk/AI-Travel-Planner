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

// Load Baidu Maps JS v3.0 (non‑GL) to use LocalSearch easily
async function loadBaiduScript(ak: string): Promise<boolean> {
  if ((window as any).BMap) return true;
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = `https://api.map.baidu.com/api?v=3.0&ak=${ak}`;
    script.async = true;
    script.onload = () => resolve(!!(window as any).BMap);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export default function MapView({ itinerary, apiKey }: { itinerary?: Itinerary; apiKey?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const locations = useLocations(itinerary);

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!apiKey) return;
      const ok = await loadBaiduScript(apiKey);
      if (!ok || disposed) {
        if (!disposed) setLoadError('地图脚本加载失败');
        return;
      }
      try {
        const BMap = (window as any).BMap;
        const map = new BMap.Map(containerRef.current!);
        map.enableScrollWheelZoom(true);
        if (disposed) return;
        setReady(true);
        // simple place search for first location only to demonstrate
        if (locations[0]) {
          const local = new BMap.LocalSearch(map, {
            onSearchComplete: (results: any) => {
              try {
                if (!results || typeof results.getPoi !== 'function') return;
                const poi = results.getPoi(0);
                if (!poi || !poi.point) return;
                const marker = new BMap.Marker(poi.point);
                map.addOverlay(marker);
                map.centerAndZoom(poi.point, 12);
              } catch { /* noop */ }
            }
          });
          local.search(locations[0]);
        } else if (itinerary?.destination) {
          const local = new BMap.LocalSearch(map, {
            onSearchComplete: (results: any) => {
              try {
                const poi = results.getPoi(0);
                if (poi?.point) {
                  map.centerAndZoom(poi.point, 11);
                }
              } catch { /* noop */ }
            }
          });
          local.search(String(itinerary.destination));
        }
      } catch (_err) {
        if (!disposed) {
          setLoadError('地图初始化失败，请检查百度浏览器端AK与域名白名单');
          setReady(false);
        }
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
          <div className="note">
            {loadError ? loadError : '未检测到地图脚本或未配置百度浏览器端AK，展示地点列表：'}
          </div>
          {locations.length === 0 ? (
            <div className="note">行程中未包含地点信息</div>
          ) : (
            <ul style={{ paddingLeft: 16 }}>
              {locations.map((loc) => (
                <li key={loc}>
                  <a href={`https://map.baidu.com/search/${encodeURIComponent(loc)}`} target="_blank" rel="noreferrer">{loc}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}