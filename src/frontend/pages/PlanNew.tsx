import React, { useState } from 'react';
import { api } from '../api';

type Itinerary = { destination: string; start_date: string; end_date: string; days: any[] };

export default function PlanNew() {
  const [destination, setDestination] = useState('Hangzhou');
  const [start_date, setStart] = useState('2025-05-01');
  const [end_date, setEnd] = useState('2025-05-02');
  const [result, setResult] = useState<any>(null);
  const [budget, setBudget] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const onGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setResult(null);
    setBudget(null);
    const gen = await api<Itinerary>('/planner/generate', {
      method: 'POST',
      body: JSON.stringify({ destination, start_date, end_date })
    });
    if (!gen.data) {
      setMsg(gen.message || '生成失败');
      return;
    }
    setResult(gen.data);
    const est = await api<any>('/budget/estimate', {
      method: 'POST',
      body: JSON.stringify({ destination, start_date, end_date, party_size: 2, itinerary: gen.data })
    });
    if (est.data) setBudget(est.data);
  };

  return (
    <div>
      <h2>新建行程</h2>
      <form onSubmit={onGenerate} style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
        <input placeholder="目的地" value={destination} onChange={e => setDestination(e.target.value)} />
        <input placeholder="开始日期" value={start_date} onChange={e => setStart(e.target.value)} />
        <input placeholder="结束日期" value={end_date} onChange={e => setEnd(e.target.value)} />
        <button type="submit">生成行程并估算预算</button>
        {msg && <div>{msg}</div>}
      </form>
      {result && (
        <div style={{ marginTop: 16 }}>
          <h3>行程</h3>
          <pre style={{ background: '#f6f8fa', padding: 12 }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
      {budget && (
        <div style={{ marginTop: 16 }}>
          <h3>预算估算</h3>
          <pre style={{ background: '#f6f8fa', padding: 12 }}>{JSON.stringify(budget, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}