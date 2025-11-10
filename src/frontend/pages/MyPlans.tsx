import React from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Card from '../components/Card';
import Button from '../components/Button';

type PlanBasic = {
  id: number;
  destination: string;
  start_date: string;
  end_date: string;
  budget?: number;
  party_size?: number;
  created_at: string;
};

export default function MyPlans() {
  const navigate = useNavigate();
  const [plans, setPlans] = React.useState<PlanBasic[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [msg, setMsg] = React.useState('');
  const [deletingId, setDeletingId] = React.useState<number | null>(null);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api<PlanBasic[]>('/plans/my');
      if (!res.data) {
        setMsg(res.message || '获取行程列表失败');
        setPlans([]);
      } else {
        setPlans(res.data);
      }
      setLoading(false);
    })();
  }, []);

  async function onDeletePlan(id: number) {
    if (deletingId) return; // prevent concurrent
    const ok = window.confirm('确定要删除该行程吗？该操作不可恢复。');
    if (!ok) return;
    setDeletingId(id);
    setMsg('');
    try {
      const res = await api<{ id: number }>(`/plans/${id}`, { method: 'DELETE' });
      if (!res.data) {
        setMsg(res.message || '删除失败');
      } else {
        setPlans(prev => prev.filter(p => p.id !== id));
        setMsg('已删除该行程');
      }
    } catch (e) {
      setMsg('删除失败');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 960 }}>
      <Card title="我的行程">
        {loading && <div>加载中…</div>}
        {!loading && plans.length === 0 && (
          <div className="stack">
            <div>暂无已保存的行程。</div>
            <div>
              <Button type="button" variant="primary" onClick={() => navigate('/plan/new')}>去新建行程</Button>
            </div>
          </div>
        )}
        {!loading && plans.length > 0 && (
          <div className="stack" style={{ gap: 12 }}>
            {plans.map(p => (
              <div key={p.id} className="card" style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontWeight: 600 }}>{p.destination}</div>
                    <div className="note">{p.start_date} ~ {p.end_date}{p.party_size ? ` · ${p.party_size}人` : ''}{p.budget ? ` · 预算¥${p.budget}` : ''}</div>
                    <div className="note">保存于 {new Date(p.created_at).toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button type="button" variant="primary" onClick={() => navigate(`/plan/${p.id}`)}>查看详情</Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => onDeletePlan(p.id)}
                      disabled={deletingId === p.id}
                    >{deletingId === p.id ? '删除中…' : '删除'}</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {msg && <span className="note">{msg}</span>}
      </Card>
    </div>
  );
}