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
                  <div>
                    <Button type="button" variant="primary" onClick={() => navigate(`/plan/${p.id}`)}>查看详情</Button>
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