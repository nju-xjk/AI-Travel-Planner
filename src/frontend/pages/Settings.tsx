import React, { useEffect, useState } from 'react';
import { api } from '../api';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';

type Settings = Record<string, any>;

export default function Settings() {
  const [settings, setSettings] = useState<Settings>({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const res = await api<Settings>('/settings');
      if (res.data) setSettings(res.data);
    })();
  }, []);

  const onChange = (k: string, v: any) => {
    setSettings(s => ({ ...s, [k]: v }));
  };

  const onSave = async () => {
    setMsg('');
    const res = await api<Settings>('/settings', { method: 'POST', body: JSON.stringify(settings) });
    if (res.data) setMsg('保存成功');
    else setMsg(res.message || '保存失败');
  };

  return (
    <div className="container" style={{ maxWidth: 980 }}>
      <div className="grid two">
        <Card title="通用设置">
          <div className="stack">
            <Input label="BAILIAN_API_KEY" placeholder="用于百炼 API 密钥" value={settings.BAILIAN_API_KEY || ''} onChange={e => onChange('BAILIAN_API_KEY', e.target.value)} />
          <Input label="AMAP_API_KEY" placeholder="用于高德地图 JSAPI" value={settings.AMAP_API_KEY || ''} onChange={e => onChange('AMAP_API_KEY', e.target.value)} />
          <Input label="XF_API_KEY" placeholder="用于科大讯飞语音识别" value={settings.XF_API_KEY || ''} onChange={e => onChange('XF_API_KEY', e.target.value)} />
          <Input label="XF_API_SECRET" placeholder="用于科大讯飞语音识别（Secret）" value={settings.XF_API_SECRET || ''} onChange={e => onChange('XF_API_SECRET', e.target.value)} />
          <Input label="XF_APP_ID" placeholder="用于科大讯飞应用ID" value={settings.XF_APP_ID || ''} onChange={e => onChange('XF_APP_ID', e.target.value)} />
          </div>
        </Card>

        <Card title="预算日均系数">
          <div className="grid two">
            <Input label="交通（BUDGET_PERDAY_TRANSPORT）" type="number" value={settings.BUDGET_PERDAY_TRANSPORT ?? ''} onChange={e => onChange('BUDGET_PERDAY_TRANSPORT', Number(e.target.value))} />
            <Input label="餐饮（BUDGET_PERDAY_FOOD）" type="number" value={settings.BUDGET_PERDAY_FOOD ?? ''} onChange={e => onChange('BUDGET_PERDAY_FOOD', Number(e.target.value))} />
            <Input label="娱乐（BUDGET_PERDAY_ENTERTAINMENT）" type="number" value={settings.BUDGET_PERDAY_ENTERTAINMENT ?? ''} onChange={e => onChange('BUDGET_PERDAY_ENTERTAINMENT', Number(e.target.value))} />
            <Input label="住宿（BUDGET_PERDAY_ACCOMMODATION）" type="number" value={settings.BUDGET_PERDAY_ACCOMMODATION ?? ''} onChange={e => onChange('BUDGET_PERDAY_ACCOMMODATION', Number(e.target.value))} />
          </div>
        </Card>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <Button variant="primary" onClick={onSave}>保存</Button>
        {msg && <span className="note">{msg}</span>}
      </div>
    </div>
  );
}