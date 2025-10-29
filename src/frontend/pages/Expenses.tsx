import React, { useEffect, useMemo, useState } from 'react';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import { api } from '../api';

type ExpenseCategory = 'transport' | 'accommodation' | 'food' | 'entertainment' | 'shopping' | 'other';
type ExpenseRecord = { id: number; plan_id: number; date: string; amount: number; category: ExpenseCategory; note?: string | null };
type ExpenseStats = { total: number; byCategory: Record<string, number> };
const categories: ExpenseCategory[] = ['transport','accommodation','food','entertainment','shopping','other'];

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Expenses() {
  const [planId, setPlanId] = useState<number | ''>('');
  const [date, setDate] = useState<string>(today());
  const [amount, setAmount] = useState<number | ''>('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [note, setNote] = useState<string>('');
  const [list, setList] = useState<ExpenseRecord[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [msg, setMsg] = useState<string>('');
  const token = useMemo(() => localStorage.getItem('token') || '', []);

  const canSubmit = useMemo(() => {
    return !!token && typeof planId === 'number' && planId > 0 && typeof amount === 'number' && amount > 0 && !!date;
  }, [token, planId, amount, date]);

  const loadData = async () => {
    setMsg('');
    if (typeof planId !== 'number' || planId <= 0) {
      setMsg('请先输入有效的 planId');
      return;
    }
    const resList = await api<ExpenseRecord[]>(`/expenses?planId=${planId}`);
    if (resList.data) setList(resList.data);
    const resStats = await api<ExpenseStats>(`/expenses/stats?planId=${planId}`);
    if (resStats.data) setStats(resStats.data);
    if (!resList.data || !resStats.data) setMsg(resList.message || resStats.message || '加载失败');
  };

  useEffect(() => {
    // hint: require login
    if (!token) setMsg('请先在“登录”页登录以使用费用接口');
  }, [token]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    if (!canSubmit) {
      setMsg('请填写完整且有效的表单');
      return;
    }
    const res = await api<ExpenseRecord>('/expenses', {
      method: 'POST',
      body: JSON.stringify({ planId, date, amount, category, note: note || undefined, inputMethod: 'text' })
    });
    if (res.data) {
      setMsg('添加成功');
      setAmount('');
      setNote('');
      await loadData();
    } else {
      setMsg(res.message || '添加失败');
    }
  };

  return (
    <div className="container" style={{ maxWidth: 980 }}>
      <div className="grid two">
        <Card title="新增支出">
          <form onSubmit={onAdd} className="stack">
            <Input label="计划ID（planId）" type="number" placeholder="例如：1" value={planId} onChange={e => setPlanId(Number(e.target.value) || '')} />
            <div className="grid two">
              <Input label="日期" placeholder="YYYY-MM-DD" value={date} onChange={e => setDate(e.target.value)} />
              <Input label="金额" type="number" placeholder="例如：100" value={amount} onChange={e => setAmount(Number(e.target.value) || '')} />
            </div>
            <div className="row" style={{ gap: 12, alignItems: 'center' }}>
              <div className="label">类别</div>
              <select value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Input label="备注" placeholder="可选" value={note} onChange={e => setNote(e.target.value)} />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Button type="submit" variant="primary" disabled={!canSubmit}>添加支出</Button>
              <Button type="button" variant="secondary" onClick={loadData}>刷新列表与统计</Button>
              {msg && <span className="note">{msg}</span>}
            </div>
            {!token && <div className="note">未登录，将无法调用受保护的接口。请前往“登录”页。</div>}
          </form>
        </Card>

        <Card title="统计概览">
          {stats ? (
            <div className="stack">
              <div className="kpi">总额：¥ {stats.total.toFixed(2)}</div>
              <ul style={{ paddingLeft: 16 }}>
                {categories.map(c => (
                  <li key={c}>{c}: ¥ {(stats.byCategory?.[c] || 0).toFixed(2)}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="note">暂无统计数据，请先输入 planId 并刷新。</div>
          )}
        </Card>
      </div>

      <div className="spacer" />
      <Card title="支出列表">
        {list.length === 0 ? (
          <div className="note">暂无数据</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border)' }}>日期</th>
                  <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border)' }}>金额</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border)' }}>类别</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border)' }}>备注</th>
                </tr>
              </thead>
              <tbody>
                {list.map(r => (
                  <tr key={r.id}>
                    <td style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>{r.date}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid var(--border)', textAlign: 'right' }}>¥ {r.amount.toFixed(2)}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>{r.category}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>{r.note || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}