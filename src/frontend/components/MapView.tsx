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

function useDayLocations(itinerary?: Itinerary) {
  return useMemo(() => {
    if (!itinerary) return [] as string[][];
    const days = itinerary.days || [];
    return days.map(d => {
      const list: string[] = [];
      for (const s of d.segments || []) {
        if (s.location && s.location.trim()) list.push(s.location.trim());
      }
      return list;
    });
  }, [itinerary]);
}

function getDayColor(idx: number) {
  const palette = ['#2f54eb', '#13c2c2', '#eb2f96', '#52c41a', '#fa8c16', '#722ed1'];
  if (idx < 0) return '#faad14'; // 全部天数综合路线
  return palette[idx % palette.length];
}

// Load Baidu Maps JS v3.0 (non‑GL) via getscript to avoid document.write
async function loadBaiduScript(ak: string): Promise<boolean> {
  if ((window as any).BMap) return true;
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = `https://api.map.baidu.com/getscript?v=3.0&ak=${ak}&services=`;
    script.async = true;
    script.onload = () => resolve(!!(window as any).BMap);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

function waitForGlobal(key: 'BMap' | 'BMapGL', timeoutMs = 4000): Promise<boolean> {
  const start = Date.now();
  return new Promise(resolve => {
    const tick = () => {
      if ((window as any)[key]) return resolve(true);
      if (Date.now() - start >= timeoutMs) return resolve(false);
      setTimeout(tick, 50);
    };
    tick();
  });
}

// Load Baidu Maps GL JS (webgl) via getscript as fallback
async function loadBaiduGLScript(ak: string): Promise<boolean> {
  if ((window as any).BMapGL) return true;
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = `https://api.map.baidu.com/getscript?type=webgl&v=1.0&ak=${ak}&services=`;
    script.async = true;
    script.onload = () => resolve(!!(window as any).BMapGL);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export default function MapView({ itinerary, apiKey }: { itinerary?: Itinerary; apiKey?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const locations = useLocations(itinerary);
  const dayLocations = useDayLocations(itinerary);
  const [dayIndex, setDayIndex] = useState<number>(0); // -1 代表“全部天数”

  useEffect(() => {
    // 选择第一个有地点的日期作为默认
    if (dayLocations.length > 0) {
      const firstIdx = dayLocations.findIndex(dl => dl.length > 0);
      setDayIndex(firstIdx >= 0 ? firstIdx : 0);
    } else {
      setDayIndex(0);
    }
  }, [dayLocations.length]);

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!apiKey) return;
      const ok = await loadBaiduScript(apiKey);
      const bmapReady = ok ? await waitForGlobal('BMap', 4000) : false;
      if (bmapReady && !disposed && (window as any).BMap && containerRef.current) {
        try {
          const BMap = (window as any).BMap;
          const map = new BMap.Map(containerRef.current!);
          map.enableScrollWheelZoom(true);
          if (disposed) return;
          setReady(true);
          mapRef.current = map;
          const allList = dayLocations.flat();
          const list = dayIndex === -1 ? allList : (dayLocations[dayIndex] || []);
          // 设置一个安全的初始中心，避免地图未居中时显示空白
          const seedName = list[0] || (itinerary?.destination ? String(itinerary.destination) : undefined);
          if (seedName) {
            try { map.centerAndZoom(seedName, 11); } catch { /* noop */ }
          }
          await drawDayRouteBMap(mapRef.current, list, itinerary?.destination, getDayColor(dayIndex));
        } catch (_err) {
          if (!disposed) {
            setLoadError('地图初始化失败，请检查百度浏览器端AK与域名白名单');
            setReady(false);
          }
        }
        return;
      }

      // 回退到GL版本，仅初始化地图（GL下不使用 REST 与 LocalSearch）
      const glOk = await loadBaiduGLScript(apiKey);
      const glReady = glOk ? await waitForGlobal('BMapGL', 4000) : false;
      if (!glReady || disposed || !(window as any).BMapGL) {
        if (!disposed) setLoadError('地图脚本加载失败（非GL与GL均不可用）');
        return;
      }
      try {
        const BMapGL = (window as any).BMapGL;
        if (!containerRef.current) throw new Error('地图容器尚未渲染');
        const map = new BMapGL.Map(containerRef.current!);
        map.enableScrollWheelZoom(true);
        if (disposed) return;
        setReady(true);
        // GL 模式下，若无坐标检索能力，这里仅保持地图可用，用户可用链接导航
      } catch (_err) {
        if (!disposed) {
          setLoadError('地图初始化失败（GL），请检查百度浏览器端AK与域名白名单');
          setReady(false);
        }
      }
    })();
    return () => { disposed = true; };
  }, [apiKey]);

  useEffect(() => {
    // 日期切换或行程变更时重绘（非GL）
    const BMap = (window as any).BMap;
    if (BMap && mapRef.current) {
      const allList = dayLocations.flat();
      const list = dayIndex === -1 ? allList : (dayLocations[dayIndex] || []);
      drawDayRouteBMap(mapRef.current, list, itinerary?.destination, getDayColor(dayIndex));
    }
  }, [dayIndex, itinerary, dayLocations]);

  async function drawDayRouteBMap(map: any, keywords: string[], dest?: string, color = '#2f54eb') {
    const BMap = (window as any).BMap;
    if (!BMap || !map) return;
    try {
      map.clearOverlays();
      const points: any[] = [];
      const seen = new Set<string>();

      const searchOne = (kw: string) => new Promise<any>((resolve) => {
        try {
          const local = new BMap.LocalSearch(map, {
            onSearchComplete: (results: any) => {
              try {
                const poi = results && typeof results.getPoi === 'function' ? results.getPoi(0) : null;
                resolve(poi && poi.point ? poi.point : null);
              } catch { resolve(null); }
            }
          });
          local.search(kw);
        } catch { resolve(null); }
      });

      for (let i = 0; i < keywords.length; i++) {
        const kw = keywords[i];
        if (!kw || seen.has(kw)) continue;
        seen.add(kw);
        const pt = await searchOne(kw);
        if (pt) {
          points.push(pt);
          const marker = new BMap.Marker(pt);
          map.addOverlay(marker);
          // 标签显示序号与名称
          const label = new BMap.Label(`${i + 1}. ${kw}`, { offset: new BMap.Size(12, -20) });
          label.setStyle({
            color: '#fff',
            backgroundColor: color,
            border: 'none',
            borderRadius: '6px',
            padding: '2px 6px',
            fontSize: '12px'
          } as any);
          marker.setLabel(label);
        }
      }

      if (points.length > 1) {
        const polyline = new BMap.Polyline(points, { strokeColor: color, strokeWeight: 4, strokeOpacity: 0.9 });
        map.addOverlay(polyline);
        map.setViewport(points);
      } else if (points.length === 1) {
        map.centerAndZoom(points[0], 12);
      } else if (dest) {
        const pt = await searchOne(String(dest));
        if (pt) {
          map.centerAndZoom(pt, 11);
        }
      }
    } catch { /* noop */ }
  }

  if (!itinerary) return null;

  return (
    <Card title="地图预览">
      {dayLocations.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setDayIndex(-1)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: dayIndex === -1 ? getDayColor(-1) : 'var(--bg)',
              color: dayIndex === -1 ? '#fff' : 'var(--fg)',
              cursor: 'pointer'
            }}
          >全部</button>
          {dayLocations.map((dl, idx) => (
            <button
              key={idx}
              onClick={() => setDayIndex(idx)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: idx === dayIndex ? getDayColor(idx) : 'var(--bg)',
                color: idx === dayIndex ? '#fff' : 'var(--fg)',
                cursor: 'pointer'
              }}
            >第{idx + 1}天{dl.length ? `（${dl.length}点）` : ''}</button>
          ))}
        </div>
      )}
      {apiKey && (
        <div ref={containerRef} style={{ height: 360, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 12 }} />
      )}
      {(!apiKey || !ready) && (
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