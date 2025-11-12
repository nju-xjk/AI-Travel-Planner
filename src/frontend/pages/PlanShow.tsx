import React from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import Card from '../components/Card';
import ItineraryView from '../components/ItineraryView';
import MapView from '../components/MapView';
import Button from '../components/Button';
import Input from '../components/Input';
import DatePicker from '../components/DatePicker';
import PieChart from '../components/PieChart';

type PlanDetail = {
  id: number;
  origin?: string;
  destination: string;
  start_date: string;
  end_date: string;
  budget?: number;
  party_size?: number;
  days: { day_index: number; segments: any[] }[];
};

export default function PlanShow() {
  const { id } = useParams();
  const [plan, setPlan] = React.useState<PlanDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [msg, setMsg] = React.useState('');
  const [baiduAk, setBaiduAk] = React.useState<string | undefined>();
  const [selectedDay, setSelectedDay] = React.useState<number>(0);
  const [viewTab, setViewTab] = React.useState<'itinerary' | 'expenses'>('itinerary');

  // 费用与支出管理（按行程）
  type ExpenseCategory = 'transport' | 'accommodation' | 'food' | 'entertainment' | 'shopping' | 'other';
  type ExpenseRecord = { id: number; plan_id: number; date: string; amount: number; category: ExpenseCategory; note?: string | null };
  type ExpenseStats = { total: number; byCategory: Record<string, number> };
  const categories: ExpenseCategory[] = ['transport','accommodation','food','entertainment','shopping','other'];
  const categoryLabels: Record<ExpenseCategory, string> = {
    transport: '交通',
    accommodation: '住宿',
    food: '餐饮',
    entertainment: '景点/娱乐',
    shopping: '购物',
    other: '其他'
  };
  const today = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const [date, setDate] = React.useState<string>(today());
  const [amount, setAmount] = React.useState<number | ''>('');
  const [category, setCategory] = React.useState<ExpenseCategory>('food');
  const [note, setNote] = React.useState<string>('');
  const [expList, setExpList] = React.useState<ExpenseRecord[]>([]);
  const [expStats, setExpStats] = React.useState<ExpenseStats | null>(null);
  const [expMsg, setExpMsg] = React.useState<string>('');
  const canSubmit = React.useMemo(() => {
    if (!plan?.id) return false;
    const inRange = (!plan?.start_date || date >= plan.start_date) && (!plan?.end_date || date <= plan.end_date);
    return typeof amount === 'number' && amount > 0 && !!date && inRange;
  }, [plan?.id, amount, date, plan?.start_date, plan?.end_date]);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await api<Record<string, any>>('/settings');
        if (res.data && typeof res.data.BAIDU_BROWSER_AK === 'string') {
          setBaiduAk(res.data.BAIDU_BROWSER_AK);
        }
      } catch {}
    })();
  }, []);

  React.useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);
      const res = await api<PlanDetail>(`/plans/${id}`);
      if (!res.data) {
        setMsg(res.message || '获取行程详情失败');
        setPlan(null);
      } else {
        setPlan(res.data);
        setSelectedDay(0);
        // 若当前日期不在行程范围内，则默认设为行程开始日期
        const s = res.data.start_date;
        const e = res.data.end_date;
        if (date < s || date > e) setDate(s);
      }
      setLoading(false);
    })();
  }, [id]);

  const loadExpenses = React.useCallback(async () => {
    if (!plan?.id) return;
    setExpMsg('');
    const resList = await api<ExpenseRecord[]>(`/expenses?planId=${plan.id}`);
    if (resList.data) setExpList(resList.data);
    const resStats = await api<ExpenseStats>(`/expenses/stats?planId=${plan.id}`);
    if (resStats.data) setExpStats(resStats.data);
    if (!resList.data || !resStats.data) setExpMsg(resList.message || resStats.message || '加载失败');
  }, [plan?.id]);

  React.useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const onAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpMsg('');
    if (!canSubmit || !plan?.id) {
      setExpMsg('请填写有效的金额与日期');
      return;
    }
    const res = await api<ExpenseRecord>('/expenses', {
      method: 'POST',
      body: JSON.stringify({ planId: plan.id, date, amount, category, note: note || undefined, inputMethod: 'text' })
    });
    if (res.data) {
      setExpMsg('添加成功');
      setAmount('');
      setNote('');
      await loadExpenses();
    } else {
      setExpMsg(res.message || '添加失败');
    }
  };

  return (
    <div className="container" style={{ maxWidth: 1180 }}>
      {loading && (
        <Card>
          <div>加载中…</div>
        </Card>
      )}
      {!loading && !plan && (
        <Card>
          <div>未找到该行程或无权限查看。</div>
        </Card>
      )}

      {plan && (
        <div className="stack" style={{ gap: 16 }}>
              {/* 元信息模块：增加标题“行程详情”，居中展示地点、日期、人数、总预算 */}
              <Card title="行程详情">
                <div className="meta-bar">
                  <span className="meta-chip"><strong>📍</strong> {plan.origin ? `${plan.origin} → ${plan.destination}` : plan.destination}</span>
                  <span className="meta-chip"><strong>🗓️</strong> {plan.start_date} → {plan.end_date}</span>
                  {typeof plan.party_size === 'number' && plan.party_size > 0 ? (
                    <span className="meta-chip"><strong>👥</strong> {plan.party_size}人</span>
                  ) : null}
                  {(() => {
                    const days = plan?.days || [];
                let total = typeof plan?.budget === 'number' ? Number(plan.budget) : 0;
                if (!total) {
                  let sumDay = 0; let hasDay = false;
                  days.forEach((d: any) => { if (typeof d?.dayBudget === 'number') { sumDay += Number(d.dayBudget); hasDay = true; } });
                  total = hasDay ? sumDay : 0;
                }
                if (!total) {
                  let sumSeg = 0;
                  days.forEach((d: any) => (d?.segments || []).forEach((s: any) => { if (typeof s?.costEstimate === 'number') sumSeg += Number(s.costEstimate); }));
                  total = sumSeg;
                }
                return total > 0 ? <span className="meta-chip"><strong>💰</strong> 总预算：¥{Math.round(total)}</span> : null;
              })()}
                </div>
              </Card>
              {msg && <span className="note">{msg}</span>}

          {/* 视图切换：具体行程 / 费用管理 */}
          <Card>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setViewTab('itinerary')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: viewTab === 'itinerary' ? 'var(--primary)' : 'var(--bg)',
                  color: viewTab === 'itinerary' ? '#fff' : 'var(--text)',
                  cursor: 'pointer'
                }}
              >具体行程</button>
              <button
                type="button"
                onClick={() => setViewTab('expenses')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: viewTab === 'expenses' ? 'var(--primary)' : 'var(--bg)',
                  color: viewTab === 'expenses' ? '#fff' : 'var(--text)',
                  cursor: 'pointer'
                }}
              >费用管理</button>
            </div>
          </Card>

          {viewTab === 'itinerary' && (
            <>
              <Card title="选择查看的日期">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {plan.days.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedDay(idx)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: idx === selectedDay ? 'var(--primary)' : 'var(--bg)',
                        color: idx === selectedDay ? '#fff' : 'var(--fg)',
                        cursor: 'pointer'
                      }}
                    >第{idx + 1}天</button>
                  ))}
                </div>
              </Card>

              <div className="grid two">
                <div className={((plan.days?.[selectedDay]?.segments || []).length) < 4 ? 'fit-column' : undefined} style={{ minHeight: ((plan.days?.[selectedDay]?.segments || []).length) < 4 ? 550 : undefined }}>
                  <ItineraryView itinerary={plan as any} singleDayIndex={selectedDay} hideHeaderMeta={true} />
                </div>
                <MapView itinerary={plan as any} apiKey={baiduAk} dayIndex={selectedDay} hideControls={true} />
              </div>
            </>
          )}

          {viewTab === 'expenses' && (
            <>
              {/* 费用与支出管理 */}
              <div className="spacer" />
              <div className="grid two">
                <Card title="新增支出">
                  <form onSubmit={onAddExpense} className="stack">
                    <div className="grid two">
                      <DatePicker label="日期" value={date} onChange={(v) => setDate(v)} min={plan.start_date} max={plan.end_date} />
                      <Input label="金额" type="number" placeholder="例如：100" value={amount} onChange={e => setAmount(Number(e.target.value) || '')} />
                    </div>
                    <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                      <div className="label">类别</div>
                      <select value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                        {categories.map(c => <option key={c} value={c}>{categoryLabels[c]}</option>)}
                      </select>
                    </div>
                    <Input label="备注" placeholder="可选" value={note} onChange={e => setNote(e.target.value)} />
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Button type="submit" variant="primary" disabled={!canSubmit}>添加支出</Button>
                      <Button type="button" variant="secondary" onClick={loadExpenses}>刷新列表与统计</Button>
                      {expMsg && <span className="note">{expMsg}</span>}
                    </div>
                  </form>
                </Card>

                <Card title="统计概览">
                  {expStats ? (
                    (() => {
                      const colorMap: Record<string, string> = {
                        transport: '#4C78A8',
                        accommodation: '#F58518',
                        food: '#54A24B',
                        entertainment: '#E45756',
                        shopping: '#72B7B2',
                        other: '#B279A2'
                      };
                      const chartData = categories.map(c => ({
                        label: categoryLabels[c],
                        value: Number(expStats.byCategory?.[c] || 0),
                        color: colorMap[c]
                      }));
                      return (
                        <div className="chart-card">
                          <PieChart data={chartData} size={170} thickness={34} />
                        </div>
                      );
                    })()
                  ) : (
                    <div className="note">暂无统计数据，请先添加支出或刷新。</div>
                  )}
                </Card>
              </div>

              <div className="spacer" />
              <Card title="支出列表">
                {expList.length === 0 ? (
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
                        {expList.map(r => (
                          <tr key={r.id}>
                            <td style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>{r.date}</td>
                            <td style={{ padding: 8, borderBottom: '1px solid var(--border)', textAlign: 'right' }}>¥ {r.amount.toFixed(2)}</td>
                            <td style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>{categoryLabels[r.category]}</td>
                            <td style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>{r.note || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}