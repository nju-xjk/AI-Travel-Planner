import React, { useState } from 'react';
import { api } from '../api';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import MapView from '../components/MapView';

type Itinerary = { destination: string; start_date: string; end_date: string; days: any[] };

export default function PlanNew() {
  const [destination, setDestination] = useState('Hangzhou');
  const [start_date, setStart] = useState('2025-05-01');
  const [end_date, setEnd] = useState('2025-05-02');
  const [result, setResult] = useState<any>(null);
  const [budget, setBudget] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [amapKey, setAmapKey] = useState<string | undefined>(undefined);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await api<Record<string, any>>('/settings');
        if (res.data && typeof res.data.AMAP_API_KEY === 'string') {
          setAmapKey(res.data.AMAP_API_KEY);
        }
      } catch { /* noop */ }
    })();
  }, []);

  const onGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setResult(null);
    setBudget(null);
    setLoading(true);
    const gen = await api<Itinerary>('/planner/generate', {
      method: 'POST',
      body: JSON.stringify({ destination, start_date, end_date })
    });
    if (!gen.data) {
      setLoading(false);
      setMsg(gen.message || '生成失败');
      return;
    }
    setResult(gen.data);
    const est = await api<any>('/budget/estimate', {
      method: 'POST',
      body: JSON.stringify({ destination, start_date, end_date, party_size: 2, itinerary: gen.data })
    });
    setLoading(false);
    if (est.data) setBudget(est.data);
  };

  return (
    <div className="container" style={{ maxWidth: 980 }}>
      <div className="grid two">
        <Card title="新建行程">
          <form onSubmit={onGenerate} className="stack">
            <Input label="目的地" placeholder="目的地" value={destination} onChange={e => setDestination(e.target.value)} />
            <div className="grid two">
              <Input label="开始日期" placeholder="YYYY-MM-DD" value={start_date} onChange={e => setStart(e.target.value)} />
              <Input label="结束日期" placeholder="YYYY-MM-DD" value={end_date} onChange={e => setEnd(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Button type="submit" variant="primary" disabled={loading}>{loading ? '生成中...' : '生成行程并估算预算'}</Button>
              {msg && <span className="note">{msg}</span>}
            </div>
            <div className="note">生成后将自动调用预算估算。</div>
          </form>
        </Card>

        {result && (
          <>
            <Card title="行程">
              <div className="kpi">📍 {result.destination} · 🗓️ {result.start_date} → {result.end_date}</div>
              <div className="spacer" />
              <pre style={{ background: '#0a1020', padding: 12, borderRadius: 12, border: '1px solid var(--border)', overflow: 'auto' }}>{JSON.stringify(result, null, 2)}</pre>
            </Card>
            <div className="spacer" />
            <MapView itinerary={result} apiKey={amapKey} />
          </>
        )}
      </div>

      {budget && (
        <>
          <div className="spacer" />
          <Card title="预算估算">
            <pre style={{ background: '#0a1020', padding: 12, borderRadius: 12, border: '1px solid var(--border)', overflow: 'auto' }}>{JSON.stringify(budget, null, 2)}</pre>
          </Card>
        </>
      )}
    </div>
  );
}