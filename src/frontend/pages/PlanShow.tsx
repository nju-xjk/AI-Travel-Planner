import React from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import Card from '../components/Card';
import ItineraryView from '../components/ItineraryView';
import MapView from '../components/MapView';
import Button from '../components/Button';

type PlanDetail = {
  id: number;
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
      }
      setLoading(false);
    })();
  }, [id]);

  return (
    <div className="container" style={{ maxWidth: 1180 }}>
      <Card title="行程详情">
        {loading && <div>加载中…</div>}
        {!loading && !plan && <div>未找到该行程或无权限查看。</div>}
        {!loading && plan && (
          <div className="stack" style={{ gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600 }}>{plan.destination}</div>
              <div className="note">{plan.start_date} ~ {plan.end_date}{plan.party_size ? ` · ${plan.party_size}人` : ''}{plan.budget ? ` · 预算¥${plan.budget}` : ''}</div>
            </div>
            <div className="note">行程ID：{plan.id}</div>
          </div>
        )}
        {msg && <span className="note">{msg}</span>}
      </Card>

      {plan && (
        <div className="stack" style={{ gap: 16 }}>
          {plan.days.map((d, idx) => (
            <div key={idx} className="grid two">
              <ItineraryView itinerary={plan as any} singleDayIndex={idx} />
              <MapView itinerary={plan as any} apiKey={baiduAk} dayIndex={idx} hideControls={true} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}